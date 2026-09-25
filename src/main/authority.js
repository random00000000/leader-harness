// What an Official may do without asking the Leader. Anything above its level
// must be raised as a decision in the next briefing.
//
// PROTECTED FILE: only the Leader may merge changes to it (see
// "PLAN - Reliability"). The rule text tells the Official; `tools` (allowed)
// and `deny` (disallowed) enforce it through Claude Code permissions, and the
// workspace guard (guard.js) enforces the rest. For Observe, Edit/Write are
// scoped to the wiki folder at run time (see toolsFor).
const path = require('path');

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
    summary: 'Full Senior Official authority: commit, push branches, and merge pull requests.',
    tools: ['Read', 'Glob', 'Grep', 'Edit', 'Write', 'NotebookEdit', 'Bash', 'WebFetch', 'WebSearch'],
    deny: ['Bash(git push --force *)', 'Bash(git push -f *)', 'Bash(git push --force-with-lease *)'],
    rule: 'You may commit, push work branches, and merge pull requests once their checks pass. Never push to main or master: work reaches them only through a merged pull request. Never force-push, delete branches you did not create, or publish anything outside the repository without raising a decision first. A pull request that changes protected harness files can only be merged by the Leader: raise it as a decision.',
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

module.exports = { AUTHORITY, toolsFor };
