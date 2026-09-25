// Decisions: everything awaiting the Leader, plus a record of what was decided.
import { $$, esc, monogram, relTime } from '../util.js';

const HOW = { decided: 'Decided', auto: 'Recommendation proceeded', halted: 'Work halted', withdrawn: 'Withdrawn' };

export function mount(root, app) {
  function render() {
    const all = [...app.state.decisions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const pending = all.filter((d) => d.status === 'pending');
    const past = all.filter((d) => d.status !== 'pending').slice(0, 40);
    const fromOf = (d) => app.officialById(d.officialId) || { name: 'Leader Harness', title: 'Setup' };

    root.innerHTML = `
      <div class="page">
        <div class="page-head"><div><div class="eyebrow">Awaiting you</div><h1>Decisions</h1>
          <p>If there is no response in time, the recommended option proceeds.</p></div></div>
        <div class="dec-list">
          ${pending
            .map((d) => {
              const o = fromOf(d);
              const rec = d.options.find((x) => x.recommended);
              return `<div class="card dec">${monogram(o.name, 38)}
                <div><h3>${esc(d.title)}</h3><p>${esc(d.body)}</p>
                  <p style="margin-top:8px"><span class="pill gold">Recommended: ${esc(rec?.label || '')}</span> <span class="faint" style="font-size:12px">${esc(o.name)} · ${d.deadlineAt ? `recommendation proceeds ${esc(relTime(d.deadlineAt))}` : 'no deadline'}</span></p></div>
                <button class="btn primary" data-open="${d.id}">Decide</button></div>`;
            })
            .join('') || '<div class="empty">Nothing needs your decision right now.</div>'}
        </div>
        ${past.length ? `<h2 style="font-size:15px;margin:32px 0 12px">Record</h2>
        <div class="card"><table class="jobs"><thead><tr><th>Decision</th><th>Official</th><th>Outcome</th><th>When</th></tr></thead><tbody>
          ${past
            .map((d) => {
              const opt = d.options.find((x) => x.id === d.choice?.optionId);
              return `<tr><td>${esc(d.title)}</td><td>${esc(fromOf(d).name)}</td>
                <td><span class="pill ${d.status === 'halted' ? 'bad' : d.status === 'auto' ? 'warn' : 'ok'}">${HOW[d.status] || d.status}</span>
                <div class="sum" style="margin-top:4px">${esc(d.choice?.text || opt?.label || '')}</div></td>
                <td class="num">${esc(relTime(d.resolvedAt || d.createdAt))}</td></tr>`;
            })
            .join('')}
        </tbody></table></div>` : ''}
      </div>`;
    $$('[data-open]', root).forEach((b) => (b.onclick = () => app.modal.open(b.dataset.open)));
  }
  render();
  return { update: render, tick: render };
}
