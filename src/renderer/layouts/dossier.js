// Dossier: a typed memorandum in a manila file folder. The folder has a
// labelled tab and a crease, the pages are held by a two-prong fastener, and
// classification banners run at the top and bottom of the page, as on real
// documents. Reading order: summary, decisions, situation, actions, risks.
import { esc, fmtDate, decisionState, decisionControls, glance, fileRef, actionRows, riskRows } from './common.js';

const MARK = { ROUTINE: 'RESTRICTED', PRIORITY: 'CONFIDENTIAL', FLASH: 'SECRET' };

export function render(b, ctx) {
  let para = 0;
  const n = () => `<span class="pn">${++para}.</span>`;
  const mark = MARK[b.classification] || b.classification;
  const open = ctx.decisions.filter((d) => decisionState(d).open).length;
  return `
  <div class="desk">
    <div class="folder">
      <div class="tab"><span class="label"><b>${esc(fileRef(b))}</b><span>${esc(ctx.from.name)}</span></span><span class="flag f-${esc(b.classification)}" title="${esc(b.classification)}"></span></div>
      <div class="back">
        <div class="crease"></div>
        <div class="stack">
          <div class="leaf l2"></div><div class="leaf l1"></div>
          <article class="sheet">
            <div class="fastener"><i></i><i></i></div>
            <div class="banner">${esc(mark)}</div>
            <table class="memo">
              <tr><th>From</th><td>${esc(ctx.from.name)}, ${esc(ctx.from.title)}</td><th>Ref</th><td>${esc(fileRef(b))}</td></tr>
              <tr><th>To</th><td>The Leader</td><th>Date</th><td>${esc(fmtDate(b.createdAt, { dateStyle: 'medium', timeStyle: 'short' }))}</td></tr>
              <tr><th>Subject</th><td colspan="3"><b>${esc(b.title)}</b></td></tr>
            </table>
            <div class="glance">${glance(b, ctx)
              .map((g) => `<div class="${g.alert ? 'alert' : ''}"><b>${esc(g.value)}</b><span>${esc(g.label)}</span></div>`)
              .join('')}</div>

            <section class="summary"><h3>Summary</h3><p>${n()} ${esc(b.bluf)}</p></section>

            ${ctx.decisions
              .map((d) => {
                const st = decisionState(d);
                return `<section class="minute ${st.open ? 'open' : 'closed'}" data-decision-block="${esc(d.id)}">
                  <h3>${st.open ? 'Decision required' : 'Decision'}: ${esc(d.title)}</h3>
                  <p>${n()} ${esc(d.body)}</p>
                  ${decisionControls(d)}
                </section>`;
              })
              .join('')}

            ${(b.situation || []).length ? `<section><h3>Situation</h3>${b.situation.map((s) => `<p>${n()} ${esc(s)}</p>`).join('')}</section>` : ''}
            ${(b.actions || []).length ? `<section><h3>Action taken</h3><table class="rows">${actionRows(b)}</table></section>` : ''}
            ${(b.risks || []).length ? `<section><h3>Risks</h3><table class="rows">${riskRows(b)}</table></section>` : ''}
            ${(b.next || []).length ? `<section><h3>Intentions</h3>${b.next.map((x) => `<p>${n()} ${esc(x)}</p>`).join('')}</section>` : ''}

            <div class="banner bottom">${esc(mark)}${open ? ` · ${open} DECISION${open > 1 ? 'S' : ''} REQUIRED` : ''}</div>
          </article>
        </div>
      </div>
    </div>
  </div>`;
}

export const script = '';

export const css = `
* { box-sizing: border-box; }
html, body { margin: 0; min-height: 100%; background: var(--backdrop); color: var(--ink); font-family: var(--font-body); }
.desk { padding: 56px 28px 72px; display: flex; justify-content: center; }
.folder { position: relative; width: min(900px, 100%); }

/* The folder: tab, back panel with a crease, a dark inner edge. */
.tab { position: absolute; top: -34px; left: 36px; height: 40px; min-width: 260px; padding: 7px 14px 0 14px; display: flex; align-items: flex-start; gap: 10px;
  background: linear-gradient(var(--folder-tab), var(--folder)); border-radius: 9px 9px 0 0; box-shadow: inset 0 1px 0 rgba(255,255,255,.35), 0 -1px 2px rgba(0,0,0,.12); }
.label { display: flex; gap: 10px; align-items: baseline; background: #fbfaf5; padding: 4px 10px; border-radius: 2px; box-shadow: 0 1px 1px rgba(0,0,0,.18); font-family: var(--font-mono); font-size: 11.5px; color: #2b2b2b; letter-spacing: .04em; white-space: nowrap; }
.label span { color: #666; }
.flag { width: 12px; height: 12px; border-radius: 2px; margin-top: 5px; box-shadow: inset 0 0 0 1px rgba(0,0,0,.2); }
.f-ROUTINE { background: #4f7d5b; } .f-PRIORITY { background: #d19a2a; } .f-FLASH { background: #b3261e; }
.back { position: relative; background: linear-gradient(175deg, var(--folder-tab) 0%, var(--folder) 40%, var(--folder-edge) 100%); border-radius: 3px 10px 10px 10px; padding: 34px 30px 36px;
  box-shadow: 0 18px 40px rgba(0,0,0,.45), inset 0 0 0 1px rgba(0,0,0,.12), inset 0 -3px 0 rgba(0,0,0,.08); }
.crease { position: absolute; left: 0; right: 0; top: 16px; height: 2px; background: linear-gradient(rgba(0,0,0,.12), rgba(255,255,255,.25)); }

/* Pages: two sheets peek out behind the top one. */
.stack { position: relative; }
.leaf { position: absolute; inset: 0; background: var(--paper-2); box-shadow: 0 1px 2px rgba(0,0,0,.2); }
.leaf.l1 { transform: translate(5px, 5px); }
.leaf.l2 { transform: translate(10px, 10px); opacity: .85; }
.sheet { position: relative; background: var(--paper); padding: 30px 56px 26px; box-shadow: 0 1px 3px rgba(0,0,0,.22); line-height: 1.55; font-size: 14.5px; }

/* Two-prong fastener through the top of the pages. */
.fastener { position: absolute; top: -14px; left: 50%; width: 150px; margin-left: -75px; height: 20px; border-radius: 3px;
  background: linear-gradient(#e3e5e8, #a9adb3); box-shadow: 0 1px 2px rgba(0,0,0,.35); display: flex; justify-content: space-between; padding: 0 16px; align-items: center; }
.fastener i { width: 10px; height: 10px; border-radius: 50%; background: radial-gradient(circle at 40% 35%, #f4f5f6, #8d9197); box-shadow: inset 0 0 0 1px rgba(0,0,0,.25); }

.banner { text-align: center; font-family: var(--font-mono); font-weight: 700; letter-spacing: .3em; font-size: 12px; color: var(--stamp); padding: 6px 0 14px; }
.banner.bottom { padding: 22px 0 0; border-top: 1px solid var(--rule); margin-top: 26px; }

.memo { width: 100%; border-collapse: collapse; font-family: var(--font-mono); font-size: 13px; margin-bottom: 14px; }
.memo th { text-align: left; text-transform: uppercase; letter-spacing: .08em; font-size: 11px; color: var(--muted-ink); padding: 5px 10px 5px 0; width: 70px; vertical-align: top; }
.memo td { padding: 5px 16px 5px 0; border-bottom: 1px solid var(--rule); vertical-align: top; }
.memo tr:last-child td { border-bottom: 2px solid var(--ink); }
.memo td:nth-child(2) { width: 58%; }
.memo td:nth-child(4) { white-space: nowrap; }

.glance { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid var(--rule); margin: 4px 0 6px; }
.glance div { padding: 8px 12px; border-left: 1px solid var(--rule); display: grid; }
.glance div:first-child { border-left: 0; }
.glance b { font-family: var(--font-mono); font-size: 20px; line-height: 1.1; }
.glance span { font-size: 10.5px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted-ink); }
.glance .alert b { color: var(--stamp); }

h3 { font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .12em; font-size: 12.5px; margin: 24px 0 8px; padding-bottom: 4px; border-bottom: 1px solid var(--rule); }
p { margin: 0 0 9px; }
.pn { display: inline-block; min-width: 2em; font-weight: 700; font-family: var(--font-mono); }
.summary p { font-weight: 600; font-size: 15.5px; }

.rows { width: 100%; border-collapse: collapse; font-size: 14px; }
.rows td { padding: 6px 8px; border-bottom: 1px solid var(--rule); vertical-align: top; }
.rows .st { width: 110px; font-family: var(--font-mono); font-size: 11.5px; text-transform: uppercase; letter-spacing: .06em; font-weight: 700; white-space: nowrap; }
.s-done .st, .r-low .st { color: var(--ok); }
.s-in_progress .st, .r-medium .st { color: var(--warn); }
.s-blocked .st, .r-high .st { color: var(--stamp); }

.minute { margin: 22px 0 6px; border: 1.5px solid var(--ink); padding: 2px 18px 16px; background: var(--minute); }
.minute h3 { border-bottom: 0; margin-top: 14px; }
.minute.closed { border-style: dashed; }
:root { --decide-accent: var(--ink); --decide-on-accent: var(--paper); --decide-bg: var(--paper); --decide-line: var(--ink); --decide-field: var(--paper); --decide-danger: var(--stamp); --decide-radius: 0; }
.minute .lh-opt:hover, .minute .lh-go:hover { border-color: var(--stamp); }
`;
