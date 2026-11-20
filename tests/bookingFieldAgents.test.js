const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveBookingFieldAgents } = require('../src/utils/bookingFieldAgents');
const agent = (id) => ({ id, name: `Agent ${id}`, phone: `900000000${id}`, isActive: true });

test('worker assigned agent takes priority over customer onboarding agent', () => {
  const agents = resolveBookingFieldAgents({ bookedWorkers:[{id:17}], workersWithMitra:[{id:17,mitra:agent(5)}], customerMitra:agent(6) });
  assert.equal(agents[0].id,5);
  assert.equal(agents[0].source,'WORKER');
  assert.deepEqual(agents[0].workerIds,[17]);
});
test('multiple workers from same agent return one contact', () => {
  const agents = resolveBookingFieldAgents({ bookedWorkers:[{id:17},{id:18}], workersWithMitra:[{id:17,mitra:agent(5)},{id:18,mitra:agent(5)}] });
  assert.equal(agents.length,1);
  assert.deepEqual(agents[0].workerIds,[17,18]);
});
test('different worker agents both appear, cancelled workers excluded', () => {
  const input = {bookedWorkers:[{id:17},{id:18}],workersWithMitra:[{id:17,mitra:agent(5)},{id:18,mitra:agent(6)}]};
  assert.equal(resolveBookingFieldAgents(input).length,2);
  assert.deepEqual(resolveBookingFieldAgents({...input,cancelledWorkerIds:[17]}).map(a=>a.id),[6]);
});
test('fallback to customer agent and nearby naka agent only when no worker contact', () => {
  const empty = {bookedWorkers:[{id:17}],workersWithMitra:[{id:17,mitra:null}]};
  assert.equal(resolveBookingFieldAgents({...empty, customerMitra:agent(6),nakaMitra:agent(7)})[0].id,6);
  assert.equal(resolveBookingFieldAgents({...empty,nakaMitra:agent(7)})[0].source,'NAKA');
});
test('inactive or missing-phone contacts are not advertised as callable', () => {
  assert.equal(resolveBookingFieldAgents({bookedWorkers:[{id:17}],workersWithMitra:[{id:17,mitra:{...agent(5),phone:''}}]}).length,0);
  assert.equal(resolveBookingFieldAgents({bookedWorkers:[{id:17}],workersWithMitra:[{id:17,mitra:{...agent(5),isActive:false}}]}).length,0);
});
