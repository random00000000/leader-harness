// Red Box: a leather despatch box holding a civil-service submission. The
// lid carries the Official's office in gold; it opens by itself when a
// decision is waiting. The submission follows the Whitehall format: issue,
// recommendation (decided in place), background, progress, handling.
import { esc, fmtDate, decisionState, decisionControls, glance, fileRef, actionRows, riskRows } from './common.js';

// UK government security classifications.
const MARK = { ROUTINE: 'OFFICIAL', PRIORITY: 'OFFICIAL-SENSITIVE', FLASH: 'SECRET' };
const TIMING = { ROUTINE: 'Routine', PRIORITY: 'Priority: a decision is needed soon', FLASH: 'Immediate' };

export function render(b, ctx) {
  const mark = MARK[b.classification] || b.classification;
  let para = 0;
  const n = () => `<span class="num">${++para}.</span>`;
  return `
  <div class="room">
    <div class="box" role="button" tabindex="0" aria-label="Open the box">
      <div class="lid">
        <div class="tooling">
          <div class="word">${esc(ctx.from.title)}</div>
          <div class="rule"></div>
          <div class="sub">For the Leader</div>
        </div>
        <div class="lock"><i></i></div>
        <div class="hint">Open</div>
      </div>
    </div>
    <div class="papers">
      <article class="paper">
        <div class="marking">${esc(mark)}</div>
        <table class="meta">
          <tr><th>From</th><td>${esc(ctx.from.name)}, ${esc(ctx.from.title)}</td></tr>
          <tr><th>To</th><td>The Leader</td></tr>
          <tr><th>Date</th><td>${esc(fmtDate(b.createdAt, { dateStyle: 'long', timeStyle: 'short' }))}</td></tr>
          <tr><th>Timing</th><td>${esc(TIMING[b.classification] || 'Routine')}</td></tr>
          <tr><th>Reference</th><td>${esc(fileRef(b))}</td></tr>
        </table>
        <h1>${esc(b.title)}</h1>

        <h2>Issue</h2>
        <p class="lead">${n()}${esc(b.bluf)}</p>

        ${
          ctx.decisions.length
            ? `<h2>Recommendation</h2>${ctx.decisions
                .map((d) => {
                  const st = decisionState(d);
                  const rec = d.options.find((o) => o.recommended) || d.options[0];
                  return `<div class="slip ${st.open ? 'open' : 'closed'}" data-decision-block="${esc(d.id)}">
                    <p>${n()}That you agree to <b>${esc(rec.label.replace(/^./, (c) => c.toLowerCase()).replace(/\.$/, ''))}</b>. <span class="why">${esc(d.body)}</span></p>
                    ${decisionControls(d)}
                  </div>`;
                })
                .join('')}`
            : ''
        }

        <table class="glance"><tr>${glance(b, ctx)
          .map((g) => `<td class="${g.alert ? 'alert' : ''}"><b>${esc(g.value)}</b><span>${esc(g.label)}</span></td>`)
          .join('')}</tr></table>

        ${(b.situation || []).length ? `<h2>Background</h2>${b.situation.map((s) => `<p>${n()}${esc(s)}</p>`).join('')}` : ''}
        ${(b.actions || []).length ? `<h2>Progress</h2><table class="rows">${actionRows(b)}</table>` : ''}
        ${(b.risks || []).length ? `<h2>Handling</h2><table class="rows">${riskRows(b)}</table>` : ''}
        ${(b.next || []).length ? `<h2>Next steps</h2>${b.next.map((x) => `<p>${n()}${esc(x)}</p>`).join('')}` : ''}
        <div class="marking bottom">${esc(mark)}</div>
      </article>
    </div>
  </div>`;
}

export const script = `
if (document.querySelector('.slip.open') || window.LH_FOCUS) document.body.classList.add('opened');
const box = document.querySelector('.box');
const open = () => document.body.classList.add('opened');
box.addEventListener('click', open);
box.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && open());
`;

export const css = `
* { box-sizing: border-box; }
html, body { margin: 0; min-height: 100%; background: var(--backdrop); color: var(--ink); font-family: var(--font-body); }
.room { min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 40px 20px 80px; }

/* The despatch box: leather, gold tooling and stitching, brass lock. */
.box { width: min(720px, 100%); aspect-ratio: 1.75; perspective: 1400px; cursor: pointer; outline: none; transition: margin .5s ease, aspect-ratio .5s ease; }
.lid { position: relative; height: 100%; border-radius: 8px; display: grid; place-items: center;
  background: radial-gradient(ellipse at 50% 30%, var(--leather-light), var(--leather) 55%, var(--leather-dark) 100%);
  box-shadow: 0 28px 55px rgba(0,0,0,.55), inset 0 0 0 1px rgba(0,0,0,.4), inset 0 2px 0 rgba(255,255,255,.08), inset 0 0 70px rgba(0,0,0,.35);
  transform-origin: top center; transition: transform .6s cubic-bezier(.3,.7,.2,1), opacity .4s ease .15s; }
.lid::before { content: ''; position: absolute; inset: 12px; border: 1.5px dashed rgba(226,192,113,.45); border-radius: 5px; }
.lid::after { content: ''; position: absolute; inset: 20px; border: 1px solid rgba(226,192,113,.55); border-radius: 3px; }
.tooling { position: relative; z-index: 1; color: var(--gold); text-align: center; text-shadow: 0 1px 0 rgba(0,0,0,.45); padding: 0 40px; }
.word { font-family: var(--font-display); letter-spacing: .26em; font-size: 20px; font-weight: 600; text-transform: uppercase; line-height: 1.5; }
.rule { width: 140px; height: 1px; background: var(--gold); opacity: .7; margin: 14px auto; }
.sub { font-family: var(--font-display); letter-spacing: .3em; font-size: 11px; text-transform: uppercase; opacity: .85; }
.lock { position: absolute; z-index: 1; bottom: 26px; left: 50%; width: 54px; height: 30px; margin-left: -27px; border-radius: 4px;
  background: linear-gradient(#e6c982, #a78335); box-shadow: 0 2px 4px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.45); display: grid; place-items: center; }
.lock i { width: 7px; height: 12px; border-radius: 4px 4px 2px 2px; background: #3a2a10; }
.hint { position: absolute; bottom: -30px; font-size: 11px; letter-spacing: .25em; text-transform: uppercase; color: var(--muted); }
.box:focus-visible .lid { outline: 2px solid var(--gold); outline-offset: 6px; }
.papers { width: min(780px, 100%); display: grid; gap: 22px; max-height: 0; overflow: hidden; opacity: 0; transition: opacity .5s ease .3s; }
body.opened .box { aspect-ratio: 7; margin-bottom: 22px; }
body.opened .lid { transform: rotateX(70deg); opacity: .6; }
body.opened .tooling, body.opened .lock { display: none; }
body.opened .hint { display: none; }
body.opened .papers { max-height: none; overflow: visible; opacity: 1; }

/* The submission. */
.paper { background: var(--paper); color: var(--ink); padding: 34px 60px 30px; box-shadow: 0 10px 28px rgba(0,0,0,.35); line-height: 1.6; font-size: 15px; border-top: 6px solid var(--leather); }
.marking { text-align: center; font-weight: 700; letter-spacing: .22em; font-size: 12px; color: var(--leather); padding-bottom: 16px; }
.marking.bottom { padding: 22px 0 0; margin-top: 24px; border-top: 1px solid var(--rule); }
.meta { border-collapse: collapse; font-size: 13.5px; width: 100%; }
.meta th { text-align: left; padding: 4px 18px 4px 0; color: var(--muted-ink); font-weight: 600; width: 110px; vertical-align: top; }
.meta td { padding: 4px 0; border-bottom: 1px solid var(--rule); }
h1 { font-family: var(--font-display); font-size: 24px; margin: 22px 0 6px; font-weight: 600; line-height: 1.25; }
h2 { font-family: var(--font-display); font-size: 13px; letter-spacing: .14em; text-transform: uppercase; margin: 22px 0 8px; color: var(--leather); border-bottom: 1px solid var(--rule); padding-bottom: 4px; }
p { margin: 0 0 9px; }
.num { display: inline-block; width: 2.1em; font-weight: 600; }
.lead { font-size: 16.5px; font-weight: 600; }
.slip { margin: 0 0 14px; padding: 12px 16px 14px; background: var(--tint); border-left: 3px solid var(--leather); }
.slip.closed { background: transparent; border-left-color: var(--rule); }
.why { color: var(--muted-ink); }
.glance { width: 100%; border-collapse: collapse; margin: 18px 0 4px; table-layout: fixed; }
.glance td { border: 1px solid var(--rule); padding: 8px 12px; }
.glance b { display: block; font-size: 20px; line-height: 1.1; font-family: var(--font-display); }
.glance span { font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted-ink); }
.glance .alert b { color: var(--leather); }
.rows { width: 100%; border-collapse: collapse; font-size: 14.5px; }
.rows td { padding: 6px 8px; border-bottom: 1px solid var(--rule); vertical-align: top; }
.rows .st { width: 105px; font-size: 11.5px; letter-spacing: .08em; text-transform: uppercase; font-weight: 700; white-space: nowrap; }
.s-done .st, .r-low .st { color: var(--ok); } .s-in_progress .st, .r-medium .st { color: var(--warn); } .s-blocked .st, .r-high .st { color: var(--leather); }
:root { --decide-accent: var(--leather); --decide-on-accent: #f7e9c4; --decide-bg: var(--paper); --decide-line: var(--rule); --decide-field: var(--paper); --decide-danger: var(--leather); --decide-radius: 2px; }
`;
