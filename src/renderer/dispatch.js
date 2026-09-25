// The Dispatch panel: what needs the Leader right now, delivered to the corner
// of the screen. Decisions can be taken here; briefings open in full on demand.
import { $, $$, esc, monogram, relTime, shortTime, toast } from './util.js';

let state = null;
const drafts = new Map(); // decisionId -> { selected, other, text } survives re-renders

const call = (channel, ...args) =>
  window.lh.call(channel, ...args).catch((err) => {
    toast(err.message, 'error');
    throw err;
  });

const fromOf = (officialId, fallback) => state.officials.find((o) => o.id === officialId) || fallback || { name: 'Leader Harness', title: 'Setup' };

function decisionCard(d) {
  const o = fromOf(d.officialId, state.briefings.find((b) => b.id === d.briefingId)?.from);
  const draft = drafts.get(d.id) || {};
  const chosen = d.options.find((x) => x.id === draft.selected);
  return `<section class="dp-card decision" data-dec="${d.id}">
    <div class="dp-from">${monogram(o.name, 20)}<span>${esc(o.name)}</span><span class="time">${esc(shortTime(d.createdAt))}</span></div>
    <h3>${esc(d.title)}</h3>
    <p>${esc(d.body)}</p>
    <div class="dp-opts">${d.options
      .map(
        (x) => `<button class="dp-opt ${x.recommended ? 'rec' : ''} ${draft.selected === x.id ? 'selected' : ''}" data-opt="${x.id}">
          ${x.recommended ? '<span class="rec-tag">Recommended</span>' : ''}<b>${esc(x.label)}</b><small>${esc(x.detail)}</small></button>`
      )
      .join('')}</div>
    ${chosen ? `<div class="dp-confirm"><span>Your decision: <b>${esc(chosen.label)}</b></span><button class="btn primary sm" data-confirm>Confirm</button><button class="dp-link" data-cancel>Cancel</button></div>` : ''}
    ${
      d.sample
        ? ''
        : draft.other
          ? `<div class="dp-other"><textarea placeholder="Your instruction is sent exactly as written.">${esc(draft.text || '')}</textarea>
               <div class="dp-row"><button class="btn primary sm" data-send>Send instruction</button><button class="dp-link" data-cancel-other>Cancel</button></div></div>`
          : `<div class="dp-row"><button class="dp-link" data-other>Give a different instruction</button><button class="dp-link danger" data-halt>${draft.haltArmed ? 'Confirm: halt this Official' : 'Halt work'}</button></div>`
    }
    ${d.deadlineAt ? `<div class="dp-deadline">If there is no response, the recommendation proceeds ${esc(relTime(d.deadlineAt))}.</div>` : ''}
  </section>`;
}

function briefingCard(b) {
  const o = fromOf(b.officialId, b.from);
  return `<section class="dp-card" data-brf="${b.id}">
    <div class="dp-from">${monogram(o.name, 20)}<span><span class="cls ${esc(b.classification)}">${esc(b.classification)}</span> ${esc(o.name)}</span><span class="time">${esc(shortTime(b.createdAt))}</span></div>
    <h3>${esc(b.title)}</h3>
    <p>${esc(b.bluf)}</p>
    <div class="dp-row"><button class="btn sm" data-read>Read full briefing</button><button class="dp-link" data-mark>Mark read</button></div>
  </section>`;
}

function render() {
  const pending = state.decisions.filter((d) => d.status === 'pending').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const unread = state.briefings.filter((b) => !b.read).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  $('#dp-count').textContent =
    pending.length || unread.length
      ? [pending.length && `${pending.length} decision${pending.length > 1 ? 's' : ''}`, unread.length && `${unread.length} new briefing${unread.length > 1 ? 's' : ''}`].filter(Boolean).join(' · ')
      : 'All clear';
  $('#dp-read-all').hidden = !unread.length;

  // Keep a half-written instruction if the panel re-renders.
  const typing = document.activeElement?.closest?.('[data-dec]')?.dataset.dec;
  if (typing && document.activeElement.tagName === 'TEXTAREA') {
    drafts.set(typing, { ...(drafts.get(typing) || {}), text: document.activeElement.value });
  }

  if (!pending.length && !unread.length) {
    const next = state.officials
      .filter((o) => o.nextBriefingAt)
      .sort((a, b) => a.nextBriefingAt.localeCompare(b.nextBriefingAt))[0];
    $('#dp-body').innerHTML = `<div class="dp-empty"><b>Nothing needs you.</b>${next ? `Next briefing from ${esc(next.name)} ${esc(relTime(next.nextBriefingAt))}.` : 'Your Officials will report here.'}</div>`;
    return;
  }
  $('#dp-body').innerHTML = `
    ${pending.length ? `<div class="dp-section">Decisions awaiting you</div>${pending.map(decisionCard).join('')}` : ''}
    ${unread.length ? `<div class="dp-section">New briefings</div>${unread.map(briefingCard).join('')}` : ''}`;
  if (typing) {
    const ta = $(`[data-dec="${typing}"] textarea`);
    if (ta) {
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }
  }
}

async function decide(id, choice) {
  const d = state.decisions.find((x) => x.id === id);
  $(`[data-dec="${id}"]`)?.classList.add('sending');
  try {
    const result = await call('decision:resolve', id, choice);
    drafts.delete(id);
    if (d?.sample && result?.route) await call('window:open', result.route);
    else toast(choice.halt ? 'Work halted.' : 'Decision recorded.');
  } catch {
    $(`[data-dec="${id}"]`)?.classList.remove('sending');
  }
}

document.addEventListener('click', async (e) => {
  const dec = e.target.closest('[data-dec]');
  const brf = e.target.closest('[data-brf]');
  if (dec) {
    const id = dec.dataset.dec;
    const draft = drafts.get(id) || {};
    const opt = e.target.closest('[data-opt]');
    if (opt) drafts.set(id, { ...draft, selected: opt.dataset.opt, other: false });
    else if (e.target.closest('[data-confirm]')) return decide(id, { optionId: draft.selected });
    else if (e.target.closest('[data-cancel]')) drafts.set(id, { ...draft, selected: null });
    else if (e.target.closest('[data-other]')) drafts.set(id, { ...draft, other: true, selected: null });
    else if (e.target.closest('[data-cancel-other]')) drafts.set(id, { ...draft, other: false });
    else if (e.target.closest('[data-send]')) {
      const text = $('textarea', dec).value.trim();
      if (text) return decide(id, { text });
      return $('textarea', dec).focus();
    } else if (e.target.closest('[data-halt]')) {
      if (draft.haltArmed) return decide(id, { halt: true });
      drafts.set(id, { ...draft, haltArmed: true });
    } else return;
    render();
    if (drafts.get(id)?.other) $(`[data-dec="${id}"] textarea`)?.focus();
    return;
  }
  if (brf) {
    if (e.target.closest('[data-read]')) {
      await call('window:open', `#/briefing/${brf.dataset.brf}`);
    } else if (e.target.closest('[data-mark]')) {
      await call('briefing:read', brf.dataset.brf);
    }
  }
});

$('#dp-close').onclick = () => call('dispatch:close');
$('#dp-open').onclick = () => call('window:open', '#/briefings');
$('#dp-read-all').onclick = async () => {
  for (const b of state.briefings.filter((x) => !x.read)) await call('briefing:read', b.id);
};
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.activeElement?.tagName !== 'TEXTAREA') call('dispatch:close');
});

window.lh.onState((s) => {
  state = s;
  render();
});
state = await call('state:get');
render();
// Deadlines are relative times; keep them honest while the panel is open.
setInterval(() => !document.hidden && document.activeElement?.tagName !== 'TEXTAREA' && render(), 60000);
