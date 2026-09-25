const test = require('node:test');
const assert = require('node:assert/strict');
const { isDue, nextDue } = require('../src/main/scheduler');

const at = (d, h, m = 0) => new Date(2026, 8, d, h, m);
const daily = { mode: 'daily', time: '08:00' };
const hourly = { mode: 'interval', minutes: 60 };

test('daily cadence is due once the slot has passed and it has not run since', () => {
  assert.equal(isDue(daily, null, at(24, 9)), true);
  assert.equal(isDue(daily, null, at(24, 7)), false);
  assert.equal(isDue(daily, at(24, 8, 1).toISOString(), at(24, 12)), false);
  assert.equal(isDue(daily, at(23, 8, 1).toISOString(), at(24, 8, 30)), true);
});

test('daily cadence rolls over midnight to the next day', () => {
  const lateRun = at(24, 23, 30).toISOString();
  assert.equal(isDue(daily, lateRun, at(25, 0, 30)), false);
  assert.equal(isDue(daily, lateRun, at(25, 8)), true);
  assert.equal(nextDue(daily, lateRun, at(25, 0, 30)), at(25, 8).toISOString());
  assert.equal(nextDue(daily, at(24, 8, 1).toISOString(), at(24, 12)), at(25, 8).toISOString());
});

test('interval cadence waits the full interval', () => {
  assert.equal(isDue(hourly, null, at(24, 9)), true);
  assert.equal(isDue(hourly, at(24, 8).toISOString(), at(24, 8, 59)), false);
  assert.equal(isDue(hourly, at(24, 8).toISOString(), at(24, 9)), true);
  assert.equal(nextDue(hourly, at(24, 8).toISOString(), at(24, 8, 10)), at(24, 9).toISOString());
});

test('interval cadence never runs more often than every 5 minutes', () => {
  const fast = { mode: 'interval', minutes: 1 };
  assert.equal(isDue(fast, at(24, 8).toISOString(), at(24, 8, 4)), false);
  assert.equal(isDue(fast, at(24, 8).toISOString(), at(24, 8, 5)), true);
});

test('manual cadence is never due', () => {
  assert.equal(isDue({ mode: 'manual' }, null, at(24, 9)), false);
  assert.equal(isDue(undefined, null, at(24, 9)), false);
  assert.equal(nextDue({ mode: 'manual' }, null, at(24, 9)), null);
});
