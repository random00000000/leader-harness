const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { gitRoot, createWorkspace, syncWorkspace, removeWorkspace } = require('../src/main/workspace');
const { tempDir } = require('./helpers');

const ENV = { ...process.env, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 't@example.com' };
const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', env: ENV, stdio: ['ignore', 'pipe', 'pipe'] }).trim();

// A project cloned from a local bare "remote", with one commit on main.
function makeProject() {
  const dir = tempDir('lh-ws-');
  const remote = path.join(dir, 'remote.git');
  const project = path.join(dir, 'project');
  execFileSync('git', ['init', '--quiet', '--bare', '-b', 'main', remote], { env: ENV });
  execFileSync('git', ['clone', '--quiet', remote, project], { env: ENV, stdio: 'ignore' });
  git(project, 'checkout', '-q', '-B', 'main');
  fs.writeFileSync(path.join(project, 'README.md'), '# Project\n');
  git(project, 'add', '-A');
  git(project, 'commit', '-q', '-m', 'Initial');
  git(project, 'push', '-q', '-u', 'origin', 'main');
  git(project, 'remote', 'set-head', 'origin', 'main');
  return { dir, remote, project };
}

// Everything the Leader could see: tracked content, status and HEAD.
function snapshot(project) {
  return {
    status: git(project, 'status', '--porcelain'),
    head: git(project, 'rev-parse', 'HEAD'),
    branch: git(project, 'rev-parse', '--abbrev-ref', 'HEAD'),
    files: fs.readdirSync(project).sort().join(','),
  };
}

test('gitRoot finds repositories and rejects plain folders', () => {
  const { project } = makeProject();
  assert.ok(gitRoot(project));
  assert.equal(gitRoot(tempDir()), null);
  assert.equal(gitRoot(path.join(tempDir(), 'missing')), null);
});

test('work in the workspace never touches the Leader checkout', () => {
  const { dir, project } = makeProject();
  const before = snapshot(project);
  const ws = createWorkspace({ projectPath: project, dest: path.join(dir, 'official', 'workspace'), branch: 'official/test' });
  assert.equal(ws.method, 'worktree');
  assert.equal(ws.base, 'origin/main');
  assert.equal(git(ws.path, 'rev-parse', '--abbrev-ref', 'HEAD'), 'official/test');

  fs.writeFileSync(path.join(ws.path, 'feature.js'), 'module.exports = 1;\n');
  git(ws.path, 'add', '-A');
  git(ws.path, 'commit', '-q', '-m', 'Official work');

  assert.deepEqual(snapshot(project), before, 'the Leader checkout is unchanged');
  assert.equal(fs.existsSync(path.join(project, 'feature.js')), false);
  assert.match(git(project, 'log', '--oneline', 'official/test'), /Official work/, 'the commit is on the Official branch');
});

test('an Official can push its branch to the remote', () => {
  const { dir, remote, project } = makeProject();
  const ws = createWorkspace({ projectPath: project, dest: path.join(dir, 'ws'), branch: 'official/push' });
  fs.writeFileSync(path.join(ws.path, 'x.txt'), 'x\n');
  git(ws.path, 'add', '-A');
  git(ws.path, 'commit', '-q', '-m', 'Pushed work');
  git(ws.path, 'push', '-q', '-u', 'origin', 'official/push');
  assert.match(git(remote, 'log', '--oneline', 'official/push'), /Pushed work/);
});

test('an existing Official branch is reused', () => {
  const { dir, project } = makeProject();
  const first = createWorkspace({ projectPath: project, dest: path.join(dir, 'a'), branch: 'official/again' });
  removeWorkspace({ projectPath: project, dest: first.path });
  const second = createWorkspace({ projectPath: project, dest: path.join(dir, 'b'), branch: 'official/again' });
  assert.equal(second.method, 'worktree');
  assert.equal(git(second.path, 'rev-parse', '--abbrev-ref', 'HEAD'), 'official/again');
});

test('syncWorkspace fetches new work from the remote', async () => {
  const { dir, project } = makeProject();
  const ws = createWorkspace({ projectPath: project, dest: path.join(dir, 'ws'), branch: 'official/sync' });
  fs.writeFileSync(path.join(project, 'later.md'), 'later\n');
  git(project, 'add', '-A');
  git(project, 'commit', '-q', '-m', 'Later work');
  git(project, 'push', '-q');
  const r = await syncWorkspace(ws.path);
  assert.equal(r.fetched, true);
  assert.match(git(ws.path, 'log', '--oneline', 'origin/main'), /Later work/);
});

test('removing a workspace keeps the branch', () => {
  const { dir, project } = makeProject();
  const ws = createWorkspace({ projectPath: project, dest: path.join(dir, 'ws'), branch: 'official/keep' });
  removeWorkspace({ projectPath: project, dest: ws.path });
  assert.equal(fs.existsSync(ws.path), false);
  assert.ok(git(project, 'rev-parse', '--verify', 'refs/heads/official/keep'));
  assert.doesNotMatch(git(project, 'worktree', 'list'), /official\/keep/);
});

test('createWorkspace refuses folders that are not repositories', () => {
  assert.throws(() => createWorkspace({ projectPath: tempDir(), dest: path.join(tempDir(), 'ws'), branch: 'official/x' }), /not a git repository/);
});

test('inspectProject recognises git projects and Leader Harness itself', () => {
  const { inspectProject } = require('../src/main/workspace');
  const { project } = makeProject();
  assert.deepEqual(inspectProject(project), { exists: true, git: true, harness: false });
  assert.deepEqual(inspectProject(tempDir()), { exists: true, git: false, harness: false });
  assert.equal(inspectProject(path.join(tempDir(), 'missing')).exists, false);
  // This very repository is the harness.
  assert.equal(inspectProject(path.join(__dirname, '..')).harness, true);
  assert.equal(inspectProject(path.join(__dirname, '..', 'src')).harness, true, 'a subfolder resolves to the repo root');
});
