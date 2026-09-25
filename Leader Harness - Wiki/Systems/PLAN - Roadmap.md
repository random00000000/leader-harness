# PLAN - Roadmap

## Intent

> "I will soon turn on automation to work this harness, is the wiki lacking plans for the automation to implement?"

This is the work queue for unattended sessions. Its rules live in AGENTS.md under "Autonomous work". It builds on [[Systems/PLAN - Leader Harness]], [[Systems/Desktop App]], [[Systems/Senior Officials]] and [[Systems/Briefings And Styles]].

## How to use this page

- Take the **first item whose status is READY**. Do exactly one item per session.
- Change its status to IN PROGRESS when you start, then DONE (with the date), or BLOCKED (with the reason) when you stop.
- An item marked **HUMAN** must never be started by automation. Raise it in the ledger's AI Notes instead.
- Each item is finished only when its acceptance criteria are met *and* its verification steps pass. When built, move the durable content into the relevant Systems page, then collapse the item here to a one-line DONE stub (numbers stay stable because other pages refer to them).
- Add newly discovered work to the bottom as READY or HUMAN. Never reorder items above the one you are working on.

## Queue

Goal (the human, 2026-09-25): "Ideally the harness gets to a state that can develop features for the harness." Items 1–5 build toward that goal; item 6 is the moment the harness starts working on itself. Until then, and afterwards unless the human says otherwise, the harness and its automation touch **only this repository** (see "Scope" in AGENTS.md).

### 1. Test suite: DONE (2026-09-25)
`npm test` (node:test, 23 tests in `test/`); `npm run check` runs it too. See [[Systems/Desktop App]], Tests.

### 2. Continuous integration: DONE (2026-09-25)
`.github/workflows/check.yml` runs `npm run check` on every pull request and push to main. See [[Systems/Desktop App]], CI.

### 3. Workspace guard hook: DONE (2026-09-25)
`src/main/guard.js` runs as a PreToolUse hook on every session and fails closed. See [[Systems/Senior Officials]], Workspace guard.

### 4. Isolated workspace per Official: DONE (2026-09-25)
`src/main/workspace.js`: each git-project Official works in its own worktree on `official/<name>`. See [[Systems/Senior Officials]], Isolated workspace.

### 5. Self-development template: DONE (2026-09-25)
The setup console offers **Harness Engineer** when the project folder is this repository. See [[Systems/Senior Officials]], Harness Engineer. Acceptance run: a real haiku Official picked item 7, built it on a branch and briefed about it. It also pushed straight to `main` when no pull request was possible, which led to R3.

### Reliability (see [[Systems/PLAN - Reliability]])
The harness must never be able to break the harness. These items come before and alongside self-development.

#### R1. Versioned releases outside the source tree: DONE (2026-09-25)
`npm run release` builds, smoke-tests, tags and switches the `Leader Harness.lnk` shortcut in the repo. `npm run rollback` goes back one version. See [[Systems/Desktop App]], Releases.

#### R2. Smoke test in CI: READY
Why: "it still starts" must be tested on every pull request, not only at release time.
- Move the smoke test out of `scripts/release.js` into `scripts/smoke.js`, usable against both `npx electron .` and a packaged exe.
- In CI, download the Electron binary for this job only, then run the smoke test against `npx electron .` on `windows-latest`. It must render every screen, and fail on any renderer error or blank screen.
- Also fail if the main process logs an uncaught exception.

Acceptance: CI fails on a PR that breaks `app.js` (try it on a throwaway branch) and passes on main.
Verify: `gh pr checks` on the PR that adds it.
Protected: this touches `.github/workflows/`, so the Leader merges it.

#### R3. No pushes to main, merge gate for protected files: DONE (2026-09-25)
The guard blocks pushes to `main`/`master` at every authority. It also blocks `gh pr merge` when the pull request touches protected harness files. See [[Systems/Senior Officials]], Workspace guard.

#### R4. State versioning and migrations: READY
Why: a new release must never corrupt the Leader's state, and an older release must never overwrite newer state.
- `state.json` gets `schemaVersion` (start at 2; files without it are 1).
- `src/main/migrations.js` has an ordered list of pure functions `vN → vN+1`. `Store.load` applies them in order, and first writes `state.v<old>.bak.json` next to the file.
- A state with a higher `schemaVersion` than the app knows opens read-only, with a notice: "This data was written by a newer Leader Harness. Open the newer version, or roll back your data from the backup."
- Unknown fields are always preserved.

Acceptance: unit tests for migration order, the backup file, read-only on a newer version, and preservation of unknown fields.
Verify: `npm test`.

#### R5. Branch protection on GitHub: HUMAN
Require the `check` status on `main`, forbid force-pushes and deletion. This is a repository setting, so the Leader decides and applies it.

### 6. The harness develops itself: HUMAN
The human appoints the Harness Engineer (item 5) from the released app (the `Leader Harness.lnk` shortcut, not `npm start`), on this repository, and chooses its cadence. Prerequisites R1 and R3 are done. From then on, new roadmap items are delivered by the harness's own Official, and the human reads its briefings. Automation must not appoint it.

### 7. Briefing continuity: READY
Why: each Briefing currently starts cold apart from the job summaries.
- In `briefingPrompt`, include the previous Briefing's `bluf`, `next[]`, and the outcomes of its decisions (the chosen option or free text, and whether it was auto-decided).
- Ask the Official to state in `situation` whether last time's `next` items happened.

Acceptance: a unit test shows the prompt contains the previous `next` items and the decision outcomes.
Verify: `npm test`.

### 8. Per-Official usage budget: READY
Why: D4 says subscription usage is the main resource, and one Official can currently use it all.
- Add official fields `maxSessionsPerDay` (default 12) and `maxTokensPerDay` (default 0, meaning no limit), editable in the instructions form.
- Counters reset at local midnight. Surge runs count toward them.
- When over budget, the scheduler skips that Official's scheduled and surge jobs; they stay queued. Leader instructions (directive jobs) always run.
- Show "Budget: n/12 today" on the Officials card and Official page.

Acceptance: unit tests for the skip rule and the midnight reset.
Verify: `npm test`, then an `LH_CAPTURE` screenshot of the Officials screen (see Dev hooks in [[Systems/Desktop App]]).

### 9. Launch at login: READY
Why: Officials only work while the app runs.
- Add a Settings checkbox "Start Leader Harness when I sign in to Windows", using `app.setLoginItemSettings({ openAtLogin, args: ['--hidden'] })`.
- With `--hidden`, the app starts in the tray and the window stays closed.
- Off by default.

Acceptance: the setting persists across restarts; `app.getLoginItemSettings()` reflects it.
Verify: capture Settings. Do not leave the setting enabled on the dev machine after testing.

### 10. Style import/export: READY
Why: D11 says anyone should be able to make and share styles.
- In the Style Studio, add "Export" (save dialog, writes the style JSON) and "Import" (open dialog).
- Validate imports:
  - `layout` must be one of deck, dossier, redbox or tablet.
  - Var keys must match `^--[\w-]+$`, and values must be strings of 200 characters or fewer.
  - `css` must be a string of 200 KB or less.
  - Unknown fields are dropped.
- The imported style gets a new `custom-…` id, so it never overwrites a built-in style.

Acceptance: importing an exported style round-trips; invalid files show an error toast and write nothing.
Verify: `npm test` (the validator is a pure function), then capture the Studio.

### 11. Live session view: READY
Why: the Leader should be able to glance at what a running Official is doing.
- Switch the runner to `--output-format stream-json --verbose`. Keep the final `result` event as the source of the outcome, and store the last 20 tool-use lines on the running job (`job.trail`).
- Activity and the Official page show the trail for running jobs.
- The parsing must tolerate partial lines.

Acceptance: a unit test feeds recorded stream lines into the parser and gets the same outcome object as today.
Verify: one real session with `model: haiku` (see the usage rule in AGENTS.md).

### 12. Installer: READY
Why: "good enough for people to use" needs an install. R1 already produces a portable, versioned build for the Leader; this item adds a one-file installer for other people.
- Add electron-builder (devDependency) with an NSIS target and the `npm run dist` script, using `resources/icon.png` (convert to .ico if needed).
- Output goes to `dist/`, which is gitignored.
- Do not publish it or upload it anywhere.

Acceptance: `npm run dist` produces an installer; the unpacked app launches and shows the Briefing Room.
Verify: `dist/win-unpacked/Leader Harness.exe` with `LH_CAPTURE`.

### 13. Other projects: HUMAN
The human's other projects (their games and tools in sibling folders) are off limits until the human explicitly opens one to the harness. Nothing in this roadmap may read, test against, or appoint an Official to them.

### 14. Distribution terms: HUMAN (Q5)
Verify Anthropic's terms for apps that drive a user's own Claude Code subscription login before anything is shared with other people.

### 15. "depseek harness" reference: HUMAN (Q3)
Waiting for the human to identify it. Do not redesign the Style Studio on a guess.

### 16. Codex backend: HUMAN
"Codex may follow later." Not scheduled until the human asks.

## Decided

- **Public repo** (DECISION, human, 2026-09-25): "the repo should be public for this project". It is https://github.com/random00000000/leader-harness. Commits use the GitHub noreply identity.
- **Automation ships its own work** (DECISION, human, 2026-09-25): "commit, push and merge". This matches D7 (commit, push and merge are Senior Official authority). The flow is in AGENTS.md under "Autonomous work". Revisit if an automated merge breaks main.

- **MIT license** (DECISION, human, 2026-09-25): "use MIT license". Added `LICENSE`, with `"license": "MIT"` in package.json.
- **Harness only** (DECISION, human, 2026-09-25): "it is too early for that so we can use it to keep building this harness but not to touch my other projects. Ideally the harness gets to a state that can develop features for the harness". The queue now leads to self-development (items 3–6), and other projects are off limits (item 13).
- **README for humans** (DECISION, human, 2026-09-25): the README is written for visitors, with real screenshots in `docs/screenshots/` taken from seeded demo data. When the UI changes noticeably, retake them with the `LH_CAPTURE` hook (see [[Systems/Desktop App]]).

## Open edges

- The queue order is the agent's proposal (DECISION, 2026-09-25). The human may reorder it; the order on this page wins.
