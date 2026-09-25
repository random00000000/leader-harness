# PLAN - Reliability

## Intent

> "so if the harness will build the harness we need to make sure we use versioning correctly and we do not land in a place where the harness destroys the harness and it stops working. so make a plan for that reliability"

> "also I would like the .exe to be close to the repo so I can use it easily"

See the [[PROMPT-LEDGER]] row dated 2026-09-25.

## The principle

**The harness the Leader runs is never the code the harness is editing.** The running app is a frozen, versioned build. The Harness Engineer changes the source through pull requests. A change reaches the Leader only as a new release, and only after it has proved it starts and works. Every release can be rolled back with one action.

## Layers of protection

Each layer is independent, so a failure in one is caught by the next.

1. **Isolated workspace** (DONE, roadmap item 4). The Official edits its own git worktree and never touches the Leader's checkout or the running app.
2. **Workspace guard** (DONE, roadmap item 3). Claude Code itself blocks the Official from leaving its workspace, and enforces git authority.
3. **CI gate** (DONE, roadmap item 2). No pull request merges unless `npm run check` (syntax, format rendering, tests) is green.
4. **Smoke test in CI** (roadmap R2). CI also launches the real Electron app headlessly, loads every screen and fails if anything throws or the window does not render. "It still starts" is tested on every PR.
5. **Protected paths need the Leader** (roadmap R3). A pull request that touches the harness's own safety machinery cannot be merged by an Official: the guard blocks `gh pr merge` for such a branch, and the Official must raise a decision in its briefing instead. The protected paths:
   - `src/main/guard.js`
   - `src/main/runner.js`
   - the `AUTHORITY` and `toolsFor` code in `src/main/prompts.js`
   - `src/main/workspace.js`
   - `.github/workflows/`
   - `scripts/release.js`
   - the Scope and Autonomous work sections of `AGENTS.md`
6. **Versioned releases, run from outside the source tree** (roadmap R1). The Leader runs a packaged `.exe` built from a tagged commit. It lives in `release/` next to the repo, with a shortcut in the repo folder. Pulling or merging source never changes the running app.
7. **Release only what passed** (roadmap R1). `npm run release` works only from a clean `main` that matches `origin/main`, runs the checks and the smoke test on the packaged build, bumps the version, tags it, and only then updates the shortcut.
8. **Rollback** (roadmap R1). The last three releases are kept side by side. `npm run rollback` points the shortcut at the previous version. A release that fails its smoke test never becomes current.
9. **State survives upgrades** (roadmap R4). `state.json` carries a `version`. Each new version migrates it forward and writes a backup first (`state.v<old>.bak.json`). An older release reading newer state refuses to write, instead of corrupting it.
10. **Branch protection on GitHub** (roadmap R5, HUMAN). `main` requires the CI check to pass and forbids force-pushes. This is a repository setting, so it is the Leader's to make.

## Versioning rules

- Semantic versioning in `package.json`: patch for fixes, minor for features (one roadmap item is usually a minor bump), major only with the Leader's approval.
- `CHANGELOG.md` gets one line per merged pull request, written by the PR's author.
- Tags are `vX.Y.Z` on `main`, created by `npm run release`. Tags and releases are never rewritten.
- Releases are built and kept locally. Publishing a release on GitHub stays a human decision (see AGENTS.md).

## How the Leader upgrades

1. The Harness Engineer's briefing lists the merged work since the running version.
2. The Leader runs `npm run release` in the repo, or asks an agent to. It builds, smoke-tests, tags and updates the shortcut.
3. The Leader restarts Leader Harness from the shortcut. If anything is wrong, `npm run rollback` returns to the previous version.

## Decisions

- DECISION (2026-09-25): the running app is a packaged build, not `npm start` from the checkout. Revisit if packaging slows iteration too much; `npm start` stays available for development.
- DECISION: releases are local (`release/`, gitignored). A signed installer and auto-update come later, once distribution terms are settled (roadmap item 14).

## Open edges

- QUESTION: should the Harness Engineer be allowed to run `npm run release` itself? Default: no. Releasing changes what the Leader runs, so it stays a Leader action until trust is established.
