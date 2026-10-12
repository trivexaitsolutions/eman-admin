// Minimal no-database allocation regression test. Run: node scripts/testSimulatorAllocations.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const src = fs.readFileSync(path.join(__dirname, '../src/controllers/adminSimulatorController.js'), 'utf8');
const campaign = { id: 1, status: 'RUNNING', mode: 'MANUAL', maxWorkers: 200 };
const rows = [];
const workers = Array.from({length:200}, (_, i) => ({id:i+1,name:`Demo ${i+1}`,phone:String(i+1).padStart(10,'0'),isDemo:true,isActive:true}));
let nextId = 1;
function matches(v, where) { return Object.entries(where || {}).every(([k,w]) => k === 'campaign' ? ['RUNNING','PAUSED'].includes(campaign.status) : v[k] === w); }
function sortRows(rs) { return rs.slice().sort((a,b)=>a.slotIndex-b.slotIndex); }
const db = {
 simulatorCampaign:{ findUnique:async()=>campaign },
 simulatorInstance:{
  findMany:async({where={},orderBy}={})=>{const q=rows.filter(v=>matches(v,where));return orderBy?sortRows(q):q;},
  count:async({where})=>rows.filter(v=>matches(v,where)).length,
  create:async({data})=>{const r={id:nextId++,...data}; rows.push(r);return r;},
  deleteMany:async({where})=>{const prev=rows.length;for(let i=rows.length-1;i>=0;i--){const row=rows[i];if(Object.entries(where).every(([k,v])=>k==='id'?v.in.includes(row.id):row[k]===v))rows.splice(i,1)}return {count:prev-rows.length}},
  findFirst:async({where})=>rows.find(v=>matches(v,where)),
 },
 worker:{findMany:async({where,select,orderBy,take})=>workers.filter(w=>w.isDemo&&w.isActive&& (where.id?.notIn?!where.id.notIn.includes(w.id):where.id?.in?where.id.in.includes(w.id):true)).slice(0,take||200)},
 $transaction:async(fn)=>fn(db),
};
const sandbox={process:{env:{SIMULATOR_ENABLED:'true',JWT_SECRET:'a'.repeat(32),NODE_ENV:'development'}},console,require:(id)=>{
 if(id==='@prisma/client')return {PrismaClient:class{constructor(){return db}},Prisma:{TransactionIsolationLevel:{Serializable:'Serializable'}}};
 if(id==='../utils/bookingSettings')return {getActivePoolContext:async()=>({isOpen:true})};
 if(id==='../utils/arrivalCodes')return {issueArrivalCodes:()=>({codes:new Map(),expiresAt:''})};
 if(id==='./workerController')return {updateStatus:async()=>{}};
 if(id==='./bookingController')return {submitClientRatingByWorker:async()=>{}};
 throw Error(id);
 },module:{exports:{}}};
vm.runInNewContext(src,sandbox);
const ctrl=sandbox.module.exports;
async function call(fn,params={},body={},query={}) {
 let code=200, result=null;
 const res={status(n){code=n;return this},json(v){result=v;return this},send(v){result=v;return this}};
 await fn({params,body,query,user:{id:1}},res);
 return {code,result};
}
(async()=>{
 const dev1='browser_aaaaaaaaaaaaaaaa',dev2='browser_bbbbbbbbbbbbbbbb';
 let a=await call(ctrl.claim,{id:1},{deviceId:dev1,count:20});
 let b=await call(ctrl.claim,{id:1},{deviceId:dev2,count:20});
 assert.equal(a.result.instances.length,20); assert.equal(b.result.instances.length,20);
 assert.equal(new Set(rows.map(v=>v.workerId)).size,40,'Unique worker per claim');
 let repeated=await call(ctrl.claim,{id:1},{deviceId:dev1,count:20});
 assert.equal(repeated.result.instances.length,20); assert.equal(rows.length,40,'Idempotent allocation');
 a=await call(ctrl.claim,{id:1},{deviceId:dev1,count:5});
 assert.equal(a.result.instances.length,5);assert.equal(rows.length,25,'Shrink releases unused slots');
 b=await call(ctrl.claim,{id:1},{deviceId:dev2,count:21});
 assert.equal(b.code,400,'Per browser cap enforced');
 await call(ctrl.release,{id:1},{deviceId:dev1});
 assert.equal(rows.length,20,'Release scoped to this device only');
 for (let j=3; j<=11; j++) {
   const device = `browser_${String(j).padStart(16,'c')}`;
   const next = await call(ctrl.claim,{id:1},{deviceId:device,count:20});
   assert.equal(next.result.instances.length,20);
 }
 assert.equal(rows.length,200,'10 active PCs x 20 claims = 200');
 const overflow=await call(ctrl.claim,{id:1},{deviceId:'browser_overflowggggg',count:20});
 assert.equal(overflow.result.instances.length,0,'Global capacity 200');
 console.log('Simulator claims: 2 PCs, max20, idempotence, shrink, release tests PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
