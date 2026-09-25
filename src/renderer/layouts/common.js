// Shared helpers for briefing layouts. A layout turns the Briefing schema into
// HTML for a sandboxed iframe; a style (JSON) supplies CSS variables and extra
// CSS on top of the layout's own CSS.

export const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const fmtDate = (iso, opts = { dateStyle: 'full', timeStyle: 'short' }) => new Date(iso).toLocaleString(undefined, opts);

export const STATUS = { done: 'Done', in_progress: 'In progress', blocked: 'Blocked' };
export const LEVEL = { low: 'Low', medium: 'Medium', high: 'High' };

export function fromLine(ctx) {
  return `${esc(ctx.from.name)}, ${esc(ctx.from.title)}`;
}

// Decision state as shown inside a briefing.
export function decisionState(d) {
  if (d.status === 'pending') return { open: true, label: 'Awaiting decision' };
  const opt = d.options.find((o) => o.id === d.choice?.optionId);
  const text = d.choice?.text || opt?.label || '';
  const how = { decided: 'Decided', auto: 'Recommendation proceeded', halted: 'Work halted', withdrawn: 'Withdrawn' }[d.status] || d.status;
  return { open: false, label: text ? `${how}: ${text}` : how };
}

function deadlineText(d) {
  if (!d.deadlineAt) return '';
  const mins = Math.round((new Date(d.deadlineAt) - Date.now()) / 60000);
  if (mins <= 0) return 'The recommendation proceeds shortly.';
  const when = mins < 60 ? `${mins} min` : mins < 1440 ? `${Math.round(mins / 60)} h` : `${Math.round(mins / 1440)} days`;
  return `If there is no response within ${when}, the recommendation proceeds.`;
}

/**
 * The decision controls every layout embeds: choose an option (then confirm),
 * give a different instruction, or halt the Official's work. Once decided,
 * the outcome is shown instead.
 */
export function decisionControls(d) {
  const st = decisionState(d);
  if (!st.open) {
    const chosen = d.options.find((o) => o.id === d.choice?.optionId);
    return `<div class="lh-decision closed"><span class="lh-outcome">${esc(st.label)}</span>${chosen?.detail ? `<small>${esc(chosen.detail)}</small>` : ''}</div>`;
  }
  const opts = d.options
    .map(
      (o) => `<button type="button" class="lh-opt ${o.recommended ? 'rec' : ''}" data-opt="${esc(o.id)}" data-label="${esc(o.label)}">
        ${o.recommended ? '<span class="lh-tag">Recommended</span>' : ''}<b>${esc(o.label)}</b><small>${esc(o.detail)}</small></button>`
    )
    .join('');
  return `<div class="lh-decision" data-dec="${esc(d.id)}">
    <div class="lh-opts">${opts}</div>
    <div class="lh-confirm" hidden><span class="lh-choice"></span><button type="button" class="lh-go" data-confirm>Confirm decision</button><button type="button" class="lh-link" data-cancel>Cancel</button></div>
    ${
      d.sample
        ? ''
        : `<div class="lh-other" hidden><textarea placeholder="Your instruction is sent exactly as written."></textarea>
             <div><button type="button" class="lh-go" data-send>Send instruction</button><button type="button" class="lh-link" data-cancel-other>Cancel</button></div></div>
           <div class="lh-foot"><button type="button" class="lh-link" data-other>Give a different instruction</button>
             <button type="button" class="lh-link lh-halt" data-halt>Halt work</button><span class="lh-deadline">${esc(deadlineText(d))}</span></div>`
    }
  </div>`;
}

// Structural CSS for the decision controls. Each layout sets --decide-* to
// match its look; styles can override any of it.
export const DECISION_CSS = `
[hidden] { display: none !important; }
.lh-decision { display: grid; gap: .7em; margin-top: .6em; font-family: var(--decide-font, inherit); }
.lh-opts { display: grid; gap: .5em; }
.lh-opt { position: relative; display: grid; gap: .2em; text-align: left; font: inherit; color: var(--decide-ink, inherit);
  background: var(--decide-bg, rgba(127,127,127,.08)); border: 1px solid var(--decide-line, rgba(127,127,127,.35));
  border-radius: var(--decide-radius, 6px); padding: .75em .95em; cursor: pointer; }
.lh-opt:hover { border-color: var(--decide-accent, #b8860b); }
.lh-opt.rec { border-color: var(--decide-accent, #b8860b); }
.lh-opt.selected { outline: 2px solid var(--decide-accent, #b8860b); outline-offset: 1px; }
.lh-opt small { opacity: .75; font-size: .88em; line-height: 1.4; }
.lh-tag { font-size: .68em; letter-spacing: .12em; text-transform: uppercase; color: var(--decide-accent, #b8860b); font-weight: 700; }
.lh-confirm { display: flex; flex-wrap: wrap; align-items: center; gap: .6em; padding: .6em .8em; border-radius: var(--decide-radius, 6px);
  background: var(--decide-bg, rgba(127,127,127,.08)); }
.lh-choice { flex: 1; min-width: 12em; }
.lh-go { font: inherit; font-weight: 600; cursor: pointer; border: 0; border-radius: var(--decide-radius, 6px); padding: .5em 1.1em;
  background: var(--decide-accent, #b8860b); color: var(--decide-on-accent, #fff); }
.lh-link { font: inherit; font-size: .9em; background: none; border: 0; padding: .2em 0; cursor: pointer; color: var(--decide-ink, inherit); opacity: .75; text-decoration: underline; text-underline-offset: 3px; }
.lh-link:hover { opacity: 1; }
.lh-halt { color: var(--decide-danger, #c0392b); opacity: .9; }
.lh-foot { display: flex; flex-wrap: wrap; align-items: center; gap: 1.2em; font-size: .9em; }
.lh-deadline { opacity: .7; font-size: .92em; margin-left: auto; }
.lh-other { display: grid; gap: .5em; }
.lh-other textarea { font: inherit; min-height: 4.5em; padding: .6em; border-radius: var(--decide-radius, 6px); border: 1px solid var(--decide-line, rgba(127,127,127,.35));
  background: var(--decide-field, transparent); color: var(--decide-ink, inherit); resize: vertical; }
.lh-other > div { display: flex; gap: .8em; align-items: center; }
.lh-decision.closed { gap: .2em; }
.lh-outcome { font-weight: 600; }
.lh-decision.closed small { opacity: .75; }
.lh-decision.sending { opacity: .5; pointer-events: none; }
`;

// Every layout gets this script: decisions are taken in the report itself and
// sent to the app. Elements with data-goto-decision ask the layout to bring
// the decision into view (the deck listens for this).
export const BRIDGE_SCRIPT = `
function send(dec, choice) {
  dec.classList.add('sending');
  parent.postMessage({ lh: 'choose', id: dec.dataset.dec, choice }, '*');
}
document.addEventListener('click', (e) => {
  const jump = e.target.closest('[data-goto-decision]');
  if (jump) { e.preventDefault(); window.dispatchEvent(new CustomEvent('lh-goto', { detail: jump.dataset.gotoDecision })); return; }
  const dec = e.target.closest('.lh-decision[data-dec]');
  if (!dec) return;
  const $ = (s) => dec.querySelector(s);
  const opt = e.target.closest('.lh-opt');
  if (opt) {
    dec.querySelectorAll('.lh-opt').forEach((o) => o.classList.toggle('selected', o === opt));
    dec.dataset.opt = opt.dataset.opt;
    $('.lh-choice').textContent = 'Your decision: ' + opt.dataset.label;
    $('.lh-confirm').hidden = false;
    if ($('.lh-other')) $('.lh-other').hidden = true;
    $('[data-confirm]').focus();
    return;
  }
  if (e.target.closest('[data-confirm]')) return send(dec, { optionId: dec.dataset.opt });
  if (e.target.closest('[data-cancel]')) {
    $('.lh-confirm').hidden = true;
    dec.querySelectorAll('.lh-opt').forEach((o) => o.classList.remove('selected'));
    return;
  }
  if (e.target.closest('[data-other]')) { $('.lh-other').hidden = false; $('.lh-confirm').hidden = true; $('.lh-other textarea').focus(); return; }
  if (e.target.closest('[data-cancel-other]')) { $('.lh-other').hidden = true; return; }
  if (e.target.closest('[data-send]')) {
    const text = $('.lh-other textarea').value.trim();
    if (text) send(dec, { text });
    else $('.lh-other textarea').focus();
    return;
  }
  const halt = e.target.closest('[data-halt]');
  if (halt) {
    if (halt.dataset.armed) return send(dec, { halt: true });
    halt.dataset.armed = '1';
    halt.textContent = 'Confirm: halt this Official';
  }
});
window.addEventListener('message', (e) => {
  // The app reports a failed decision; re-enable the controls.
  if (e.data && e.data.lh === 'decision-failed') document.querySelectorAll('.lh-decision.sending').forEach((d) => d.classList.remove('sending'));
});
`;
