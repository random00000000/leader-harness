// Workspace guard: a Claude Code PreToolUse hook that keeps an Official inside
// its workspace and enforces its git authority, whatever the prompt says.
//
// As a hook it reads the tool call as JSON on stdin and exits with code 2 and
// a reason on stderr to block it. The workspace root and authority come from
// LH_GUARD_ROOT and LH_GUARD_AUTHORITY. Any internal error blocks too: the
// guard fails closed.
const path = require('path');

const WIN = process.platform === 'win32';
const norm = (p) => {
  const r = path.resolve(p);
  return WIN ? r.toLowerCase() : r;
};

function inside(target, dir) {
  const t = norm(target);
  const d = norm(dir);
  return t === d || t.startsWith(d.endsWith(path.sep) ? d : d + path.sep);
}

// Git Bash writes C:\x as /c/x; treat both forms alike.
function fromPosixDrive(p) {
  const m = /^\/([a-zA-Z])(\/.*)?$/.exec(p);
  return m && WIN ? `${m[1]}:${(m[2] || '/').replace(/\//g, '\\')}` : p;
}

// Only the workspace itself. The system temp folder is deliberately excluded:
// it holds other programs' files.
function allowedPath(p, root) {
  if (!p) return true;
  const abs = path.isAbsolute(fromPosixDrive(p)) ? fromPosixDrive(p) : path.join(root, p);
  return inside(abs, root);
}

const FILE_TOOLS = {
  Read: (i) => [i.file_path],
  Edit: (i) => [i.file_path],
  MultiEdit: (i) => [i.file_path],
  Write: (i) => [i.file_path],
  NotebookEdit: (i) => [i.notebook_path],
  Glob: (i) => [i.path, path.isAbsolute(i.pattern || '') ? i.pattern.replace(/[*?[{].*$/, '') : null],
  Grep: (i) => [i.path],
};

// Absolute paths, home shortcuts and parent-directory escapes in a command.
const DRIVE_PATH = /(?:^|[\s"'=(])([a-zA-Z]:[\\/][^\s"'|&;<>)]*)/g;
const POSIX_ABS = /(?:^|[\s"'=(])(\/[^\s"'|&;<>)]+)/g;
const HOME_REF = /(^|[\s"'=(])(~(?=[\\/\s"']|$)|\$HOME\b|\$\{HOME\}|%USERPROFILE%|%HOMEPATH%|\$env:USERPROFILE)/i;
const PARENT = /(?:^|[\s"'=(\\/])\.\.(?=[\\/\s"']|$)/;
// Harmless: device paths and single-letter switches (/d, /s).
const DEVICE = /^\/dev\/(null|stdout|stderr|stdin)$|^nul$/i;
const HARMLESS = (p) => DEVICE.test(p) || /^\/[a-zA-Z?]$/.test(p);

function checkBash(command, root) {
  const cmd = String(command || '');
  if (HOME_REF.test(cmd)) return 'Commands may not reference the home directory. Stay inside your workspace.';
  for (const re of [DRIVE_PATH, POSIX_ABS]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(cmd))) {
      const p = m[1].replace(/[.,:;]+$/, '');
      if (HARMLESS(p)) continue;
      if (!allowedPath(p, root)) return `The path ${p} is outside your workspace. Stay inside ${root}.`;
    }
  }
  if (PARENT.test(cmd)) {
    // ".." is fine only when it cannot leave the root, e.g. "src/../test".
    const tokens = cmd.split(/[\s"'|&;<>()]+/).filter((t) => /(^|[\\/])\.\.([\\/]|$)/.test(t));
    for (const t of tokens) if (!allowedPath(t, root)) return `"${t}" leaves your workspace. Stay inside ${root}.`;
  }
  return null;
}

// git [global options] <subcommand>, however it is spelled.
const GIT_SUB = (names) =>
  new RegExp(`(?:^|[\\s;&|(])(?:\\S*[\\\\/])?git(?:\\.exe)?(?:\\s+(?:-[Cc]\\s+\\S+|--?[\\w-]+(?:=\\S+)?))*\\s+(?:${names})(?=\\s|$|[;&|)])`, 'i');
const GIT_WRITE = GIT_SUB('push|merge|rebase');
const GIT_HARD_RESET = /(?:^|[\s;&|(])(?:\S*[\\/])?git(?:\.exe)?\b[^;&|]*\sreset\s[^;&|]*--hard\b/i;
const GH_MERGE = /(?:^|[\s;&|(])gh(?:\.exe)?\s+pr\s+merge\b/i;
const FORCE_PUSH = /(?:^|[\s;&|(])(?:\S*[\\/])?git(?:\.exe)?\b[^;&|]*\spush\b[^;&|]*(?:\s--force(?:-with-lease)?\b|\s-f\b|\s-[a-z]*f[a-z]*\b|\s\+\S)/i;

function checkGit(command, authority) {
  const cmd = String(command || '');
  if (authority === 'observe' || authority === 'build') {
    if (GIT_WRITE.test(cmd) || GH_MERGE.test(cmd)) return `Your authority (${authority}) does not allow push, merge or rebase. Raise it as a decision in your briefing.`;
    if (GIT_HARD_RESET.test(cmd)) return `Your authority (${authority}) does not allow git reset --hard.`;
  }
  if (FORCE_PUSH.test(cmd)) return 'Force-pushing is never allowed.';
  return null;
}

/**
 * @returns {string|null} a reason to block, or null to allow.
 */
function check({ tool_name: tool, tool_input: input = {} }, { root, authority = 'observe' }) {
  if (!root) return 'The workspace guard has no root configured.';
  if (FILE_TOOLS[tool]) {
    for (const p of FILE_TOOLS[tool](input)) {
      if (!allowedPath(p, root)) return `${p} is outside your workspace. Stay inside ${root}.`;
    }
    return null;
  }
  if (tool === 'Bash' || tool === 'PowerShell') {
    return checkBash(input.command, root) || checkGit(input.command, authority);
  }
  return null;
}

function main() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (d) => (raw += d));
  process.stdin.on('end', () => {
    try {
      const reason = check(JSON.parse(raw || '{}'), { root: process.env.LH_GUARD_ROOT, authority: process.env.LH_GUARD_AUTHORITY });
      if (reason) {
        process.stderr.write(`Blocked by the Leader Harness workspace guard: ${reason}\n`);
        process.exit(2);
      }
      process.exit(0);
    } catch (err) {
      process.stderr.write(`Blocked: the workspace guard failed (${err.message}).\n`);
      process.exit(2);
    }
  });
}

if (require.main === module) main();

module.exports = { check, checkBash, checkGit, allowedPath };
