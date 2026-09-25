// The first thing a new Leader sees: a real briefing, in their chosen style,
// that explains the harness and asks for the first decision.
const { id } = require('./store');
const { findClaude } = require('./runner');

function welcomeBriefing(s) {
  const now = new Date().toISOString();
  const briefingId = id('brf');
  const decision = {
    id: id('dec'),
    sample: true,
    officialId: null,
    briefingId,
    title: 'The Cabinet Is Empty',
    body: 'You have taken office, but nobody reports to you yet. A Senior Official needs a remit, a project, and a cadence. Once appointed, they will work in the background and brief you on schedule.',
    options: [
      { id: 'opt0', label: 'Appoint my first Senior Official', detail: 'Open the setup screen and spawn an official.', recommended: true, route: '#/spawn' },
      { id: 'opt1', label: 'Try the other briefing styles first', detail: 'Open the Style Studio.', recommended: false, route: '#/studio' },
      { id: 'opt2', label: 'Let me read the briefing first', detail: 'Close this event.', recommended: false, route: null },
    ],
    status: 'pending',
    createdAt: now,
    deadlineAt: null,
  };
  s.decisions.push(decision);
  s.briefings.push({
    id: briefingId,
    officialId: null,
    from: { name: 'The Harness', title: 'Chief of Staff' },
    createdAt: now,
    read: false,
    title: 'Welcome to office',
    classification: 'PRIORITY',
    bluf: 'Leader Harness runs your AI work while you are away and reports to you through briefings like this one. Appoint a Senior Official to get started.',
    situation: [
      'Senior Officials are Claude Code agents with a remit. Each one owns an area, such as one of your games, and keeps a wiki as its memory.',
      'Officials work on their own schedule: hourly, daily, or only when you order it. They spend your subscription usage while you are away from the keyboard.',
      'You lead by reading briefings and answering events. Each event has a recommended option. If you do not answer in time, the recommendation is carried out, and Halt stops that line of work.',
      'This briefing can be shown as a cabinet deck, a manila dossier, a red box, or a daily brief tablet. Switch styles above, or build your own in the Style Studio.',
    ],
    actions: [
      { text: 'Harness installed and scheduler running.', status: 'done' },
      findClaude(s.settings.claudePath)
        ? { text: 'Claude Code located on this machine.', status: 'done' }
        : { text: 'Claude Code not found. Set its path in Settings.', status: 'blocked' },
      { text: 'Appoint the first Senior Official.', status: 'in_progress' },
    ],
    risks: [
      { text: 'Officials with Ship authority can commit, push and merge without asking. Start with Observe or Build until you trust them.', level: 'medium' },
      { text: 'A big push can use a large share of your subscription window. Size it deliberately.', level: 'low' },
    ],
    decisions: [decision.id],
    next: ['Appoint an official from the Cabinet screen.', 'Choose how often they brief you.', 'Read their first briefing, usually a few minutes after appointment.'],
  });
}

module.exports = { welcomeBriefing };
