// Turns the thread digest (threads.js) into three suggested Senior Officials,
// using one short Claude Code session with no tools. The result is validated:
// a suggestion may only point at a folder that appeared in the digest.
const os = require('os');
const { runClaude } = require('./runner');

const CADENCE = {
  type: 'object',
  additionalProperties: false,
  required: ['mode', 'time', 'minutes'],
  properties: {
    mode: { type: 'string', enum: ['daily', 'interval', 'manual'] },
    time: { type: 'string', description: 'HH:MM for daily, otherwise ""' },
    minutes: { type: 'integer', description: 'For interval: 60, 120, 240, 480, 720 or 1440; otherwise 0' },
  },
};

const SUGGESTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['suggestions'],
  properties: {
    suggestions: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'title', 'remit', 'projectPath', 'authority', 'briefingCadence', 'workCadence', 'why'],
        properties: {
          name: { type: 'string', description: 'A plausible professional full name, e.g. "Sarah Chen".' },
          title: { type: 'string', description: 'An executive title, e.g. "Head of Engineering, Northwind".' },
          remit: { type: 'string', description: 'What the Official owns and reports on, 1-2 sentences, addressed as the Leader would write it.' },
          projectPath: { type: 'string', description: 'Exactly one path from the digest, or "" for an Official without a project.' },
          authority: { type: 'string', enum: ['observe', 'build', 'ship'] },
          briefingCadence: CADENCE,
          workCadence: CADENCE,
          why: { type: 'string', description: 'At most 35 words, addressed to the Leader as "you", citing the evidence.' },
        },
      },
    },
  },
};

function suggestPrompt(digest, officials) {
  const lines = digest.projects.map(
    (p, i) =>
      `${i + 1}. ${p.path}\n   ${p.sessions} sessions (Claude Code ${p.claude}, Codex ${p.codex}), last active ${p.lastActive.slice(0, 10)}` +
      (p.titles.length ? `\n   Thread titles: ${p.titles.join(' | ')}` : '') +
      (p.prompts.length ? `\n   Sample requests:\n${p.prompts.map((x) => `   - ${x}`).join('\n')}` : '')
  );
  return [
    "You advise a Leader who runs AI agents (Claude Code and Codex) across several projects. Below is a digest of the Leader's recent threads, grouped by project folder. Suggest exactly three Senior Officials to appoint. Each Official owns an area, works unattended in the background, and briefs the Leader.",
    `Digest (${digest.scanned.claude} Claude Code and ${digest.scanned.codex} Codex sessions from the last 60 days):\n\n${lines.join('\n\n') || '(no recent threads)'}`,
    officials.length
      ? `Already appointed (do not duplicate): ${officials.map((o) => `${o.name}, ${o.title}${o.projectPath ? ` (${o.projectPath})` : ''}`).join('; ')}`
      : 'No Officials are appointed yet.',
    [
      'Rules:',
      '- Favour the projects with the most, and most recent, activity. The three suggestions must differ: at most one of them may be a cross-project role (e.g. a Chief of Staff with projectPath "").',
      '- projectPath must be copied exactly from the digest, or "".',
      '- Authority: "observe" for oversight or research, "build" for hands-on development. Suggest "ship" only for a project the Leader clearly ships continuously, and explain why.',
      '- Cadence: a daily briefing (usually 08:00) unless activity suggests otherwise. Background work every 240-720 minutes for active builds, "manual" for oversight roles.',
      '- Voice: serious and executive, like an intelligence service or an executive office. No game or fantasy language, even when a project is a game. Titles like "Head of Engineering, <Project>" or "Director of Research".',
      '- "why" cites the evidence (session counts, recency, what has been asked for) in at most 35 words, addressed to the Leader as "you" (e.g. "You ran 88 sessions here this month…"). Never refer to the Leader in the third person or with gendered pronouns.',
      '- "remit" is written as the Leader would write it to the Official ("Own…", "Brief me…").',
    ].join('\n'),
    'Return the result as structured output.',
  ].join('\n\n');
}

function cleanCadence(c, fallback) {
  if (!c || !['daily', 'interval', 'manual'].includes(c.mode)) return fallback;
  if (c.mode === 'daily') return { mode: 'daily', time: /^\d{2}:\d{2}$/.test(c.time) ? c.time : '08:00' };
  if (c.mode === 'interval') return { mode: 'interval', minutes: [30, 60, 120, 240, 480, 720, 1440].includes(c.minutes) ? c.minutes : 240 };
  return { mode: 'manual' };
}

// Keeps only well-formed suggestions that point at known folders.
function validateSuggestions(raw, digest) {
  const known = new Map(digest.projects.map((p) => [p.path.toLowerCase(), p.path]));
  return (raw?.suggestions || [])
    .filter((s) => s && s.name && s.title && s.remit)
    .slice(0, 3)
    .map((s) => ({
      name: String(s.name).slice(0, 60),
      title: String(s.title).slice(0, 90),
      remit: String(s.remit).slice(0, 600),
      projectPath: known.get(String(s.projectPath || '').toLowerCase()) || '',
      authority: ['observe', 'build', 'ship'].includes(s.authority) ? s.authority : 'observe',
      briefingCadence: cleanCadence(s.briefingCadence, { mode: 'daily', time: '08:00' }),
      workCadence: cleanCadence(s.workCadence, { mode: 'manual' }),
      why: String(s.why || '').slice(0, 400),
    }));
}

async function suggestOfficials({ claudePath, digest, officials = [], model }) {
  const { done } = runClaude({
    claudePath,
    cwd: os.tmpdir(),
    prompt: suggestPrompt(digest, officials),
    tools: [],
    schema: SUGGESTION_SCHEMA,
    model: model || undefined,
    authority: 'observe',
    timeoutMin: 5,
  });
  const out = await done;
  if (!out.ok) throw new Error(out.error || 'The suggestion session failed.');
  const items = validateSuggestions(out.structured, digest);
  if (!items.length) throw new Error('No usable suggestions came back.');
  return { items, costUsd: out.costUsd, tokens: out.usage };
}

module.exports = { suggestOfficials, suggestPrompt, validateSuggestions, SUGGESTION_SCHEMA };
