// Isolated workspaces: an Official works in its own git worktree of the
// project, on its own branch, and delivers through pull requests. The
// Leader's checkout is never edited.
const { execFile, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const git = (cwd, args, opts = {}) =>
  execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();

const tryGit = (cwd, args) => {
  try {
    return git(cwd, args);
  } catch {
    return null;
  }
};

// The repository's top-level folder, or null when the folder is not in git.
function gitRoot(dir) {
  return dir && fs.existsSync(dir) ? tryGit(dir, ['rev-parse', '--show-toplevel']) : null;
}

// What new work branches from: origin's default branch when there is one,
// otherwise the project's current branch.
function baseRef(projectPath) {
  const remoteHead = tryGit(projectPath, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
  if (remoteHead) return remoteHead;
  return tryGit(projectPath, ['rev-parse', '--abbrev-ref', 'HEAD']) || 'HEAD';
}

/**
 * Creates the Official's workspace at `dest` on `branch`.
 * @returns {{ path, branch, base, method: 'worktree'|'clone' }}
 */
function createWorkspace({ projectPath, dest, branch }) {
  if (!gitRoot(projectPath)) throw new Error(`${projectPath} is not a git repository.`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const base = baseRef(projectPath);
  const branchExists = tryGit(projectPath, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]) !== null;
  try {
    git(projectPath, branchExists ? ['worktree', 'add', dest, branch] : ['worktree', 'add', '-b', branch, dest, base]);
    return { path: dest, branch, base, method: 'worktree' };
  } catch (err) {
    // Some setups refuse worktrees (e.g. the branch is checked out elsewhere);
    // a separate clone gives the same isolation.
    fs.rmSync(dest, { recursive: true, force: true });
    execFileSync('git', ['clone', '--quiet', projectPath, dest], { windowsHide: true, stdio: 'ignore' });
    const origin = tryGit(projectPath, ['remote', 'get-url', 'origin']);
    if (origin) git(dest, ['remote', 'set-url', 'origin', origin]);
    git(dest, ['checkout', '-q', '-b', branch]);
    return { path: dest, branch, base, method: 'clone', fallbackReason: err.message.split('\n')[0] };
  }
}

// Before each session: fetch, so the Official branches from current work.
// Asynchronous, so the app never blocks on the network.
function syncWorkspace(dest) {
  return new Promise((resolve) => {
    if (!tryGit(dest, ['remote'])) return resolve({ fetched: false });
    execFile('git', ['-C', dest, 'fetch', '--quiet', '--prune', 'origin'], { windowsHide: true, timeout: 60000 }, (err) =>
      resolve({ fetched: !err, error: err ? err.message.split('\n')[0] : null })
    );
  });
}

// Removes the workspace; the branch and its commits are kept.
function removeWorkspace({ projectPath, dest }) {
  if (!dest || !fs.existsSync(dest)) return;
  if (projectPath && tryGit(projectPath, ['worktree', 'remove', '--force', dest]) !== null) return;
  fs.rmSync(dest, { recursive: true, force: true });
  if (projectPath) tryGit(projectPath, ['worktree', 'prune']);
}

module.exports = { gitRoot, baseRef, createWorkspace, syncWorkspace, removeWorkspace };
