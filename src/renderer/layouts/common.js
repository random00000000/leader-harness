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
  if (d.status === 'pending') return { open: true, label: 'Awaiting your decision' };
  const opt = d.options.find((o) => o.id === d.choice?.optionId);
  const text = d.choice?.text || opt?.label || '';
  const how = { decided: 'Decided', auto: 'Auto-decided (recommended)', halted: 'Halted', withdrawn: 'Withdrawn' }[d.status] || d.status;
  return { open: false, label: text ? `${how}: ${text}` : how };
}

export function decideButton(d, label = 'Decide') {
  const st = decisionState(d);
  return st.open
    ? `<button class="decide" data-decide="${esc(d.id)}">${esc(label)}</button>`
    : `<span class="decided">${esc(st.label)}</span>`;
}

// Minimal script every layout gets: decision buttons talk to the app.
export const BRIDGE_SCRIPT = `
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-decide]');
  if (b) { e.preventDefault(); parent.postMessage({ lh: 'decide', id: b.dataset.decide }, '*'); }
});
`;
