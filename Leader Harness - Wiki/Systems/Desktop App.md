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
- **Renderer** (`src/renderer/`): views for the Briefing Room, Decisions, Cabinet, Appoint (setup console), Official, Activity, Style Studio and Settings. `event.js` is the HOI4-style popup.
- **Closing the window hides it to the tray**, so the scheduler keeps running. The tray menu has Pause all work and Quit.
- **Dev hooks**: `LH_USER_DATA=<dir>` isolates state. `LH_CAPTURE=<dir>` together with `LH_ROUTES` (one route per line, `route|js` runs js first) screenshots each route and quits. This is how the UI was verified.
- The **Electron postinstall** is run explicitly by our own `postinstall` script, because npm 11 skipped Electron's download step (FACT, observed 2026-09-24).

## Decisions

- The folder in Downloads (`electron-main`) is the Electron framework's source code, which needs a Chromium build. It was not used; Electron comes from npm instead.
- The state file is plain JSON, not a database. Revisit if briefings or jobs grow past a few thousand.
- Source files use LF line endings, enforced by `.gitattributes`. Python on Windows had silently written CRLF into files it edited, which broke later exact-match edits.

## Tried and rejected

- Passing the Official's wiki with `--add-dir` while scoping permissions by absolute path. On Windows, Claude Code did not match the `//C:/...` absolute rule form, so even the allowed file was denied. Relative rules (`Edit(<Project> - Wiki/**)`) work.

## Open edges

- There is no installer or auto-update yet (electron-builder).
- The app cannot read the subscription's remaining quota. Activity shows sessions, tokens and Claude Code's API-equivalent cost, and pauses the queue when it detects a usage-limit message.
- The app does not auto-start with Windows, so Officials only work while the app runs (window open or in the tray).
