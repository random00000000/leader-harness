const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { scanThreads, cleanPrompt } = require('../src/main/threads');
const { validateSuggestions, suggestPrompt } = require('../src/main/suggest');
const { tempDir } = require('./helpers');

const line = (o) => JSON.stringify(o) + '\n';

// A fake home with Claude Code and Codex thread stores and two projects.
function fixture() {
  const root = tempDir('lh-threads-');
  const alpha = path.join(root, 'work', 'alpha-app');
  const beta = path.join(root, 'work', 'beta-site');
  fs.mkdirSync(path.join(alpha, '.git'), { recursive: true });
  fs.mkdirSync(path.join(alpha, 'Alpha - Wiki'), { recursive: true });
  fs.mkdirSync(path.join(beta, '.git'), { recursive: true });
  const claude = path.join(root, '.claude', 'projects');
  const codex = path.join(root, '.codex', 'sessions', '2026', '09', '20');

  const claudeSession = (dir, file, cwd, prompts) => {
    fs.mkdirSync(path.join(claude, dir), { recursive: true });
    const rows = [line({ type: 'queue-operation', operation: 'enqueue' })];
    for (const p of prompts) rows.push(line({ type: 'user', cwd, isSidechain: false, message: { role: 'user', content: p } }));
    rows.push(line({ type: 'user', cwd, message: { role: 'user', content: [{ type: 'tool_result', content: 'ignored' }] } }));
    rows.push(line({ type: 'custom-title', customTitle: 'Checkout flow' }));
    fs.writeFileSync(path.join(claude, dir, file), rows.join(''));
  };
  claudeSession('alpha', 's1.jsonl', alpha, ['Add a checkout flow', '<system-reminder>injected</system-reminder>']);
  claudeSession('alpha', 's2.jsonl', path.join(alpha, 'Alpha - Wiki'), ['Update the wiki ledger']);
  claudeSession('tmp', 's3.jsonl', path.join(root, 'tmpwork'), ['This is a scratch session']);

  fs.mkdirSync(codex, { recursive: true });
  fs.writeFileSync(
    path.join(codex, 'rollout-2026-09-20T10-00-00-x.jsonl'),
    line({ type: 'session_meta', payload: { cwd: beta, base_instructions: 'x'.repeat(1000) } }) +
      line({ type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: '<environment_context>…</environment_context>' }] } }) +
      line({ type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Redesign the landing page' }] } })
  );
  return { root, alpha, beta, claude, codexDir: path.join(root, '.codex', 'sessions') };
}

test('prompts that are wrappers or injected context are dropped', () => {
  assert.equal(cleanPrompt('<command-name>/x</command-name>'), null);
  assert.equal(cleanPrompt('please see <system-reminder>'), null);
  assert.equal(cleanPrompt('  Add   a feature  '), 'Add a feature');
  assert.equal(cleanPrompt('x'.repeat(300)).length, 238);
});

test('threads are grouped by project root across Claude Code and Codex', () => {
  const f = fixture();
  const r = scanThreads({ claudeDir: f.claude, codexDir: f.codexDir, exclude: [path.join(f.root, 'tmpwork')] });
  assert.deepEqual(r.scanned, { claude: 3, codex: 1 });
  const alpha = r.projects.find((p) => p.name === 'alpha-app');
  const beta = r.projects.find((p) => p.name === 'beta-site');
  assert.ok(alpha && beta, 'both projects found');
  assert.equal(alpha.sessions, 2, 'the wiki subfolder session counts toward its project');
  assert.equal(alpha.claude, 2);
  assert.deepEqual([...alpha.prompts].sort(), ['Add a checkout flow', 'Update the wiki ledger']);
  assert.deepEqual(alpha.titles, ['Checkout flow', 'Checkout flow']);
  assert.equal(beta.codex, 1);
  assert.deepEqual(beta.prompts, ['Redesign the landing page']);
  assert.ok(!r.projects.some((p) => p.path.includes('tmpwork')), 'excluded folders are skipped');
  assert.equal(alpha.path, f.alpha);
});

test('old threads are ignored', () => {
  const f = fixture();
  const r = scanThreads({ claudeDir: f.claude, codexDir: f.codexDir, now: Date.now() + 400 * 86400000 });
  assert.equal(r.projects.length, 0);
});

test('suggestions are validated against the digest', () => {
  const digest = { scanned: { claude: 2, codex: 1 }, projects: [{ path: 'C:\\work\\alpha-app', name: 'alpha-app', sessions: 2, claude: 2, codex: 0, lastActive: new Date().toISOString(), prompts: ['Add a checkout flow'], titles: [] }] };
  const out = validateSuggestions(
    {
      suggestions: [
        { name: 'Sarah Chen', title: 'Head of Engineering, Alpha', remit: 'Own Alpha.', projectPath: 'c:\\work\\alpha-app', authority: 'build', briefingCadence: { mode: 'daily', time: '08:00', minutes: 0 }, workCadence: { mode: 'interval', time: '', minutes: 240 }, why: 'Most active.' },
        { name: 'James Okafor', title: 'Chief of Staff', remit: 'Watch everything.', projectPath: 'C:\\somewhere\\invented', authority: 'emperor', briefingCadence: { mode: 'weekly' }, workCadence: { mode: 'interval', minutes: 7 }, why: 'Oversight.' },
        { name: '', title: 'No name', remit: 'x' },
        { name: 'Third', title: 'Director of Research', remit: 'Research.', projectPath: '' },
        { name: 'Fourth', title: 'Surplus', remit: 'x', projectPath: '' },
      ],
    },
    digest
  );
  assert.equal(out.length, 3, 'nameless and surplus suggestions are dropped');
  assert.deepEqual(out.map((s) => s.name), ['Sarah Chen', 'James Okafor', 'Third']);
  assert.equal(out[0].projectPath, 'C:\\work\\alpha-app', 'known paths are kept, in their original spelling');
  assert.deepEqual(out[0].workCadence, { mode: 'interval', minutes: 240 });
  assert.equal(out[1].projectPath, '', 'invented paths are removed');
  assert.equal(out[1].authority, 'observe', 'unknown authority falls back to Observe');
  assert.deepEqual(out[1].briefingCadence, { mode: 'daily', time: '08:00' });
  assert.deepEqual(out[1].workCadence, { mode: 'interval', minutes: 240 });
});

test('the suggestion prompt carries the digest and the voice rules', () => {
  const digest = { scanned: { claude: 1, codex: 0 }, projects: [{ path: '/w/alpha', name: 'alpha', sessions: 1, claude: 1, codex: 0, lastActive: new Date().toISOString(), prompts: ['Add a checkout flow'], titles: [] }] };
  const text = suggestPrompt(digest, [{ name: 'Sarah Chen', title: 'Head of Engineering', projectPath: '/w/alpha' }]);
  assert.match(text, /\/w\/alpha/);
  assert.match(text, /Add a checkout flow/);
  assert.match(text, /do not duplicate/);
  assert.match(text, /No game or fantasy language/);
  assert.match(text, /addressed to the Leader as "you"/);
  assert.match(text, /gendered pronouns/);
});
