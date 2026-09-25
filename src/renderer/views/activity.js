// Activity: every Claude Code session the harness ran, what it cost in usage,
// and the controls to pause everything.
import { $, $$, esc, relTime, duration, compact } from '../util.js';

function totals(jobs, sinceMs) {
  const since = Date.now() - sinceMs;
  const list = jobs.filter((j) => j.finishedAt && new Date(j.finishedAt).getTime() >= since);
  return {
    sessions: list.length,
    failed: list.filter((j) => j.status === 'failed').length,
    tokens: list.reduce((n, j) => n + (j.tokens || 0), 0),
    cost: list.reduce((n, j) => n + (j.costUsd || 0), 0),
    ms: list.reduce((n, j) => n + (j.durationMs || 0), 0),
  };
}

export function mount(root, app) {
  function render() {
    const s = app.state;
    const day = totals(s.jobs, 86400000);
    const week = totals(s.jobs, 7 * 86400000);
    const limited = s.settings.rateLimitedUntil && new Date(s.settings.rateLimitedUntil) > new Date();
    const jobs = [...s.jobs].sort((a, b) => (b.startedAt || b.createdAt).localeCompare(a.startedAt || a.createdAt)).slice(0, 150);
    const name = (id) => app.officialById(id)?.name || 'Removed Official';

    root.innerHTML = `
      <div class="page">
        <div class="page-head"><div><div class="eyebrow">Operations log</div><h1>Activity</h1>
          <p>Every background session your Officials ran. Cost is Claude Code's API-equivalent estimate; on a subscription it indicates how much of your usage window a session consumed.</p></div>
          <div class="actions">${s.settings.paused ? '<button class="btn primary" data-resume>Resume all work</button>' : '<button class="btn danger" data-pause>Pause all work</button>'}</div></div>
        ${limited ? `<div class="card" style="padding:14px 18px;margin-bottom:16px;border-color:rgba(224,166,74,.4)">
            <b style="color:var(--warn)">Usage limit reached.</b> <span class="muted">Work resumes ${esc(relTime(s.settings.rateLimitedUntil))}.</span>
            <button class="btn ghost sm" data-clear-limit style="float:right">Try now</button></div>` : ''}
        <div class="tiles">
          <div class="card tile"><div class="k">Sessions · 24h</div><div class="v">${day.sessions}</div><div class="sub">${day.failed} failed · ${duration(day.ms)} of work</div></div>
          <div class="card tile"><div class="k">Tokens · 24h</div><div class="v">${compact(day.tokens)}</div><div class="sub">≈ $${day.cost.toFixed(2)} API-equivalent</div></div>
          <div class="card tile"><div class="k">Sessions · 7d</div><div class="v">${week.sessions}</div><div class="sub">${week.failed} failed · ${duration(week.ms)} of work</div></div>
          <div class="card tile"><div class="k">Tokens · 7d</div><div class="v">${compact(week.tokens)}</div><div class="sub">≈ $${week.cost.toFixed(2)} API-equivalent</div></div>
        </div>
        <div class="card">
          <table class="jobs">
            <thead><tr><th>Session</th><th>Official</th><th>Status</th><th>When</th><th>Time</th><th>Tokens</th><th></th></tr></thead>
            <tbody>${jobs
              .map(
                (j) => `<tr>
                  <td><b>${esc(j.title)}</b>${j.summary ? `<div class="sum">${esc(j.summary.slice(0, 500))}</div>` : ''}${j.error ? `<div class="sum err">${esc(j.error.slice(0, 400))}</div>` : ''}${j.permissionDenials ? `<div class="sum faint">${j.permissionDenials} action(s) blocked by authority level</div>` : ''}</td>
                  <td>${esc(name(j.officialId))}</td>
                  <td><span class="pill ${j.status === 'done' ? 'ok' : j.status === 'failed' ? 'bad' : j.status === 'running' ? 'gold' : j.status === 'queued' ? 'warn' : ''}">${j.status === 'running' ? '<span class="dot ok"></span>' : ''}${esc(j.status)}</span></td>
                  <td class="num">${esc(relTime(j.finishedAt || j.startedAt || j.createdAt))}</td>
                  <td class="num">${j.status === 'running' ? esc(duration(Date.now() - new Date(j.startedAt).getTime())) : duration(j.durationMs)}</td>
                  <td class="num">${j.tokens ? compact(j.tokens) : '–'}</td>
                  <td>${j.status === 'queued' || j.status === 'running' ? `<button class="btn ghost sm" data-cancel="${j.id}">${j.status === 'running' ? 'Stop' : 'Cancel'}</button>` : ''}</td>
                </tr>`
              )
              .join('') || '<tr><td colspan="7" class="muted" style="padding:30px;text-align:center">No sessions yet.</td></tr>'}</tbody>
          </table>
        </div>
      </div>`;
    $('[data-pause]', root)?.addEventListener('click', () => app.call('settings:update', { paused: true }));
    $('[data-resume]', root)?.addEventListener('click', () => app.call('settings:update', { paused: false }));
    $('[data-clear-limit]', root)?.addEventListener('click', () => app.call('settings:update', { clearRateLimit: true }));
    $$('[data-cancel]', root).forEach((b) => (b.onclick = () => app.call('job:cancel', b.dataset.cancel)));
  }
  render();
  return { update: render, tick: render };
}
