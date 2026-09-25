# Briefings And Styles

## Intent

> "I want all mentioned styles built at first in a way anyone can later do a style similar to what depseek harness did where people can change how content looks on the fly."

## How it works

- **Briefing schema** (DECISION, agent default for D10; `BRIEFING_SCHEMA` in `src/main/prompts.js`):
  - title and classification (ROUTINE / PRIORITY / FLASH);
  - bluf (at most two sentences);
  - situation[], actions[{text, status}], risks[{text, level}], next[];
  - decisions[] (at most 3, each with 2–4 options, exactly one recommended).

  It is produced with `claude -p --json-schema`, and the result is read from `structured_output`.
- **Layout vs style**:
  - A *layout* (`src/renderer/layouts/`: deck, dossier, redbox, tablet) turns the schema into HTML plus its structural CSS.
  - A *style* (`styles/*.json` built in, or `userData/styles/*.json` custom) picks a layout and supplies CSS variables and extra CSS. With `replaceLayoutCss`, it replaces the layout's CSS entirely.
- **Utilitarian layout rules** (2026-09-25, from "polish the reports to be more utilitarian. the folder should look more like a folder and each style should be more polished"):
  - Every format follows the same reading order: bottom line → decisions → situation → actions → risks → next.
  - Each opens with an at-a-glance strip (`glance()`: decisions pending, actions done/total, blocked, high risks) and carries a filing reference (`fileRef()`, e.g. LH-2509-4F2A).
  - Actions and risks render as status tables (`actionRows()`, `riskRows()`; risks sorted high first). All three helpers are in `layouts/common.js`.
- **Built-in styles**:
  - Slide Deck: 16:9 slides with a running header (section, briefing, classification, page) and footer (Official, reference). The cover carries the numbers and a "Review the decision now" jump. Decision slides are marked in the dot navigation.
  - Dossier: a manila file folder (labelled tab with the reference and a classification flag, a crease, a darker lower edge) holding a memorandum on a two-prong fastener, with two sheets peeking out behind. The memo header is a table (From, To, Date, Subject, Ref), and classification banners run at the top and bottom of the page.
  - Red Box: a stitched leather despatch box with gold tooling and a brass lock. It opens onto a Whitehall-style submission using UK markings (OFFICIAL, OFFICIAL-SENSITIVE, SECRET), a header table, then Issue, Recommendation ("That you agree to…", decided in place), Background, Progress and Handling.
  - Daily Brief: a tablet frame. The masthead holds the numbers, followed by the top line, then decision cards, the situation as one numbered list, and actions and risks side by side as tables.
  - Daily Brief (Night): an example of a style built on another style's layout.
- **Rendering**: a sandboxed iframe (`allow-scripts`, not same-origin) with a strict CSP. Custom CSS cannot reach the app or load remote resources. Decision buttons use `postMessage` to open the decision request.
- **Style Studio** (`#/studio`): pick a style, then edit its variables (colour pickers), layout and CSS with a live preview. Saving a built-in style creates a copy. "Load the full layout CSS" gives complete control. Any style can be made the default. The style can also be switched per Briefing in the Briefing Room.
- **Decisions inside the report** (2026-09-25, from "in the briefing room is hard to take a decision, make sure I can interact with the report and take decisions in the report no matter the style"):
  - Every layout embeds the same controls (`decisionControls` and `DECISION_CSS` in `layouts/common.js`): options as buttons, pick then **Confirm decision**, **Give a different instruction** (a textarea, sent word for word), **Halt work** (click twice), and the response window.
  - Each layout restyles them through `--decide-*` variables, so they look native in the deck, the dossier, the red box and the daily brief.
  - The sandboxed frame sends `{lh:'choose', id, choice}` to the app. The app accepts it only from its own briefing frames and records it through `App.resolveDecision`, the same path the popup uses.
  - After deciding, the report reopens at that decision (`ctx.focus`, `window.LH_FOCUS`) and shows the outcome.
  - The deck's title slide links straight to pending decisions ("N decisions awaiting you: review now"). The red box opens by itself when a decision is waiting.
  - `npm run check` fails if any format lacks the controls.
- **Decision requests** (`src/renderer/decision.js`): new pending decisions open as a plain decision memo (title, from-line, situation, options with one marked Recommended). The Leader can also **Give a different instruction** (sent word for word), **Halt work** or **Decide later**. When the window expires, the recommendation proceeds automatically.
- UPDATE (2026-09-25): the Hearts of Iron-style event popup, the rotated stamp and paperclip, the red box star emblem and the fake tablet chrome were removed as "toy like". See [[Systems/PATTERN - Voice And Tone]].

## Decisions

- Styles are declarative (CSS and variables on a built-in layout) rather than arbitrary JS. That makes sharing styles safe. Revisit if the Leader wants entirely new structures; a sandboxed layout plugin would be the next step.

## Open edges

- QUESTION: the "depseek harness" reference is still unidentified. The Studio is a best guess at "change how content looks on the fly".
- There is no import/export of style files from the UI yet; users can drop JSON into `userData/styles`.
