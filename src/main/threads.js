// Reads the Leader's recent Claude Code and Codex threads on this machine and
// condenses them into a per-project digest: which folders they work in, how
// often, and what they ask for. The digest feeds the suggested Officials on
// the Appoint screen. Only the start of each session file is read, and
// nothing is sent anywhere by this module.
const fs = require('fs');
const os = require('os');
const path = require('path');

const HEAD_BYTES = 256 * 1024;
const MAX_FILES_PER_SOURCE = 400;
const PROMPTS_PER_PROJECT = 6;

const WIN = process.platform === 'win32';
const key = (p) => (WIN ? path.resolve(p).toLowerCase() : path.resolve(p));

// Sessions started in a subfolder (e.g. a project's wiki) belong to the
// project: walk up to the nearest folder with a .git entry.
const rootCache = new Map();
function projectRoot(cwd) {
  const start = path.resolve(cwd);
  if (rootCache.has(start)) return rootCache.get(start);
  let dir = start;
  let found = start;
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(dir, '.git'))) {
      found = dir;
      break;
    }
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  rootCache.set(start, found);
  return found;
}

function readHead(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(HEAD_BYTES);
    const n = fs.readSync(fd, buf, 0, HEAD_BYTES, 0);
    return buf.subarray(0, n).toString('utf8');
  } finally {
    fs.closeSync(fd);
  }
}

// Complete JSON lines only: the last line of a partial read is dropped.
function jsonLines(text) {
  const lines = text.split('\n');
  if (!text.endsWith('\n')) lines.pop();
  const out = [];
  for (const l of lines) {
    if (!l.trim()) continue;
    try {
      out.push(JSON.parse(l));
    } catch {
      /* skip */
    }
  }
  return out;
}

// A prompt worth showing: typed by the person, not a tool result, command
// wrapper or injected context.
function cleanPrompt(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t || t.startsWith('<') || /system-reminder|<command-|<environment_context|<user_instructions/i.test(t)) return null;
  return t.length > 240 ? `${t.slice(0, 237)}…` : t;
}

function recentFiles(root, match, sinceMs) {
  const out = [];
  const walk = (dir, depth) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory() && depth < 4) walk(full, depth + 1);
      else if (e.isFile() && match(e.name)) {
        try {
          const { mtimeMs } = fs.statSync(full);
          if (mtimeMs >= sinceMs) out.push({ file: full, mtimeMs });
        } catch {
          /* vanished */
        }
      }
    }
  };
  walk(root, 0);
  return out.sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, MAX_FILES_PER_SOURCE);
}

// Claude Code: ~/.claude/projects/<folder>/<session>.jsonl, where user
// records carry `cwd` and `message.content`.
function readClaudeSession(file) {
  let cwd = null;
  let title = null;
  const prompts = [];
  for (const r of jsonLines(readHead(file))) {
    if (!cwd && r.cwd) cwd = r.cwd;
    if (r.type === 'custom-title' && r.customTitle) title = r.customTitle;
    if (r.type === 'user' && r.message?.role === 'user' && !r.isSidechain) {
      const c = r.message.content;
      const text = typeof c === 'string' ? c : Array.isArray(c) ? c.filter((x) => x.type === 'text').map((x) => x.text).join(' ') : '';
      const p = cleanPrompt(text);
      if (p && prompts.length < 3) prompts.push(p);
    }
  }
  return { cwd, title, prompts };
}

// Codex: ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl, with a session_meta
// record carrying `cwd` and user messages as response_item/message.
function readCodexSession(file) {
  const text = readHead(file);
  let cwd = null;
  const prompts = [];
  for (const r of jsonLines(text)) {
    if (!cwd && r.type === 'session_meta' && r.payload?.cwd) cwd = r.payload.cwd;
    if (!cwd && r.type === 'turn_context' && r.payload?.cwd) cwd = r.payload.cwd;
    if (r.type === 'response_item' && r.payload?.type === 'message' && r.payload.role === 'user') {
      const t = (r.payload.content || []).filter((x) => /text/.test(x.type)).map((x) => x.text).join(' ');
      const p = cleanPrompt(t);
      if (p && prompts.length < 3) prompts.push(p);
    }
  }
  // The session header can be longer than the part read; fall back to a scan.
  if (!cwd) {
    const m = /"cwd"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(text);
    if (m) cwd = JSON.parse(`"${m[1]}"`);
  }
  return { cwd, title: null, prompts };
}

/**
 * @returns {{ projects: Array<{path, name, sessions, claude, codex, lastActive, prompts, titles}>, scanned: {claude, codex} }}
 */
function scanThreads({
  claudeDir = path.join(os.homedir(), '.claude', 'projects'),
  codexDir = path.join(os.homedir(), '.codex', 'sessions'),
  days = 60,
  maxProjects = 12,
  exclude = [os.tmpdir()],
  now = Date.now(),
} = {}) {
  const since = now - days * 86400000;
  const excluded = exclude.filter(Boolean).map(key);
  const home = key(os.homedir());
  const projects = new Map();
  const scanned = { claude: 0, codex: 0 };

  const add = (source, session, mtimeMs) => {
    if (!session.cwd) return;
    const raw = key(session.cwd);
    if (raw === home || excluded.some((x) => raw === x || raw.startsWith(x + path.sep))) return;
    const root = projectRoot(session.cwd);
    const k = key(root);
    if (k === home) return;
    if (!projects.has(k)) {
      projects.set(k, { path: root, name: path.basename(root), sessions: 0, claude: 0, codex: 0, lastActive: 0, prompts: [], titles: [] });
    }
    const p = projects.get(k);
    p.sessions += 1;
    p[source] += 1;
    p.lastActive = Math.max(p.lastActive, mtimeMs);
    for (const pr of session.prompts) if (p.prompts.length < PROMPTS_PER_PROJECT && !p.prompts.includes(pr)) p.prompts.push(pr);
    if (session.title && p.titles.length < 3) p.titles.push(session.title);
  };

  for (const { file, mtimeMs } of recentFiles(claudeDir, (n) => n.endsWith('.jsonl'), since)) {
    try {
      add('claude', readClaudeSession(file), mtimeMs);
      scanned.claude += 1;
    } catch {
      /* unreadable session */
    }
  }
  for (const { file, mtimeMs } of recentFiles(codexDir, (n) => n.startsWith('rollout-') && n.endsWith('.jsonl'), since)) {
    try {
      add('codex', readCodexSession(file), mtimeMs);
      scanned.codex += 1;
    } catch {
      /* unreadable session */
    }
  }

  // Busy and recent projects first.
  const score = (p) => p.sessions * (1 + Math.max(0, 1 - (now - p.lastActive) / (days * 86400000)));
  const list = [...projects.values()]
    .filter((p) => fs.existsSync(p.path))
    .sort((a, b) => score(b) - score(a))
    .slice(0, maxProjects)
    .map((p) => ({ ...p, lastActive: new Date(p.lastActive).toISOString() }));
  return { projects: list, scanned };
}

module.exports = { scanThreads, cleanPrompt };
