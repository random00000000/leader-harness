// Decision requests. New pending decisions open on their own as a short
// decision memo; the Leader picks an option, sends a different instruction,
// halts the Official's work, or decides later.
import { $, esc, monogram, relTime, toast } from './util.js';

export class DecisionModal {
  constructor(app) {
    this.app = app;
    this.seen = new Set();
    this.queue = [];
    this.currentId = null;
    this.el = null;
    this.primed = false;
  }

  // Open decisions that arrived since the app last looked.
  checkForNew() {
    const pending = this.app.state.decisions.filter((d) => d.status === 'pending');
    for (const d of pending) {
      if (this.seen.has(d.id)) continue;
      this.seen.add(d.id);
      // On first load only the welcome decision opens; older ones wait in the list.
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

  // Close when the decision is resolved elsewhere (e.g. its window expired).
  refresh() {
    if (!this.currentId) return;
    const d = this.app.state.decisions.find((x) => x.id === this.currentId);
    if (!d || d.status !== 'pending') return this.close();
    const deadline = this.el?.querySelector('.deadline-text');
    if (deadline && d.deadlineAt) deadline.textContent = deadlineText(d);
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
      toast(choice.halt ? `${o?.name || 'Official'}: work halted. Resume from Officials.` : `Instruction sent to ${o?.name || 'the Official'}.`);
    } catch {
      /* toast already shown */
    }
  }

  render() {
    const d = this.app.state.decisions.find((x) => x.id === this.currentId);
    if (!d) return this.close();
    const o = this.app.officialById(d.officialId);
    const b = this.app.state.briefings.find((x) => x.id === d.briefingId);
    const from = o || b?.from || { name: 'Leader Harness', title: 'Setup' };

    this.el?.remove();
    const el = document.createElement('div');
    el.className = 'scrim';
    el.innerHTML = `
      <div class="decision" role="dialog" aria-modal="true" aria-label="${esc(d.title)}">
        <header class="decision-head">
          <div class="eyebrow">Decision required</div>
          <h2>${esc(d.title)}</h2>
          <div class="decision-from">${monogram(from.name, 22)}<span>${esc(from.name)}, ${esc(from.title)}</span></div>
        </header>
        <p class="decision-body">${esc(d.body)}</p>
        <div class="decision-opts">
          ${d.options
            .map(
              (opt) => `<button class="decision-opt ${opt.recommended ? 'rec' : ''}" data-opt="${esc(opt.id)}">
                ${opt.recommended ? '<span class="rec-tag">Recommended</span>' : ''}<b>${esc(opt.label)}</b><small>${esc(opt.detail)}</small></button>`
            )
            .join('')}
          ${
            d.sample
              ? ''
              : `<div class="decision-other" hidden>
                   <textarea placeholder="Your instruction reaches ${esc(from.name)} exactly as written."></textarea>
                   <div class="row"><button class="btn primary sm" data-send>Send instruction</button><button class="btn ghost sm" data-cancel-other>Cancel</button></div>
                 </div>
                 <button class="decision-opt quiet" data-other><b>Give a different instruction</b></button>`
          }
        </div>
        <footer class="decision-foot">
          ${d.deadlineAt ? `<span class="deadline-text">${esc(deadlineText(d))}</span>` : ''}
          <span class="spacer"></span>
          ${d.sample ? '' : `<button class="btn ghost sm danger-text" data-halt title="Stop this Official's work until you resume it">Halt work</button>`}
          <button class="btn ghost sm" data-later>Decide later</button>
        </footer>
      </div>`;
    $('#modal-root').appendChild(el);
    this.el = el;

    el.querySelectorAll('[data-opt]').forEach((btn) => (btn.onclick = () => this.choose({ optionId: btn.dataset.opt })));
    el.querySelector('[data-later]').onclick = () => this.close();
    el.querySelector('[data-halt]')?.addEventListener('click', () => this.choose({ halt: true }));
    const other = el.querySelector('.decision-other');
    el.querySelector('[data-other]')?.addEventListener('click', (e) => {
      other.hidden = false;
      e.currentTarget.hidden = true;
      other.querySelector('textarea').focus();
    });
    el.querySelector('[data-cancel-other]')?.addEventListener('click', () => {
      other.hidden = true;
      el.querySelector('[data-other]').hidden = false;
    });
    el.querySelector('[data-send]')?.addEventListener('click', () => {
      const text = other.querySelector('textarea').value.trim();
      if (!text) return other.querySelector('textarea').focus();
      this.choose({ text });
    });
    el.addEventListener('keydown', (e) => e.key === 'Escape' && this.close());
    el.addEventListener('mousedown', (e) => e.target === el && this.close());
    (el.querySelector('.decision-opt.rec') || el.querySelector('.decision-opt')).focus();
  }
}

function deadlineText(d) {
  return `If there is no response, the recommendation proceeds ${relTime(d.deadlineAt)}.`;
}
