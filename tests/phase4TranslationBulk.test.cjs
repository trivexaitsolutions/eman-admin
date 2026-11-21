'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const files = require('../src/services/translationBulkFiles');
const bulk = require('../src/services/translationBulk');
const S = require('../src/services/contentTranslations');
process.env.TRANSLATION_IMPORT_SECRET = 'phase4-test-secret-used-only-in-unit-tests';
const langs=[{code:'en',name:'English',isDefault:true,isActive:true,sortOrder:1},
 {code:'mr',name:'Marathi',isDefault:false,isActive:true,sortOrder:2},
 {code:'hi',name:'Hindi',isDefault:false,isActive:true,sortOrder:3}];
const data={
 customer:[{id:13,name:'Demo Customer',businessName:null,siteAddress:null,isVerified:true},
 {id:14,name:'OTP Pending',siteAddress:null,businessName:null,isVerified:false}],
 customerAddress:[{id:9,customerId:13,title:'Demo Work Site',addressLine:'Chakki naka, Dombivli',addressDetail:null,landmark:'Station East'}],
 skill:[{id:1,name:'Plumbing',description:null}],naka:[{id:1,name:'Station East',landmark:'Railway Bridge'}],
 worker:[],city:[],state:[],mitra:[],
};
const translated=[];
const match=(r,where)=>Object.entries(where||{}).every(([k,v])=>{
  if(k==='id' && v && typeof v==='object')return v.gt===undefined || r.id>v.gt;
  if(v && typeof v==='object' && v.in)return v.in.includes(r[k]);
  return r[k]===v;
});
const fake={
 appLanguage:{findMany:async({where}={})=>langs.filter(l=>match(l,where)).sort((a,b)=>a.sortOrder-b.sortOrder)},
 contentTranslation:{
   findMany:async({where}={})=>translated.filter(r=>match(r,where)),
   upsert:async({where,create,update})=>{
     let r=translated.find((s)=>match(s,where.entity_field_language));
     if(r)Object.assign(r,update);else translated.push({...create});
   }
 },
 $transaction:async fn=>fn(fake)
};
for(const [model,rows] of Object.entries(data)) fake[model]={
 findMany:async({where={},select,orderBy,take}={})=>rows.filter(r=>match(r,where)).sort((a,b)=>a.id-b.id).slice(0,take||999).map(r=>select?Object.fromEntries(Object.keys(select).map(k=>[k,r[k]??null])):r),
 findUnique:async({where,select})=>{
  const r=rows.find(x=>match(x,where));
  return r?(select?Object.fromEntries(Object.keys(select).map(k=>[k,r[k]??null])):r):null;
 }
};
const fresh = () => translated.splice(0);
const targetCol=(grid,code)=>grid[0].findIndex(h=>h.endsWith('['+code+']'));

test('CSV and XLSX UTF-8 round trip, multilingual text & commas',()=>{
 const grid=[[...files.FIXED_HEADERS,'Marathi [mr]'],['SKILL','1','','Plumbing','name','Plumbing','h','token','प्लंबिंग'],
  ['NAKA','2','','Example','landmark','Main St, East','h','token','नाका, पूर्व']];
 assert.deepEqual(files.fromCSV(files.toCSV(grid)),grid);
 assert.deepEqual(files.fromXLSX(files.toXLSX(grid)),grid);
});
test('export groups customer and addresses without OTP-unverified customer',async()=>{
 const out=await bulk.exportGrid(fake,{status:'PENDING'});
 const t=out.grid.map(r=>r[0]);
 assert.ok(t.includes('CUSTOMER'));assert.ok(t.includes('CUSTOMER_ADDRESS'));
 assert.ok(!out.grid.some(r=>r[3]==='OTP Pending'));
 assert.ok(out.grid.some(r=>r[0]==='NAKA' && r[4]==='landmark'));
 assert.ok(out.grid.some(r=>r[0]==='SKILL' && r[5]==='Plumbing'));
 assert.deepEqual(out.languages.map(l=>l.code),['mr','hi']);
 assert.equal(out.exportedRecords,3); // Customer (incl address), Naka, Skill
});
test('import in publish mode only publishes complete language groups',async()=>{
 fresh();const out=await bulk.exportGrid(fake,{status:'ALL'}),grid=out.grid;
 const mr=targetCol(grid,'mr');
 for(const r of grid.slice(1)) if(r[0]==='SKILL')r[mr]='प्लंबिंग';
 const result=await bulk.importGrid(fake,grid,{mode:'publish',adminId:1});
 assert.equal(result.published,1);
 assert.ok(translated.some(t=>t.entityType==='SKILL' && t.status==='PUBLISHED' && t.translatedValue==='प्लंबिंग'));
 assert.equal(data.skill[0].name,'Plumbing');
});
test('incomplete group stays Draft, not published',async()=>{
 fresh();const grid=(await bulk.exportGrid(fake,{type:'NAKA',status:'ALL'})).grid,mr=targetCol(grid,'mr');
 for(const r of grid.slice(1))if(r[0]==='NAKA' && r[4]==='name')r[mr]='स्टेशन पूर्व';
 const result=await bulk.importGrid(fake,grid,{mode:'publish'});
 assert.ok(result.drafts===1);
 assert.equal(translated.find(t=>t.entityType==='NAKA')?.status,'DRAFT');
});
test('published existing text cannot overwrite unless approved',async()=>{
 fresh(); const original=await bulk.exportGrid(fake,{type:'SKILL',status:'ALL'}),g=original.grid,mr=targetCol(g,'mr');
 g[1][mr]='प्लंबिंग';await bulk.importGrid(fake,g,{mode:'publish'});
 g[1][mr]='प्लम्बर';
 const blocked=await bulk.importGrid(fake,g,{mode:'publish',overwrite:false});
 assert.equal(translated[0].translatedValue,'प्लंबिंग');assert.ok(blocked.skipped>=1);
 const replaced=await bulk.importGrid(fake,g,{mode:'publish',overwrite:true});
 assert.equal(translated[0].translatedValue,'प्लम्बर');assert.ok(replaced.updated>=1);
});
test('stale source hash and tampered record identity are rejected',async()=>{
 fresh();const g=(await bulk.exportGrid(fake,{type:'SKILL',status:'ALL'})).grid,mr=targetCol(g,'mr');
 g[1][mr]='प्लंबिंग';g[1][1]='999';
 const tampered=await bulk.importGrid(fake,g,{mode:'publish'});
 assert.equal(tampered.added,0);assert.ok(tampered.errors.some(e=>e.includes('signature')));
 g[1][1]='1';data.skill[0].name='New Plumbing';
 const stale=await bulk.importGrid(fake,g,{mode:'publish'});
 assert.equal(stale.added,0);assert.ok(stale.skipped>0);
 data.skill[0].name='Plumbing';
});
test('wrong header/unknown language and formula cell are rejected',async()=>{
 const grid=(await bulk.exportGrid(fake,{type:'SKILL',status:'ALL'})).grid;
 await assert.rejects(()=>bulk.importGrid(fake,[['Bad',...grid[0].slice(1)],...grid.slice(1)]),/Wrong template/);
 const altered=grid.map(row=>[...row]);altered[0][8]='Gujarati [gu]';
 await assert.rejects(()=>bulk.importGrid(fake,altered),/Unknown or duplicate/);
 const xmlfiles=files.toXLSX(grid);
 assert.deepEqual(files.fromXLSX(xmlfiles),grid);
});
