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
    title: 'No Officials appointed',
    body: 'Nobody reports to you yet. An Official needs a remit, optionally a project, and a reporting schedule. Once appointed, they work in the background and brief you on that schedule.',
    options: [
      { id: 'opt0', label: 'Appoint the first Official', detail: 'Open the setup screen.', recommended: true, route: '#/appoint' },
      { id: 'opt1', label: 'Review briefing formats first', detail: 'Open the Style Studio.', recommended: false, route: '#/studio' },
      { id: 'opt2', label: 'Read this briefing first', detail: 'Close this decision.', recommended: false, route: null },
    ],
    status: 'pending',
    createdAt: now,
    deadlineAt: null,
  };
  s.decisions.push(decision);
  s.briefings.push({
    id: briefingId,
    officialId: null,
    from: { name: 'Leader Harness', title: 'Setup' },
    createdAt: now,
    read: false,
    title: 'Getting started',
    classification: 'PRIORITY',
    bluf: 'Leader Harness runs AI work in the background and reports to you in briefings like this one. Appoint an Official to begin.',
    situation: [
      'An Official is a Claude Code agent with a remit, such as delivery of one project. Each keeps a wiki as its working memory.',
      'Officials work on a schedule you set (hourly, daily, or only on request) and use your Claude subscription while you are away.',
      'You direct the work by reading briefings and answering decisions. Each decision carries a recommendation; if you do not respond in time, the recommendation proceeds. Halt stops that line of work.',
      'Briefings can be read as a slide deck, a dossier, a red box submission, or a daily brief. Choose a format above, or create your own in the Style Studio.',
    ],
    actions: [
      { text: 'Scheduler running.', status: 'done' },
      findClaude(s.settings.claudePath)
        ? { text: 'Claude Code found on this machine.', status: 'done' }
        : { text: 'Claude Code not found. Set its path in Settings.', status: 'blocked' },
      { text: 'Appoint the first Official.', status: 'in_progress' },
    ],
    risks: [
      { text: 'Officials with Ship authority can commit, push and merge without asking. Start with Observe or Build.', level: 'medium' },
      { text: 'A surge can consume a large share of your usage window. Size it deliberately.', level: 'low' },
    ],
    decisions: [decision.id],
    next: ['Appoint an Official from the Officials screen.', 'Set how often they report.', 'Read their first briefing, usually within a few minutes.'],
  });
}

module.exports = { welcomeBriefing };
