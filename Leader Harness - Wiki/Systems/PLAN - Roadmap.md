# PLAN - Roadmap

## Intent

> "I will soon turn on automation to work this harness, is the wiki lacking plans for the automation to implement?"

This is the work queue for unattended sessions. Its rules live in AGENTS.md under "Autonomous work". It builds on [[Systems/PLAN - Leader Harness]], [[Systems/Desktop App]], [[Systems/Senior Officials]] and [[Systems/Briefings And Styles]].

## How to use this page

- Take the **first item whose status is READY**. Do exactly one item per session.
- Change its status to IN PROGRESS when you start, then DONE (with the date), or BLOCKED (with the reason) when you stop.
- An item marked **HUMAN** must never be started by automation. Raise it in the ledger's AI Notes instead.
- Each item is finished only when its acceptance criteria are met *and* its verification steps pass. When built, move the durable content into the relevant Systems page, then delete it here.
- Add newly discovered work to the bottom as READY or HUMAN. Never reorder items above the one you are working on.

## Queue

### 1. Test suite: READY
Why: automation needs a safety net before changing the scheduler or permissions.
- Add `npm test`, using `node --test` (no new dependencies) under `test/`.
- Cover:
  - `isDue` / `nextDue` for daily, interval and manual cadences, including across midnight.
  - `Scheduler.enqueue` deduplication.
  - `expireDecisions`: taking the recommended option creates a directive job.
  - `resolve` with `{halt:true}`: the official is halted and no job is created.
  - `toolsFor`: Observe is scoped to a relative wiki path, and throws when the wiki is outside cwd. Build/Ship deny lists are present.
  - `ensureWiki`: creates `<Name> - Wiki` with `Wiki Home.md` and `PROMPT-LEDGER.md`, and reuses an existing wiki.
  - `detectRateLimit`: parses the epoch form and falls back to +30 min.
- The scheduler must run without Electron. Construct it with a fake store and fake `notify`, and never spawn `claude`.

Acceptance: `npm test` passes, and `npm run check` also runs the tests.
Verify: break `isDue` on purpose and confirm the tests fail, then revert.

### 2. Briefing continuity: READY
Why: each Briefing currently starts cold apart from the job summaries.
- In `briefingPrompt`, include the previous Briefing's `bluf`, `next[]`, and the outcomes of its decisions (the chosen option or free text, and whether it was auto-decided).
- Ask the Official to state in `situation` whether last time's `next` items happened.

Acceptance: a unit test shows the prompt contains the previous `next` items and the decision outcomes.
Verify: `npm test`.

### 3. Per-Official usage budget: READY
Why: D4 says subscription usage is the main resource, and one Official can currently use it all.
- Add official fields `maxSessionsPerDay` (default 12) and `maxTokensPerDay` (default 0, meaning no limit), editable in the orders form.
- Counters reset at local midnight. Big push runs count toward them.
- When over budget, the scheduler skips that Official's scheduled and big push jobs; they stay queued. Leader orders (directive jobs) always run.
- Show "Budget: n/12 today" on the Cabinet card and Official page.

Acceptance: unit tests for the skip rule and the midnight reset.
Verify: `npm test`, then an `LH_CAPTURE` screenshot of the Cabinet (see Verification recipes).

### 4. Launch at login: READY
Why: Officials only work while the app runs.
- Add a Settings checkbox "Start Leader Harness when I sign in to Windows", using `app.setLoginItemSettings({ openAtLogin, args: ['--hidden'] })`.
- With `--hidden`, the app starts in the tray and the window stays hidden.
- Off by default.

Acceptance: the setting persists across restarts; `app.getLoginItemSettings()` reflects it.
Verify: capture Settings. Do not leave the setting enabled on the dev machine after testing.

### 5. Style import/export: READY
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

### 6. Live session view: READY
Why: the Leader should be able to glance at what a running Official is doing.
- Switch the runner to `--output-format stream-json --verbose`. Keep the final `result` event as the source of the outcome, and store the last 20 tool-use lines on the running job (`job.trail`).
- Activity and the Official page show the trail for running jobs.
- The parsing must tolerate partial lines.

Acceptance: a unit test feeds recorded stream lines into the parser and gets the same outcome object as today.
Verify: one real session with `model: haiku` (see the usage rule in AGENTS.md).

### 7. Harden git denies with a hook: READY
Why: the Build/Ship deny rules match prefixes only, so `git -C . push` would get past them (see [[Systems/Senior Officials]], Open edges).
- For Build and Ship runs, pass `--settings` with a PreToolUse hook on Bash. It runs `node resources/hooks/git-guard.js`, which blocks by regex:
  - Build: any git `push`, `merge`, `rebase` or `reset --hard`.
  - Ship: force pushes.
- It exits with code 2 and a reason.

Acceptance: unit tests for the regex against a list of evasions (`git -C x push`, `git push --force`, `git   push`, `git.exe push`).
Verify: one real haiku session under Build, ordered to "push", must show a denial.

### 8. Installer: READY
Why: "good enough for people to use" needs an install.
- Add electron-builder (devDependency) with an NSIS target and the `npm run dist` script, using `resources/icon.png` (convert to .ico if needed).
- Output goes to `dist/`, which is gitignored.
- Do not publish it or upload it anywhere.

Acceptance: `npm run dist` produces an installer; the unpacked app launches and shows the Briefing Room.
Verify: `dist/win-unpacked/Leader Harness.exe` with `LH_CAPTURE`.

### 9. First commit and private GitHub repo: HUMAN
The human was offered `random00000000/leader-harness` (private) on 2026-09-24 and has not answered yet. Automation must not create remotes or push.

### 10. Distribution terms: HUMAN (Q5)
Verify Anthropic's terms for apps that drive a user's own Claude Code subscription login before anything is shared with other people.

### 11. "depseek harness" reference: HUMAN (Q3)
Waiting for the human to identify it. Do not redesign the Style Studio on a guess.

### 12. Codex backend: HUMAN
"Codex may follow later." Not scheduled until the human asks.

## Open edges

- The queue order is the agent's proposal (DECISION, 2026-09-25). The human may reorder it; the order on this page wins.
