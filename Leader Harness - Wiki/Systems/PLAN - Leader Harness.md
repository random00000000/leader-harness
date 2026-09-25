# PLAN - Leader Harness

## Intent

From the founding request (see [[PROMPT-LEDGER]] row dated 2026-09-24):

> "an AI harness but shaped for a leader to receive briefings, Senior Officials can be created and those senior officials lean on automation to do work."

> "one of the main flaws of current harnesses is that they need the person sitting in fron of the computer to get stuff done, the leadership harness looks to do the opposite"

> "From day one this should look modern and good enough for people to use."

Origin: Briefing reports in different styles (folder, PowerPoint) were built for the human's Hearts of Iron 4 competitor game, and the human liked the result enough to turn it into a harness.

## What the leader wants (agent's reading)

HYPOTHESIS, not contested. The human did not correct it and answered the decisions on top of it.

1. **The bottleneck is attention, not tokens.** Current harnesses only turn tokens into work while a human sits at the prompt. The harness should turn spare tokens into results while the leader is away.
2. **Flip the direction of work.** Agents push Briefings up; the leader reads and decides instead of prompting.
3. **A chain of command replaces the chat window.** The leader delegates areas of responsibility to Senior Officials, not tasks.
4. **Every decision is a bounded choice.** Decision requests turn "what should I prompt?" into "choose A, B or C". (The first version was modeled on Hearts of Iron events; that styling was retired on 2026-09-25 in favour of [[Systems/PATTERN - Voice And Tone]].)
5. **How it feels matters.** The Briefing style is part of the product.
6. **Setup is the only time it looks like Claude Code.** The console is for spawning Officials.
7. **Not tied to one backend.** Claude Code comes first; others can follow.

## Decided (2026-09-24, human's answers)

- **Backend** (DECISION): Claude Code is the main agent. Human: "Claude Code should be the main agent because is better than codex at background work." This replaces the earlier "Codex first" decision. Codex is optional later. Revisit if headless Claude Code can't be driven reliably from the app.
- **D1. First job** (DECISION): being briefed. The Briefings and their styles are the day-one product. Pointing it at the human's projects comes second.
- **D2. Where it runs** (DECISION): locally on the leader's machine, like Claude Code.
- **D3. How the leader is reached** (DECISION): only on the PC for now. No phone or server.
- **D4. Budget unit** (DECISION): subscription usage. It also needs a way to launch a deliberate **surge** (originally "big push"), meaning a concentrated effort that spends a lot of quota on one goal.
- **D5. Senior Officials** (DECISION): the leader creates them freely. Example: an Official for one of the human's games that briefs on it and uses routines like Claude Code's to push work forward.
- **D6. Work tracking** (DECISION): every project the harness handles gets a wiki in this Karpathy pattern. Work is tracked and managed there.
- **D7. Authority** (DECISION): commit, push and merge are Senior Official authority. See the open question Q2 below.
- **D8. Cadence** (DECISION): dynamic and set per project, and it can change over time (e.g. daily now, hourly later for the same project).
- **D9. Ignored events** (DECISION): the recommended option is auto-picked. Every event and Briefing also has a **Halt** button that stops that line of work.
- **D11. Styles** (DECISION): all four styles ship at launch (deck, folder, red box, tablet). They are built on a style system that lets anyone make a new style and change how content looks on the fly.
- **D12. Leader input** (DECISION): inside a Briefing, the leader picks an option or chooses "Other" and types free text, like Claude Code's question prompts. The setup screen is for spawning Senior Officials.
- **D13. App form** (DECISION): a desktop app.
- **D14. Memory** (DECISION): each Official keeps a wiki like this project's, and its automation reads and writes it.
- **D15. Integration** (DECISION): Claude Code first.
- **Scheduler** (DECISION): the app needs its own scheduler to wake Officials and specialists.
- **Quality bar** (DECISION): modern and polished enough for other people to use from day one.

## Still open

On 2026-09-24 the human said "Just start building it". Open items got agent defaults, marked here so the human can overturn them:

- **Q7. Desktop stack** (DECISION, human): Electron. See [[Systems/Desktop App]].
- **D10. Briefing contents** (DECISION, agent default): title, classification, bottom line, situation, actions, risks, decisions, next. See [[Systems/Briefings And Styles]].
- **Q1. Official vs project** (DECISION, agent default): one Official per project, sharing the project's wiki. See [[Systems/Senior Officials]].
- **Q2. What reaches the Leader** (DECISION, agent default): three authority levels (Observe / Build / Ship), enforced by Claude Code permissions. Anything above the level becomes a decision.
- **Q6. When the window closes** (DECISION, agent default): the app keeps running in the tray. It does not auto-start with Windows yet.
- **Q3. "depseek harness"** (QUESTION): still unidentified. The Style Studio is the current guess.
- **Q4. Subscription quota** (PARTIAL): the app shows tokens and API-equivalent cost per session and pauses on usage-limit errors. It cannot read the remaining quota.
- **Q5. Distribution** (QUESTION): each user runs their own Claude Code login. Anthropic's terms for apps built on subscription login still need to be verified before this is shared.

## Tried and rejected

See the Systems pages.

## Open edges

The v0.1 desktop app exists. What's next: an installer, auto-start, per-Official usage budgets, and style import/export.
