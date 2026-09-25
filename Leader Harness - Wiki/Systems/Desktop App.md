# Desktop App

## Intent

> "lets use electron, I think there is an electron thing downloaded in my downloads or desktop. Just start building it"

It builds on the decisions in [[Systems/PLAN - Leader Harness]]: a local desktop app, Claude Code first, a modern look from day one, and a setup screen whose job is spawning Senior Officials. See the [[PROMPT-LEDGER]] rows dated 2026-09-24.

## How it works

- **Stack** (DECISION): Electron 44 with plain ES modules in the renderer and no build step. `npm start` runs the app and `npm run check` runs the sanity checks. Revisit if the UI outgrows hand-written DOM code; React plus Vite is the obvious next step.
- **Main process** (`src/main/`):
  - `main.js`: window, tray, notifications, IPC.
  - `store.js`: one JSON state file in userData, written atomically.
  - `scheduler.js`: cadences, job queue, decisions.
  - `runner.js`: headless `claude -p`.
  - `prompts.js`: persona, prompts, authority, Briefing schema.
  - `wiki.js`: scaffolds each Official's wiki.
  - `welcome.js`: the first-run Briefing.
- **Renderer** (`src/renderer/`): views for the Briefing Room, Decisions, Officials, Appoint (setup console), Official, Activity, Style Studio and Settings. `decision.js` is the decision request modal.
- **Closing the window destroys it**; the main process, scheduler and tray keep running, and the tray or a second launch recreates the window. The tray menu has Pause all work and Quit.
- **Dev hooks**: `LH_USER_DATA=<dir>` isolates state. `LH_CAPTURE=<dir>` together with `LH_ROUTES` (one route per line, `route|js` runs js first) screenshots each route and quits without starting the scheduler. In normal mode the scheduler runs, so demo states must set `settings.paused: true`. This is how the UI was verified.
- The **Electron postinstall** is run explicitly by our own `postinstall` script, because npm 11 skipped Electron's download step (FACT, observed 2026-09-24).

## Performance

Intent: "we need to make it run super light weight because currently it feels like it sows my computer" (2026-09-25).

- FACT (measured 2026-09-25, Windows, demo state, all work paused):

  | State | Before | After |
  |---|---|---|
  | Window open | 5 processes, ~398 MB | 5 processes, ~365 MB, ~2% of one core idle |
  | Window closed | ~398 MB (window hidden, not freed) | 3 processes, ~176 MB, 0 CPU |

- OBSERVATION: the real load is the Claude Code sessions. One Official session measured ~354 MB with sustained CPU. So sessions run at **below-normal OS priority** (`os.setPriority` in `runner.js`; child processes inherit it), and the default is one session at a time.
- DECISION: GPU acceleration is disabled (`app.disableHardwareAcceleration()`); the UI is simple enough for software rendering. `LH_GPU=1` re-enables it. Revisit if scrolling large briefings stutters.
- DECISION: no infinite CSS animations and no backdrop blur. The renderer's 30-second refresh skips when the document is hidden. The Claude Code path lookup is cached (`findClaude`) instead of running on every state push.
- Rule for contributors: measure before and after any change that could add weight (see Dev hooks), and keep idle CPU at zero when the window is closed.

## Decisions

- The folder in Downloads (`electron-main`) is the Electron framework's source code, which needs a Chromium build. It was not used; Electron comes from npm instead.
- The state file is plain JSON, not a database. Revisit if briefings or jobs grow past a few thousand.
- Source files use LF line endings, enforced by `.gitattributes`. Python on Windows had silently written CRLF into files it edited, which broke later exact-match edits.

## Tried and rejected

- Measuring performance with the dev data dir in normal mode while the demo state had an active surge: the scheduler started a real Claude Code session. Demo states must set `settings.paused: true`.

- Passing the Official's wiki with `--add-dir` while scoping permissions by absolute path. On Windows, Claude Code did not match the `//C:/...` absolute rule form, so even the allowed file was denied. Relative rules (`Edit(<Project> - Wiki/**)`) work.

## Open edges

- There is no installer or auto-update yet (electron-builder).
- The app cannot read the subscription's remaining quota. Activity shows sessions, tokens and Claude Code's API-equivalent cost, and pauses the queue when it detects a usage-limit message.
- The app does not auto-start with Windows, so Officials only work while the app runs (window open or in the tray).
