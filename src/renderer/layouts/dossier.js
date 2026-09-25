// Manila Dossier: a folder with a tab, a typed sheet, a stamp and a paperclip.
import { esc, fmtDate, STATUS, LEVEL, decisionState, decideButton } from './common.js';

const STAMP = { ROUTINE: 'RESTRICTED', PRIORITY: 'CONFIDENTIAL', FLASH: 'TOP SECRET' };

export function render(b, ctx) {
  let para = 0;
  const n = () => `<span class="pn">${++para}.</span>`;
  return `
  <div class="desk">
    <div class="folder">
      <div class="tab">${esc(ctx.from.name)} · FILE ${esc(b.id.slice(-6).toUpperCase())}</div>
      <article class="sheet">
        <div class="clip"></div>
        <header>
          <div class="marking">${esc(STAMP[b.classification] || b.classification)} // LEADER EYES ONLY</div>
          <div class="meta">
            <div><b>FROM:</b> ${esc(ctx.from.name)}, ${esc(ctx.from.title)}</div>
            <div><b>TO:</b> The Leader</div>
            <div><b>DATE:</b> ${esc(fmtDate(b.createdAt, { dateStyle: 'long', timeStyle: 'short' }))}</div>
            <div><b>SUBJECT:</b> ${esc(b.title)}</div>
          </div>
          <div class="stamp s-${esc(b.classification)}">${esc(STAMP[b.classification] || b.classification)}</div>
        </header>
        <section>
          <h3>Summary</h3>
          <p class="bluf">${n()} ${esc(b.bluf)}</p>
        </section>
        <section>
          <h3>Situation</h3>
          ${(b.situation || []).map((s) => `<p>${n()} ${esc(s)}</p>`).join('')}
        </section>
        ${(b.actions || []).length ? `<section><h3>Action taken</h3>${b.actions.map((a) => `<p>${n()} ${esc(a.text)} <span class="tag t-${esc(a.status)}">[${esc(STATUS[a.status] || a.status).toUpperCase()}]</span></p>`).join('')}</section>` : ''}
        ${(b.risks || []).length ? `<section><h3>Assessment of risk</h3>${b.risks.map((r) => `<p>${n()} <span class="tag r-${esc(r.level)}">[${esc(LEVEL[r.level] || r.level).toUpperCase()}]</span> ${esc(r.text)}</p>`).join('')}</section>` : ''}
        ${ctx.decisions
          .map((d) => {
            const st = decisionState(d);
            return `
          <section class="minute ${st.open ? 'open' : 'closed'}">
            <h3>Minute for decision: ${esc(d.title)}</h3>
            <p>${esc(d.body)}</p>
            <ul class="boxes">${d.options
              .map((o) => `<li><span class="box">${!st.open && d.choice?.optionId === o.id ? '&#10007;' : ''}</span><div><b>${esc(o.label)}</b>${o.recommended ? ' <i>(recommended)</i>' : ''}<br><small>${esc(o.detail)}</small></div></li>`)
              .join('')}</ul>
            <div class="sign">${decideButton(d, 'Initial & decide')}</div>
          </section>`;
          })
          .join('')}
        ${(b.next || []).length ? `<section><h3>Intentions</h3>${b.next.map((x) => `<p>${n()} ${esc(x)}</p>`).join('')}</section>` : ''}
        <footer>${esc(STAMP[b.classification] || b.classification)} · Page 1 of 1 · Copy 1 of 1</footer>
      </article>
    </div>
  </div>`;
}

export const script = '';

export const css = `
* { box-sizing: border-box; }
html, body { margin: 0; min-height: 100%; background: var(--backdrop); color: var(--ink); font-family: var(--font-body); }
.desk { padding: 48px 24px 64px; display: flex; justify-content: center; }
.folder { position: relative; width: min(860px, 100%); background: var(--folder); border-radius: 4px 14px 14px 14px; padding: 34px 30px 30px; box-shadow: 0 24px 60px rgba(0,0,0,.45), inset 0 0 0 1px rgba(0,0,0,.08); }
.tab { position: absolute; top: -30px; left: 0; background: var(--folder); padding: 8px 22px 6px; border-radius: 10px 10px 0 0; font-family: var(--font-display); font-size: 12px; letter-spacing: .12em; color: var(--folder-ink); }
.sheet { position: relative; background: var(--paper); padding: 56px 64px 40px; box-shadow: 0 2px 6px rgba(0,0,0,.18); line-height: 1.6; font-size: 15px; transform: rotate(-.35deg); }
.clip { position: absolute; top: -18px; left: 70px; width: 22px; height: 64px; border: 3px solid #9aa0a6; border-radius: 12px; border-bottom-color: transparent; box-shadow: 1px 1px 0 rgba(0,0,0,.15); }
header { position: relative; border-bottom: 2px solid var(--ink); padding-bottom: 16px; margin-bottom: 20px; }
.marking { text-align: center; font-weight: 700; letter-spacing: .25em; font-size: 12px; color: var(--stamp); margin-bottom: 18px; }
.meta { display: grid; gap: 2px; font-size: 14px; padding-right: 190px; }
.stamp { position: absolute; right: -10px; top: 26px; border: 4px double var(--stamp); color: var(--stamp); font-family: var(--font-display); font-weight: 800; letter-spacing: .12em; padding: 6px 14px; font-size: 22px; transform: rotate(-11deg); opacity: .78; mix-blend-mode: multiply; }
h3 { font-family: var(--font-display); text-transform: uppercase; letter-spacing: .14em; font-size: 13px; margin: 26px 0 8px; text-decoration: underline; text-underline-offset: 4px; }
p { margin: 0 0 10px; }
.pn { display: inline-block; min-width: 2em; font-weight: 700; }
.bluf { font-weight: 700; }
.tag { font-size: 12px; font-weight: 700; }
.t-blocked, .r-high { color: var(--stamp); }
.minute { margin-top: 26px; border: 1.5px solid var(--ink); padding: 4px 20px 16px; background: var(--minute); }
.boxes { list-style: none; padding: 0; margin: 12px 0; display: grid; gap: 10px; }
.boxes li { display: flex; gap: 12px; align-items: flex-start; }
.box { flex: none; width: 20px; height: 20px; border: 1.5px solid var(--ink); display: grid; place-items: center; font-size: 16px; color: var(--stamp); margin-top: 3px; }
.boxes small { opacity: .75; }
.sign { display: flex; justify-content: flex-end; }
.decide { font-family: var(--font-display); font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: var(--stamp); background: transparent; border: 3px solid var(--stamp); padding: 8px 18px; cursor: pointer; transform: rotate(-3deg); font-size: 13px; }
.decide:hover { background: var(--stamp); color: var(--paper); }
.decided { font-style: italic; opacity: .8; }
footer { margin-top: 36px; text-align: center; font-size: 11px; letter-spacing: .2em; color: var(--stamp); font-weight: 700; }
`;
