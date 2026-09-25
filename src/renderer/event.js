// Hearts of Iron-style event popup for decisions. New pending decisions pop up
// on their own; the Leader picks an option, writes their own order ("Other"),
// halts the official's work, or defers ("Later").
import { $, esc, emblem, relTime, toast } from './util.js';

export class EventModal {
  constructor(app) {
    this.app = app;
    this.seen = new Set();
    this.queue = [];
    this.currentId = null;
    this.el = null;
    this.primed = false;
  }

  // Pop decisions that arrived since the app last looked.
  checkForNew() {
    const pending = this.app.state.decisions.filter((d) => d.status === 'pending');
    for (const d of pending) {
      if (this.seen.has(d.id)) continue;
      this.seen.add(d.id);
      // On first load only the welcome sample pops; older decisions wait in the list.
      if (this.primed || d.sample) this.queue.push(d.id);
    }
    this.primed = true;
    if (!this.currentId) this.next();
  }

  next() {
    while (this.queue.length) {
      const nextId = this.queue.shift();
      const d = this.app.state.decisions.find((x) => x.id === nextId);
      if (d && d.status === 'pending') return this.open(nextId);
    }
  }

  open(decisionId) {
    this.currentId = decisionId;
    this.render();
  }

  // Re-render when state changes (e.g. auto-decided while open).
  refresh() {
    if (!this.currentId) return;
    const d = this.app.state.decisions.find((x) => x.id === this.currentId);
    if (!d || d.status !== 'pending') {
      this.close();
      return;
    }
    const timer = this.el?.querySelector('.timer-text');
    if (timer && d.deadlineAt) timer.textContent = `Auto-decides ${relTime(d.deadlineAt)}`;
  }

  close() {
    this.el?.remove();
    this.el = null;
    this.currentId = null;
    setTimeout(() => this.next(), 250);
  }

  async choose(choice) {
    const d = this.app.state.decisions.find((x) => x.id === this.currentId);
    if (!d) return this.close();
    try {
      const result = await this.app.call('decision:resolve', d.id, choice);
      this.close();
      if (d.sample) {
        if (result?.route) this.app.go(result.route);
        return;
      }
      const o = this.app.officialById(d.officialId);
      toast(choice.halt ? `${o?.name || 'Official'} halted. Resume from the Cabinet.` : `Order issued to ${o?.name || 'the official'}.`);
    } catch {
      /* toast already shown */
    }
  }

  render() {
    const d = this.app.state.decisions.find((x) => x.id === this.currentId);
    if (!d) return this.close();
    const o = this.app.officialById(d.officialId);
    const b = this.app.state.briefings.find((x) => x.id === d.briefingId);
    const from = o || b?.from || { name: 'The Harness', title: 'Chief of Staff' };

    this.el?.remove();
    const el = document.createElement('div');
    el.className = 'scrim';
    el.innerHTML = `
      <div class="event" role="dialog" aria-modal="true" aria-label="${esc(d.title)}">
        <div class="event-title">${esc(d.title)}</div>
        <div class="event-art">${emblem(from.name, 92)}<div class="from">${esc(from.name)} · ${esc(from.title)}</div></div>
        <div class="event-body">${esc(d.body)}</div>
        <div class="event-opts">
          ${d.options
            .map((opt) => `<button class="event-opt ${opt.recommended ? 'rec' : ''}" data-opt="${esc(opt.id)}"><b>${esc(opt.label)}</b><small>${esc(opt.detail)}</small></button>`)
            .join('')}
          ${
            d.sample
              ? ''
              : `<div class="event-other" hidden>
                   <textarea placeholder="Write your own order. It goes to ${esc(from.name)} word for word."></textarea>
                   <div class="row"><button class="btn primary sm" data-issue>Issue order</button><button class="btn ghost sm" data-cancel-other>Back</button></div>
                 </div>
                 <button class="event-opt" data-other><b>Other…</b><small>Give your own order instead.</small></button>`
          }
        </div>
        <div class="event-foot">
          ${d.deadlineAt ? `<span class="timer">⏳ <span class="timer-text">Auto-decides ${esc(relTime(d.deadlineAt))}</span></span>` : ''}
          <span class="spacer"></span>
          ${d.sample ? '' : `<button class="btn danger sm" data-halt title="Stop this official's work until you resume it">Halt work</button>`}
          <button class="btn ghost sm" data-later>Later</button>
        </div>
      </div>`;
    $('#modal-root').appendChild(el);
    this.el = el;

    el.querySelectorAll('[data-opt]').forEach((btn) => (btn.onclick = () => this.choose({ optionId: btn.dataset.opt })));
    el.querySelector('[data-later]').onclick = () => this.close();
    el.querySelector('[data-halt]')?.addEventListener('click', () => this.choose({ halt: true }));
    const other = el.querySelector('.event-other');
    el.querySelector('[data-other]')?.addEventListener('click', (e) => {
      other.hidden = false;
      e.currentTarget.hidden = true;
      other.querySelector('textarea').focus();
    });
    el.querySelector('[data-cancel-other]')?.addEventListener('click', () => {
      other.hidden = true;
      el.querySelector('[data-other]').hidden = false;
    });
    el.querySelector('[data-issue]')?.addEventListener('click', () => {
      const text = other.querySelector('textarea').value.trim();
      if (!text) return other.querySelector('textarea').focus();
      this.choose({ text });
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });
    el.addEventListener('mousedown', (e) => e.target === el && this.close());
    (el.querySelector('.event-opt.rec') || el.querySelector('.event-opt')).focus();
  }
}
