// Style Studio: change how briefings look, live. A style is a layout (deck,
// dossier, red box, tablet) plus CSS variables plus extra CSS. Built-in
// styles are forked; custom styles are saved to the user's styles folder.
import { $, $$, esc, toast } from '../util.js';
import { mountStage, LAYOUTS } from '../stage.js';
import { briefingContext } from './briefings.js';

const SAMPLE = {
  id: 'brf_sample00',
  createdAt: new Date().toISOString(),
  title: 'Billing migration ready for cutover',
  classification: 'PRIORITY',
  bluf: 'The new billing system has passed parallel runs for five days. One decision is needed: the cutover window.',
  situation: [
    'Parallel runs matched the legacy system on 41,000 invoices; two rounding differences were traced and fixed.',
    'Rollback has been rehearsed twice and takes under ten minutes.',
    'Cutover needs a window with low invoice volume. Two options are viable.',
  ],
  actions: [
    { text: 'Parallel-run reconciliation complete.', status: 'done' },
    { text: 'Rollback procedure rehearsed.', status: 'done' },
    { text: 'Cutover scheduling.', status: 'blocked' },
  ],
  risks: [{ text: 'Month-end volume makes a cutover after the 28th riskier.', level: 'medium' }],
  next: ['Confirm the cutover window with finance.', 'Run the final reconciliation.'],
  decisions: [],
};
const SAMPLE_DECISION = {
  id: 'dec_sample00',
  title: 'Billing cutover window',
  body: 'The new billing system is ready. Cutting over this weekend avoids month-end volume; waiting a week allows one more full parallel run.',
  status: 'pending',
  options: [
    { id: 'opt0', label: 'Cut over this weekend', detail: 'Saturday 06:00, with rollback on standby.', recommended: true },
    { id: 'opt1', label: 'Wait one more week', detail: 'Run a further parallel cycle first.', recommended: false },
  ],
};

const isColor = (v) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(v).trim());

export function mount(root, app) {
  let draft = null;
  let timer = null;

  const previewBriefing = () => {
    const real = [...app.state.briefings].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).find((b) => b.officialId);
    if (real) return { b: real, ctx: briefingContext(app, real) };
    return { b: SAMPLE, ctx: { from: { name: 'Sarah Chen', title: 'Head of Engineering' }, decisions: [SAMPLE_DECISION] } };
  };

  function select(styleId) {
    const base = app.styles.find((s) => s.id === styleId) || app.styles[0];
    draft = structuredClone(base);
    render();
  }

  function renderList() {
    $('.style-list', root).innerHTML = `
      <div class="eyebrow" style="padding:4px 12px 8px">Styles</div>
      ${app.styles
        .map(
          (s) => `<div class="style-item ${draft?.id === s.id ? 'on' : ''}" data-id="${esc(s.id)}"><b>${esc(s.name)}${s.id === app.state.settings.defaultStyle ? ' <span class="pill gold" style="font-size:10px;padding:1px 6px">default</span>' : ''}</b>
            <small>${s.builtin ? 'Built-in' : 'Custom'} · ${esc(LAYOUTS[s.layout]?.name || s.layout)}</small></div>`
        )
        .join('')}`;
    $$('.style-item', root).forEach((el) => (el.onclick = () => select(el.dataset.id)));
  }

  function renderEditor() {
    const d = draft;
    $('.editor', root).innerHTML = `
      <div><div class="eyebrow">Style Studio</div><h2 style="margin:4px 0 0;font-family:var(--display)">${esc(d.name)}</h2>
        <p class="muted" style="margin:4px 0 0;font-size:12.5px">${d.builtin ? 'Built-in styles are read-only. Your changes are saved as a new style.' : 'Custom style. Changes preview live; save to keep them.'}</p></div>
      <label class="field"><span>Name</span><input type="text" data-k="name" value="${esc(d.builtin ? `${d.name} (mine)` : d.name)}"></label>
      <label class="field"><span>Layout</span><select data-k="layout">${Object.entries(LAYOUTS).map(([k, l]) => `<option value="${k}" ${d.layout === k ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select>
        <small>The layout decides the structure. Variables and CSS decide the look.</small></label>
      <div class="field"><span>Variables</span><div class="vars">${Object.entries(d.vars || {})
        .map(([k, v]) =>
          isColor(v)
            ? `<div class="var"><label title="${esc(k)}">${esc(k)}</label><input type="color" data-var="${esc(k)}" value="${esc(v.length === 4 ? '#' + [...v.slice(1)].map((c) => c + c).join('') : v)}"><input type="text" data-var-text="${esc(k)}" value="${esc(v)}"></div>`
            : `<div class="var wide"><label title="${esc(k)}">${esc(k)}</label><input type="text" data-var-text="${esc(k)}" value="${esc(v)}"></div>`
        )
        .join('')}</div></div>
      <label class="field"><span>Extra CSS</span><textarea class="css" data-k="css" spellcheck="false" placeholder="/* Anything here overrides the layout. Try: h1 { letter-spacing: .1em; } */">${esc(d.css || '')}</textarea>
        <small>${d.replaceLayoutCss ? 'This style replaces the layout CSS entirely.' : '<a href="#" data-full>Load the full layout CSS for complete control</a>'}</small></label>
      <div class="row" style="flex-wrap:wrap;gap:8px">
        <button class="btn primary" data-save>${d.builtin ? 'Save as new style' : 'Save'}</button>
        ${d.builtin ? '' : '<button class="btn" data-save-new>Save as copy</button>'}
        <button class="btn" data-default ${d.id === app.state.settings.defaultStyle ? 'disabled' : ''}>Make default</button>
        ${d.builtin ? '' : '<button class="btn danger" data-delete>Delete</button>'}
      </div>`;

    const ed = $('.editor', root);
    $('[data-full]', ed)?.addEventListener('click', (e) => {
      e.preventDefault();
      draft.css = `${LAYOUTS[draft.layout].module.css.trim()}\n\n${draft.css || ''}`;
      draft.replaceLayoutCss = true;
      renderEditor();
      schedulePreview();
    });
    const save = async (asNew) => {
      const name = $('[data-k="name"]', ed).value.trim() || 'My style';
      const saved = await app.call('styles:save', { ...draft, name, id: draft.builtin || asNew ? null : draft.id, base: draft.base || draft.id });
      await app.reloadStyles();
      toast(`Saved "${saved.name}".`);
      select(saved.id);
    };
    $('[data-save]', ed).onclick = () => save(false);
    $('[data-save-new]', ed)?.addEventListener('click', () => save(true));
    $('[data-default]', ed).onclick = async () => {
      await app.call('settings:update', { defaultStyle: draft.id });
      toast(`"${draft.name}" is now your default briefing style.`);
      renderList();
      renderEditor();
    };
    $('[data-delete]', ed)?.addEventListener('click', async () => {
      const ok = await app.dialog({ title: `Delete "${draft.name}"?`, confirm: 'Delete', danger: true });
      if (!ok) return;
      await app.call('styles:delete', draft.id);
      if (app.state.settings.defaultStyle === draft.id) await app.call('settings:update', { defaultStyle: 'dossier' });
      await app.reloadStyles();
      select(app.styles[0].id);
    });
  }

  function schedulePreview() {
    clearTimeout(timer);
    timer = setTimeout(renderPreview, 180);
  }

  function renderPreview() {
    const { b, ctx } = previewBriefing();
    mountStage($('.studio-stage', root), b, draft, ctx);
  }

  function render() {
    renderList();
    renderEditor();
    renderPreview();
  }

  root.innerHTML = `<div class="studio"><div class="style-list"></div><div class="editor"></div><div class="studio-stage"></div></div>`;
  // Delegated once: the editor's contents are re-rendered, the element is not.
  const editor = $('.editor', root);
  editor.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.k) draft[t.dataset.k] = t.value;
    if (t.dataset.var) {
      draft.vars[t.dataset.var] = t.value;
      $(`[data-var-text="${CSS.escape(t.dataset.var)}"]`, editor).value = t.value;
    }
    if (t.dataset.varText) {
      draft.vars[t.dataset.varText] = t.value;
      const picker = $(`[data-var="${CSS.escape(t.dataset.varText)}"]`, editor);
      if (picker && isColor(t.value) && t.value.length === 7) picker.value = t.value;
    }
    schedulePreview();
  });
  editor.addEventListener('change', (e) => e.target.dataset.k === 'layout' && schedulePreview());
  select(app.state.settings.defaultStyle);
  return { destroy: () => clearTimeout(timer) };
}
