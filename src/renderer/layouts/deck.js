// Slide Deck: a 16:9 slide presentation. Arrow keys, click, or dots to move.
import { esc, fmtDate, STATUS, LEVEL, fromLine, decisionState, decisionControls } from './common.js';

function chunk(list, n) {
  const out = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out.length ? out : [[]];
}

export function render(b, ctx) {
  const slides = [];
  slides.push(`
    <section class="slide title-slide">
      <div class="class-pill c-${esc(b.classification)}">${esc(b.classification)}</div>
      <h1>${esc(b.title)}</h1>
      <p class="from">Briefing by ${fromLine(ctx)}</p>
      <p class="date">${esc(fmtDate(b.createdAt))}</p>
      ${(() => {
        const open = ctx.decisions.filter((d) => decisionState(d).open);
        return open.length ? `<button class="await" data-goto-decision="${esc(open[0].id)}">${open.length} decision${open.length > 1 ? 's' : ''} awaiting you: review now</button>` : '';
      })()}
    </section>`);
  slides.push(`
    <section class="slide bluf-slide">
      <div class="kicker">Bottom line</div>
      <p class="bluf">${esc(b.bluf)}</p>
    </section>`);
  chunk(b.situation || [], 4).forEach((part, i, all) =>
    slides.push(`
    <section class="slide">
      <div class="kicker">Situation${all.length > 1 ? ` · ${i + 1}/${all.length}` : ''}</div>
      <ol class="points" start="${i * 4 + 1}">${part.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>
    </section>`)
  );
  if ((b.actions || []).length || (b.risks || []).length) {
    slides.push(`
    <section class="slide two-col">
      <div>
        <div class="kicker">Actions</div>
        <ul class="actions">${(b.actions || []).map((a) => `<li><span class="chip s-${esc(a.status)}">${esc(STATUS[a.status] || a.status)}</span>${esc(a.text)}</li>`).join('')}</ul>
      </div>
      <div>
        <div class="kicker">Risks</div>
        <ul class="risks">${(b.risks || []).map((r) => `<li><span class="chip r-${esc(r.level)}">${esc(LEVEL[r.level] || r.level)}</span>${esc(r.text)}</li>`).join('')}</ul>
      </div>
    </section>`);
  }
  for (const d of ctx.decisions) {
    const st = decisionState(d);
    slides.push(`
    <section class="slide decision-slide ${st.open ? 'open' : 'closed'}" data-decision-block="${esc(d.id)}">
      <div class="kicker">${st.open ? 'Decision required' : 'Decision'}</div>
      <h2>${esc(d.title)}</h2>
      <p class="body">${esc(d.body)}</p>
      ${decisionControls(d)}
    </section>`);
  }
  if ((b.next || []).length) {
    slides.push(`
    <section class="slide">
      <div class="kicker">Next</div>
      <ul class="points next">${b.next.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
    </section>`);
  }

  return `
  <div class="deck">
    <div class="viewport">${slides.map((s, i) => s.replace('<section class="slide', `<section data-i="${i}" class="slide`)).join('')}</div>
    <footer class="nav">
      <button class="prev" aria-label="Previous slide">&#8249;</button>
      <div class="dots">${slides.map((_, i) => `<i data-go="${i}"></i>`).join('')}</div>
      <span class="count"></span>
      <button class="next" aria-label="Next slide">&#8250;</button>
    </footer>
    <div class="progress"><span></span></div>
  </div>`;
}

export const script = `
const slides = [...document.querySelectorAll('.slide')];
const dots = [...document.querySelectorAll('.dots i')];
let cur = 0;
function show(i) {
  cur = Math.max(0, Math.min(slides.length - 1, i));
  slides.forEach((s, k) => s.classList.toggle('active', k === cur));
  dots.forEach((d, k) => d.classList.toggle('on', k === cur));
  document.querySelector('.count').textContent = (cur + 1) + ' / ' + slides.length;
  document.querySelector('.progress span').style.width = ((cur + 1) / slides.length * 100) + '%';
}
document.querySelector('.prev').onclick = () => show(cur - 1);
document.querySelector('.next').onclick = () => show(cur + 1);
dots.forEach((d) => (d.onclick = () => show(+d.dataset.go)));
document.addEventListener('keydown', (e) => {
  if (e.target.closest('textarea, button')) return;
  if (['ArrowRight', 'PageDown', ' '].includes(e.key)) show(cur + 1);
  if (['ArrowLeft', 'PageUp'].includes(e.key)) show(cur - 1);
  if (e.key === 'Home') show(0);
  if (e.key === 'End') show(slides.length - 1);
});
const slideOf = (id) => slides.findIndex((s) => s.dataset.decisionBlock === id);
window.addEventListener('lh-goto', (e) => show(slideOf(e.detail)));
show(window.LH_FOCUS && slideOf(window.LH_FOCUS) >= 0 ? slideOf(window.LH_FOCUS) : 0);
`;

export const css = `
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: var(--backdrop); color: var(--ink); font-family: var(--font-body); overflow: hidden; }
.deck { position: absolute; inset: 0; display: flex; flex-direction: column; }
.viewport { flex: 1; position: relative; display: grid; place-items: center; padding: 28px 28px 8px; }
.slide {
  position: absolute; width: min(calc(100% - 56px), calc((100vh - 110px) * 16 / 9)); aspect-ratio: 16 / 9;
  background: var(--slide); border-radius: var(--radius); box-shadow: var(--shadow);
  padding: 5.5% 7%; display: flex; flex-direction: column; justify-content: center; gap: 1.2em;
  opacity: 0; transform: translateX(24px) scale(.985); transition: opacity .35s ease, transform .35s ease; pointer-events: none;
  font-size: clamp(12px, 1.55vw, 22px); overflow: hidden;
}
.slide::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 6px; background: var(--accent); }
.slide.active { opacity: 1; transform: none; pointer-events: auto; }
.decision-slide { justify-content: flex-start; overflow-y: auto; font-size: clamp(11px, 1.25vw, 18px); }
.await { align-self: flex-start; font: inherit; font-size: .8em; font-weight: 600; margin-top: .6em; padding: .55em 1.1em; border-radius: 99px; border: 1px solid var(--accent); background: transparent; color: var(--accent); cursor: pointer; }
.await:hover { background: var(--accent); color: var(--slide); }
:root { --decide-accent: var(--accent); --decide-on-accent: var(--slide); --decide-bg: var(--chip); --decide-line: var(--line); --decide-field: var(--backdrop); --decide-danger: var(--danger); --decide-radius: calc(var(--radius) / 2); }
.kicker { font-family: var(--font-display); text-transform: uppercase; letter-spacing: .18em; font-size: .72em; color: var(--accent); font-weight: 600; }
h1 { font-family: var(--font-display); font-size: 2.6em; line-height: 1.08; margin: 0; font-weight: 700; letter-spacing: -.01em; }
h2 { font-family: var(--font-display); font-size: 1.8em; margin: 0; line-height: 1.15; }
.from { margin: 0; color: var(--muted); font-size: 1.05em; }
.date { margin: 0; color: var(--muted); font-size: .85em; }
.class-pill { align-self: flex-start; font-family: var(--font-display); font-size: .7em; letter-spacing: .2em; padding: .35em .9em; border-radius: 99px; border: 1px solid currentColor; }
.c-ROUTINE { color: var(--muted); } .c-PRIORITY { color: var(--warn); } .c-FLASH { color: var(--danger); }
.bluf { font-size: 2em; line-height: 1.3; margin: 0; font-weight: 500; }
.points { margin: 0; padding-left: 1.4em; display: grid; gap: .8em; line-height: 1.45; }
.points li::marker { color: var(--accent); font-weight: 700; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 2.5em; align-content: center; }
.two-col > div { display: flex; flex-direction: column; gap: 1em; }
.actions, .risks { list-style: none; margin: 0; padding: 0; display: grid; gap: .75em; line-height: 1.4; }
.actions li, .risks li { display: flex; gap: .7em; align-items: baseline; }
.chip { flex: none; font-size: .62em; text-transform: uppercase; letter-spacing: .1em; padding: .3em .6em; border-radius: 4px; background: var(--chip); font-weight: 600; }
.s-done, .r-low { color: var(--ok); } .s-in_progress, .r-medium { color: var(--warn); } .s-blocked, .r-high { color: var(--danger); }
.body { margin: 0; line-height: 1.5; color: var(--muted); max-width: 60ch; }
.nav { display: flex; align-items: center; justify-content: center; gap: 16px; height: 52px; color: var(--muted); font-size: 13px; }
.nav button { background: none; border: 1px solid var(--line); color: var(--ink); width: 34px; height: 34px; border-radius: 50%; font-size: 20px; line-height: 1; cursor: pointer; }
.nav button:hover { border-color: var(--accent); color: var(--accent); }
.dots { display: flex; gap: 7px; }
.dots i { width: 7px; height: 7px; border-radius: 50%; background: var(--line); cursor: pointer; transition: all .2s; }
.dots i.on { background: var(--accent); width: 20px; border-radius: 4px; }
.count { min-width: 48px; text-align: center; font-variant-numeric: tabular-nums; }
.progress { position: absolute; top: 0; left: 0; right: 0; height: 3px; }
.progress span { display: block; height: 100%; background: var(--accent); transition: width .35s ease; }
`;
