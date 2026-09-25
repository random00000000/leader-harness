# Leader Harness — Wiki Home

> The wiki is the brain. Agent sessions are temporary compute.
> Open this folder (`Leader Harness - Wiki/`) as your Obsidian vault and start here.

## What this project is

Leader Harness is an AI harness for leaders of organizations: people who have more tokens than time. Most harnesses need someone at the keyboard. This one works the other way. Senior Officials run scheduled specialist agents (Claude Code first, Codex possibly later) that do the work while the leader is away. The Senior Officials then report up through **Briefings** in a format the leader picks: Slide Deck, Dossier, Red Box or Daily Brief. The leader answers short decision requests. The voice is serious and executive (see [[Systems/PATTERN - Voice And Tone]]), and the app is built to stay light on the machine. It is a local desktop app. Each project it manages keeps its own wiki in this same pattern. Version 0.1 of the desktop app exists: `npm install`, then `npm start`.

## Always-current pages

- [[PROMPT-LEDGER]] — every human request with a one-line result. Read this first to get familiar with intent.
- [[Systems/PLAN - Leader Harness|PLAN - Leader Harness]] — the product vision, the decisions made, and the questions still open.
- [[Systems/PLAN - Roadmap|PLAN - Roadmap]] — the ordered work queue for automation: READY items with acceptance criteria and verification steps, and HUMAN items that wait for the Leader.
- [[Systems/Desktop App|Desktop App]] — the Electron app: structure, how to run it, and dev hooks.
- [[Systems/Senior Officials|Senior Officials]] — appointing Officials, cadences, authority enforcement, surges.
- [[Systems/Briefings And Styles|Briefings And Styles]] — the Briefing schema, the four formats, the Style Studio and decision requests.
- [[Systems/PATTERN - Voice And Tone|PATTERN - Voice And Tone]] — the binding vocabulary and visual restraint for everything the Leader sees.

## How this wiki works

- Plain Markdown and [[wikilinks]] only — no Obsidian plugins required.
- Systems pages are written on the fly as systems are built, never retroactively. When a system changes, its page changes in the same session.
- Requests and outcomes go to [[PROMPT-LEDGER]] immediately; distilled knowledge goes to the relevant system page; nothing here is a conversation dump.
- Uncertainty is labeled (FACT / OBSERVATION / HYPOTHESIS / DECISION / QUESTION); speculation never becomes fact by repetition.
