// The scheduler wakes Senior Officials on their cadence, runs the job queue
// (one Claude Code session per job), turns briefings into decisions, and
// auto-takes the recommended option when a decision expires.
const fs = require('fs');
const { id } = require('./store');
const { runClaude, findClaude } = require('./runner');
const P = require('./prompts');

const TICK_MS = 20 * 1000;

// cadence: { mode: 'manual' } | { mode: 'interval', minutes } | { mode: 'daily', time: 'HH:MM' }
function isDue(cadence, lastIso, now = new Date()) {
  if (!cadence || cadence.mode === 'manual') return false;
  const last = lastIso ? new Date(lastIso) : null;
  if (cadence.mode === 'interval') {
    return !last || now - last >= Math.max(5, Number(cadence.minutes) || 60) * 60 * 1000;
  }
  if (cadence.mode === 'daily') {
    const [h, m] = String(cadence.time || '08:00').split(':').map(Number);
    const slot = new Date(now);
    slot.setHours(h, m || 0, 0, 0);
    return now >= slot && (!last || last < slot);
  }
  return false;
}

function nextDue(cadence, lastIso, now = new Date()) {
  if (!cadence || cadence.mode === 'manual') return null;
  if (cadence.mode === 'interval') {
    if (!lastIso) return now.toISOString();
    return new Date(new Date(lastIso).getTime() + Math.max(5, Number(cadence.minutes) || 60) * 60 * 1000).toISOString();
  }
  const [h, m] = String(cadence.time || '08:00').split(':').map(Number);
  const slot = new Date(now);
  slot.setHours(h, m || 0, 0, 0);
  if (isDue(cadence, lastIso, now)) return now.toISOString();
  if (slot <= now) slot.setDate(slot.getDate() + 1);
  return slot.toISOString();
}

class Scheduler {
  constructor(store, { notify }) {
    this.store = store;
    this.notify = notify;
    this.running = new Map(); // jobId -> child process
    this.cancelled = new Set();
    this.timer = null;
  }

  start() {
    this.tick();
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  stop() {
    clearInterval(this.timer);
    for (const child of this.running.values()) child.kill();
  }

  // ---- queueing -------------------------------------------------------

  enqueue(official, kind, extra = {}) {
    return this.store.update((s) => {
      const duplicate = s.jobs.find(
        (j) => j.officialId === official.id && j.kind === kind && j.status === 'queued' && !extra.directive && !extra.operationId
      );
      if (duplicate) return duplicate;
      const job = {
        id: id('job'),
        officialId: official.id,
        kind, // briefing | work | directive | operation
        title: extra.title || { briefing: 'Briefing', work: 'Work session' }[kind] || kind,
        status: 'queued',
        createdAt: new Date().toISOString(),
        ...extra,
      };
      s.jobs.push(job);
      return job;
    });
  }

  tick() {
    const now = new Date();
    this.expireDecisions(now);
    const s = this.store.get();

    for (const o of s.officials) {
      if (o.status !== 'active') continue;
      if (isDue(o.briefingCadence, o.lastBriefingAt, now)) {
        this.store.update(() => (o.lastBriefingAt = now.toISOString()));
        this.enqueue(o, 'briefing');
      }
      if (isDue(o.workCadence, o.lastWorkAt, now)) {
        this.store.update(() => (o.lastWorkAt = now.toISOString()));
        this.enqueue(o, 'work');
      }
    }

    for (const op of s.operations) {
      if (op.status !== 'active') continue;
      const official = s.officials.find((o) => o.id === op.officialId);
      if (!official || official.status !== 'active') continue;
      const inFlight = s.jobs.some((j) => j.operationId === op.id && (j.status === 'queued' || j.status === 'running'));
      if (!inFlight && op.completed < op.runs) {
        this.enqueue(official, 'operation', { operationId: op.id, runNumber: op.completed + 1, title: `Surge ${op.completed + 1}/${op.runs}: ${op.objective.slice(0, 60)}` });
      }
    }

    this.pump();
  }

  pump() {
    const s = this.store.get();
    if (s.settings.paused) return;
    if (s.settings.rateLimitedUntil) {
      if (new Date(s.settings.rateLimitedUntil) > new Date()) return;
      this.store.update((st) => (st.settings.rateLimitedUntil = null));
    }
    const limit = Math.max(1, Number(s.settings.maxConcurrent) || 1);
    const busyOfficials = new Set(s.jobs.filter((j) => j.status === 'running').map((j) => j.officialId));

    for (const job of s.jobs) {
      if (this.running.size >= limit) break;
      if (job.status !== 'queued' || busyOfficials.has(job.officialId)) continue;
      const official = s.officials.find((o) => o.id === job.officialId);
      if (!official) {
        this.store.update(() => Object.assign(job, { status: 'cancelled', finishedAt: new Date().toISOString() }));
        continue;
      }
      if (official.status !== 'active' && job.kind !== 'briefing') continue;
      busyOfficials.add(official.id);
      this.run(job, official);
    }
  }

  // ---- running --------------------------------------------------------

  async run(job, official) {
    const s = this.store.get();
    const claudePath = findClaude(s.settings.claudePath);
    if (!claudePath) {
      this.finish(job, { ok: false, error: 'Claude Code was not found. Set its path in Settings.' });
      return;
    }

    let prompt;
    let schema = null;
    if (job.kind === 'briefing') {
      const since = official.lastBriefingDeliveredAt;
      const activity = s.jobs.filter(
        (j) => j.officialId === official.id && j.kind !== 'briefing' && j.finishedAt && (!since || j.finishedAt > since)
      );
      prompt = P.briefingPrompt(official, { since, activity });
      schema = P.BRIEFING_SCHEMA;
    } else if (job.kind === 'directive') {
      prompt = P.directivePrompt(official, job.directive);
    } else if (job.kind === 'operation') {
      const op = s.operations.find((o) => o.id === job.operationId);
      if (!op || op.status !== 'active') return this.finish(job, { ok: false, error: 'The surge was cancelled.' }, 'cancelled');
      prompt = P.operationPrompt(official, op, job.runNumber);
    } else {
      prompt = P.workPrompt(official);
    }

    const cwd = official.projectPath && fs.existsSync(official.projectPath) ? official.projectPath : official.homeDir;
    let perms;
    try {
      perms = P.toolsFor(official, cwd);
    } catch (err) {
      return this.finish(job, { ok: false, error: err.message });
    }
    this.store.update(() => Object.assign(job, { status: 'running', startedAt: new Date().toISOString() }));

    const { child, done } = runClaude({
      claudePath,
      cwd,
      prompt,
      systemPrompt: P.persona(official),
      tools: perms.allow,
      deny: perms.deny,
      authority: official.authority,
      model: official.model || undefined,
      schema,
      timeoutMin: s.settings.jobTimeoutMin,
    });
    // No child means the session never started (e.g. the guard is unavailable).
    if (child) this.running.set(job.id, child);
    const outcome = await done;
    this.running.delete(job.id);
    const cancelled = this.cancelled.delete(job.id);
    this.finish(job, cancelled ? { ...outcome, ok: false, error: 'Cancelled by the Leader.' } : outcome, cancelled ? 'cancelled' : undefined);
    this.pump();
  }

  finish(job, outcome, forcedStatus) {
    const now = new Date().toISOString();
    let briefing = null;
    this.store.update((s) => {
      Object.assign(job, {
        status: forcedStatus || (outcome.ok ? 'done' : 'failed'),
        finishedAt: now,
        durationMs: outcome.durationMs,
        costUsd: outcome.costUsd || 0,
        tokens: outcome.usage ? (outcome.usage.input_tokens || 0) + (outcome.usage.output_tokens || 0) + (outcome.usage.cache_creation_input_tokens || 0) + (outcome.usage.cache_read_input_tokens || 0) : 0,
        summary: outcome.ok ? (job.kind === 'briefing' ? outcome.structured?.bluf : outcome.result) : null,
        error: outcome.error || null,
        permissionDenials: outcome.permissionDenials || 0,
      });
      if (outcome.rateLimitedUntil) s.settings.rateLimitedUntil = outcome.rateLimitedUntil;

      const official = s.officials.find((o) => o.id === job.officialId);
      if (job.kind === 'operation') {
        const op = s.operations.find((o) => o.id === job.operationId);
        if (op && outcome.ok) {
          op.completed += 1;
          if (op.completed >= op.runs) {
            op.status = 'complete';
            op.finishedAt = now;
          }
        } else if (op && !outcome.rateLimitedUntil) {
          op.failures = (op.failures || 0) + 1;
          if (op.failures >= 3) op.status = 'stalled';
        }
      }
      if (job.kind === 'briefing' && outcome.ok && outcome.structured && official) {
        briefing = this.recordBriefing(s, official, outcome.structured, job);
      }
    });

    const official = this.store.get().officials.find((o) => o.id === job.officialId);
    if (briefing) {
      this.notify({ title: `${official?.name || 'Official'}: ${briefing.title}`, body: briefing.bluf, route: `#/briefing/${briefing.id}` });
    } else if (!outcome.ok && !forcedStatus) {
      this.notify({ title: `${official?.name || 'Official'}: ${job.title} failed`, body: (outcome.error || '').slice(0, 180), route: '#/activity' });
    }
  }

  recordBriefing(s, official, data, job) {
    const now = new Date();
    const briefing = {
      id: id('brf'),
      officialId: official.id,
      jobId: job.id,
      createdAt: now.toISOString(),
      read: false,
      ...data,
      decisions: [],
    };
    for (const d of data.decisions || []) {
      const options = d.options.map((o, i) => ({ id: `opt${i}`, ...o }));
      if (!options.some((o) => o.recommended)) options[0].recommended = true;
      const decision = {
        id: id('dec'),
        officialId: official.id,
        briefingId: briefing.id,
        title: d.title,
        body: d.body,
        options,
        status: 'pending',
        createdAt: now.toISOString(),
        deadlineAt: new Date(now.getTime() + (official.decisionWindowMin || 240) * 60 * 1000).toISOString(),
      };
      s.decisions.push(decision);
      briefing.decisions.push(decision.id);
    }
    s.briefings.push(briefing);
    official.lastBriefingDeliveredAt = now.toISOString();
    return briefing;
  }

  // ---- decisions ------------------------------------------------------

  expireDecisions(now) {
    const expired = this.store.get().decisions.filter((d) => d.status === 'pending' && d.deadlineAt && new Date(d.deadlineAt) <= now);
    for (const d of expired) {
      const rec = d.options.find((o) => o.recommended) || d.options[0];
      this.resolve(d.id, { optionId: rec.id, auto: true });
    }
  }

  // choice: { optionId } | { text } | { halt: true }, plus auto flag
  resolve(decisionId, choice) {
    const s = this.store.get();
    const d = s.decisions.find((x) => x.id === decisionId);
    if (!d || d.status !== 'pending') return null;
    const official = s.officials.find((o) => o.id === d.officialId);

    if (choice.halt) {
      this.store.update(() => {
        Object.assign(d, { status: 'halted', resolvedAt: new Date().toISOString() });
        if (official) official.status = 'halted';
      });
      return d;
    }

    const option = d.options.find((o) => o.id === choice.optionId);
    const text = choice.text ? choice.text : `${option.label.replace(/[.\s]+$/, '')}. ${option.detail}`;
    this.store.update(() =>
      Object.assign(d, {
        status: choice.auto ? 'auto' : 'decided',
        choice: { optionId: option?.id || null, text: choice.text || null },
        resolvedAt: new Date().toISOString(),
      })
    );
    if (official) {
      this.enqueue(official, 'directive', {
        title: `Instruction: ${choice.text ? choice.text.slice(0, 60) : option.label}`,
        directive: { decisionId: d.id, decisionTitle: d.title, text },
      });
      this.pump();
    }
    return d;
  }

  cancelJob(jobId) {
    const child = this.running.get(jobId);
    if (child) {
      this.cancelled.add(jobId);
      child.kill();
    }
    this.store.update((s) => {
      const job = s.jobs.find((j) => j.id === jobId);
      if (job && job.status === 'queued') Object.assign(job, { status: 'cancelled', finishedAt: new Date().toISOString() });
    });
  }
}

module.exports = { Scheduler, isDue, nextDue };
