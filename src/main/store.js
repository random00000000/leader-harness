// Persistent state for the harness: one JSON file in the app's userData folder.
// Writes are debounced and atomic (write temp file, then rename).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_STATE = {
  version: 1,
  settings: {
    claudePath: '',
    maxConcurrent: 1,
    defaultStyle: 'dossier',
    notifications: true,
    paused: false,
    rateLimitedUntil: null,
    jobTimeoutMin: 30,
  },
  officials: [],
  briefings: [],
  decisions: [],
  jobs: [],
  operations: [],
};

const MAX_FINISHED_JOBS = 400;

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(5).toString('hex')}`;
}

class Store {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, 'state.json');
    this.listeners = new Set();
    this.saveTimer = null;
    this.state = this.load();
  }

  load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      const state = { ...structuredClone(DEFAULT_STATE), ...raw };
      state.settings = { ...DEFAULT_STATE.settings, ...raw.settings };
      // Jobs that were running when the app closed never finished.
      for (const job of state.jobs) {
        if (job.status === 'running') {
          job.status = 'failed';
          job.error = 'Interrupted: the app closed while this job was running.';
          job.finishedAt = job.finishedAt || new Date().toISOString();
        }
      }
      return state;
    } catch (err) {
      if (err.code !== 'ENOENT') console.error('State file unreadable, starting fresh:', err.message);
      return structuredClone(DEFAULT_STATE);
    }
  }

  get() {
    return this.state;
  }

  // Mutate state through a function, then persist and notify.
  update(fn) {
    const result = fn(this.state);
    this.trim();
    this.scheduleSave();
    for (const listener of this.listeners) listener(this.state);
    return result;
  }

  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  trim() {
    const finished = this.state.jobs.filter((j) => j.status !== 'queued' && j.status !== 'running');
    if (finished.length > MAX_FINISHED_JOBS) {
      const drop = new Set(finished.slice(0, finished.length - MAX_FINISHED_JOBS).map((j) => j.id));
      this.state.jobs = this.state.jobs.filter((j) => !drop.has(j.id));
    }
  }

  scheduleSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveNow(), 250);
  }

  saveNow() {
    clearTimeout(this.saveTimer);
    fs.mkdirSync(this.dir, { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2));
    fs.renameSync(tmp, this.file);
  }
}

module.exports = { Store, id };
