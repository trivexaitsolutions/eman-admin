'use strict';
const crypto = require('node:crypto');
const { ENTITY_DEFINITIONS, QUEUE_ENTITY_TYPES, requiredFields, normalizeSource, sourceHash,
  statusOf, translationMap, getEntity } = require('./contentTranslations');
const files = require('./translationBulkFiles');
const SELECT_CHUNK = 150;
const MAX_EXPORT = 20000;
const hashKey = () => process.env.TRANSLATION_IMPORT_SECRET || process.env.JWT_SECRET;
function signature(type, id, field, hash) {
  const secret = hashKey();
  if (!secret || secret.length < 12) throw new Error('Set JWT_SECRET (or TRANSLATION_IMPORT_SECRET) in the backend .env to enable signed import/export.');
  return crypto.createHmac('sha256', secret).update(JSON.stringify([type, id, field, hash])).digest('hex');
}
function equalSignature(a, b) {
  if (!/^[a-f0-9]{64}$/i.test(a || '') || !/^[a-f0-9]{64}$/i.test(b || '')) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}
function select(def) { return Object.fromEntries(['id', ...Object.keys(def.fields)].map((x) => [x, true])); }
function key(type, id) { return `${type}:${id}`; }
const validFilter = (s, options, fallback) => options.includes(s) ? s : fallback;
async function exportGrid(prisma, {type='ALL', language='ALL', status='PENDING'}={}) {
  // Do not support arbitrary model/table names supplied through the query.
  type = validFilter(type, ['ALL', ...QUEUE_ENTITY_TYPES], 'ALL');
  status = validFilter(status, ['ALL','COMPLETE','PENDING'], 'PENDING');
  const languages = await prisma.appLanguage.findMany({
    where: {isDefault:false}, orderBy:[{sortOrder:'asc'},{code:'asc'}],
  });
  const targets = language === 'ALL' ? languages : languages.filter((l)=>l.code===language);
  if (!targets.length) throw new Error('No translation target languages selected.');
  const headers = [...files.FIXED_HEADERS, ...targets.map(files.langHeader)];
  const out = [headers];
  let exportedRecords = 0;
  for (const entityType of QUEUE_ENTITY_TYPES) {
    if (type !== 'ALL' && type !== entityType) continue;
    const def = ENTITY_DEFINITIONS[entityType];
    let lastId = 0;
    for (;;) {
      const records = await prisma[def.model].findMany({
        where:{...(def.where||{}),id:{gt:lastId}}, select:select(def),
        orderBy:{id:'asc'},take:SELECT_CHUNK,
      });
      if (!records.length) break;
      lastId = records[records.length-1].id;
      let entities = records.map((r)=>({type:entityType, record:r, parentId:'',parent: r}));
      if (entityType === 'CUSTOMER') {
        const addrDef = ENTITY_DEFINITIONS.CUSTOMER_ADDRESS;
        const addresses = await prisma.customerAddress.findMany({
          where:{customerId:{in:records.map((r)=>r.id)}},
          select:{...select(addrDef),customerId:true},
        });
        entities.push(...addresses.map((r)=>({type:'CUSTOMER_ADDRESS',record:r,parentId:r.customerId,
          parent:records.find((c)=>c.id===r.customerId)})));
      }
      const translations = new Map();
      for (const kind of [...new Set(entities.map((x)=>x.type))]) {
        const matching = entities.filter((e)=>e.type===kind);
        const rows = await prisma.contentTranslation.findMany({
          where:{entityType:kind,entityId:{in:matching.map((e)=>e.record.id)},
            languageCode:{in:targets.map((l)=>l.code)}},
          select:{entityId:true,fieldKey:true,languageCode:true,translatedValue:true,sourceHash:true,status:true},
        });
        for (const row of rows) {
          const id=key(kind,row.entityId);
          if (!translations.has(id)) translations.set(id,[]);
          translations.get(id).push(row);
        }
      }
      // Group customer and saved addresses into one logical record before filtering.
      for (const record of records) {
        const parts = entities.filter((e)=>e.parent.id===record.id);
        if (!parts.some((e)=>requiredFields(e.record,ENTITY_DEFINITIONS[e.type]).length)) continue;
        const checks=targets.map((l)=>parts.map((e)=>statusOf(e.record,ENTITY_DEFINITIONS[e.type],l.code,
          translationMap(translations.get(key(e.type,e.record.id))||[]))));
        const complete=checks.every((pieces)=>pieces.every((c)=>c.state==='COMPLETE'||c.state==='EMPTY'));
        if (status==='PENDING' && complete || status==='COMPLETE' && !complete) continue;
        exportedRecords++;
        for (const part of parts) {
          const entityDef=ENTITY_DEFINITIONS[part.type], map=translationMap(translations.get(key(part.type,part.record.id))||[]);
          for (const field of requiredFields(part.record,entityDef)) {
            const original=normalizeSource(part.record[field]), hash=sourceHash(original);
            const title=part.type==='CUSTOMER_ADDRESS'
              ? `Customer #${record.id} · ${entityDef.title(part.record)}` : entityDef.title(part.record);
            const values=targets.map((l)=>{
              const saved=map.get(`${l.code}:${field}`);
              return saved?.sourceHash===hash && ['PUBLISHED','DRAFT'].includes(saved.status) ? saved.translatedValue : '';
            });
            out.push([part.type,String(part.record.id),part.parentId?String(part.parentId):'',title,field,original,hash,
              signature(part.type,part.record.id,field,hash),...values]);
            if (out.length>MAX_EXPORT+1) throw new Error('More than 20,000 fields. Apply a narrower record type or language filter.');
          }
        }
      }
    }
  }
  return {grid:out,languages:targets,exportedRecords,exportedFields:out.length-1};
}
function checkHeaders(head, languages) {
  const fields = files.FIXED_HEADERS;
  if (head.length < fields.length+1 || head.length > 64 || fields.some((v,i)=>String(head[i]||'').trim()!==v))
    throw new Error('Wrong template. Export a fresh E-MAN Translation file; do not edit or reorder the first eight columns.');
  const byCode=new Map(languages.filter((l)=>!l.isDefault).map((l)=>[l.code,l]));
  const codes=[];
  for (let j=fields.length;j<head.length;j++) {
    const c=files.langCode(head[j]);
    if (!c || !byCode.has(c) || codes.includes(c)) throw new Error(`Unknown or duplicate translation column: ${head[j]||'(blank)'}`);
    codes.push(c);
  }
  return codes;
}
function isDangerousText(text) { return /^[\s\x00-\x1f]*[=+@]/.test(text); }
function summaryError(report,row,why) { report.skipped++; if(report.errors.length<60) report.errors.push(row > 0 ? `Row ${row}: ${why}` : why); }
async function importGrid(prisma,grid,{mode='draft',overwrite=false,adminId=null}={}) {
  const report={rows:Math.max(0,grid.length-1),languages:[],groups:0,published:0,drafts:0,
    added:0,updated:0,unchanged:0,skipped:0,errors:[]};
  if (!['draft','publish'].includes(mode)) throw new Error('Unknown import mode.');
  const languages=await prisma.appLanguage.findMany({where:{isDefault:false}});
  const codes=checkHeaders(grid[0]||[],languages); report.languages=codes;
  const grouped=new Map(), seenRows=new Set();
  for(let i=1;i<grid.length;i++) {
    const r=grid[i],n=i+1,type=String(r[0]||'').trim(), idText=String(r[1]||'').trim(),
      field=String(r[4]||'').trim(), original=String(r[5]||''), hash=String(r[6]||'').trim(),
      sig=String(r[7]||'').trim();
    const id=Number(idText);
    if (!Object.prototype.hasOwnProperty.call(ENTITY_DEFINITIONS,type) || !/^\d+$/.test(idText) || !Number.isSafeInteger(id) || id<1 ||
      !Object.prototype.hasOwnProperty.call(ENTITY_DEFINITIONS[type].fields,field) || !/^[a-f\d]{64}$/i.test(hash)) {
      summaryError(report,n,'Invalid record ID/type/field/hash.');continue;
    }
    const rowIdentity=`${type}:${id}:${field}`;
    if(seenRows.has(rowIdentity)){summaryError(report,n,'Duplicate record-field row in file.');continue;}
    seenRows.add(rowIdentity);
    if(!equalSignature(sig,signature(type,id,field,hash))) {summaryError(report,n,'Row signature invalid. Keep the ID, field and token columns unchanged.');continue;}
    for(let j=0;j<codes.length;j++) {
      const value=String(r[files.FIXED_HEADERS.length+j]??'').trim(),code=codes[j];
      if(!value) continue;
      if(value.length>2000 || isDangerousText(value)){summaryError(report,n,`Invalid ${code} translation (length/formula-like content).`);continue;}
      const gid=`${type}:${id}:${code}`;
      if(!grouped.has(gid))grouped.set(gid,{type,id,code,fields:new Map()});
      grouped.get(gid).fields.set(field,{value,hash,original,row:n});
    }
  }
  for(const group of grouped.values()) {
    report.groups++;
    try {
      // Each entity-language is transactional, so a complete publish cannot be partially applied.
      const outcome=await prisma.$transaction(async(tx)=>{
        const entity=await getEntity(tx,group.type,group.id);
        if(!entity) return {error:'Original record no longer exists.'};
        if(group.type==='CUSTOMER_ADDRESS') {
          const address=await tx.customerAddress.findUnique({where:{id:group.id},select:{customerId:true}});
          const owner=address && await tx.customer.findUnique({where:{id:address.customerId},select:{isVerified:true}});
          if(!owner?.isVerified) return {error:'Address has no verified Customer.'};
        }
        const {record,def}=entity, required=requiredFields(record,def);
        const exists=await tx.contentTranslation.findMany({where:{entityType:group.type,entityId:group.id,languageCode:group.code}});
        const saved=translationMap(exists);
        const input=new Map();let ignored=0, unchanged=0;const warnings=[];
        for(const [field,data] of group.fields) {
          const current=normalizeSource(record[field]);
          if(!current || sourceHash(current)!==data.hash) {ignored++; warnings.push(`Row ${data.row}: original source changed. Re-export this record.`);continue;}
          const old=saved.get(`${group.code}:${field}`);
          if(old && old.sourceHash===data.hash && old.status==='PUBLISHED' && old.translatedValue!==data.value && !overwrite){ignored++;warnings.push(`Row ${data.row}: published translation protected. Enable overwrite to replace it.`);continue;}
          if(old && old.sourceHash===data.hash && old.status==='PUBLISHED' && old.translatedValue===data.value){unchanged++;continue;}
          input.set(field,data.value);
        }
        const finalValue=(field)=>{
          if(input.has(field))return input.get(field);
          const old=saved.get(`${group.code}:${field}`);
          return old?.sourceHash===sourceHash(record[field])?normalizeSource(old.translatedValue):'';
        };
        const canPublish=mode==='publish' && required.length && required.every((field)=>finalValue(field));
        let added=0,updated=0;
        const fieldsToWrite=canPublish?required: [...input.keys()];
        for(const field of fieldsToWrite){
          const value=finalValue(field),hash=sourceHash(record[field]);
          if(!value) continue;
          const old=saved.get(`${group.code}:${field}`);
          const nextStatus=canPublish?'PUBLISHED':'DRAFT';
          if(old && old.sourceHash===hash && old.translatedValue===value && old.status===nextStatus)continue;
          const where={entity_field_language:{entityType:group.type,entityId:group.id,fieldKey:field,languageCode:group.code}};
          const data={translatedValue:value,sourceHash:hash,status:nextStatus,updatedById:adminId};
          await tx.contentTranslation.upsert({where,create:{entityType:group.type,entityId:group.id,fieldKey:field,languageCode:group.code,...data},update:data});
          if(old)updated++;else added++;
        }
        return {added,updated,ignored,unchanged,warnings,published:canPublish && (added||updated),draft:!canPublish && (added||updated)};
      });
      if(outcome.error){summaryError(report,0,`${group.type} #${group.id} (${group.code}): ${outcome.error}`);continue;}
      report.added+=outcome.added;report.updated+=outcome.updated;report.unchanged+=outcome.unchanged;
      report.skipped+=outcome.ignored;
      for(const warning of outcome.warnings||[])if(report.errors.length<60)report.errors.push(warning);
      if(outcome.published)report.published++;
      if(outcome.draft)report.drafts++;
    }catch(e){
      console.error('[Translation bulk] group failed:',group.type,group.id,group.code,e);
      summaryError(report,0,`${group.type} #${group.id} (${group.code}) could not be saved.`);
    }
  }
  return report;
}
module.exports={exportGrid,importGrid,signature,checkHeaders};
