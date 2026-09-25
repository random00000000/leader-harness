// One Senior Official: status, big pushes, recent sessions, and their orders.
import { $, $$, esc, emblem, relTime, duration, compact, toast } from '../util.js';
import { officialForm } from './spawn.js';
import { officialStatus, launchPush } from './cabinet.js';

export function mount(root, app, [officialId]) {
  const o = () => app.officialById(officialId);
  if (!o()) {
    root.innerHTML = '<div class="page"><div class="empty">This official has left the cabinet.</div></div>';
    return {};
  }

  root.innerHTML = `
    <div class="page">
      <div class="page-head" data-head></div>
      <div class="detail">
        <div data-form></div>
        <div style="display:grid;gap:16px" data-side></div>
      </div>
    </div>`;

  function renderHead() {
    const off = o();
    if (!off) return;
    $('[data-head]', root).innerHTML = `
      ${emblem(off.name, 58)}
      <div><div class="eyebrow">Senior Official</div><h1>${esc(off.name)}</h1><p>${esc(off.title)} · ${officialStatus(app, off)}</p></div>
      <div class="actions">
        <button class="btn" data-brief>Brief me now</button>
        <button class="btn" data-work>Work now</button>
        <button class="btn" data-push>Big push</button>
        ${off.status === 'halted' ? '<button class="btn primary" data-resume>Resume work</button>' : '<button class="btn danger" data-halt>Halt</button>'}
      </div>`;
    $('[data-brief]', root).onclick = () => app.call('official:run', off.id, 'briefing').then(() => toast('Briefing ordered.'));
    $('[data-work]', root).onclick = () => app.call('official:run', off.id, 'work').then(() => toast('Work session ordered.'));
    $('[data-push]', root).onclick = () => launchPush(app, off);
    $('[data-halt]', root)?.addEventListener('click', () => app.call('official:setStatus', off.id, 'halted').then(() => toast(`${off.name} halted.`)));
    $('[data-resume]', root)?.addEventListener('click', () => app.call('official:setStatus', off.id, 'active').then(() => toast(`${off.name} is back on duty.`)));
  }

  function renderSide() {
    const off = o();
    if (!off) return;
    const s = app.state;
    const ops = s.operations.filter((op) => op.officialId === off.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
    const jobs = s.jobs.filter((j) => j.officialId === off.id).sort((a, b) => (b.startedAt || b.createdAt).localeCompare(a.startedAt || a.createdAt)).slice(0, 12);
    $('[data-side]', root).innerHTML = `
      <div class="card section">
        <h2>Memory</h2>
        <div class="mono faint" style="font-size:12px;word-break:break-all">${esc(off.wikiDir)}</div>
        <div class="row"><button class="btn sm" data-wiki>Open wiki</button>${off.projectPath ? '<button class="btn sm" data-project>Open project</button>' : ''}</div>
        <div class="muted" style="font-size:12.5px">Next briefing ${off.nextBriefingAt ? esc(relTime(off.nextBriefingAt)) : 'on order only'} · next work ${off.nextWorkAt ? esc(relTime(off.nextWorkAt)) : 'on order only'}</div>
      </div>
      <div class="card section">
        <h2>Big pushes</h2>
        <div class="ops">${ops
          .map(
            (op) => `<div class="op"><div class="row"><b style="flex:1">${esc(op.objective)}</b><span class="pill ${op.status === 'active' ? 'gold' : op.status === 'complete' ? 'ok' : 'bad'}">${esc(op.status)}</span></div>
              <div class="meter"><span style="width:${(op.completed / op.runs) * 100}%"></span></div>
              <div class="row muted" style="font-size:12px"><span>${op.completed} of ${op.runs} runs</span>${op.status === 'active' ? `<button class="btn ghost sm" style="margin-left:auto" data-cancel-op="${op.id}">Cancel</button>` : ''}</div></div>`
          )
          .join('') || '<div class="muted" style="font-size:13px">No big pushes yet. Use one when you want a lot of usage spent on one objective.</div>'}</div>
      </div>
      <div class="card section">
        <h2>Recent sessions</h2>
        ${jobs.length ? jobs
          .map(
            (j) => `<div style="border-top:1px solid var(--line);padding-top:10px;display:grid;gap:4px">
              <div class="row"><b style="flex:1;font-size:13px">${esc(j.title)}</b><span class="pill ${j.status === 'done' ? 'ok' : j.status === 'failed' ? 'bad' : j.status === 'running' ? 'gold' : ''}">${esc(j.status)}</span></div>
              <div class="num faint">${esc(relTime(j.finishedAt || j.startedAt || j.createdAt))} · ${duration(j.durationMs)} · ${compact(j.tokens)} tokens</div>
              ${j.summary ? `<div class="muted" style="font-size:12.5px;white-space:pre-wrap">${esc(j.summary.slice(0, 400))}</div>` : ''}
              ${j.error ? `<div style="color:var(--danger);font-size:12.5px">${esc(j.error.slice(0, 300))}</div>` : ''}
            </div>`
          )
          .join('') : '<div class="muted" style="font-size:13px">Nothing has run yet.</div>'}
      </div>
      <div class="card section">
        <h2>Dismiss</h2>
        <div class="muted" style="font-size:13px">Removes the official from the cabinet. Their wiki stays on disk.</div>
        <div><button class="btn danger sm" data-dismiss>Dismiss ${esc(off.name)}</button></div>
      </div>`;
    $('[data-wiki]', root).onclick = () => app.call('open:path', off.wikiDir);
    $('[data-project]', root)?.addEventListener('click', () => app.call('open:path', off.projectPath));
    $$('[data-cancel-op]', root).forEach((b) => (b.onclick = () => app.call('operation:cancel', b.dataset.cancelOp)));
    $('[data-dismiss]', root).onclick = async () => {
      const ok = await app.dialog({ title: `Dismiss ${off.name}?`, text: 'Scheduled work stops and pending decisions are withdrawn. The wiki is kept.', confirm: 'Dismiss', danger: true });
      if (ok) {
        await app.call('official:dismiss', off.id);
        toast(`${off.name} dismissed.`);
        app.go('#/cabinet');
      }
    };
  }

  officialForm($('[data-form]', root), app, o(), {
    mode: 'edit',
    onSubmit: async (patch) => {
      await app.call('official:update', officialId, patch);
      toast('Orders updated.');
    },
  });
  renderHead();
  renderSide();

  return {
    update() {
      if (!o()) return app.go('#/cabinet');
      renderHead();
      renderSide();
    },
    tick: renderSide,
  };
}
