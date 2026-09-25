# Changelog

One line per merged pull request, newest first. Versions follow semver; releases are built with `npm run release`.

## Unreleased

- Releases also add a Leader Harness entry to the Start menu.

## 0.2.0

- Versioned releases outside the source tree, with smoke test and rollback; the guard blocks pushes to main and gates merges of protected files; authority rules moved to `authority.js`. (Reliability R1, R3)
- Harness Engineer template for self-development. (#10)
- Isolated git worktree per Official. (#9)
- Workspace guard hook on every session. (#8)
- CI for every pull request. (#7)
- Test suite. (#6)
- Scope limited to this repository; serious executive voice; lighter footprint. (#3, #4, #5)

## 0.1.0

- First desktop app: Officials, scheduler, headless Claude Code, briefing formats, Style Studio, decisions, surges.
