// Slide Deck: a 16:9 presentation, one point per slide. Every slide carries a
// running header (briefing, classification, page) like a real briefing deck.
// Order: cover with the numbers, bottom line, decisions, situation, actions
// and risks, next. Arrow keys, click, or dots to move.
import { esc, fmtDate, fromLine, decisionState, decisionControls, glance, fileRef, actionRows, riskRows } from './common.js';

function chunk(list, n) {
  const out = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out.length ? out : [[]];
}

export function render(b, ctx) {
  const slides = [];
  const open = ctx.decisions.filter((d) => decisionState(d).open);

  slides.push({
    cls: 'cover',
    body: `
      <div class="class-pill c-${esc(b.classification)}">${esc(b.classification)}</div>
      <h1>${esc(b.title)}</h1>
      <p class="from">${fromLine(ctx)} · ${esc(fmtDate(b.createdAt, { dateStyle: 'medium', timeStyle: 'short' }))}</p>
      <div class="glance">${glance(b, ctx)
        .map((g) => `<div class="${g.alert ? 'alert' : ''}"><b>${esc(g.value)}</b><span>${esc(g.label)}</span></div>`)
        .join('')}</div>
      ${open.length ? `<button class="await" data-goto-decision="${esc(open[0].id)}">Review ${open.length > 1 ? `${open.length} decisions` : 'the decision'} now &#8594;</button>` : ''}`,
  });
  slides.push({ label: 'Bottom line', cls: 'bluf-slide', body: `<p class="bluf">${esc(b.bluf)}</p>` });
  for (const d of ctx.decisions) {
    const st = decisionState(d);
    slides.push({
      label: st.open ? 'Decision required' : 'Decision',
      cls: `decision-slide ${st.open ? 'open' : 'closed'}`,
      attrs: `data-decision-block="${esc(d.id)}"`,
      body: `<h2>${esc(d.title)}</h2><p class="body">${esc(d.body)}</p>${decisionControls(d)}`,
    });
  }
  chunk(b.situation || [], 4).forEach((part, i, all) =>
    slides.push({
      label: `Situation${all.length > 1 ? ` (${i + 1}/${all.length})` : ''}`,
      body: `<ol class="points" start="${i * 4 + 1}">${part.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>`,
    })
  );
  if ((b.actions || []).length || (b.risks || []).length) {
    slides.push({
      label: 'Actions and risks',
      cls: 'two-col',
      body: `
        <div><h3>Actions</h3><table class="rows">${actionRows(b) || '<tr><td>None reported.</td></tr>'}</table></div>
        <div><h3>Risks</h3><table class="rows">${riskRows(b) || '<tr><td>None reported.</td></tr>'}</table></div>`,
    });
  }
  if ((b.next || []).length) {
    slides.push({ label: 'Next', body: `<ul class="points next">${b.next.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` });
  }

  const total = slides.length;
  return `
  <div class="deck">
    <div class="viewport">${slides
      .map(
        (s, i) => `<section data-i="${i}" class="slide ${s.cls || ''}" ${s.attrs || ''}>
          <header class="run"><span>${esc(s.label || 'Briefing')} · <em>${esc(b.title)}</em></span><span>${esc(b.classification)} · ${i + 1}/${total}</span></header>
          <div class="content">${s.body}</div>
          <footer class="foot"><span>${esc(ctx.from.name)}</span><span>${esc(fileRef(b))}</span></footer>
        </section>`
      )
      .join('')}</div>
    <nav class="nav">
      <button class="prev" aria-label="Previous slide">&#8249;</button>
      <div class="dots">${slides.map((s, i) => `<i data-go="${i}" class="${s.attrs ? 'dec' : ''}" title="${esc(s.label || 'Cover')}"></i>`).join('')}</div>
      <span class="count"></span>
      <button class="next" aria-label="Next slide">&#8250;</button>
    </nav>
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
.viewport { flex: 1; position: relative; display: grid; place-items: center; padding: 22px 24px 6px; }
.slide {
  position: absolute; width: min(calc(100% - 48px), calc((100vh - 96px) * 16 / 9)); aspect-ratio: 16 / 9;
  background: var(--slide); border-radius: var(--radius); box-shadow: var(--shadow); border: 1px solid var(--line);
  display: grid; grid-template-rows: auto 1fr auto; overflow: hidden;
  opacity: 0; transition: opacity .25s ease; pointer-events: none; font-size: clamp(13px, 1.65vw, 22px);
}
.slide.active { opacity: 1; pointer-events: auto; }
.run, .foot { display: flex; justify-content: space-between; gap: 1em; padding: .7em 2.2em; font-size: .62em; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
.run { border-bottom: 1px solid var(--line); }
.run em { font-style: normal; color: var(--faint); text-transform: none; letter-spacing: 0; }
.foot { border-top: 1px solid var(--line); color: var(--faint); }
.content { padding: 1.4em 2.2em; display: flex; flex-direction: column; justify-content: center; gap: 1em; min-height: 0; overflow-y: auto; }
.cover .content { justify-content: center; gap: .9em; }
.class-pill { align-self: flex-start; font-size: .62em; font-weight: 700; letter-spacing: .2em; padding: .3em .8em; border-radius: 3px; color: var(--slide); }
.c-ROUTINE { background: var(--ok); } .c-PRIORITY { background: var(--warn); } .c-FLASH { background: var(--danger); }
h1 { font-family: var(--font-display); font-size: 2.3em; line-height: 1.1; margin: 0; font-weight: 700; letter-spacing: -.01em; }
h2 { font-family: var(--font-display); font-size: 1.55em; margin: 0; line-height: 1.2; }
h3 { font-size: .7em; letter-spacing: .14em; text-transform: uppercase; color: var(--accent); margin: 0 0 .6em; }
.from { margin: 0; color: var(--muted); font-size: .85em; }
.glance { display: grid; grid-template-columns: repeat(4, 1fr); gap: .6em; margin-top: .6em; }
.glance div { background: var(--chip); border-radius: calc(var(--radius) / 2); padding: .6em .8em; display: grid; gap: .1em; border-left: 3px solid var(--line); }
.glance b { font-size: 1.5em; line-height: 1; font-variant-numeric: tabular-nums; }
.glance span { font-size: .6em; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
.glance .alert { border-left-color: var(--accent); }
.glance .alert b { color: var(--accent); }
.await { align-self: flex-start; font: inherit; font-size: .75em; font-weight: 600; margin-top: .4em; padding: .55em 1.1em; border-radius: 4px; border: 0; background: var(--accent); color: var(--slide); cursor: pointer; }
.bluf { font-size: 1.75em; line-height: 1.3; margin: 0; font-weight: 500; max-width: 38ch; }
.points { margin: 0; padding-left: 1.4em; display: grid; gap: .7em; line-height: 1.45; }
.points li::marker { color: var(--accent); font-weight: 700; }
.two-col .content { display: grid; grid-template-columns: 1fr 1fr; gap: 2em; align-content: start; padding-top: 2em; }
.rows { width: 100%; border-collapse: collapse; font-size: .9em; }
.rows td { padding: .45em .5em; border-bottom: 1px solid var(--line); vertical-align: top; line-height: 1.35; }
.rows .st { width: 7.5em; font-size: .78em; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; white-space: nowrap; }
.s-done .st, .r-low .st { color: var(--ok); } .s-in_progress .st, .r-medium .st { color: var(--warn); } .s-blocked .st, .r-high .st { color: var(--danger); }
.decision-slide .content { justify-content: flex-start; font-size: .9em; }
.decision-slide .body { margin: 0; line-height: 1.45; color: var(--muted); max-width: 70ch; }
.nav { display: flex; align-items: center; justify-content: center; gap: 14px; height: 48px; color: var(--muted); font-size: 13px; }
.nav button { background: none; border: 1px solid var(--line); color: var(--ink); width: 32px; height: 32px; border-radius: 50%; font-size: 19px; line-height: 1; cursor: pointer; }
.nav button:hover { border-color: var(--accent); color: var(--accent); }
.dots { display: flex; gap: 7px; }
.dots i { width: 7px; height: 7px; border-radius: 50%; background: var(--line); cursor: pointer; }
.dots i.dec { background: var(--accent); opacity: .55; }
.dots i.on { background: var(--ink); width: 18px; border-radius: 4px; opacity: 1; }
.count { min-width: 48px; text-align: center; font-variant-numeric: tabular-nums; }
.progress { position: absolute; top: 0; left: 0; right: 0; height: 2px; }
.progress span { display: block; height: 100%; background: var(--accent); transition: width .25s ease; }
:root { --decide-accent: var(--accent); --decide-on-accent: var(--slide); --decide-bg: var(--chip); --decide-line: var(--line); --decide-field: var(--backdrop); --decide-danger: var(--danger); --decide-radius: 4px; }
`;
