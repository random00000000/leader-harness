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
- **Built-in styles**:
  - Cabinet Deck: 16:9 slides with arrow keys and dots.
  - Manila Dossier: a typed sheet with a stamp and paperclip, and decision minutes with checkboxes.
  - Red Box: a leather box that opens onto civil-service submissions (Issue / Recommendation / Background / Handling) and decision slips.
  - Daily Brief Tablet: a device frame with feed cards.
  - Night Tablet: an example of a style built on another style's layout.
- **Rendering**: a sandboxed iframe (`allow-scripts`, not same-origin) with a strict CSP. Custom CSS cannot reach the app or load remote resources. Decision buttons use `postMessage` to open the event popup.
- **Style Studio** (`#/studio`): pick a style, then edit its variables (colour pickers), layout and CSS with a live preview. Saving a built-in style creates a copy. "Load the full layout CSS" gives complete control. Any style can be made the default. The style can also be switched per Briefing in the Briefing Room.
- **Decisions / events**: new pending decisions pop up as HOI4-style events. Each has options, **Other…** (a free-text order, sent word for word), **Halt work** and **Later**. When the window expires, the recommended option is carried out automatically.

## Decisions

- Styles are declarative (CSS and variables on a built-in layout) rather than arbitrary JS. That makes sharing styles safe. Revisit if the Leader wants entirely new structures; a sandboxed layout plugin would be the next step.

## Open edges

- QUESTION: the "depseek harness" reference is still unidentified. The Studio is a best guess at "change how content looks on the fly".
- There is no import/export of style files from the UI yet; users can drop JSON into `userData/styles`.
