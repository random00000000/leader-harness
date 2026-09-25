# Senior Officials

## Intent

> "I should be able to create a Senior Official that will brief me about stuff, maybe I create an official for one of my games and that official leans into Claude Code like Rutines to push work."

> "I feel like commit, push and merge are senior official stuff."

## How it works

- An **Official** has a name, title, remit, optional project folder, authority, model, preferred style, a Briefing cadence, a work cadence and a decision window. It is appointed from the setup console (`#/appoint`), which has four templates: Project Lead, Chief of Staff, Director of Research and Head of Engineering.
- **Wiki**: each Official gets a Karpathy-style wiki. If there is a project, it lives in the project root as `<Project> - Wiki/`, or reuses one that already exists. If there is no project, it lives in the Official's home folder in userData. An optional checkbox appends the wiki mandate to the project's AGENTS.md. The Official's ledger rows use the Model "Claude Code (Leader Harness: <name>)".
- **Cadence**: `daily at HH:MM`, `interval N minutes` (at least 5) or `manual`. It is checked every 20 seconds. Each kind of job has at most one queued per Official, and one Official never runs two sessions at once.
- **Session kinds**: briefing (structured output against the Briefing schema), work (picks the most valuable item from its wiki), directive (the Leader's instruction), and operation (one run of a surge).
- **Authority is enforced by Claude Code permissions, not just the prompt** (`toolsFor` in `src/main/prompts.js`, with `--permission-mode dontAsk`):
  - Observe: read, git read commands and web. Edit/Write only inside its wiki.
  - Build: full tools, but `git push`, `merge`, `rebase` and `reset --hard` are denied.
  - Ship: full tools, force-push denied.
- **Scope**: every session's persona says to stay inside the working directory and ignore other projects named by skills or templates (added 2026-09-25, after the `llm-wiki` skill was found to point agents at the human's game VictoryMarche). The workspace guard below enforces it.
- **Workspace guard** (`src/main/guard.js`, roadmap item 3): every session runs with `--settings` holding a PreToolUse hook, `"<node>" guard.js`. `LH_GUARD_ROOT` (the working directory) and `LH_GUARD_AUTHORITY` are set in the session's environment. It blocks with exit code 2 and a reason:
  - File tools (Read, Edit, MultiEdit, Write, NotebookEdit, Glob, Grep): any path outside the workspace.
  - Bash/PowerShell: absolute paths outside it (`C:\...` and Git Bash `/c/...` forms), `..` escapes, and home references (`~`, `$HOME`, `%USERPROFILE%`).
  - Observe/Build: git `push`, `merge` and `rebase` however they are spelled (`git -C x push`, `git.exe push`), `reset --hard`, and `gh pr merge`.
  - Every level: force pushes.
  - The guard **fails closed**: bad input, a missing root, or any internal error blocks. The runner self-tests the guard (one allowed and one blocked call) before any session, and refuses to start sessions if Node.js is missing or the self-test fails.
  - Verified 2026-09-25 with a real haiku session: the inside read passed; `../outside.txt` via Read and via `cat`, and `git push` under Build, were all blocked.
- **Surge** (called "big push" before 2026-09-25): an objective plus N runs (1–50), executed back to back. Each run continues from the wiki. Three failures mark it stalled.
- **Halt** from a popup or the Official's page stops queued work until the Leader resumes it.

## Decisions

- One Official per project, sharing that project's wiki (DECISION, agent default for Q1). Revisit if the Leader wants a Chief of Staff that spans projects; it can already run without a folder and read other paths.
- A new Official's first Briefing is requested immediately, so the Leader sees it working.

## Tried and rejected

- **Allowing the system temp folder in the guard** (2026-09-25): a real session read a neighbouring file through `cat ../outside.txt` because the workspace sat inside temp. Temp holds other programs' files, so only the workspace itself is allowed now.

- **Prompt-only authority** (OBSERVATION, 2026-09-24): an Observe Official on Haiku was told to set up a build and wrote `package.json`, `index.html` and `server.js` into the project despite "only edit your wiki". That led to the permission enforcement above. Verified afterwards: the same order produced 2 permission denials and only wiki changes.
- **Silently dropping a project path that doesn't exist**: the Official ended up with no project and briefed that it had "no project context". Spawning now fails with "Project folder not found".

## Open edges

- The guard reads command text, so an indirect route (a script file that pushes, or a path assembled at run time) could still get past it. Revisit with a git credential or wrapper boundary if an Official ever does this.
- There is no per-Official usage budget yet. Pacing is global (Sessions at once).
