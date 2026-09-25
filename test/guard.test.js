const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { check } = require('../src/main/guard');
const { tempDir } = require('./helpers');

const root = tempDir('lh-guard-');
// The workspace lives in the temp folder (which the guard allows), so the
// other project sits where real ones do: outside it.
const sibling = path.join(os.homedir(), 'Documents', 'SomeOtherProject');
const bash = (command, authority = 'ship') => check({ tool_name: 'Bash', tool_input: { command } }, { root, authority });
const file = (tool_name, tool_input) => check({ tool_name, tool_input }, { root, authority: 'ship' });

test('file tools may use paths inside the workspace', () => {
  assert.equal(file('Read', { file_path: path.join(root, 'src', 'a.js') }), null);
  assert.equal(file('Edit', { file_path: 'src/a.js' }), null);
  assert.equal(file('Write', { file_path: path.join(root, 'Tiny - Wiki', 'PROMPT-LEDGER.md') }), null);
  assert.equal(file('Glob', { pattern: '**/*.js' }), null);
  assert.equal(file('Grep', { pattern: 'x' }), null);
});

test('file tools may not leave the workspace', () => {
  assert.ok(file('Read', { file_path: '../outside.txt' }), 'a neighbour in the temp folder is still outside');
  assert.ok(file('Read', { file_path: path.join(sibling, 'README.md') }));
  assert.ok(file('Edit', { file_path: '../../SomeOtherProject/x.js' }));
  assert.ok(file('Write', { file_path: 'C:\\Users\\someone\\Documents\\x.txt' }));
  assert.ok(file('Glob', { pattern: '**/*', path: sibling }));
  assert.ok(file('Grep', { pattern: 'x', path: os.homedir() }));
  assert.ok(file('NotebookEdit', { notebook_path: path.join(sibling, 'n.ipynb') }));
});

test('commands may work inside the workspace', () => {
  for (const cmd of [
    'npm test',
    'git status && git log --oneline -5',
    `node "${path.join(root, 'scripts', 'x.js')}"`,
    'ls src/../test',
    'echo done > /dev/null',
    'gh pr create --title "x" --body "see https://github.com/a/b/pull/1"',
  ]) {
    assert.equal(bash(cmd), null, cmd);
  }
});

test('commands may not reach outside the workspace', () => {
  for (const cmd of [
    `cat "${path.join(sibling, 'secrets.txt')}"`,
    'cat ../../other/file',
    'cd ../.. && ls',
    'cd /d C:\\',
    'ls C:\\Users',
    'ls /c/Users/someone',
    'cat ~/notes.txt',
    'ls $HOME',
    'dir %USERPROFILE%',
    'mkdir /tmp/scratch',
  ]) {
    assert.ok(bash(cmd), `blocks: ${cmd}`);
  }
});

test('Build may not push, merge, rebase or hard-reset, however it is written', () => {
  for (const cmd of [
    'git push',
    'git push origin main',
    'git -C . push',
    'git   push',
    'git.exe push',
    'git -c user.name=x push',
    'git merge feature',
    'git rebase main',
    'git reset --hard HEAD~1',
    'gh pr merge 3 --squash',
    'npm test && git push',
  ]) {
    assert.ok(bash(cmd, 'build'), `blocks: ${cmd}`);
  }
  for (const cmd of ['git commit -m "push the fix"', 'git merge-base main HEAD', 'git log --grep=merge', 'git reset HEAD file.js']) {
    assert.equal(bash(cmd, 'build'), null, `allows: ${cmd}`);
  }
});

test('Ship may push and merge but never force-push', () => {
  assert.equal(bash('git push -u origin auto/3-guard', 'ship'), null);
  assert.equal(bash('gh pr merge 3 --squash --delete-branch', 'ship'), null);
  for (const cmd of ['git push --force', 'git push -f origin main', 'git push --force-with-lease', 'git push origin +main', 'git push -uf origin x']) {
    assert.ok(bash(cmd, 'ship'), `blocks: ${cmd}`);
  }
});

test('the hook blocks with exit code 2 and fails closed', () => {
  const guard = path.join(__dirname, '..', 'src', 'main', 'guard.js');
  const run = (input, env = {}) =>
    spawnSync(process.execPath, [guard], { input, env: { ...process.env, LH_GUARD_ROOT: root, LH_GUARD_AUTHORITY: 'build', ...env }, encoding: 'utf8' });

  const ok = run(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'npm test' } }));
  assert.equal(ok.status, 0);

  const blocked = run(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git push' } }));
  assert.equal(blocked.status, 2);
  assert.match(blocked.stderr, /workspace guard/);

  assert.equal(run('not json').status, 2, 'bad input blocks');
  assert.equal(run(JSON.stringify({ tool_name: 'Read', tool_input: { file_path: 'x' } }), { LH_GUARD_ROOT: '' }).status, 2, 'missing root blocks');
});

test('the runner self-tests the guard and wires it into every session', () => {
  const { guardPreflight, guardSettings } = require('../src/main/runner');
  const pre = guardPreflight();
  assert.equal(pre.error, undefined, pre.error);
  const settings = JSON.parse(guardSettings(pre.node));
  const hook = settings.hooks.PreToolUse[0];
  const matched = hook.matcher.split('|');
  for (const tool of ['Read', 'Edit', 'Write', 'Glob', 'Grep', 'Bash']) assert.ok(matched.includes(tool), `guards ${tool}`);
  assert.match(hook.hooks[0].command, /guard\.js"$/);
});
