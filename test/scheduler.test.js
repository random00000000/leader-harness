const test = require('node:test');
const assert = require('node:assert/strict');
const { Scheduler } = require('../src/main/scheduler');
const { makeStore, makeOfficial, makeDecision } = require('./helpers');

function setup(seed = {}) {
  const official = makeOfficial();
  const store = makeStore({ officials: [official], ...seed });
  const notes = [];
  const scheduler = new Scheduler(store, { notify: (n) => notes.push(n) });
  return { store, scheduler, official: store.get().officials[0], notes };
}

test('enqueue does not duplicate a queued job of the same kind', () => {
  const { store, scheduler, official } = setup();
  const a = scheduler.enqueue(official, 'briefing');
  const b = scheduler.enqueue(official, 'briefing');
  assert.equal(a.id, b.id);
  assert.equal(store.get().jobs.length, 1);
  scheduler.enqueue(official, 'work');
  assert.equal(store.get().jobs.length, 2);
});

test('directive and surge jobs are never deduplicated', () => {
  const { store, scheduler, official } = setup();
  scheduler.enqueue(official, 'directive', { directive: { text: 'one' } });
  scheduler.enqueue(official, 'directive', { directive: { text: 'two' } });
  scheduler.enqueue(official, 'operation', { operationId: 'op1', runNumber: 1 });
  scheduler.enqueue(official, 'operation', { operationId: 'op1', runNumber: 2 });
  assert.equal(store.get().jobs.length, 4);
});

test('an expired decision takes the recommended option as an instruction', () => {
  const { store, scheduler } = setup({ decisions: [makeDecision({ deadlineAt: new Date(Date.now() - 1000).toISOString() })] });
  scheduler.expireDecisions(new Date());
  const d = store.get().decisions[0];
  assert.equal(d.status, 'auto');
  assert.equal(d.choice.optionId, 'opt1');
  const job = store.get().jobs.find((j) => j.kind === 'directive');
  assert.ok(job, 'a directive job is queued');
  assert.equal(job.status, 'queued');
  assert.equal(job.directive.text, 'Path B. Take path B.');
});

test('a decision that has not expired stays pending', () => {
  const { store, scheduler } = setup({ decisions: [makeDecision()] });
  scheduler.expireDecisions(new Date());
  assert.equal(store.get().decisions[0].status, 'pending');
  assert.equal(store.get().jobs.length, 0);
});

test('a free-text instruction is sent word for word', () => {
  const { store, scheduler } = setup({ decisions: [makeDecision()] });
  scheduler.resolve('dec_test', { text: 'Do neither | wait for me' });
  const job = store.get().jobs.find((j) => j.kind === 'directive');
  assert.equal(job.directive.text, 'Do neither | wait for me');
  assert.equal(store.get().decisions[0].status, 'decided');
});

test('halting from a decision halts the official and queues nothing', () => {
  const { store, scheduler } = setup({ decisions: [makeDecision()] });
  scheduler.resolve('dec_test', { halt: true });
  assert.equal(store.get().decisions[0].status, 'halted');
  assert.equal(store.get().officials[0].status, 'halted');
  assert.equal(store.get().jobs.length, 0);
});

test('a resolved decision cannot be resolved again', () => {
  const { store, scheduler } = setup({ decisions: [makeDecision()] });
  scheduler.resolve('dec_test', { optionId: 'opt0' });
  assert.equal(scheduler.resolve('dec_test', { optionId: 'opt1' }), null);
  assert.equal(store.get().jobs.length, 1);
});

test('paused work never starts a session', () => {
  const { store, scheduler, official } = setup();
  scheduler.enqueue(official, 'work');
  scheduler.pump();
  assert.equal(store.get().jobs[0].status, 'queued');
  assert.equal(scheduler.running.size, 0);
});
