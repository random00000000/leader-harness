// The guard rules that keep the harness from damaging itself (PLAN - Reliability):
// no pushes to main/master, and protected files need the Leader to merge.
const test = require('node:test');
const assert = require('node:assert/strict');
const { check } = require('../src/main/guard');
const { tempDir } = require('./helpers');

const root = tempDir('lh-rel-');
const env = (branch = 'auto/8-budget', files = ['src/main/scheduler.js']) => ({
  currentBranch: () => branch,
  prFiles: () => files,
});
const bash = (command, e = env(), authority = 'ship') => check({ tool_name: 'Bash', tool_input: { command } }, { root, authority, env: e });

test('Ship may push its work branch', () => {
  for (const cmd of ['git push -u origin auto/8-budget', 'git push origin HEAD', 'git push', 'git push origin official/x:auto/8-budget']) {
    assert.equal(bash(cmd), null, cmd);
  }
});

test('nobody may push to main or master', () => {
  for (const cmd of [
    'git push origin main',
    'git push origin HEAD:main',
    'git push origin auto/8:main',
    'git push origin refs/heads/main',
    'git push origin master',
    'git -C . push origin main',
    'npm test && git push origin main',
    'git push --all origin',
    'git push --mirror',
  ]) {
    assert.ok(bash(cmd), `blocks: ${cmd}`);
  }
  // A bare push while on main is a push to main.
  assert.ok(bash('git push', env('main')));
  assert.ok(bash('git push origin HEAD', env('master')));
});

test('ordinary commands that mention push are not mistaken for pushes', () => {
  for (const cmd of ['git commit -m "push the fix"', 'git log --grep push', 'echo push main']) {
    assert.equal(bash(cmd, env('main')), null, cmd);
  }
});

test('Ship may merge a pull request that leaves the safety machinery alone', () => {
  assert.equal(bash('gh pr merge 12 --squash --delete-branch', env('auto/8', ['src/main/scheduler.js', 'test/x.test.js', 'Leader Harness - Wiki/PROMPT-LEDGER.md'])), null);
});

test('a pull request touching protected files needs the Leader', () => {
  for (const file of [
    'src/main/guard.js',
    'src/main/runner.js',
    'src/main/authority.js',
    'src/main/workspace.js',
    'scripts/release.js',
    '.github/workflows/check.yml',
    'AGENTS.md',
    'CLAUDE.md',
  ]) {
    const reason = bash('gh pr merge 12 --squash', env('auto/x', ['src/main/scheduler.js', file]));
    assert.ok(reason, `protects ${file}`);
    assert.match(reason, /Only the Leader may merge/);
  }
});

test('a pull request whose files cannot be listed is not merged', () => {
  const broken = { currentBranch: () => 'auto/x', prFiles: () => { throw new Error('offline'); } };
  assert.match(bash('gh pr merge 12 --squash', broken), /Could not list/);
});
