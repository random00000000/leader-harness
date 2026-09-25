// Setup console: appoint (spawn) a Senior Official. The same form edits an
// existing official from its detail page.
import { $, $$, esc, emblem, cadenceLabel, toast } from '../util.js';

const PRESETS = [
  {
    label: 'Game minister',
    title: 'Minister for the Game',
    remit: 'Own the development of this game. Track progress against the roadmap, keep the build healthy, push the next most valuable feature forward, and tell me what changed and what needs my call.',
    authority: 'build',
    workCadence: { mode: 'interval', minutes: 240 },
  },
  {
    label: 'Chief of Staff',
    title: 'Chief of Staff',
    remit: 'Keep watch over my projects and their wikis. Tell me what moved, what stalled, and what deserves my attention today. Keep my priorities list current.',
    authority: 'observe',
    workCadence: { mode: 'manual' },
  },
  {
    label: 'Director of Research',
    title: 'Director of Research',
    remit: 'Research the questions I care about, keep findings in the wiki with sources, and brief me on what is new and what it means for my projects.',
    authority: 'observe',
    workCadence: { mode: 'interval', minutes: 720 },
  },
  {
    label: 'Quartermaster',
    title: 'Quartermaster of Code',
    remit: 'Keep the codebase in fighting shape: failing tests, outdated dependencies, warnings, dead code. Fix what is safe to fix and report the rest.',
    authority: 'build',
    workCadence: { mode: 'interval', minutes: 1440 },
  },
];

const INTERVALS = [
  [30, 'Every 30 minutes'],
  [60, 'Every hour'],
  [120, 'Every 2 hours'],
  [240, 'Every 4 hours'],
  [480, 'Every 8 hours'],
  [720, 'Every 12 hours'],
  [1440, 'Every day'],
];

function cadenceControl(name, c) {
  const mode = c?.mode || 'manual';
  return `<div class="cadence" data-cadence="${name}">
    <select data-mode>
      <option value="daily" ${mode === 'daily' ? 'selected' : ''}>Daily at…</option>
      <option value="interval" ${mode === 'interval' ? 'selected' : ''}>Repeating…</option>
      <option value="manual" ${mode === 'manual' ? 'selected' : ''}>Only when I order it</option>
    </select>
    <input type="time" data-time value="${esc(c?.time || '08:00')}" ${mode === 'daily' ? '' : 'hidden'}>
    <select data-minutes ${mode === 'interval' ? '' : 'hidden'}>${INTERVALS.map(([m, l]) => `<option value="${m}" ${Number(c?.minutes) === m ? 'selected' : ''}>${l}</option>`).join('')}</select>
  </div>`;
}

function readCadence(el) {
  const mode = $('[data-mode]', el).value;
  if (mode === 'daily') return { mode, time: $('[data-time]', el).value || '08:00' };
  if (mode === 'interval') return { mode, minutes: Number($('[data-minutes]', el).value) };
  return { mode: 'manual' };
}

// Renders the official form into `root`. values: an official or defaults.
export function officialForm(root, app, values, { mode, onSubmit }) {
  const v = {
    name: '',
    title: '',
    remit: '',
    projectPath: '',
    authority: 'observe',
    model: '',
    style: '',
    briefingCadence: { mode: 'daily', time: '08:00' },
    workCadence: { mode: 'manual' },
    decisionWindowMin: 240,
    installMandate: false,
    ...values,
  };
  const auth = app.state.authority;
  const creating = mode === 'create';

  root.innerHTML = `
    <div class="spawn">
      <form class="card console" autocomplete="off">
        <div class="console-head"><i></i><i></i><i></i><span style="margin-left:8px">${creating ? 'leader-harness › appoint-official' : `leader-harness › ${esc(v.name)} › orders`}</span></div>
        <div class="console-body">
          ${creating ? `<div class="step"><div class="step-title"><b>$</b>start from a template</div>
            <div class="presets">${PRESETS.map((p, i) => `<button type="button" class="btn sm" data-preset="${i}">${esc(p.label)}</button>`).join('')}</div></div>` : ''}
          <div class="step"><div class="step-title"><b>01</b>who are they</div>
            <div class="grid-2">
              <label class="field"><span>Name</span><input type="text" name="name" value="${esc(v.name)}" placeholder="e.g. Marshal Ardent" required></label>
              <label class="field"><span>Title</span><input type="text" name="title" value="${esc(v.title)}" placeholder="e.g. Minister for Victory Marche" required></label>
            </div>
            <label class="field"><span>Remit: what they own and what you expect</span><textarea name="remit" required placeholder="Own the development of…">${esc(v.remit)}</textarea></label>
          </div>
          ${creating ? `<div class="step"><div class="step-title"><b>02</b>what they manage</div>
            <div class="field"><span>Project folder (optional)</span>
              <div class="folder-pick"><input type="text" name="projectPath" value="${esc(v.projectPath)}" placeholder="No folder: the official works from their own wiki"><button type="button" class="btn" data-pick>Browse…</button></div>
              <small>The official works inside this folder. Its wiki is created here as "&lt;Project&gt; - Wiki" unless one already exists.</small></div>
            <label class="check"><input type="checkbox" name="installMandate" ${v.installMandate ? 'checked' : ''}><span>Also add the wiki rules to the project's AGENTS.md<br><small class="faint">Then your own Claude Code and Codex sessions keep the wiki up to date too.</small></span></label>
          </div>` : ''}
          <div class="step"><div class="step-title"><b>${creating ? '03' : '02'}</b>rhythm</div>
            <div class="grid-2">
              <div class="field"><span>Briefings</span>${cadenceControl('briefingCadence', v.briefingCadence)}</div>
              <div class="field"><span>Background work</span>${cadenceControl('workCadence', v.workCadence)}</div>
            </div>
            <label class="field"><span>If I don't answer a decision, take the recommended option after</span>
              <select name="decisionWindowMin">${[
                [30, '30 minutes'],
                [60, '1 hour'],
                [240, '4 hours'],
                [720, '12 hours'],
                [1440, '24 hours'],
                [4320, '3 days'],
              ]
                .map(([m, l]) => `<option value="${m}" ${Number(v.decisionWindowMin) === m ? 'selected' : ''}>${l}</option>`)
                .join('')}</select></label>
          </div>
          <div class="step"><div class="step-title"><b>${creating ? '04' : '03'}</b>authority</div>
            <div class="auth-opts">${Object.entries(auth)
              .map(([k, a]) => `<label class="auth-opt ${v.authority === k ? 'on' : ''}"><input type="radio" name="authority" value="${k}" ${v.authority === k ? 'checked' : ''}><div><b>${esc(a.label)}</b><small>${esc(a.summary)}</small></div></label>`)
              .join('')}</div>
          </div>
          <div class="step"><div class="step-title"><b>${creating ? '05' : '04'}</b>preferences</div>
            <div class="grid-2">
              <label class="field"><span>Model</span><select name="model">
                ${[
                  ['', 'Claude Code default'],
                  ['opus', 'Opus (deepest)'],
                  ['sonnet', 'Sonnet (balanced)'],
                  ['haiku', 'Haiku (lightest on usage)'],
                ]
                  .map(([val, l]) => `<option value="${val}" ${v.model === val ? 'selected' : ''}>${l}</option>`)
                  .join('')}</select></label>
              <label class="field"><span>Briefing style</span><select name="style">
                <option value="">Use my default</option>
                ${app.styles.map((s) => `<option value="${esc(s.id)}" ${v.style === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
            </div>
          </div>
          <div class="row" style="justify-content:flex-end;gap:8px">
            <button type="button" class="btn ghost" data-cancel>Cancel</button>
            <button class="btn primary">${creating ? 'Appoint and request first briefing' : 'Save orders'}</button>
          </div>
        </div>
      </form>
      <aside class="card preview-card"></aside>
    </div>`;

  const form = $('form', root);

  function collect() {
    const fd = new FormData(form);
    return {
      name: fd.get('name') || '',
      title: fd.get('title') || '',
      remit: fd.get('remit') || '',
      projectPath: fd.get('projectPath') || '',
      installMandate: fd.get('installMandate') === 'on',
      authority: fd.get('authority') || 'observe',
      model: fd.get('model') || '',
      style: fd.get('style') || '',
      decisionWindowMin: Number(fd.get('decisionWindowMin')),
      briefingCadence: readCadence($('[data-cadence="briefingCadence"]', form)),
      workCadence: readCadence($('[data-cadence="workCadence"]', form)),
    };
  }

  function preview() {
    const c = collect();
    const a = auth[c.authority];
    const project = creating ? c.projectPath : v.projectPath;
    const folderName = project ? project.split(/[\\/]/).filter(Boolean).pop() : '';
    $('.preview-card', root).innerHTML = `
      <div class="eyebrow">${creating ? 'Appointment' : 'Current orders'}</div>
      <div class="official-head">${emblem(c.name || '?', 52)}<div><h3 style="margin:0;font-size:18px">${esc(c.name || 'Unnamed official')}</h3><p class="muted" style="margin:2px 0 0">${esc(c.title || 'No title yet')}</p></div></div>
      <div class="explain">
        <div>Briefs you: <b>${esc(cadenceLabel(c.briefingCadence).toLowerCase())}</b></div>
        <div>Works in the background: <b>${esc(cadenceLabel(c.workCadence).toLowerCase())}</b></div>
        <div>Authority: <b>${esc(a?.label)}</b>. ${esc(a?.summary)}</div>
        <div>Memory: <b>${project ? `${esc(folderName)} wiki` : 'its own wiki'}</b>, in the same pattern as this project's wiki.</div>
        <div>Unanswered decisions: the recommended option is taken after <b>${esc($('[name=decisionWindowMin] option:checked', form).textContent)}</b>.</div>
      </div>`;
  }

  form.addEventListener('input', preview);
  form.addEventListener('change', (e) => {
    const cad = e.target.closest('[data-cadence]');
    if (cad && e.target.matches('[data-mode]')) {
      $('[data-time]', cad).hidden = e.target.value !== 'daily';
      $('[data-minutes]', cad).hidden = e.target.value !== 'interval';
    }
    if (e.target.name === 'authority') $$('.auth-opt', form).forEach((l) => l.classList.toggle('on', $('input', l).checked));
    preview();
  });
  $$('[data-preset]', form).forEach(
    (btn) =>
      (btn.onclick = () => {
        const p = PRESETS[Number(btn.dataset.preset)];
        form.elements.title.value = p.title;
        form.elements.remit.value = p.remit;
        form.querySelector(`[name=authority][value=${p.authority}]`).checked = true;
        const wc = $('[data-cadence="workCadence"]', form);
        $('[data-mode]', wc).value = p.workCadence.mode;
        if (p.workCadence.minutes) $('[data-minutes]', wc).value = p.workCadence.minutes;
        $('[data-mode]', wc).dispatchEvent(new Event('change', { bubbles: true }));
        $$('.auth-opt', form).forEach((l) => l.classList.toggle('on', $('input', l).checked));
        if (!form.elements.name.value) form.elements.name.focus();
        preview();
      })
  );
  $('[data-pick]', form)?.addEventListener('click', async () => {
    const folder = await app.call('dialog:folder');
    if (folder) {
      form.elements.projectPath.value = folder;
      preview();
    }
  });
  $('[data-cancel]', form).onclick = () => history.back();
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('button.primary', form);
    btn.disabled = true;
    try {
      await onSubmit(collect());
    } catch {
      btn.disabled = false;
    }
  };
  preview();
}

export function mount(root, app) {
  root.innerHTML = `<div class="page"><div class="page-head"><div><div class="eyebrow">Setup</div><h1>Appoint a Senior Official</h1>
    <p>They own an area, work in the background with Claude Code, and brief you on the schedule you set.</p></div></div><div data-form></div></div>`;
  officialForm($('[data-form]', root), app, {}, {
    mode: 'create',
    onSubmit: async (input) => {
      const o = await app.call('official:spawn', input);
      toast(`${o.name} appointed. First briefing is being prepared.`);
      app.go(`#/official/${o.id}`);
    },
  });
  return {};
}
