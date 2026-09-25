// Red Box: a leather despatch box that opens onto submission papers written in
// the civil service format (Issue, Recommendation, Background, Handling).
import { esc, fmtDate, STATUS, LEVEL, decisionState, decideButton } from './common.js';

export function render(b, ctx) {
  const recs = ctx.decisions.map((d) => ({ d, rec: d.options.find((o) => o.recommended) || d.options[0] }));
  return `
  <div class="room">
    <div class="box" role="button" tabindex="0" aria-label="Open the box">
      <div class="lid">
        <div class="emboss">
          <div class="word">${esc(ctx.from.title)}</div>
          <div class="rule"></div>
          <div class="sub">For the Leader</div>
        </div>
        <div class="lock"></div>
        <div class="hint">Open</div>
      </div>
    </div>
    <div class="papers">
      <article class="paper">
        <div class="head">
          <div class="dept">${esc(ctx.from.name)} · ${esc(ctx.from.title)}</div>
          <div class="mark">${esc(b.classification)}</div>
        </div>
        <h1>Submission: ${esc(b.title)}</h1>
        <table class="meta">
          <tr><th>From</th><td>${esc(ctx.from.name)}</td></tr>
          <tr><th>Date</th><td>${esc(fmtDate(b.createdAt, { dateStyle: 'long', timeStyle: 'short' }))}</td></tr>
          <tr><th>Timing</th><td>${b.classification === 'FLASH' ? 'Immediate' : b.classification === 'PRIORITY' ? 'Priority' : 'Routine'}</td></tr>
        </table>
        <h2>Issue</h2>
        <p class="lead">${esc(b.bluf)}</p>
        ${recs.length ? `<h2>Recommendation</h2><ol>${recs.map(({ d, rec }) => `<li>That you agree to <b>${esc(rec.label.replace(/^./, (c) => c.toLowerCase()))}</b> (${esc(d.title)}).</li>`).join('')}</ol>` : ''}
        <h2>Background</h2>
        ${(b.situation || []).map((s, i) => `<p><span class="num">${i + 1}.</span>${esc(s)}</p>`).join('')}
        ${(b.actions || []).length ? `<h2>Progress</h2><ul>${b.actions.map((a) => `<li>${esc(a.text)} <em>(${esc(STATUS[a.status] || a.status)})</em></li>`).join('')}</ul>` : ''}
        ${(b.risks || []).length ? `<h2>Handling</h2><ul>${b.risks.map((r) => `<li><b>${esc(LEVEL[r.level] || r.level)} risk:</b> ${esc(r.text)}</li>`).join('')}</ul>` : ''}
        ${(b.next || []).length ? `<h2>Next steps</h2><ul>${b.next.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      </article>
      ${ctx.decisions
        .map((d) => {
          const st = decisionState(d);
          return `
      <article class="paper slip ${st.open ? 'open' : 'closed'}">
        <div class="slip-head">Decision slip</div>
        <h2>${esc(d.title)}</h2>
        <p>${esc(d.body)}</p>
        <ul class="opts">${d.options.map((o) => `<li class="${o.recommended ? 'rec' : ''}"><b>${esc(o.label)}</b>${o.recommended ? '<span class="r">Recommended</span>' : ''}<br><small>${esc(o.detail)}</small></li>`).join('')}</ul>
        <div class="act">${decideButton(d, 'Record decision')}</div>
      </article>`;
        })
        .join('')}
    </div>
  </div>`;
}

export const script = `
const box = document.querySelector('.box');
const open = () => document.body.classList.add('opened');
box.addEventListener('click', open);
box.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && open());
`;

export const css = `
* { box-sizing: border-box; }
html, body { margin: 0; min-height: 100%; background: var(--backdrop); color: var(--ink); font-family: var(--font-body); }
.room { min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 40px 20px 80px; }
.box { width: min(720px, 100%); aspect-ratio: 1.75; perspective: 1400px; cursor: pointer; outline: none; transition: margin .6s ease, aspect-ratio .6s ease; }
.lid { position: relative; height: 100%; border-radius: 10px; background: var(--leather); box-shadow: 0 30px 60px rgba(0,0,0,.55), inset 0 0 0 6px rgba(0,0,0,.18), inset 0 0 0 9px var(--gold-dim), inset 0 0 80px rgba(0,0,0,.35); display: grid; place-items: center; transform-origin: top center; transition: transform .7s cubic-bezier(.3,.7,.2,1), opacity .5s ease .2s; }
.emboss { color: var(--gold); text-align: center; text-shadow: 0 1px 0 rgba(0,0,0,.4); }
.word { font-family: var(--font-display); letter-spacing: .3em; font-size: 22px; font-weight: 600; padding-left: .3em; text-transform: uppercase; }
.rule { width: 120px; height: 1px; background: var(--gold); opacity: .6; margin: 14px auto; }
.sub { font-family: var(--font-display); letter-spacing: .25em; font-size: 11px; opacity: .8; margin-top: 6px; text-transform: uppercase; }
.lock { position: absolute; bottom: 18px; left: 50%; width: 44px; height: 26px; margin-left: -22px; border-radius: 4px; background: linear-gradient(var(--gold), var(--gold-dim)); box-shadow: 0 2px 4px rgba(0,0,0,.4); }
.lock::after { content: ''; position: absolute; left: 50%; top: 8px; width: 6px; height: 10px; margin-left: -3px; background: #3a2a10; border-radius: 3px; }
.hint { position: absolute; bottom: -34px; font-size: 12px; letter-spacing: .2em; text-transform: uppercase; color: var(--muted); }
.box:focus-visible .lid { outline: 2px solid var(--gold); outline-offset: 6px; }
.papers { width: min(760px, 100%); display: grid; gap: 22px; margin-top: 0; max-height: 0; overflow: hidden; opacity: 0; transition: opacity .6s ease .35s; }
body.opened .box { aspect-ratio: 6; margin-bottom: 24px; }
body.opened .lid { transform: rotateX(72deg); opacity: .55; }
body.opened .hint { display: none; }
body.opened .papers { max-height: none; overflow: visible; opacity: 1; }
.paper { background: var(--paper); color: var(--ink); padding: 44px 56px; box-shadow: 0 10px 30px rgba(0,0,0,.35); line-height: 1.6; font-size: 15px; }
.head { display: flex; justify-content: space-between; border-bottom: 1px solid var(--rule); padding-bottom: 10px; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted-ink); }
.mark { color: var(--leather); font-weight: 700; letter-spacing: .2em; }
h1 { font-family: var(--font-display); font-size: 24px; margin: 22px 0 12px; font-weight: 600; }
h2 { font-family: var(--font-display); font-size: 14px; letter-spacing: .12em; text-transform: uppercase; margin: 24px 0 8px; color: var(--leather); }
.meta { border-collapse: collapse; font-size: 14px; }
.meta th { text-align: left; padding: 2px 18px 2px 0; color: var(--muted-ink); font-weight: 600; }
.lead { font-size: 17px; font-weight: 600; }
.num { display: inline-block; width: 2em; font-weight: 600; }
p { margin: 0 0 10px; }
ul, ol { margin: 0 0 10px; padding-left: 1.3em; }
li { margin-bottom: 6px; }
.slip { border-top: 8px solid var(--leather); }
.slip-head { font-size: 11px; letter-spacing: .25em; text-transform: uppercase; color: var(--muted-ink); }
.opts { list-style: none; padding: 0; display: grid; gap: 10px; }
.opts li { border: 1px solid var(--rule); padding: 10px 14px; }
.opts li.rec { border-color: var(--leather); background: var(--tint); }
.opts .r { margin-left: 10px; font-size: 10px; letter-spacing: .15em; text-transform: uppercase; color: var(--leather); font-weight: 700; }
.opts small { color: var(--muted-ink); }
.act { display: flex; justify-content: flex-end; margin-top: 8px; }
.decide { font-family: var(--font-display); background: var(--leather); color: var(--gold); border: 0; padding: 10px 22px; letter-spacing: .12em; text-transform: uppercase; font-size: 12px; cursor: pointer; border-radius: 2px; }
.decide:hover { filter: brightness(1.15); }
.decided { font-style: italic; color: var(--muted-ink); }
`;
