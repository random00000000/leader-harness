// Daily Brief: the brief as it would be read on a secure tablet, in the
// manner of a presidential daily brief: masthead with the numbers, the top
// line, decisions, then the supporting detail in compact cards.
import { esc, fmtDate, decisionState, decisionControls, glance, fileRef, actionRows, riskRows } from './common.js';

export function render(b, ctx) {
  return `
  <div class="stand">
    <div class="device">
      <div class="camera"></div>
      <div class="screen">
        <header class="masthead">
          <div class="banner c-${esc(b.classification)}">${esc(b.classification)} // FOR THE LEADER ONLY</div>
          <div class="brand">The Leader's Daily Brief</div>
          <div class="dateline">${esc(fmtDate(b.createdAt, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))} · ${esc(ctx.from.name)}, ${esc(ctx.from.title)} · ${esc(fileRef(b))}</div>
          <div class="glance">${glance(b, ctx)
            .map((g) => `<div class="${g.alert ? 'alert' : ''}"><b>${esc(g.value)}</b><span>${esc(g.label)}</span></div>`)
            .join('')}</div>
        </header>
        <main class="feed">
          <section class="hero card">
            <div class="label">Top line</div>
            <h1>${esc(b.title)}</h1>
            <p>${esc(b.bluf)}</p>
          </section>
          ${ctx.decisions
            .map((d) => {
              const st = decisionState(d);
              return `<section class="card decision ${st.open ? 'open' : 'closed'}" data-decision-block="${esc(d.id)}">
                <div class="label">${st.open ? 'Decision needed' : 'Decision'}</div>
                <h2>${esc(d.title)}</h2>
                <p class="body">${esc(d.body)}</p>
                ${decisionControls(d)}
              </section>`;
            })
            .join('')}
          ${(b.situation || []).length ? `<section class="card"><div class="label">Situation</div><ol class="items">${b.situation.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></section>` : ''}
          <div class="pair">
            ${(b.actions || []).length ? `<section class="card"><div class="label">Actions</div><table class="rows">${actionRows(b)}</table></section>` : ''}
            ${(b.risks || []).length ? `<section class="card"><div class="label">Risks</div><table class="rows">${riskRows(b)}</table></section>` : ''}
          </div>
          ${(b.next || []).length ? `<section class="card"><div class="label">Coming up</div><ul class="items next">${b.next.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>` : ''}
          <div class="end">End of brief</div>
        </main>
      </div>
    </div>
  </div>`;
}

export const script = '';

export const css = `
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: var(--backdrop); font-family: var(--font-body); overflow: hidden; }
.stand { height: 100vh; display: grid; place-items: center; padding: 22px; }
.device { position: relative; height: min(100%, 1100px); aspect-ratio: 3 / 4; max-width: 100%; background: var(--bezel); border-radius: 30px; padding: 20px;
  box-shadow: 0 36px 80px rgba(0,0,0,.55), inset 0 0 0 1.5px rgba(255,255,255,.07), inset 0 0 0 8px rgba(0,0,0,.35); }
.camera { position: absolute; top: 8px; left: 50%; width: 5px; height: 5px; margin-left: -2.5px; border-radius: 50%; background: #1d232c; }
.screen { position: relative; height: 100%; border-radius: 10px; overflow: hidden; background: var(--screen); color: var(--ink); display: flex; flex-direction: column; }
.masthead { padding: 14px 22px 14px; border-bottom: 1px solid var(--line); background: var(--card); }
.banner { font-size: 10px; letter-spacing: .22em; font-weight: 700; text-align: center; padding: 4px; border-radius: 3px; margin-bottom: 12px; color: #fff; background: var(--routine); }
.banner.c-PRIORITY { background: var(--warn); } .banner.c-FLASH { background: var(--danger); }
.brand { font-family: var(--font-display); font-size: 27px; font-weight: 700; letter-spacing: -.01em; }
.dateline { color: var(--muted); font-size: 12.5px; margin-top: 2px; }
.glance { display: grid; grid-template-columns: repeat(4, 1fr); margin-top: 12px; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
.glance div { padding: 7px 10px; border-left: 1px solid var(--line); display: grid; }
.glance div:first-child { border-left: 0; }
.glance b { font-size: 18px; line-height: 1.15; font-variant-numeric: tabular-nums; }
.glance span { font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.glance .alert b { color: var(--accent); }
.feed { flex: 1; overflow-y: auto; padding: 16px 18px 26px; display: grid; gap: 12px; align-content: start; scrollbar-width: thin; }
.card { background: var(--card); border-radius: 12px; padding: 15px 18px; box-shadow: 0 1px 2px rgba(0,0,0,.06); border: 1px solid var(--line); }
.label { font-size: 10.5px; text-transform: uppercase; letter-spacing: .14em; color: var(--accent); font-weight: 700; margin-bottom: 6px; }
.hero { background: var(--hero); color: var(--hero-ink); border: 0; }
.hero .label { color: var(--hero-accent); }
.hero h1 { font-family: var(--font-display); font-size: 23px; line-height: 1.2; margin: 0 0 8px; }
.hero p { margin: 0; font-size: 15.5px; line-height: 1.5; opacity: .95; }
h2 { font-family: var(--font-display); font-size: 18px; margin: 0 0 6px; }
.card p { margin: 0; line-height: 1.55; font-size: 14.5px; }
.decision.open { border: 2px solid var(--accent); }
.decision .body { color: var(--muted); }
.items { margin: 0; padding-left: 1.3em; display: grid; gap: 8px; font-size: 14.5px; line-height: 1.5; }
.items li::marker { color: var(--accent); font-weight: 700; }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.pair:empty { display: none; }
.rows { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.rows td { padding: 6px 4px; border-top: 1px solid var(--line); vertical-align: top; line-height: 1.4; }
.rows tr:first-child td { border-top: 0; }
.rows .st { width: 86px; font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase; font-weight: 700; white-space: nowrap; }
.s-done .st, .r-low .st { color: var(--ok); } .s-in_progress .st, .r-medium .st { color: var(--warn); } .s-blocked .st, .r-high .st { color: var(--danger); }
.end { text-align: center; color: var(--muted); font-size: 10.5px; letter-spacing: .2em; text-transform: uppercase; padding: 8px; }
:root { --decide-accent: var(--accent); --decide-on-accent: #fff; --decide-bg: var(--chip); --decide-line: var(--line); --decide-field: var(--card); --decide-danger: var(--danger); --decide-radius: 8px; }
`;
