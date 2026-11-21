'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const routes = {};
const records = {SKILL:{ id: 7, name: 'Plumbing', description: 'Pipe repair' },NAKA:{ id: 1, name: 'Station East', landmark: 'Station road' }};
const hash = val => crypto.createHash('sha256').update(String(val).trim()).digest('hex');
const row = (entityType, entityId, fieldKey, src, val, status='PUBLISHED') => ({entityType,entityId,fieldKey,sourceHash:hash(src),translatedValue:val,status});
let published = [row('NAKA',1,'name','Station East','स्टेशन पूर्व'), row('NAKA',1,'landmark','OLD ROAD','जुना रस्ता'), row('SKILL',7,'name','Plumbing','नळकाम'),row('CUSTOMER',13,'name','Private Name','खाजगी नाव')];
const prisma={
 appLanguage: {findMany:async()=>[{code:'en',name:'English',nativeName:'English',isDefault:true,isActive:true},{code:'mr',name:'Marathi',nativeName:'मराठी',isDefault:false,isActive:true}], findFirst:async ({where})=>where.code==='mr'||where.code==='en'?{code:where.code}:null},
 contentTranslation:{findMany:async({where})=>published.filter(r=>where.entityType.in.includes(r.entityType)&&r.status===where.status&&r.status==='PUBLISHED')},
 naka:{findMany:async()=>[records.NAKA]}, skill:{findMany:async()=>[records.SKILL]},
 city:{findMany:async()=>[]},state:{findMany:async()=>[]},
};
const service={ENTITY_DEFINITIONS:{NAKA:{model:'naka',fields:{name:'Naka Name',landmark:'Landmark'}},SKILL:{model:'skill',fields:{name:'Skill Name',description:'Description'}},CITY:{model:'city',fields:{name:'City Name'}},STATE:{model:'state',fields:{name:'State Name'}}}};
const sandbox={module:{exports:{}},console,require:(name)=>{
 if(name==='express')return {Router:()=>({get:(url,fn)=>routes[url]=fn})};
 if(name==='@prisma/client')return {PrismaClient:function(){return prisma}};
 if(name==='node:crypto')return crypto;
 if(name==='../../services/contentTranslations')return service;
 throw Error('Unexpected import '+name);
}};
const code=fs.readFileSync(path.join(__dirname,'../src/routes/api/languagePublicRoutes.js'),'utf8');
vm.runInNewContext(code,sandbox);
async function call(url,query={}){
 let status=200,headers={},result=null;
 await routes[url]({query},{set:(key,val)=>headers[key]=val,status(code){status=code;return this},json(value){result=value;return this}});
 return {status,body:result,headers};
}
(async()=>{
 const l=await call('/languages');assert.equal(l.status,200);assert.equal(l.body.languages.length,2);
 const c=await call('/catalog',{language:'mr'});assert.equal(c.status,200);
 assert.equal(c.body.translations['NAKA:1:name'],'स्टेशन पूर्व');
 assert.equal(c.body.translations['SKILL:7:name'],'नळकाम');
 assert.equal(c.body.translations['NAKA:1:landmark'],undefined,'Stale source translation must be skipped');
 assert.equal(c.body.translations['CUSTOMER:13:name'],undefined,'Private customer translation cannot be public');
 const v = await call('/version',{language:'mr'});
 assert.equal(v.status,200);
 assert.equal(v.body.version,c.body.version);
 assert.equal(v.body.translations,undefined,'Version API must never return the catalog');
 const before = v.body.version;
 // New published content changes the digest without a schema migration.
 published.push(row('SKILL',7,'description','Pipe repair','पाईप दुरुस्ती'));
 const publishedUpdate = await call('/version',{language:'mr'});
 assert.notEqual(publishedUpdate.body.version,before,'Publishing changes translation version');
 published.pop();
 // Original master changes invalidate the old translation and the digest.
 records.SKILL.name = 'Plumbing updated';
 const changedSource = await call('/catalog',{language:'mr'});
 assert.equal(changedSource.body.translations['SKILL:7:name'],undefined);
 assert.notEqual(changedSource.body.version,before,'Editing original data changes translation version');
 records.SKILL.name = 'Plumbing';
 const invalid=await call('/catalog',{language:'../../mr'});assert.equal(invalid.status,400);
 const off=await call('/catalog',{language:'gu'});assert.equal(off.status,404);
 console.log('Public i18n API: catalog, version digest, source hash, privacy checks passed');
})().catch(e=>{console.error(e);process.exitCode=1});
