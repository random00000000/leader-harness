// Prompts, tool permissions and the Briefing schema used when a Senior
// Official runs Claude Code headlessly.
const path = require('path');

// What an official may do without asking the Leader. Anything above its level
// must be raised as a decision in the next briefing.
// The rule text tells the official; `tools` (allowed) and `deny` (disallowed)
// enforce it through Claude Code permissions. For Observe, Edit/Write are
// scoped to the wiki folder at run time (see toolsFor).
const GIT_READ = ['git log', 'git status', 'git diff', 'git show', 'git branch'].flatMap((c) => [`Bash(${c})`, `Bash(${c} *)`]);

const AUTHORITY = {
  observe: {
    label: 'Observe',
    summary: 'Reads the project and keeps its wiki. Changes no code.',
    tools: ['Read', 'Glob', 'Grep', ...GIT_READ, 'WebSearch', 'WebFetch'],
    wikiOnly: true,
    deny: [],
    rule: 'You may read anything, but you may only edit files inside your wiki folder. Do not change code, commit, or push.',
  },
  build: {
    label: 'Build',
    summary: 'Edits code, runs builds and tests, commits on a work branch.',
    tools: ['Read', 'Glob', 'Grep', 'Edit', 'Write', 'NotebookEdit', 'Bash', 'WebSearch', 'WebFetch'],
    deny: ['Bash(git push *)', 'Bash(git merge *)', 'Bash(git rebase *)', 'Bash(git reset --hard *)'],
    rule: 'You may edit code, run builds and tests, and commit on a branch named leader/<topic>. Never push, merge, or rewrite history; raise those as decisions.',
  },
  ship: {
    label: 'Ship',
    summary: 'Full Senior Official authority: commit, push and merge.',
    tools: ['Read', 'Glob', 'Grep', 'Edit', 'Write', 'NotebookEdit', 'Bash', 'WebFetch', 'WebSearch'],
    deny: ['Bash(git push --force *)', 'Bash(git push -f *)', 'Bash(git push --force-with-lease *)'],
    rule: 'You may commit, push, and merge. Never force-push, delete branches you did not create, or publish anything outside the repository without raising a decision first.',
  },
};

// Permission rules for one run. Path rules are relative to the working
// directory, which always contains the official's wiki.
function toolsFor(official, cwd) {
  const auth = AUTHORITY[official.authority] || AUTHORITY.observe;
  if (!auth.wikiOnly) return { allow: auth.tools, deny: auth.deny };
  const rel = path.relative(cwd, official.wikiDir).split(path.sep).join('/');
  if (!rel || rel.startsWith('..')) throw new Error(`The wiki (${official.wikiDir}) must be inside the working directory (${cwd}).`);
  return { allow: [...auth.tools, `Edit(${rel}/**)`, `Write(${rel}/**)`], deny: auth.deny };
}

const BRIEFING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'classification', 'bluf', 'situation', 'actions', 'risks', 'decisions', 'next'],
  properties: {
    title: { type: 'string', description: 'Headline for this briefing, under 80 characters.' },
    classification: { type: 'string', enum: ['ROUTINE', 'PRIORITY', 'FLASH'] },
    bluf: { type: 'string', description: 'Bottom line up front: at most two sentences.' },
    situation: { type: 'array', items: { type: 'string' }, description: 'Key facts, one short paragraph each, most important first.' },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'status'],
        properties: { text: { type: 'string' }, status: { type: 'string', enum: ['done', 'in_progress', 'blocked'] } },
      },
    },
    risks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'level'],
        properties: { text: { type: 'string' }, level: { type: 'string', enum: ['low', 'medium', 'high'] } },
      },
    },
    decisions: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'body', 'options'],
        properties: {
          title: { type: 'string' },
          body: { type: 'string', description: 'The situation in 2-4 sentences, written like a Hearts of Iron event.' },
          options: {
            type: 'array',
            minItems: 2,
            maxItems: 4,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['label', 'detail', 'recommended'],
              properties: {
                label: { type: 'string', description: 'Short imperative, e.g. "Approve the refactor".' },
                detail: { type: 'string', description: 'What you will do if this is chosen.' },
                recommended: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
    next: { type: 'array', items: { type: 'string' }, description: 'What you plan to do before the next briefing.' },
  },
};

function persona(official) {
  const auth = AUTHORITY[official.authority] || AUTHORITY.observe;
  return [
    `You are ${official.name}, ${official.title}, a Senior Official serving the Leader through the Leader Harness.`,
    `Your remit: ${official.remit}`,
    'The Leader has very little time and more usage budget than attention. You work in the background, unattended, and report through briefings. Nobody is watching this session: never ask questions, never wait for input.',
    `Authority (${auth.label}): ${auth.rule}`,
    `Your memory is the wiki at "${official.wikiDir}". Before working, read its "Wiki Home.md" and the latest rows of "PROMPT-LEDGER.md", plus only the Systems pages the task touches.`,
    `Every session must prepend one row to PROMPT-LEDGER.md (newest at the top of the table) with Model "Claude Code (Leader Harness: ${official.name})". When the session carries the Leader's own words (an order or a big push objective), the Request cell holds those words verbatim, with line breaks as <br> and | escaped; otherwise it names the trigger, e.g. "Scheduled briefing" or "Scheduled work session". Keep results to one line. Never write in the Human Notes column.`,
    'When you build or change a system, create or update its page under Systems/ in the same session. Page names are Title Case with spaces, e.g. "Combat System.md" or "PLAN - Fog Of War.md"; never kebab-case, snake_case or dates. Label knowledge FACT / OBSERVATION / HYPOTHESIS / DECISION / QUESTION.',
  ].join('\n\n');
}

function formatActivity(jobs) {
  if (!jobs.length) return 'No work sessions have run since the last briefing.';
  return jobs
    .map((j) => `- ${j.finishedAt} [${j.kind}${j.status === 'failed' ? ', FAILED' : ''}] ${j.title}: ${(j.summary || j.error || '').slice(0, 600)}`)
    .join('\n');
}

function briefingPrompt(official, { since, activity }) {
  return [
    `Prepare your briefing for the Leader. Period covered: ${since ? `since ${since}` : 'this is your first briefing; introduce the state of your remit'}.`,
    official.projectPath
      ? `The project is at "${official.projectPath}" (your working directory). Look before you write: list its top-level files, read its README and any docs or roadmap, run "git log --oneline -20" and "git status". Never ask the Leader for anything you can find in the project yourself.`
      : 'You have no project folder; work from your wiki and your remit.',
    `Work sessions since the last briefing:\n${formatActivity(activity)}`,
    'Write for a busy leader: the bottom line first, facts over narration, no filler.',
    'Raise a decision only when the Leader genuinely needs to choose (direction, spend, anything above your authority). Each decision has 2-4 options that are concrete orders you would carry out, and exactly one is marked recommended. If the Leader does not answer in time, the recommended option is taken automatically, so recommend what you would defend.',
    'Before returning, record this briefing as a row in your PROMPT-LEDGER.md.',
    'Return the briefing as structured output.',
  ].join('\n\n');
}

function workPrompt(official) {
  return [
    'Scheduled work session.',
    'Choose the single most valuable piece of work within your remit and authority: open edges and PLAN pages in your wiki, broken builds, unfinished work from earlier sessions. Do it properly, then update the wiki and the ledger.',
    'Finish with a summary of at most five lines: what you did, what changed, what is left.',
  ].join('\n\n');
}

function directivePrompt(official, directive) {
  return [
    'The Leader has issued an order. Carry it out within your authority.',
    `Decision: ${directive.decisionTitle}`,
    `Leader's order (verbatim): ${directive.text}`,
    'If the order needs more authority than you have, do everything you can up to that line and explain what remains.',
    'Finish with a summary of at most five lines.',
  ].join('\n\n');
}

function operationPrompt(official, op, runNumber) {
  return [
    `BIG PUSH, run ${runNumber} of ${op.runs}. The Leader has committed a large share of usage to one objective.`,
    `Objective (verbatim from the Leader): ${op.objective}`,
    'Read the wiki to see what earlier runs of this push achieved, then take the next concrete step toward the objective. Record progress in the wiki so the next run can continue without repeating work.',
    'Finish with a summary of at most five lines.',
  ].join('\n\n');
}

module.exports = { AUTHORITY, toolsFor, BRIEFING_SCHEMA, persona, briefingPrompt, workPrompt, directivePrompt, operationPrompt };
