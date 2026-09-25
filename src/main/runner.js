// Runs one headless Claude Code session (`claude -p`) and parses its JSON result.
const { spawn, spawnSync, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// The lookup can shell out to `where`, and the UI asks on every state push,
// so results are cached: found paths until the setting changes, misses for a minute.
const lookupCache = new Map();

function findClaude(configured = '') {
  const hit = lookupCache.get(configured);
  if (hit && (hit.path || Date.now() - hit.at < 60000)) return hit.path;
  const found = lookupClaude(configured);
  lookupCache.set(configured, { path: found, at: Date.now() });
  return found;
}

function lookupClaude(configured) {
  if (configured && fs.existsSync(configured)) return configured;
  const candidates = [
    path.join(os.homedir(), '.local', 'bin', process.platform === 'win32' ? 'claude.exe' : 'claude'),
    path.join(os.homedir(), '.claude', 'local', process.platform === 'win32' ? 'claude.exe' : 'claude'),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  try {
    const out = execFileSync(process.platform === 'win32' ? 'where' : 'which', ['claude'], { encoding: 'utf8' });
    const lines = out.split(/\r?\n/).filter(Boolean);
    return lines.find((l) => l.endsWith('.exe')) || lines[0] || null;
  } catch {
    return null;
  }
}

// ---- workspace guard ----------------------------------------------------

const GUARD_SCRIPT = path.join(__dirname, 'guard.js');
let guardNode; // cached: { node } or { error }

// The guard hook runs under Node.js. Inside Electron, process.execPath is the
// Electron binary, so we look for a real node on PATH.
function findNode() {
  if (!process.versions.electron) return process.execPath;
  try {
    const out = execFileSync(process.platform === 'win32' ? 'where' : 'which', ['node'], { encoding: 'utf8' });
    return out.split(/\r?\n/).find(Boolean) || null;
  } catch {
    return null;
  }
}

// Confirms the guard actually allows and blocks before any session relies on
// it. Without a working guard no session starts: it fails closed.
function guardPreflight() {
  if (guardNode) return guardNode;
  const node = findNode();
  if (!node) return (guardNode = { error: 'The workspace guard needs Node.js on PATH. Install Node.js, then try again.' });
  const run = (command) =>
    spawnSync(node, [GUARD_SCRIPT], {
      input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
      env: { ...process.env, LH_GUARD_ROOT: os.tmpdir(), LH_GUARD_AUTHORITY: 'build' },
      encoding: 'utf8',
      windowsHide: true,
    });
  const allowed = run('git status');
  const blocked = run('git push');
  if (allowed.status !== 0 || blocked.status !== 2) {
    return (guardNode = { error: `The workspace guard failed its self-test (exit ${allowed.status}/${blocked.status}).` });
  }
  return (guardNode = { node });
}

function guardSettings(node) {
  const command = `"${node}" "${GUARD_SCRIPT}"`;
  return JSON.stringify({
    hooks: { PreToolUse: [{ matcher: 'Read|Edit|MultiEdit|Write|NotebookEdit|Glob|Grep|Bash|PowerShell', hooks: [{ type: 'command', command }] }] },
  });
}

// Usage-limit messages look like "Claude AI usage limit reached|1760000000"
// or "You've hit your limit · resets 3pm".
function detectRateLimit(text) {
  if (!text || !/usage limit|rate limit|hit your limit|limit reached/i.test(text)) return null;
  const epoch = text.match(/\|(\d{10})\b/);
  if (epoch) return new Date(Number(epoch[1]) * 1000).toISOString();
  return new Date(Date.now() + 30 * 60 * 1000).toISOString();
}

/**
 * @returns {{ child, done: Promise<{ok, result, structured, costUsd, usage, durationMs, error, rateLimitedUntil, stderr}>}}
 */
function runClaude({ claudePath, cwd, prompt, systemPrompt, tools, deny, model, schema, authority, timeoutMin = 30 }) {
  const guard = guardPreflight();
  if (guard.error) return { child: null, done: Promise.resolve({ ok: false, error: guard.error, durationMs: 0 }) };

  const args = ['-p', '--output-format', 'json', '--no-session-persistence', '--permission-mode', 'dontAsk'];
  args.push('--settings', guardSettings(guard.node));
  if (systemPrompt) args.push('--append-system-prompt', systemPrompt);
  if (tools?.length) args.push('--allowedTools', tools.join(','));
  if (deny?.length) args.push('--disallowedTools', deny.join(','));
  if (model) args.push('--model', model);
  if (schema) args.push('--json-schema', JSON.stringify(schema));

  const started = Date.now();
  const env = { ...process.env, LH_GUARD_ROOT: cwd, LH_GUARD_AUTHORITY: authority || 'observe' };
  const child = spawn(claudePath, args, { cwd, windowsHide: true, env });
  // Background work must never compete with what the Leader is doing.
  try {
    os.setPriority(child.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
  } catch {
    /* the process may already have exited */
  }
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => (stdout += d));
  child.stderr.on('data', (d) => (stderr += d));
  child.stdin.end(prompt);

  const done = new Promise((resolve) => {
    const timer = setTimeout(() => child.kill(), timeoutMin * 60 * 1000);
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, error: `Could not start Claude Code: ${err.message}`, durationMs: Date.now() - started, stderr });
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const durationMs = Date.now() - started;
      let parsed = null;
      try {
        parsed = JSON.parse(stdout.trim().split(/\r?\n/).pop());
      } catch {
        /* not JSON: handled below */
      }
      if (!parsed) {
        const text = (stderr || stdout).trim().slice(-2000);
        resolve({
          ok: false,
          error: signal ? `Stopped (${signal}); the session may have timed out.` : `Claude Code exited with code ${code}. ${text}`,
          rateLimitedUntil: detectRateLimit(text),
          durationMs,
          stderr,
        });
        return;
      }
      const ok = !parsed.is_error && parsed.subtype === 'success';
      resolve({
        ok,
        result: parsed.result || '',
        structured: parsed.structured_output || null,
        costUsd: parsed.total_cost_usd || 0,
        usage: parsed.usage || null,
        numTurns: parsed.num_turns,
        permissionDenials: (parsed.permission_denials || []).length,
        error: ok ? null : parsed.result || parsed.subtype || 'Claude Code reported an error.',
        rateLimitedUntil: ok ? null : detectRateLimit(parsed.result),
        durationMs,
        stderr,
      });
    });
  });

  return { child, done };
}

module.exports = { runClaude, findClaude, detectRateLimit, guardPreflight, guardSettings };
