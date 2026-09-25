// Shared test fixtures. Everything lives in a fresh temp folder, and work is
// always paused so the scheduler can never start a real Claude Code session.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Store } = require('../src/main/store');

function tempDir(prefix = 'lh-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function makeOfficial(overrides = {}) {
  const home = overrides.homeDir || tempDir('lh-official-');
  return {
    id: 'off_test',
    name: 'Test Official',
    title: 'Head of Testing',
    remit: 'Test things.',
    projectPath: null,
    homeDir: home,
    wikiDir: path.join(home, 'Test Official - Wiki'),
    authority: 'observe',
    model: '',
    style: '',
    briefingCadence: { mode: 'manual' },
    workCadence: { mode: 'manual' },
    decisionWindowMin: 60,
    status: 'active',
    ...overrides,
  };
}

function makeStore(seed = {}) {
  const store = new Store(tempDir());
  store.update((s) => {
    s.settings.paused = true;
    Object.assign(s, seed);
  });
  return store;
}

// A pending decision with a recommended second option.
function makeDecision(overrides = {}) {
  return {
    id: 'dec_test',
    officialId: 'off_test',
    briefingId: 'brf_test',
    title: 'Choose a path',
    body: 'Two paths are open.',
    options: [
      { id: 'opt0', label: 'Path A', detail: 'Take path A.', recommended: false },
      { id: 'opt1', label: 'Path B.', detail: 'Take path B.', recommended: true },
    ],
    status: 'pending',
    createdAt: new Date().toISOString(),
    deadlineAt: new Date(Date.now() + 3600e3).toISOString(),
    ...overrides,
  };
}

module.exports = { tempDir, makeOfficial, makeStore, makeDecision };
