// Cabinet: every Senior Official at a glance, with quick orders.
import { $$, esc, emblem, relTime, cadenceLabel, toast } from '../util.js';

export function officialStatus(app, o) {
  const running = app.state.jobs.find((j) => j.officialId === o.id && j.status === 'running');
  if (o.status === 'halted') return '<span class="pill bad">Halted</span>';
  if (running) return `<span class="pill ok"><span class="dot ok pulse"></span>${esc(running.title)}</span>`;
  const queued = app.state.jobs.filter((j) => j.officialId === o.id && j.status === 'queued').length;
  if (queued) return `<span class="pill warn">${queued} queued</span>`;
  return '<span class="pill">On duty</span>';
}

export async function launchPush(app, o) {
  const v = await app.dialog({
    title: `Big push: ${o.name}`,
    text: 'Commit a concentrated block of usage to one objective. Each run is a full Claude Code session that continues from the last one, using the wiki.',
    fields: [
      { name: 'objective', label: 'Objective', type: 'textarea', placeholder: 'e.g. Get the campaign map playable end to end.' },
      { name: 'runs', label: 'Runs', type: 'number', value: 5, min: 1, max: 50, hint: 'Sessions run back to back. Each can take up to the job timeout set in Settings.' },
    ],
    confirm: 'Launch the push',
  });
  if (!v?.objective?.trim()) return;
  await app.call('operation:launch', { officialId: o.id, objective: v.objective, runs: Number(v.runs) });
  toast(`Big push launched: ${v.runs} runs for ${o.name}.`);
}

export function mount(root, app) {
  function render() {
    const s = app.state;
    root.innerHTML = `
      <div class="page">
        <div class="page-head"><div><div class="eyebrow">Your government</div><h1>Cabinet</h1>
          <p>Senior Officials own an area, run Claude Code in the background, and brief you.</p></div>
          <div class="actions"><button class="btn primary" data-go="#/spawn">+ Appoint official</button></div></div>
        <div class="cabinet">
          ${s.officials
            .map((o) => {
              const pending = s.decisions.filter((d) => d.officialId === o.id && d.status === 'pending').length;
              const push = s.operations.find((op) => op.officialId === o.id && op.status === 'active');
              return `<div class="card official ${o.status}">
                <div class="official-head">${emblem(o.name, 46)}<div style="min-width:0"><h3>${esc(o.name)}</h3><p>${esc(o.title)}</p></div></div>
                <div>${officialStatus(app, o)} ${pending ? `<span class="pill gold">${pending} decision${pending > 1 ? 's' : ''}</span>` : ''} ${push ? `<span class="pill gold">Big push ${push.completed}/${push.runs}</span>` : ''}</div>
                <p class="remit">${esc(o.remit)}</p>
                <div class="facts">
                  <div><span>Briefs</span>${esc(cadenceLabel(o.briefingCadence))}</div>
                  <div><span>Works</span>${esc(cadenceLabel(o.workCadence))}</div>
                  <div><span>Next briefing</span>${o.nextBriefingAt ? esc(relTime(o.nextBriefingAt)) : '–'}</div>
                  <div><span>Authority</span>${esc(s.authority[o.authority]?.label || o.authority)}</div>
                </div>
                <div class="btns">
                  <button class="btn sm" data-brief="${o.id}">Brief me now</button>
                  <button class="btn sm" data-work="${o.id}">Work now</button>
                  <button class="btn sm" data-push="${o.id}">Big push</button>
                  <button class="btn ghost sm" data-go="#/official/${o.id}" style="margin-left:auto">Manage →</button>
                </div>
              </div>`;
            })
            .join('')}
          <button class="appoint" data-go="#/spawn"><div><div class="plus">+</div><div style="margin-top:10px;font-weight:600">Appoint a Senior Official</div>
            <div class="muted" style="font-size:12.5px;margin-top:4px">Give them a remit, a project, and a schedule.</div></div></button>
        </div>
      </div>`;
    $$('[data-go]', root).forEach((el) => (el.onclick = () => app.go(el.dataset.go)));
    $$('[data-brief]', root).forEach((el) => (el.onclick = () => app.call('official:run', el.dataset.brief, 'briefing').then(() => toast('Briefing ordered.'))));
    $$('[data-work]', root).forEach((el) => (el.onclick = () => app.call('official:run', el.dataset.work, 'work').then(() => toast('Work session ordered.'))));
    $$('[data-push]', root).forEach((el) => (el.onclick = () => launchPush(app, app.officialById(el.dataset.push))));
  }
  render();
  return { update: render, tick: render };
}
