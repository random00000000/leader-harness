// Daily Brief Tablet: a secure tablet showing the brief as an app, like a
// presidential daily brief read on a device.
import { esc, fmtDate, STATUS, LEVEL, decisionState, decideButton } from './common.js';

export function render(b, ctx) {
  const date = new Date(b.createdAt);
  return `
  <div class="stand">
    <div class="device">
      <div class="camera"></div>
      <div class="screen">
        <div class="statusbar"><span>${esc(date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }))}</span><span class="secure">&#9679; SECURE</span><span>100%</span></div>
        <header class="masthead">
          <div class="banner c-${esc(b.classification)}">${esc(b.classification)} // FOR THE LEADER ONLY</div>
          <div class="brand">The Leader's Daily Brief</div>
          <div class="dateline">${esc(fmtDate(b.createdAt, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))} · ${esc(ctx.from.name)}</div>
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
              return `
          <section class="card decision ${st.open ? 'open' : 'closed'}">
            <div class="label">${st.open ? 'Decision needed' : 'Decision'}</div>
            <h2>${esc(d.title)}</h2>
            <p>${esc(d.body)}</p>
            <div class="chips">${d.options.map((o) => `<span class="${o.recommended ? 'rec' : ''}">${esc(o.label)}</span>`).join('')}</div>
            <div class="row">${decideButton(d, 'Review & decide')}</div>
          </section>`;
            })
            .join('')}
          ${(b.situation || []).map((s, i) => `<section class="card article"><div class="label">Item ${i + 1}</div><p>${esc(s)}</p></section>`).join('')}
          ${(b.actions || []).length ? `<section class="card"><div class="label">Actions</div>${b.actions.map((a) => `<div class="line"><i class="dot d-${esc(a.status)}"></i><span>${esc(a.text)}</span><small>${esc(STATUS[a.status] || a.status)}</small></div>`).join('')}</section>` : ''}
          ${(b.risks || []).length ? `<section class="card"><div class="label">Risks</div>${b.risks.map((r) => `<div class="line"><i class="dot r-${esc(r.level)}"></i><span>${esc(r.text)}</span><small>${esc(LEVEL[r.level] || r.level)}</small></div>`).join('')}</section>` : ''}
          ${(b.next || []).length ? `<section class="card"><div class="label">Coming up</div>${b.next.map((x) => `<div class="line"><i class="dot"></i><span>${esc(x)}</span></div>`).join('')}</section>` : ''}
          <div class="end">End of brief</div>
        </main>
        <nav class="tabbar"><span class="on">Brief</span><span>Decisions</span><span>Archive</span></nav>
      </div>
    </div>
  </div>`;
}

export const script = '';

export const css = `
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: var(--backdrop); font-family: var(--font-body); overflow: hidden; }
.stand { height: 100vh; display: grid; place-items: center; padding: 26px; }
.device { position: relative; height: min(100%, 1100px); aspect-ratio: 3 / 4; max-width: 100%; background: var(--bezel); border-radius: 38px; padding: 26px; box-shadow: 0 40px 90px rgba(0,0,0,.6), inset 0 0 0 2px rgba(255,255,255,.08), inset 0 0 0 10px rgba(0,0,0,.4); }
.camera { position: absolute; top: 11px; left: 50%; width: 6px; height: 6px; margin-left: -3px; border-radius: 50%; background: #1d232c; box-shadow: inset 0 0 2px #4b5a70; }
.screen { position: relative; height: 100%; border-radius: 14px; overflow: hidden; background: var(--screen); color: var(--ink); display: flex; flex-direction: column; }
.statusbar { display: flex; justify-content: space-between; padding: 8px 18px 4px; font-size: 11px; color: var(--muted); font-weight: 600; }
.secure { color: var(--ok); letter-spacing: .1em; }
.masthead { padding: 6px 26px 16px; border-bottom: 1px solid var(--line); }
.banner { font-size: 10px; letter-spacing: .22em; font-weight: 700; text-align: center; padding: 4px; border-radius: 3px; margin-bottom: 14px; color: #fff; background: var(--routine); }
.banner.c-PRIORITY { background: var(--warn); } .banner.c-FLASH { background: var(--danger); }
.brand { font-family: var(--font-display); font-size: 30px; font-weight: 700; letter-spacing: -.01em; }
.dateline { color: var(--muted); font-size: 13px; margin-top: 2px; }
.feed { flex: 1; overflow-y: auto; padding: 18px 20px 30px; display: grid; gap: 14px; align-content: start; scrollbar-width: thin; }
.card { background: var(--card); border-radius: 14px; padding: 18px 20px; box-shadow: 0 1px 2px rgba(0,0,0,.06); }
.label { font-size: 11px; text-transform: uppercase; letter-spacing: .14em; color: var(--accent); font-weight: 700; margin-bottom: 6px; }
.hero { background: var(--hero); color: var(--hero-ink); }
.hero .label { color: var(--hero-accent); }
.hero h1 { font-family: var(--font-display); font-size: 26px; line-height: 1.15; margin: 0 0 10px; }
.hero p { margin: 0; font-size: 16px; line-height: 1.5; opacity: .92; }
h2 { font-family: var(--font-display); font-size: 19px; margin: 0 0 6px; }
.card p { margin: 0; line-height: 1.55; font-size: 15px; }
.article p { font-family: var(--font-display); font-size: 16px; }
.decision.open { box-shadow: 0 0 0 2px var(--accent); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0; }
.chips span { font-size: 12px; padding: 5px 10px; border-radius: 99px; background: var(--chip); }
.chips span.rec { background: var(--accent); color: #fff; }
.row { display: flex; justify-content: flex-end; }
.decide { font: inherit; font-size: 14px; font-weight: 600; background: var(--accent); color: #fff; border: 0; border-radius: 10px; padding: 9px 18px; cursor: pointer; }
.decided { color: var(--muted); font-size: 13px; font-style: italic; }
.line { display: flex; gap: 10px; align-items: baseline; padding: 7px 0; border-top: 1px solid var(--line); font-size: 14px; line-height: 1.45; }
.line:first-of-type { border-top: 0; }
.line span { flex: 1; }
.line small { color: var(--muted); white-space: nowrap; }
.dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--muted); transform: translateY(-1px); }
.d-done, .r-low { background: var(--ok); } .d-in_progress, .r-medium { background: var(--warn); } .d-blocked, .r-high { background: var(--danger); }
.end { text-align: center; color: var(--muted); font-size: 11px; letter-spacing: .2em; text-transform: uppercase; padding: 10px; }
.tabbar { display: flex; justify-content: space-around; border-top: 1px solid var(--line); padding: 10px 0 12px; font-size: 12px; color: var(--muted); background: var(--screen); }
.tabbar .on { color: var(--accent); font-weight: 700; }
`;
