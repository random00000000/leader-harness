// Runs one headless Claude Code session (`claude -p`) and parses its JSON result.
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

function findClaude(configured) {
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
function runClaude({ claudePath, cwd, prompt, systemPrompt, tools, deny, model, schema, timeoutMin = 30 }) {
  const args = ['-p', '--output-format', 'json', '--no-session-persistence', '--permission-mode', 'dontAsk'];
  if (systemPrompt) args.push('--append-system-prompt', systemPrompt);
  if (tools?.length) args.push('--allowedTools', tools.join(','));
  if (deny?.length) args.push('--disallowedTools', deny.join(','));
  if (model) args.push('--model', model);
  if (schema) args.push('--json-schema', JSON.stringify(schema));

  const started = Date.now();
  const child = spawn(claudePath, args, { cwd, windowsHide: true, env: { ...process.env } });
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

module.exports = { runClaude, findClaude, detectRateLimit };
