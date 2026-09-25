# Leader Harness

An AI harness shaped for leaders: people with more tokens than time.

Most agent harnesses need someone sitting at the prompt. Leader Harness works the other way. You appoint **Senior Officials**, each with a remit and a project. They run Claude Code in the background on their own schedule, and they report to you through **Briefings**. You lead by reading and deciding in short, Hearts of Iron-style event popups, not by prompting.

## What it does

- **Briefings in the style you like:** Cabinet Deck (slides), Manila Dossier, Red Box, and Daily Brief Tablet. The **Style Studio** lets anyone restyle them live and save new styles.
- **Decisions as events:** each one has a few concrete options, one of them recommended. You can also write your own order (Other…) or **Halt** that Official's work. If you don't answer in time, the recommended option is carried out.
- **Senior Officials:** appointed from a setup console. You choose each one's Briefing cadence (daily at a time, repeating, or only when you order it), background work cadence, authority level, and model.
- **Authority enforced by Claude Code permissions**, not just by instructions:
  - Observe: can only edit its own wiki.
  - Build: edits and commits, but can't push or merge.
  - Ship: commits, pushes and merges, but can't force-push.
- **Big push:** commit a block of your usage to one objective, run by run.
- **A wiki per Official:** every Official keeps a self-maintaining, [Karpathy-style wiki](https://github.com/random00000000/self-maintaining-karpathy-style-wiki) as its memory, with a ledger of every order.
- **Runs locally** with your own Claude Code install and login. It lives in the tray, so Officials keep working after you close the window.

## Run it

Requires Windows, Node 22+, and [Claude Code](https://claude.com/claude-code) installed and logged in.

```bash
npm install
npm start
```

`npm run check` syntax-checks the source and renders every built-in style.

## Project status

Version 0.1, built in the open. The project's own wiki is in [`Leader Harness - Wiki/`](Leader%20Harness%20-%20Wiki/Wiki%20Home.md). It holds the vision, the design decisions, the roadmap automation works from, and a ledger of every request that shaped the project.
