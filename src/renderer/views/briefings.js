// Briefing Room: the inbox of briefings on the left, the selected briefing
// rendered in the chosen style on the right.
import { $, $$, esc, monogram, shortTime } from '../util.js';
import { mountStage } from '../stage.js';

export function briefingContext(app, b) {
  const o = app.officialById(b.officialId);
  return {
    from: o ? { name: o.name, title: o.title } : b.from || { name: 'Former Official', title: 'Removed' },
    decisions: (b.decisions || []).map((dId) => app.state.decisions.find((d) => d.id === dId)).filter(Boolean),
  };
}

export function mount(root, app, [briefingId]) {
  let stageKey = '';

  const list = () => [...app.state.briefings].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const filtered = () => list().filter((b) => !app.ui.inboxFilter || b.officialId === app.ui.inboxFilter);
  const selected = () => app.state.briefings.find((b) => b.id === briefingId) || filtered()[0] || null;
  const styleFor = (b) => app.styleById(app.ui.styleOverride || app.officialById(b.officialId)?.style || app.state.settings.defaultStyle);

  function renderInbox() {
    const sel = selected();
    const officials = app.state.officials;
    $('.inbox', root).innerHTML = `
      <div class="inbox-head">
        <h2>Briefing Room</h2>
        ${officials.length > 1 ? `<div class="seg" style="margin-bottom:4px">
          <button data-filter="" class="${!app.ui.inboxFilter ? 'on' : ''}">All</button>
          ${officials.map((o) => `<button data-filter="${o.id}" class="${app.ui.inboxFilter === o.id ? 'on' : ''}">${esc(o.name)}</button>`).join('')}
        </div>` : ''}
      </div>
      ${filtered()
        .map((b) => {
          const ctx = briefingContext(app, b);
          return `<div class="inbox-item ${b.read ? '' : 'unread'} ${sel?.id === b.id ? 'on' : ''}" data-id="${b.id}">
            ${monogram(ctx.from.name, 30)}
            <div class="top"><span class="cls ${esc(b.classification)}">${esc(b.classification)}</span><span>${esc(ctx.from.name)}</span><span class="time">${esc(shortTime(b.createdAt))}</span></div>
            <div class="t">${esc(b.title)}</div>
            <div class="s">${esc(b.bluf)}</div>
          </div>`;
        })
        .join('') || '<div class="empty" style="margin:18px">No briefings yet.</div>'}`;
    $$('.inbox-item', root).forEach((el) => (el.onclick = () => app.go(`#/briefing/${el.dataset.id}`)));
    $$('[data-filter]', root).forEach(
      (el) =>
        (el.onclick = () => {
          app.ui.inboxFilter = el.dataset.filter || null;
          briefingId = null;
          renderAll();
        })
    );
  }

  function renderViewer() {
    const b = selected();
    const viewer = $('.viewer', root);
    if (!b) {
      viewer.innerHTML = `<div class="page"><div class="empty">
        <p style="font-size:16px;color:var(--text)">No briefings yet.</p>
        <p>Appoint an Official. Their first briefing arrives here within minutes.</p>
        <button class="btn primary" data-go="#/appoint">Appoint an Official</button></div></div>`;
      $('[data-go]', viewer).onclick = () => app.go('#/appoint');
      stageKey = '';
      return;
    }
    const style = styleFor(b);
    const ctx = briefingContext(app, b);
    const key = JSON.stringify([b.id, style.id, ctx.decisions.map((d) => d.status)]);
    if (!$('.viewer-bar', viewer) || $('.viewer-bar', viewer).dataset.id !== b.id) {
      viewer.innerHTML = `
        <div class="viewer-bar" data-id="${b.id}">
          <div class="who">${monogram(ctx.from.name, 28)}<div><b>${esc(b.title)}</b><span class="muted" style="font-size:12px">${esc(ctx.from.name)} · ${esc(new Date(b.createdAt).toLocaleString())}</span></div></div>
          <span class="spacer"></span>
          <label class="style-pick">Style <select class="styles"></select></label>
          <button class="btn ghost sm" data-studio title="Edit how briefings look">Customize</button>
          <button class="btn ghost sm" data-delete title="Delete this briefing">Delete</button>
        </div>
        <div class="stage"></div>`;
      $('[data-studio]', viewer).onclick = () => app.go('#/studio');
      $('[data-delete]', viewer).onclick = async () => {
        const ok = await app.dialog({ title: 'Delete this briefing?', text: 'The briefing is removed from the Briefing Room. Work the official did is unaffected.', confirm: 'Delete', danger: true });
        if (ok) {
          await app.call('briefing:delete', b.id);
          app.go('#/briefings');
        }
      };
    }
    const picker = $('.styles', viewer);
    picker.innerHTML = app.styles.map((s) => `<option value="${esc(s.id)}" ${s.id === style.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
    picker.onchange = () => {
      app.ui.styleOverride = picker.value;
      renderViewer();
    };
    if (key !== stageKey) {
      stageKey = key;
      mountStage($('.stage', viewer), b, style, ctx);
    }
    if (!b.read) app.call('briefing:read', b.id);
  }

  function renderAll() {
    renderInbox();
    renderViewer();
  }

  root.innerHTML = `<div class="room"><aside class="inbox"></aside><section class="viewer"></section></div>`;
  renderAll();

  return {
    update() {
      renderAll();
    },
  };
}
