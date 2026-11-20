const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeDuration, matchesWorkerDuration, workerDayBaseRate, durationRate } = require('../src/utils/workerDuration');
const { calculatePoolTimer } = require('../src/utils/bookingSettings');

const worker = { availabilityType:'SHORT_PERIOD',availabilityHours:2,skills:[{rates:[{rate:400},{rate:800}]},{rates:[{rate:500}]}] };
test('Duration defaults to Full Day and rejects invalid choices',()=>{
 assert.equal(normalizeDuration(undefined),'FULL_DAY');
 assert.equal(normalizeDuration('3'),'3');
 assert.equal(normalizeDuration('5'),null);
 assert.equal(normalizeDuration('foo'),null);
});
test('Booking duration must exactly match worker availability',()=>{
 assert.ok(matchesWorkerDuration(worker,'2'));
 assert.ok(!matchesWorkerDuration(worker,'3'));
 assert.ok(!matchesWorkerDuration(worker,'FULL_DAY'));
 assert.ok(matchesWorkerDuration({availabilityType:'FULL_DAY'},'FULL_DAY'));
});
test('Worker 2-hour rate is same ₹100 on worker preview and customer checkout, unaffected by Pool 2',()=>{
 const poolTwoWorker={...worker,availabilityPoolSlot:{sortOrder:1,startTime:'09:00'}};
 assert.equal(workerDayBaseRate(poolTwoWorker),400);
 assert.equal(durationRate(poolTwoWorker,'2'),100);
 assert.equal(durationRate(poolTwoWorker,'3'),150);
 assert.equal(durationRate(poolTwoWorker,'FULL_DAY'),400);
 assert.equal(durationRate({...worker,skills:[]},'2'),null);
});
test('Timer based on entry, first pool or current schedule',()=>{
 const slots=[{startTime:'08:00',isActive:true},{startTime:'09:00',isActive:true},{startTime:'10:00',isActive:true}];
 const now=new Date('2026-11-14T04:00:00.000Z'); // 09:30 IST
 const entry=new Date('2026-11-14T04:00:00.000Z');
 assert.equal(calculatePoolTimer({poolTimerMode:'USER_ENTRY',poolSlots:slots},entry,now).elapsedSeconds,0);
 assert.equal(calculatePoolTimer({poolTimerMode:'FIRST_POOL',poolSlots:slots},entry,now).elapsedSeconds,5400);
 assert.equal(calculatePoolTimer({poolTimerMode:'CURRENT_POOL',poolSlots:slots},entry,now).elapsedSeconds,1800);
 const next=new Date('2026-11-14T04:35:00.000Z'); // 10:05 IST
 assert.equal(calculatePoolTimer({poolTimerMode:'CURRENT_POOL',poolSlots:slots},entry,next).elapsedSeconds,300);
});
