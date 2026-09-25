# Suggested Officials

## Intent

> "I want the harness to be able to scan my previews threads with claude and codex and suggest senior officials. Maybe give me like 3 options. I think it is fine if when I go to appoint an official it has 3 suggestions for me there"

See the [[PROMPT-LEDGER]] row dated 2026-09-25.

## How it works

- **Scan** (`src/main/threads.js`, run in an Electron utility process by `threads-worker.js` so the app never blocks; about 10 s on the Leader's machine):
  - Claude Code threads are read from `~/.claude/projects/*/*.jsonl`: `cwd` and `message.content` of user records, plus `custom-title`.
  - Codex threads are read from `~/.codex/sessions/**/rollout-*.jsonl`: `session_meta.cwd` and `response_item/message` with role `user`.
  - Only the last 60 days are read: up to 400 most recent files per tool, and the first 256 KB of each.
  - Prompts that are wrappers or injected context (`<system-reminder>`, `<command-…>`, `<environment_context>`, tool results) are dropped. Prompts are trimmed to 240 characters.
  - Sessions are grouped by **git repository root**, so a session started in a project's wiki counts toward that project. The home folder, the temp folder and the app's own data folder are skipped.
  - The top 12 projects are kept, ranked by session count weighted by recency, each with up to 6 of the Leader's requests.
- **Suggest** (`src/main/suggest.js`): one Claude Code session with **no tools** (`--permission-mode dontAsk`, no allowed tools, guard hook active, working directory in temp) turns the digest into exactly three suggestions: name, title, remit, project folder, authority, cadences and why.
  - `validateSuggestions` keeps only well-formed items. A project folder must be one from the digest; invented folders are dropped. Authority and cadences are clamped to known values.
  - The prompt enforces [[Systems/PATTERN - Voice And Tone]], and the "why" speaks to the Leader as "you", with no third person or gendered pronouns.
- **Officials screen** (`src/renderer/views/suggestions.js`, moved from the Appoint screen on 2026-09-25 at the Leader's request: "I want the suggestions to be here in this view"): a "Suggested for you" section between the header and the Officials. It shows three cards (Official, project folder, why, authority and cadence pills), and suggestions for projects that already have an Official are hidden. **Review and appoint** hands the suggestion to the Appoint screen (`app.ui.pendingSuggestion`), which opens pre-filled, with an isolated copy on. Suggestions are prepared automatically when missing or older than 7 days, unless all work is paused. They can be refreshed on demand, and a note states what is read and what is sent.
- **State**: `state.suggestions = { status: running|ready|failed, generatedAt, items, basis: { claude, codex, projects } }`. A run interrupted by quitting is marked failed on the next start.

## Decisions

- DECISION: the scan reads the Leader's thread files at the Leader's request. Reading *thread history* is not working *in* another project. Appointing an Official to a suggested project is the Leader's choice, and it is the act that opens that project to the harness (see [[Systems/PLAN - Roadmap]] item 13).
- DECISION: suggestions are cached and refreshed weekly rather than on every visit, because each refresh is one Claude session of usage.

## Tried and rejected

- A synchronous scan in the main process. It took about 11 s and would freeze the app, so the scan moved to a utility process.
- Grouping by raw `cwd`. Wiki subfolders showed up as separate "projects" ("Systems", "… - Wiki"), so sessions are now grouped by git root.
- The first wording of "why", which described the Leader in the third person with a gendered pronoun. The prompt now requires "you".

## Open edges

- Codex's 400-file cap can be filled by one busy automated project. The digest still shows it, but quieter projects may drop out of the window.
