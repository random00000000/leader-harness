# Dispatch

## Intent

> "it feels like I need to get into the harness to get the briefing instead of the officials coming to me with the briefings, I feel like we need a lighter surface that can get to me without combing through the entire harness"

See the [[PROMPT-LEDGER]] row dated 2026-09-25.

## How it works

- **The Dispatch panel** is a small, frameless, always-on-top window (420 px wide) in the bottom-right corner of the primary screen. It holds only what needs the Leader:
  - **Decisions awaiting you**, oldest first. Each can be decided right there: pick an option, then confirm; give a different instruction, sent word for word; or halt work, which asks for confirmation.
  - **New briefings**, unread and newest first, showing the classification, the Official, the title and the bottom line. Each has **Read full briefing** (opens the main window on that briefing) and **Mark read**.
  - When nothing is pending: "Nothing needs you", with the next scheduled briefing.
- **It comes to the Leader.** When a briefing arrives, the panel appears without taking focus (`showInactive`), so it never interrupts typing. Settings → "How briefings reach you" chooses between the Dispatch panel (default), a Windows notification only, or both. Failures still use Windows notifications and open Activity.
- **Tray**: a left click opens Dispatch. The tray menu has Open Dispatch and Open Leader Harness.
- **Light**: the panel is created on demand and destroyed when closed (Esc or ✕). Its page (`dispatch.html`, `dispatch.js`, `dispatch.css`) does not load the main app. State arrives through the same `state` push as the main window.
- **Code**: `showDispatch`, `closeDispatch` and `notify` in `src/main/main.js`, plus the IPC channels `dispatch:open`, `dispatch:close` and `window:open`.

## Decisions

- DECISION: a corner panel rather than rich Windows toasts. Toast actions cannot carry a free-text instruction or a confirm step, and they vanish into the Action Center. Revisit if the Leader wants decisions on the lock screen.
- DECISION: decisions always need a confirm step, in Dispatch and in the reports alike, because the panel appears unasked and a stray click must not commit the Leader.

## Open edges

- There is no phone delivery yet (the Leader is reached only on this PC, see D3 in [[Systems/PLAN - Leader Harness]]).
- The panel always opens on the primary display.
