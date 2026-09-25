# Leader Harness — Agent Instructions

This file is the single source of agent instructions for this project. Codex reads it directly; Claude Code reads it through `CLAUDE.md`, which imports it.

## Project

Leader Harness is an AI harness shaped for leaders of organizations. The leader sits at the top of a pyramid: a Senior Official produces **Briefings** for the leader, and specialist agents run on schedules (hourly, daily, ...) to do the work. The leader acts by answering short decision requests rather than sitting at a prompt. The product voice is serious and executive, like an intelligence service; all user-facing text follows `Leader Harness - Wiki/Systems/PATTERN - Voice And Tone.md`. It must stay lightweight on the leader's machine (see `Systems/Desktop App.md`, Performance). Claude Code is the main agent backend (it is better at background work); Codex may follow later. It is a desktop app that runs locally on the leader's machine.

**Current phase: building v0.1.** The app is Electron with plain ES modules and no build step: `npm install`, `npm start`, and `npm run check` (run it before finishing any change). Main process code is in `src/main/`, the renderer in `src/renderer/`, and Briefing styles in `styles/`. Source files use LF line endings. Record designs not yet built as `PLAN - <Name>.md` pages in the wiki's `Systems/` folder.

## Scope

Work on this repository only. The human's other projects, in sibling folders such as games and tools, are off limits until the human explicitly opens one to the harness:
- Never read, search, test against, or modify files outside this repository, the system temp folder, or the app's dev data folders (`LH_USER_DATA`).
- This applies even when a skill or template names another project as an example or "reference implementation". Use this repository's own wiki as the reference instead.
- End-to-end tests use throwaway projects created in the temp folder. Never appoint an Official to a real project.

## Autonomous work

Unattended sessions (routines and scheduled agents) work from `Leader Harness - Wiki/Systems/PLAN - Roadmap.md`. The rules:

- Do one item per session: the first READY item. Never start an item marked HUMAN, and never make a decision the plan labels QUESTION. Log the blocker in the ledger instead.
- Ship each item through a pull request. The repo is public: https://github.com/random00000000/leader-harness.
  1. Branch from an up-to-date `main` as `auto/<item number>-<short-name>`.
  2. Commit, then push the branch.
  3. Run `gh pr create`. The PR body names the roadmap item and lists how it was verified.
  4. Once `gh pr checks` passes (or, before CI exists, once your local checks pass), run `gh pr merge --squash --delete-branch`, then sync `main`.
- Never push to `main` directly, never force-push, and never rewrite published history.
- Never change repository settings, visibility, secrets or collaborators, and never publish releases.
- Never commit anything secret: tokens, `.env` files, user data, or `state.json`.
- Before finishing: `npm run check` must pass (it also runs `npm test`). New behaviour comes with tests in `test/`, and tests never spawn Claude Code. For UI changes, screenshot the affected screens with `LH_USER_DATA=<temp dir> LH_CAPTURE=<scratch dir> LH_ROUTES=<routes> npx electron .` and look at the images. Never run the app against the real user data folder.
- Real Claude Code sessions cost the human's usage. In tests use `model: haiku`, at most 2 real sessions per work session, and only when the item's verification step asks for it.
- Never loosen authority enforcement (`toolsFor`, the deny lists, `--permission-mode dontAsk`) unless a roadmap item says so.
- Update the roadmap item's status, the relevant Systems page, and the ledger in the same session. For scheduled runs, the ledger Request cell names the trigger (e.g. "Scheduled roadmap session: item 3").

## Persistent Project Wiki (Wiki Brain)

Development must compound across sessions. The wiki is the brain; agent sessions are temporary compute. The wiki lives in `Leader Harness - Wiki/` as plain Obsidian-compatible Markdown with [[wikilinks]] — the human opens that folder as their Obsidian vault.

### Naming conventions (exact)

These names are literal, so any agent's `[[wikilinks]]` resolve for the next agent and the human always knows their way around:

- Wiki folder: `<Project Display Name> - Wiki/` at the repo root — Title Case display name with spaces, separator exactly ` - `.
- Fixed files: `Wiki Home.md`, `PROMPT-LEDGER.md` (all-caps — never `log.md` or any other name), folder `Systems/` (capital S). The wiki folder always carries the project's display name; a bare `Wiki/` folder is wrong.
- Systems pages: Title Case noun phrases with spaces (`Marching Column.md`) — never kebab-case, snake_case, or camelCase; no dates in filenames; no YAML frontmatter.
- Prefixed pages in `Systems/`: `PLAN - <Name>.md` for designs not yet built; `PATTERN - <Name>.md` for reusable patterns. Uppercase prefix + ` - `.
- Other Title Case top-level pages are allowed for cross-cutting knowledge; `Human Notes.md` is written only by the human.
- Ledger table columns, exact: `| Date | Model | Request | Result (one line) | AI Notes | Human Notes |` — dates `YYYY-MM-DD`, newest row at the top.
- Wikilinks match filenames exactly, including folder and prefix: `[[Systems/PLAN - The Campaign]]`.
- Never substitute another wiki layout (no `index.md`/`log.md`/`raw/`, no kebab-case). Migrate or archive such structures; never mix patterns.

### Session startup

Before non-trivial work, read the wiki's `Wiki Home.md` and `PROMPT-LEDGER.md` (latest rows = latest intent), plus only the Systems pages the task touches. Load the smallest context that is sufficient.

### Prompt ledger (mandatory, every prompt, immediately)

Every single human prompt gets its own row in `Leader Harness - Wiki/PROMPT-LEDGER.md`, written immediately when the work for that prompt is finished — never batched to the end of a session. No exemptions for small prompts, bug reports, questions, or meta-requests. The ONLY exception is an explicit instruction from the human to not log that specific prompt. Prepend new rows at the top of the table (latest first). Every row records a Model column naming the exact agent/harness that did the work (e.g. "Claude Sonnet 5", "Codex", "Z Code") — always filled in, never blank, never guessed on the human's behalf, and never relabeled by a different model later. The Request cell holds the human's EXACT prompt, verbatim: typos, spacing and wording kept as sent, never summarized, paraphrased or corrected. Only line breaks become `<br>` and `|` is escaped as `\|`. Intent is preserved in the human's own words. One-line results only. Notes are split into AI Notes (written by whichever model worked the row) and Human Notes (written only by the human — an agent never writes there). Failures are never silently dropped; late changes are `UPDATE (date):` notes appended to AI Notes (or Human Notes for the human's own follow-up), never rewrites.

**Multiple human messages can land inside one continuous agent turn** — Claude Code surfaces a follow-up, correction, or new request mid-task via a system-reminder ("This is how Claude Code surfaces messages the user sends mid-turn...") rather than waiting for a reply first. Treat every arrival as its own prompt boundary: write the row for whatever the prior prompt's work has reached at that moment — even if only partial or discussion-only — before continuing into the new request. Do not defer everything to one merged end-of-task wrap-up; that is exactly how rows get forgotten.

### Systems wiki (build it while you build the system)

Whenever a system is created or substantially extended, create or update `Leader Harness - Wiki/Systems/<System>.md` IN THE SAME WORK SESSION — never as a deferred backlog item. Capture: the human intent (quote the request, link the ledger row), how it works (rules, constants, file references), decisions with "revisit if" conditions, what was tried and rejected, and open edges.

### During work: capture as you go

When important information appears naturally — the human says something feels wrong, a test reveals a problem, an approach fails, an assumption breaks — update the relevant wiki page without being asked. Label knowledge honestly (FACT / OBSERVATION / HYPOTHESIS / DECISION / QUESTION). Speculation becomes fact only through evidence, never repetition.

### End of every session: memory pass

Before finishing meaningful work: ensure every prompt from the session is in the ledger; ensure the Systems pages for anything touched are current; keep `Wiki Home.md` links accurate; merge or delete stale material. Skip only for trivial sessions — when in doubt, do the pass.

### Principles

- Memory means integration, not storage: an observation must change a page or the ledger, not sit in a transcript.
- Notes are distilled meaning, never conversation dumps.
- Minimal change: update one existing paragraph over creating three new files.
- Never rewrite ledger rows or history; append updates.

The test: a completely fresh session reading only `Wiki Home.md` and `PROMPT-LEDGER.md` should know what exists, what was tried and rejected, what is being built now, and what to do next — without the human reconstructing context.
