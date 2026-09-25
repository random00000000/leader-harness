# Senior Officials

## Intent

> "I should be able to create a Senior Official that will brief me about stuff, maybe I create an official for one of my games and that official leans into Claude Code like Rutines to push work."

> "I feel like commit, push and merge are senior official stuff."

## How it works

- An **Official** has a name, title, remit, optional project folder, authority, model, preferred style, a Briefing cadence, a work cadence and a decision window. It is appointed from the setup console (`#/spawn`), which has four templates: Game minister, Chief of Staff, Director of Research and Quartermaster.
- **Wiki**: each Official gets a Karpathy-style wiki. If there is a project, it lives in the project root as `<Project> - Wiki/`, or reuses one that already exists. If there is no project, it lives in the Official's home folder in userData. An optional checkbox appends the wiki mandate to the project's AGENTS.md. The Official's ledger rows use the Model "Claude Code (Leader Harness: <name>)".
- **Cadence**: `daily at HH:MM`, `interval N minutes` (at least 5) or `manual`. It is checked every 20 seconds. Each kind of job has at most one queued per Official, and one Official never runs two sessions at once.
- **Session kinds**: briefing (structured output against the Briefing schema), work (picks the most valuable item from its wiki), directive (the Leader's order), and operation (one run of a big push).
- **Authority is enforced by Claude Code permissions, not just the prompt** (`toolsFor` in `src/main/prompts.js`, with `--permission-mode dontAsk`):
  - Observe: read, git read commands and web. Edit/Write only inside its wiki.
  - Build: full tools, but `git push`, `merge`, `rebase` and `reset --hard` are denied.
  - Ship: full tools, force-push denied.
- **Big push**: an objective plus N runs (1–50), executed back to back. Each run continues from the wiki. Three failures mark it stalled.
- **Halt** from a popup or the Official's page stops queued work until the Leader resumes it.

## Decisions

- One Official per project, sharing that project's wiki (DECISION, agent default for Q1). Revisit if the Leader wants a Chief of Staff that spans projects; it can already run without a folder and read other paths.
- A new Official's first Briefing is requested immediately, so the Leader sees it working.

## Tried and rejected

- **Prompt-only authority** (OBSERVATION, 2026-09-24): an Observe Official on Haiku was told to set up a build and wrote `package.json`, `index.html` and `server.js` into the project despite "only edit your wiki". That led to the permission enforcement above. Verified afterwards: the same order produced 2 permission denials and only wiki changes.
- **Silently dropping a project path that doesn't exist**: the Official ended up with no project and briefed that it had "no project context". Spawning now fails with "Project folder not found".

## Open edges

- The Build and Ship deny lists match command prefixes. A determined session could use another form, such as `git -C . push`. Revisit with hooks or a git wrapper if Officials push where they shouldn't.
- There is no per-Official usage budget yet. Pacing is global (Sessions at once).
