'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const crypto = require('node:crypto');
const Module = require('node:module');
const S = require('../src/services/contentTranslations');
const csrf = require('../src/utils/translationAdminCsrf');

const record = { id: 7, name: 'Rajesh', businessName: null, siteAddress: 'Old Dombivli Road' };
const languages = [
  {code:'en',name:'English',nativeName:'English',isDefault:true,isActive:true,sortOrder:1},
  {code:'mr',name:'Marathi',nativeName:'मराठी',isDefault:false,isActive:true,sortOrder:2},
  {code:'hi',name:'Hindi',nativeName:'हिंदी',isDefault:false,isActive:true,sortOrder:3},
];
const collections = {customer: [{ ...record, isVerified:true }, {id:8,name:'OTP Not Verified',isVerified:false}],worker:[],mitra:[],naka:[],city:[],state:[],skill:[],customerAddress:[]};
const table = [];
function db() {
  const fake = {appLanguage:{
    findMany:async ({where}={})=>languages.filter(l=>where?.isDefault === undefined || l.isDefault === where.isDefault).sort((a,b)=>a.sortOrder-b.sortOrder),
    findUnique:async ({where})=>languages.find(l=>l.code===where.code) || null,
    create:async ({data})=>{if(languages.some(l=>l.code===data.code))throw {code:'P2002'}; languages.push(data);return data;},
    update:async ({where,data})=>{const l=languages.find(l=>l.code===where.code);Object.assign(l,data);return l;},
  },contentTranslation:{
    findMany:async ({where}={})=>table.filter(r=> (!where.entityType || r.entityType===where.entityType) && (!where.entityId || (typeof where.entityId === 'object' ? where.entityId.in.includes(r.entityId) : r.entityId===where.entityId)) && (!where.languageCode || (typeof where.languageCode === 'object' ? where.languageCode.in.includes(r.languageCode):r.languageCode===where.languageCode))),
    upsert:async ({where,create,update})=>{let r=table.find(r=>Object.entries(where.entity_field_language).every(([k,v])=>r[k]===v));if(r)Object.assign(r,update);else table.push({...create});},
    deleteMany:async ({where})=>{for(let i=table.length-1;i>=0;i--)if(Object.entries(where).every(([k,v])=>table[i][k]===v))table.splice(i,1);},
  },$transaction: async fn=>fn(fake)};
  for(const [model, records] of Object.entries(collections)){
    fake[model]={
      findMany:async({where={},take,select}={})=>records.filter(r=>(!where.id || r.id>where.id.gt)&&(!('isVerified' in where)||r.isVerified===where.isVerified)).sort((a,b)=>a.id-b.id).slice(0,take||999).map(r=>select?Object.fromEntries(Object.keys(select).map(k=>[k,r[k]??null])):r),
      findUnique:async({where,select})=>{const r=records.find(r=>r.id===where.id);return r?(select?Object.fromEntries(Object.keys(select).map(k=>[k,r[k]??null])):r):null;}
    };
  }
  return fake;
}
const p=db();
test('Registry includes Customer/Worker/Mitra, address and all core masters without credentials',()=>{
  assert.deepEqual(Object.keys(S.ENTITY_DEFINITIONS),['CUSTOMER','WORKER','FIELD_AGENT','NAKA','CITY','STATE','SKILL','CUSTOMER_ADDRESS']);
  assert.equal(Object.values(S.ENTITY_DEFINITIONS).some(d=>Object.keys(d.fields).includes('phone')),false);
  assert.equal(Object.values(S.ENTITY_DEFINITIONS).some(d=>Object.keys(d.fields).includes('pincode')),false);
});
test('Missing translations are pending for all configured languages',()=>{
  const def=S.ENTITY_DEFINITIONS.CUSTOMER;
  const status=S.statusOf(record,def,'mr',new Map());
  assert.equal(status.state,'PENDING'); assert.equal(status.total,2);
});
test('Drafts never count as published',()=>{
  const rows=new Map([['mr:name',{status:'DRAFT',translatedValue:'राजेश',sourceHash:S.sourceHash(record.name)}]]);
  assert.equal(S.statusOf(record,S.ENTITY_DEFINITIONS.CUSTOMER,'mr',rows).state,'PENDING');
});
test('All required fields published count as complete',()=>{
  const rows=new Map(['name','siteAddress'].map(k=>[`mr:${k}`,{status:'PUBLISHED',translatedValue:'संपूर्ण',sourceHash:S.sourceHash(record[k])}]));
  assert.equal(S.statusOf(record,S.ENTITY_DEFINITIONS.CUSTOMER,'mr',rows).state,'COMPLETE');
});
test('Original address edit automatically marks old translation for review',()=>{
  const rows=new Map(['name','siteAddress'].map(k=>[`mr:${k}`,{status:'PUBLISHED',translatedValue:'संपूर्ण',sourceHash:S.sourceHash(record[k])}]));
  const changed={...record,siteAddress:'Kalyan East'};
  const s=S.statusOf(changed,S.ENTITY_DEFINITIONS.CUSTOMER,'mr',rows);
  assert.equal(s.state,'NEEDS_REVIEW');assert.equal(s.stale,1);
});
test('Unverified OTP-only customers are excluded from translation queue',async()=>{
  const q=await S.scanTranslationQueue(p);
  assert.equal(q.totalRecords,1);assert.equal(q.pendingRecords,1);assert.equal(q.items.length,1);assert.equal(q.items[0].title,'Rajesh');
});
test('Saved translations update the queue without altering source data',async()=>{
  for(const lang of ['mr','hi'])for(const key of ['name','siteAddress'])table.push({entityType:'CUSTOMER',entityId:7,fieldKey:key,languageCode:lang,sourceHash:S.sourceHash(record[key]),translatedValue:'Translated',status:'PUBLISHED'});
  const q=await S.scanTranslationQueue(p,{status:'COMPLETE'});
  assert.equal(q.completedRecords,1);assert.equal(q.pendingRecords,0);assert.equal(q.items.length,1);
  assert.equal(collections.customer[0].siteAddress,'Old Dombivli Road');
});
test('Adding new language automatically yields pending work without save-hook changes',async()=>{
  languages.push({code:'gu',name:'Gujarati',nativeName:'ગુજરાતી',isDefault:false,isActive:false,sortOrder:4});
  const q=await S.scanTranslationQueue(p,{language:'gu'});
  assert.equal(q.pendingRecords,1);
  assert.equal(q.items[0].checks[0].code,'gu');
});
test('CSRF requires a real session-bound token',()=>{
  const req={session:{},body:{}};
  const tok=csrf.token(req); assert.ok(tok.length>=48);
  assert.equal(csrf.valid(req),false);
  req.body._csrf=tok; assert.equal(csrf.valid(req),true);
  req.body._csrf=crypto.randomBytes(24).toString('hex');assert.equal(csrf.valid(req),false);
});
test('Language master cannot downgrade English or allow invalid code',async()=>{
  // Loads controller through a mocked PrismaClient without a live database.
  const original=Module._load;
  Module._load=function(name,parent,isMain){if(name==='@prisma/client')return {PrismaClient:class {constructor(){return p;}}};return original.call(this,name,parent,isMain);};
  let c; try {c=require('../src/controllers/languageAdminController');}finally{Module._load=original;}
  const req={params:{code:'en'},session:{},body:{name:'English changed',nativeName:'?',sortOrder:55}};
  req.body._csrf=csrf.token(req); let redirect;
  await c.update(req,{redirect:(url)=>redirect=url});
  assert.match(redirect,/success/);
  assert.equal(languages.find(l=>l.code==='en').isActive,true);
  assert.equal(languages.find(l=>l.code==='en').isDefault,true);
  assert.equal(languages.find(l=>l.code==='en').name,'English');
});
test('Translation save forbids incomplete publish and preserves original data',async()=>{
  const original=Module._load;
  Module._load=function(name,parent,isMain){if(name==='@prisma/client')return {PrismaClient:class {constructor(){return p;}}};return original.call(this,name,parent,isMain);};
  let c;try{c=require('../src/controllers/translationAdminController');}finally{Module._load=original;}
  const req={params:{type:'CUSTOMER',id:'7'},user:{id:1},session:{},body:{languageCode:'mr',action:'publish',translations:{name:'राजेश',siteAddress:''},sourceHashes:{name:S.sourceHash(record.name),siteAddress:S.sourceHash(record.siteAddress)}}};
  req.body._csrf=csrf.token(req);let redirect;
  await c.save(req,{redirect:(url)=>redirect=url});
  assert.match(redirect,/error/);
  assert.equal(collections.customer[0].name,'Rajesh');
});
test('Translations publish with valid hashes and become complete',async()=>{
  const c=require('../src/controllers/translationAdminController');
  const req={params:{type:'CUSTOMER',id:'7'},user:{id:1},session:{},body:{languageCode:'mr',action:'publish',translations:{name:'राजेश',siteAddress:'जुना डोंबिवली रस्ता'},sourceHashes:{name:S.sourceHash(record.name),siteAddress:S.sourceHash(record.siteAddress)}}};
  req.body._csrf=csrf.token(req);let redirect;
  await c.save(req,{redirect:(url)=>redirect=url});
  assert.match(redirect,/success/);
  assert.equal(table.find(r=>r.languageCode==='mr'&&r.fieldKey==='name').translatedValue,'राजेश');
  assert.equal(S.statusOf(record,S.ENTITY_DEFINITIONS.CUSTOMER,'mr',S.translationMap(table)).state,'COMPLETE');
});
test('Stale source hash rejects saving old translation',async()=>{
  const c=require('../src/controllers/translationAdminController');
  const req={params:{type:'CUSTOMER',id:'7'},session:{},body:{languageCode:'mr',action:'publish',translations:{name:'नवीन',siteAddress:'पत्ता'},sourceHashes:{name:'a'.repeat(64),siteAddress:S.sourceHash(record.siteAddress)}}};
  req.body._csrf=csrf.token(req);let redirect;
  await c.save(req,{redirect:(url)=>redirect=url});
  assert.match(redirect,/error/);
  assert.equal(table.find(r=>r.languageCode==='mr'&&r.fieldKey==='name').translatedValue,'राजेश');
});

// Minimal EJS-compatible compiler to syntax-check all templates without npm deps.
function compileEjsFile(file, vars){
  const src=fs.readFileSync(file,'utf8');
  const rx=/<%([=-]?)([\s\S]*?)%>/g;
  let body='let __out="";with(locals){\n';let last=0,m;
  while((m=rx.exec(src))){
    body+=`__out+=${JSON.stringify(src.slice(last,m.index))};\n`;
    const js=m[2];
    if(m[1]==='='||m[1]==='-')body+=`__out+=String((${js})??'');\n`;
    else body+=`${js}\n`;
    last=rx.lastIndex;
  }
  body+=`__out+=${JSON.stringify(src.slice(last))};}\nreturn __out;`;
  return new Function('locals',body)(vars);
}
test('Admin Language and Translation templates render with actual sample data',async()=>{
  const base=path.join(__dirname,'..','views','admin');
  const l=compileEjsFile(path.join(base,'languages/index.ejs'),{languages,csrf:'abc',success:null,error:null});
  assert.match(l,/English/);assert.match(l,/Marathi/);
  const q=await S.scanTranslationQueue(p,{status:'ALL'});
  const list=compileEjsFile(path.join(base,'translations/index.ejs'),{...q,entities:S.ENTITY_DEFINITIONS,success:null,error:null});
  assert.match(list,/Rajesh/);
  const entity=await S.getEntity(p,'CUSTOMER',7);
  const rows=table.filter(r=>r.entityId===7);
  const allLang=await p.appLanguage.findMany();
  const targets=allLang.filter(l=>!l.isDefault).map(l=>({ ...l,check:S.statusOf(entity.record,entity.def,l.code,S.translationMap(rows)),fields:S.requiredFields(entity.record,entity.def).map(key=>({key,label:entity.def.fields[key],original:entity.record[key],hash:S.sourceHash(entity.record[key]),value:rows.find(r=>r.languageCode===l.code&&r.fieldKey===key)?.translatedValue||'',stale:false,savedStatus:null}))}));
  const editor=compileEjsFile(path.join(base,'translations/editor.ejs'),{entityType:'CUSTOMER',id:7,record:entity.record,def:entity.def,required:S.requiredFields(entity.record,entity.def),targets,languages:allLang,addressSources:[],csrf:'abc',success:null,error:null});
  assert.match(editor,/Publish Marathi/); assert.match(editor,/Rajesh/);
});

test('Customer translation editor includes separately saved CustomerAddress and its translatable fields', async () => {
  const c = require('../src/controllers/translationAdminController');
  const address = { id: 9, customerId: 7, isDefault: true, title: 'Demo Work Site', addressLine: 'Chakki naka, Dombivli', addressDetail: 'Near station', landmark: 'Chakki naka', city: 'Dombivli', pincode: '421202', nakaName: 'Chakki naka' };
  collections.customerAddress.push(address);
  let view, props;
  try {
    await c.editor({params:{type:'CUSTOMER',id:'7'},query:{},session:{}}, {render:(v, p)=>{view=v;props=p;}});
    assert.equal(view,'admin/translations/editor');
    assert.equal(props.addressSources[0].addressLine, 'Chakki naka, Dombivli');
    const mr = props.targets.find(l=>l.code==='mr');
    assert.equal(mr.addresses.length,1);
    assert.ok(mr.addresses[0].fields.some(f=>f.key==='addressLine'));
    assert.ok(mr.check.total >= 6);
    const html = compileEjsFile(path.join(__dirname,'..','views','admin','translations','editor.ejs'),props);
    assert.match(html,/Chakki naka, Dombivli/);
    assert.match(html,/Customer saved addresses/);
    assert.match(html,/translations\[addressLine\]/);
    assert.match(html,/returnCustomerId/);
  } finally {collections.customerAddress.pop();}
});
test('Saving linked work address returns to same customer and language without changing source address', async () => {
  const c = require('../src/controllers/translationAdminController');
  const address = { id: 9, customerId: 7, isDefault: true, title: 'Demo Work Site', addressLine: 'Chakki naka, Dombivli', addressDetail: null, landmark: null };
  collections.customerAddress.push(address);
  const req={params:{type:'CUSTOMER_ADDRESS',id:'9'},user:{id:1},session:{},body:{
    returnCustomerId:'7',languageCode:'mr',action:'publish',
    translations:{title:'कार्यस्थळ',addressLine:'चक्की नाका, डोंबिवली'},
    sourceHashes:{title:S.sourceHash(address.title),addressLine:S.sourceHash(address.addressLine)}
  }};
  req.body._csrf=csrf.token(req);
  let redirect;
  try {
    await c.save(req,{redirect:url=>{redirect=url;}});
    assert.match(redirect,/^\/admin\/translations\/CUSTOMER\/7\?tab=mr&success=/);
    assert.equal(address.addressLine,'Chakki naka, Dombivli');
    assert.ok(table.some(r=>r.entityType==='CUSTOMER_ADDRESS'&&r.entityId===9&&r.fieldKey==='addressLine'&&r.status==='PUBLISHED'));
  } finally {
    collections.customerAddress.pop();
    for(let i=table.length-1;i>=0;i--)if(table[i].entityType==='CUSTOMER_ADDRESS'&&table[i].entityId===9)table.splice(i,1);
  }
});
