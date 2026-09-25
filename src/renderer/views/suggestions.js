// Three suggested Officials, drawn from the Leader's recent Claude Code and
// Codex threads, shown on the Officials screen. Prepared automatically when
// missing or a week old (unless all work is paused, which means no
// background usage).
import { $, $$, esc, monogram, relTime, cadenceLabel } from '../util.js';

const projectName = (p) => (p ? p.split(/[\\/]/).filter(Boolean).pop() : 'No project folder');

// onUse(suggestion) is called when the Leader picks one.
export function renderSuggestions(el, app, onUse) {
  const sg = app.state.suggestions || {};
  const auth = app.state.authority;
  // Suggestions for projects that already have an Official are hidden.
  const taken = new Set(app.state.officials.map((o) => (o.projectPath || '').toLowerCase()).filter(Boolean));
  const items = (sg.items || []).map((s, i) => ({ s, i })).filter(({ s }) => !s.projectPath || !taken.has(s.projectPath.toLowerCase()));
  let body;
  if (sg.status === 'running') {
    body = `<div class="sg-note"><span class="dot ok"></span> Reading your recent Claude Code and Codex threads and preparing three suggestions. This takes about a minute.</div>`;
  } else if (sg.status === 'ready' && items.length) {
    body = `<div class="sg-cards">${items
      .map(
        ({ s, i }) => `<div class="card sg-card">
          <div class="official-head">${monogram(s.name, 36)}<div><b>${esc(s.name)}</b><div class="muted" style="font-size:12.5px">${esc(s.title)}</div></div></div>
          <div class="sg-project mono">${esc(projectName(s.projectPath))}</div>
          <p class="sg-why">${esc(s.why)}</p>
          <div class="sg-pills"><span class="pill">${esc(auth[s.authority]?.label || s.authority)}</span><span class="pill">Briefs ${esc(cadenceLabel(s.briefingCadence).toLowerCase())}</span><span class="pill">Works ${esc(cadenceLabel(s.workCadence).toLowerCase())}</span></div>
          <button class="btn primary sm" data-use="${i}">Review and appoint</button>
        </div>`
      )
      .join('')}</div>`;
  } else if (sg.status === 'ready') {
    body = `<div class="sg-note">Every suggested project already has an Official. Refresh for new suggestions.</div>`;
  } else if (sg.status === 'failed') {
    body = `<div class="sg-note bad">Suggestions could not be prepared: ${esc(sg.error || 'unknown error')}</div>`;
  } else {
    body = `<div class="sg-note">Leader Harness can read your recent Claude Code and Codex threads on this computer and suggest three Officials for the work you do most.</div>`;
  }
  const basis = sg.status === 'ready' && sg.basis ? `Based on ${sg.basis.claude + sg.basis.codex} sessions across ${sg.basis.projects} projects · ${esc(relTime(sg.generatedAt))}` : '';
  el.innerHTML = `
    <div class="sg-head"><div><div class="eyebrow">Suggested for you</div><div class="faint" style="font-size:12px;margin-top:2px">${basis}</div></div>
      <button class="btn ghost sm" data-refresh ${sg.status === 'running' ? 'disabled' : ''}>${sg.status === 'ready' ? 'Refresh suggestions' : 'Suggest Officials from my threads'}</button></div>
    ${body}
    <div class="faint sg-privacy">Threads are read locally. A short digest (project folders and a few of your requests) is sent to Claude in one session to write the suggestions.</div>`;
  $('[data-refresh]', el).onclick = () => app.call('suggest:run');
  $$('[data-use]', el).forEach((b) => (b.onclick = () => onUse(sg.items[Number(b.dataset.use)])));
}

export function wantsFreshSuggestions(app) {
  const sg = app.state.suggestions;
  if (app.state.settings.paused) return false;
  if (!sg || sg.status === 'failed') return !sg;
  if (sg.status === 'running') return false;
  return !sg.generatedAt || Date.now() - new Date(sg.generatedAt).getTime() > 7 * 86400000;
}
