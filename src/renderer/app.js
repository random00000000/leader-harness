// Renderer entry: state, routing, the sidebar, and the decision modal.
import { $, $$, esc, toast } from './util.js';
import { DecisionModal } from './decision.js';
import * as briefings from './views/briefings.js';
import * as decisions from './views/decisions.js';
import * as officials from './views/officials.js';
import * as appoint from './views/appoint.js';
import * as official from './views/official.js';
import * as activity from './views/activity.js';
import * as studio from './views/studio.js';
import * as settings from './views/settings.js';

const ICONS = {
  briefings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 5h11l5 5v9a1 1 0 0 1-1 1H4z"/><path d="M15 5v5h5M8 13h8M8 16.5h5"/></svg>',
  decisions: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3 3 8l9 5 9-5z"/><path d="m3 13 9 5 9-5"/></svg>',
  officials: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 4h14v7c0 5-3.5 8-7 9-3.5-1-7-4-7-9z"/><path d="m9 11 2 2 4-4"/></svg>',
  activity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 12h4l3-7 4 14 3-7h4"/></svg>',
  studio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.8 1.5-1.6 0-1-.8-1.4-.8-2.4 0-1 .8-1.5 1.8-1.5H17a4 4 0 0 0 4-4c0-4.7-4-8.5-9-8.5Z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10.5" cy="7" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>',
};

const ROUTES = [
  { re: /^#\/briefings?(?:\/([\w]+))?$/, view: briefings, nav: 'briefings' },
  { re: /^#\/decisions$/, view: decisions, nav: 'decisions' },
  { re: /^#\/officials$/, view: officials, nav: 'officials' },
  { re: /^#\/appoint$/, view: appoint, nav: 'officials' },
  { re: /^#\/official\/([\w]+)$/, view: official, nav: 'officials' },
  { re: /^#\/activity$/, view: activity, nav: 'activity' },
  { re: /^#\/studio$/, view: studio, nav: 'studio' },
  { re: /^#\/settings$/, view: settings, nav: 'settings' },
];

class App {
  constructor() {
    this.state = null;
    this.styles = [];
    this.current = null; // { view, params, instance }
    this.modal = new DecisionModal(this);
    this.ui = {}; // per-session UI memory (selected style, filters...)
  }

  call(channel, ...args) {
    return window.lh.call(channel, ...args).catch((err) => {
      toast(err.message, 'error');
      throw err;
    });
  }

  go(route) {
    if (location.hash === route) this.route();
    else location.hash = route;
  }

  officialById(officialId) {
    return this.state.officials.find((o) => o.id === officialId) || null;
  }

  styleById(styleId) {
    return this.styles.find((s) => s.id === styleId) || this.styles.find((s) => s.id === this.state.settings.defaultStyle) || this.styles[0];
  }

  async reloadStyles() {
    this.styles = await this.call('styles:list');
  }

  async start() {
    this.state = await this.call('state:get');
    await this.reloadStyles();
    window.lh.onState((state) => this.onState(state));
    window.lh.onNavigate((route) => this.go(route));
    window.addEventListener('hashchange', () => this.route());
    window.addEventListener('message', (e) => {
      if (e.data?.lh === 'decide') this.modal.open(e.data.id);
    });
    if (!location.hash) location.hash = '#/briefings';
    this.renderChrome();
    this.route();
    this.modal.checkForNew();
    setInterval(() => {
      if (document.hidden) return;
      this.renderChrome();
      this.current?.instance?.tick?.();
    }, 30000);
  }

  onState(state) {
    this.state = state;
    this.renderChrome();
    this.current?.instance?.update?.(state);
    this.modal.checkForNew();
    this.modal.refresh();
  }

  route() {
    const hash = location.hash || '#/briefings';
    const match = ROUTES.map((r) => ({ r, m: hash.match(r.re) })).find((x) => x.m);
    if (!match) return this.go('#/briefings');
    this.current?.instance?.destroy?.();
    const root = $('#view');
    root.scrollTop = 0;
    const instance = match.r.view.mount(root, this, match.m.slice(1));
    this.current = { view: match.r.view, nav: match.r.nav, instance };
    this.renderChrome();
  }

  renderChrome() {
    const s = this.state;
    if (!s) return;
    const unread = s.briefings.filter((b) => !b.read).length;
    const pending = s.decisions.filter((d) => d.status === 'pending').length;
    const running = s.jobs.filter((j) => j.status === 'running').length;
    const queued = s.jobs.filter((j) => j.status === 'queued').length;
    const nav = this.current?.nav;
    const item = (key, label, badge) =>
      `<div class="nav-item ${nav === key ? 'on' : ''}" data-go="#/${key}">${ICONS[key]}<span>${label}</span>${badge || ''}</div>`;
    const limited = s.settings.rateLimitedUntil && new Date(s.settings.rateLimitedUntil) > new Date();
    $('#sidebar').innerHTML = `
      ${item('briefings', 'Briefing Room', unread ? `<span class="badge">${unread}</span>` : '')}
      ${item('decisions', 'Decisions', pending ? `<span class="badge">${pending}</span>` : '')}
      ${item('officials', 'Officials', s.officials.length ? `<span class="badge quiet">${s.officials.length}</span>` : '')}
      ${item('activity', 'Activity', running ? '<span class="dot ok" style="margin-left:auto"></span>' : '')}
      <div class="nav-sep"></div>
      ${item('studio', 'Style Studio')}
      ${item('settings', 'Settings')}
      <div class="sidebar-foot">
        <div><span class="dot ${s.claudeFound ? 'ok' : 'bad'}"></span> Claude Code ${s.claudeFound ? 'ready' : 'not found'}</div>
        <div>${s.settings.paused ? '<span class="dot warn"></span> All work paused' : limited ? '<span class="dot warn"></span> Usage limit: waiting' : '<span class="dot ok"></span> Scheduler live'}</div>
      </div>`;
    $$('#sidebar [data-go]').forEach((el) => (el.onclick = () => this.go(el.dataset.go)));
    $('#titlebar-status').innerHTML = `
      ${running ? `<span class="live">● ${running} running</span>` : '<span>idle</span>'}
      ${queued ? `<span>${queued} queued</span>` : ''}
      ${pending ? `<span style="color:var(--gold)">${pending} awaiting decision</span>` : ''}
      ${s.settings.paused ? '<span class="paused">paused</span>' : ''}`;
  }

  // Simple form dialog. fields: [{ name, label, type, value, placeholder, hint }]
  dialog({ title, text, fields = [], confirm = 'Confirm', danger = false }) {
    return new Promise((resolve) => {
      const root = $('#modal-root');
      const wrap = document.createElement('div');
      wrap.className = 'scrim';
      wrap.innerHTML = `
        <form class="dialog">
          <div class="dialog-head"><h2>${esc(title)}</h2>${text ? `<p>${esc(text)}</p>` : ''}</div>
          ${fields.length ? `<div class="dialog-body">${fields
            .map(
              (f) => `<label class="field"><span>${esc(f.label)}</span>${
                f.type === 'textarea'
                  ? `<textarea name="${f.name}" placeholder="${esc(f.placeholder || '')}">${esc(f.value || '')}</textarea>`
                  : `<input type="${f.type || 'text'}" name="${f.name}" value="${esc(f.value ?? '')}" placeholder="${esc(f.placeholder || '')}" ${f.min != null ? `min="${f.min}" max="${f.max}"` : ''}>`
              }${f.hint ? `<small>${esc(f.hint)}</small>` : ''}</label>`
            )
            .join('')}</div>` : '<div style="height:16px"></div>'}
          <div class="dialog-foot"><button type="button" class="btn ghost" data-x>Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}">${esc(confirm)}</button></div>
        </form>`;
      const close = (value) => {
        wrap.remove();
        resolve(value);
      };
      wrap.addEventListener('mousedown', (e) => e.target === wrap && close(null));
      wrap.querySelector('[data-x]').onclick = () => close(null);
      wrap.querySelector('form').onsubmit = (e) => {
        e.preventDefault();
        close(Object.fromEntries(new FormData(e.target)));
      };
      wrap.addEventListener('keydown', (e) => e.key === 'Escape' && close(null));
      root.appendChild(wrap);
      (wrap.querySelector('input, textarea') || wrap.querySelector('button.btn:last-child')).focus();
    });
  }
}

const app = new App();
window.addEventListener('DOMContentLoaded', () => app.start());
