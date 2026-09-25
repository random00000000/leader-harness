// Leader Harness: Electron main process. Owns state, the scheduler, the tray,
// notifications, and the IPC surface the renderer uses.
const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, Notification, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');
const { Store, id } = require('./store');
const { Scheduler, nextDue } = require('./scheduler');
const { ensureWiki, installMandate, displayName } = require('./wiki');
const { findClaude } = require('./runner');
const { AUTHORITY } = require('./prompts');
const { welcomeBriefing } = require('./welcome');

const ROOT = path.join(__dirname, '..', '..');
const BUILTIN_STYLES = path.join(ROOT, 'styles');

// Development: LH_USER_DATA isolates state; LH_CAPTURE="<dir>" screenshots
// each route (LH_ROUTES, one per line; "route|js" runs js first) and quits.
if (process.env.LH_USER_DATA) app.setPath('userData', process.env.LH_USER_DATA);

if (!app.requestSingleInstanceLock()) app.quit();
app.setAppUserModelId('Leader Harness');

let win = null;
let tray = null;
let quitting = false;
let store;
let scheduler;

// ---------------------------------------------------------------- window

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 640,
    show: false,
    backgroundColor: '#0b0d11',
    title: 'Leader Harness',
    icon: path.join(ROOT, 'resources', 'icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0b0d11', symbolColor: '#9aa3b2', height: 40 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.loadFile(path.join(ROOT, 'src', 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.on('close', (e) => {
    // Closing hides to the tray so officials keep working.
    if (!quitting) {
      e.preventDefault();
      win.hide();
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

function showWindow(route) {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  if (route) win.webContents.send('navigate', route);
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(path.join(ROOT, 'resources', 'tray.png')));
  tray.setToolTip('Leader Harness');
  tray.on('click', () => showWindow());
  refreshTrayMenu();
}

function refreshTrayMenu() {
  if (!tray) return;
  const s = store.get();
  const pending = s.decisions.filter((d) => d.status === 'pending').length;
  const running = s.jobs.filter((j) => j.status === 'running').length;
  tray.setToolTip(`Leader Harness: ${pending} decision(s) waiting, ${running} running`);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open Briefing Room', click: () => showWindow('#/briefings') },
      { label: `Decisions waiting: ${pending}`, click: () => showWindow('#/decisions') },
      { type: 'separator' },
      {
        label: s.settings.paused ? 'Resume all work' : 'Pause all work',
        click: () => store.update((st) => (st.settings.paused = !st.settings.paused)),
      },
      { type: 'separator' },
      { label: 'Quit Leader Harness', click: () => ((quitting = true), app.quit()) },
    ])
  );
}

function notify({ title, body, route }) {
  if (!store.get().settings.notifications || !Notification.isSupported()) return;
  const n = new Notification({ title, body: body || '', icon: path.join(ROOT, 'resources', 'icon.png') });
  n.on('click', () => showWindow(route));
  n.show();
}

// ---------------------------------------------------------------- styles

function userStylesDir() {
  return path.join(app.getPath('userData'), 'styles');
}

function readStyles(dir, builtin) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        return { ...JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), builtin };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function listStyles() {
  const builtin = readStyles(BUILTIN_STYLES, true).sort((a, b) => (a.order || 99) - (b.order || 99));
  return [...builtin, ...readStyles(userStylesDir(), false)];
}

// ---------------------------------------------------------------- snapshot

// What the renderer sees: state plus derived fields it should not compute itself.
function snapshot() {
  const s = store.get();
  return {
    ...s,
    officials: s.officials.map((o) => ({
      ...o,
      nextBriefingAt: o.status === 'active' ? nextDue(o.briefingCadence, o.lastBriefingAt) : null,
      nextWorkAt: o.status === 'active' ? nextDue(o.workCadence, o.lastWorkAt) : null,
    })),
    authority: Object.fromEntries(Object.entries(AUTHORITY).map(([k, v]) => [k, { label: v.label, summary: v.summary }])),
    claudeFound: Boolean(findClaude(s.settings.claudePath)),
  };
}

let pushTimer = null;
function pushState() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    refreshTrayMenu();
    if (win && !win.isDestroyed()) win.webContents.send('state', snapshot());
  }, 60);
}

// ---------------------------------------------------------------- officials

function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'official';
}

function spawnOfficial(input) {
  const officialId = id('off');
  const homeDir = path.join(app.getPath('userData'), 'officials', `${slug(input.name)}-${officialId.slice(4)}`);
  fs.mkdirSync(homeDir, { recursive: true });

  const projectPath = input.projectPath?.trim() ? path.resolve(input.projectPath.trim()) : null;
  if (projectPath && !fs.existsSync(projectPath)) throw new Error(`Project folder not found: ${projectPath}`);
  const wikiRoot = projectPath || homeDir;
  const projectName = projectPath ? displayName(path.basename(projectPath)) : input.name;
  const wiki = ensureWiki({ root: wikiRoot, projectName, description: input.remit });
  if (projectPath && input.installMandate) installMandate(projectPath, wiki.projectName);

  const official = {
    id: officialId,
    name: input.name.trim(),
    title: input.title.trim(),
    remit: input.remit.trim(),
    projectPath,
    homeDir,
    wikiDir: wiki.wikiDir,
    wikiCreated: wiki.created,
    authority: AUTHORITY[input.authority] ? input.authority : 'observe',
    model: input.model || '',
    style: input.style || '',
    briefingCadence: input.briefingCadence || { mode: 'daily', time: '08:00' },
    workCadence: input.workCadence || { mode: 'manual' },
    decisionWindowMin: Number(input.decisionWindowMin) || 240,
    emblem: input.emblem || null,
    status: 'active',
    createdAt: new Date().toISOString(),
    lastBriefingAt: null,
    lastWorkAt: new Date().toISOString(),
  };
  store.update((s) => {
    s.officials.push(official);
    // The welcome event ("The Cabinet Is Empty") is answered by appointing someone.
    for (const d of s.decisions) if (d.sample && d.status === 'pending') Object.assign(d, { status: 'decided', resolvedAt: official.createdAt });
  });
  // A new official briefs straight away so the Leader sees it working.
  if (input.briefNow !== false) {
    store.update(() => (official.lastBriefingAt = new Date().toISOString()));
    scheduler.enqueue(official, 'briefing', { title: 'First briefing' });
    scheduler.pump();
  }
  return official;
}

const EDITABLE = ['name', 'title', 'remit', 'authority', 'model', 'style', 'briefingCadence', 'workCadence', 'decisionWindowMin', 'emblem'];

// ---------------------------------------------------------------- IPC

function registerIpc() {
  const handle = (channel, fn) =>
    ipcMain.handle(channel, async (_e, ...args) => {
      try {
        return { ok: true, value: await fn(...args) };
      } catch (err) {
        console.error(channel, err);
        return { ok: false, error: err.message };
      }
    });

  handle('state:get', () => snapshot());
  handle('styles:list', () => listStyles());
  handle('styles:save', (style) => {
    const dir = userStylesDir();
    fs.mkdirSync(dir, { recursive: true });
    const clean = {
      id: style.id && !listStyles().some((s) => s.builtin && s.id === style.id) ? style.id : `custom-${slug(style.name)}-${Date.now().toString(36)}`,
      name: String(style.name || 'Custom style').slice(0, 60),
      description: String(style.description || ''),
      layout: style.layout,
      base: style.base || null,
      vars: style.vars || {},
      css: String(style.css || ''),
    };
    fs.writeFileSync(path.join(dir, `${clean.id}.json`), JSON.stringify(clean, null, 2));
    return clean;
  });
  handle('styles:delete', (styleId) => {
    const file = path.join(userStylesDir(), `${path.basename(styleId)}.json`);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return true;
  });

  handle('dialog:folder', async () => {
    const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'], title: 'Choose the project this official will manage' });
    return r.canceled ? null : r.filePaths[0];
  });
  handle('open:path', (p) => shell.openPath(p));

  handle('official:spawn', (input) => {
    if (!input?.name?.trim() || !input?.title?.trim() || !input?.remit?.trim()) throw new Error('Name, title and remit are required.');
    return spawnOfficial(input);
  });
  handle('official:update', (officialId, patch) =>
    store.update((s) => {
      const o = s.officials.find((x) => x.id === officialId);
      if (!o) throw new Error('Official not found.');
      for (const k of EDITABLE) if (k in patch) o[k] = patch[k];
      return o;
    })
  );
  handle('official:setStatus', (officialId, status) =>
    store.update((s) => {
      const o = s.officials.find((x) => x.id === officialId);
      if (o) o.status = status === 'halted' ? 'halted' : 'active';
      if (o && status === 'halted') for (const j of s.jobs) if (j.officialId === o.id && j.status === 'queued' && j.kind !== 'briefing') j.status = 'cancelled';
      return o;
    })
  );
  handle('official:dismiss', (officialId) => {
    for (const j of store.get().jobs.filter((x) => x.officialId === officialId && x.status === 'running')) scheduler.cancelJob(j.id);
    store.update((s) => {
      s.officials = s.officials.filter((o) => o.id !== officialId);
      for (const d of s.decisions) if (d.officialId === officialId && d.status === 'pending') d.status = 'withdrawn';
      for (const op of s.operations) if (op.officialId === officialId && op.status === 'active') op.status = 'cancelled';
    });
    return true;
  });
  handle('official:run', (officialId, kind) => {
    const o = store.get().officials.find((x) => x.id === officialId);
    if (!o) throw new Error('Official not found.');
    store.update(() => (kind === 'briefing' ? (o.lastBriefingAt = new Date().toISOString()) : (o.lastWorkAt = new Date().toISOString())));
    const job = scheduler.enqueue(o, kind === 'briefing' ? 'briefing' : 'work', { title: kind === 'briefing' ? 'Briefing (requested)' : 'Work session (requested)' });
    scheduler.pump();
    return job;
  });

  handle('operation:launch', ({ officialId, objective, runs }) => {
    if (!objective?.trim()) throw new Error('A big push needs an objective.');
    const op = {
      id: id('op'),
      officialId,
      objective: objective.trim(),
      runs: Math.min(50, Math.max(1, Number(runs) || 5)),
      completed: 0,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    store.update((s) => s.operations.push(op));
    scheduler.tick();
    return op;
  });
  handle('operation:cancel', (opId) =>
    store.update((s) => {
      const op = s.operations.find((o) => o.id === opId);
      if (op && op.status === 'active') op.status = 'cancelled';
      for (const j of s.jobs) if (j.operationId === opId && j.status === 'queued') j.status = 'cancelled';
      return op;
    })
  );

  handle('decision:resolve', (decisionId, choice) => {
    const d = store.get().decisions.find((x) => x.id === decisionId);
    if (d?.sample) {
      store.update(() => Object.assign(d, { status: choice.halt ? 'halted' : 'decided', resolvedAt: new Date().toISOString(), choice }));
      const option = d.options.find((o) => o.id === choice.optionId);
      return { route: option?.route || null };
    }
    return scheduler.resolve(decisionId, choice);
  });
  handle('briefing:read', (briefingId) =>
    store.update((s) => {
      const b = s.briefings.find((x) => x.id === briefingId);
      if (b) b.read = true;
    })
  );
  handle('briefing:delete', (briefingId) =>
    store.update((s) => {
      s.briefings = s.briefings.filter((b) => b.id !== briefingId);
    })
  );
  handle('job:cancel', (jobId) => scheduler.cancelJob(jobId));
  handle('settings:update', (patch) =>
    store.update((s) => {
      for (const k of ['claudePath', 'maxConcurrent', 'defaultStyle', 'notifications', 'paused', 'jobTimeoutMin']) if (k in patch) s.settings[k] = patch[k];
      if (patch.clearRateLimit) s.settings.rateLimitedUntil = null;
      return s.settings;
    })
  );
}

// ---------------------------------------------------------------- lifecycle

app.on('second-instance', () => showWindow());

app.whenReady().then(() => {
  store = new Store(app.getPath('userData'));
  if (!store.get().briefings.length && !store.get().officials.length) {
    store.update((s) => welcomeBriefing(s));
  }
  scheduler = new Scheduler(store, { notify });
  store.onChange(pushState);
  registerIpc();
  createWindow();
  createTray();
  if (process.env.LH_CAPTURE) captureRoutes(process.env.LH_CAPTURE);
  else scheduler.start();
});

async function captureRoutes(dir) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  fs.mkdirSync(dir, { recursive: true });
  await new Promise((r) => win.webContents.once('did-finish-load', r));
  const routes = (process.env.LH_ROUTES || '#/briefings').split(/\r?\n/).filter(Boolean);
  for (const [i, route] of routes.entries()) {
    const bar = route.indexOf('|');
    const [hash, js] = bar < 0 ? [route, ''] : [route.slice(0, bar), route.slice(bar + 1)];
    await win.webContents.executeJavaScript(`location.hash = ${JSON.stringify(hash)}`);
    await wait(900);
    if (js) {
      await win.webContents.executeJavaScript(js).catch((e) => console.error(e));
      await wait(900);
    }
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(dir, `${String(i).padStart(2, '0')}.png`), img.toPNG());
  }
  quitting = true;
  app.quit();
}

app.on('before-quit', () => {
  quitting = true;
  scheduler?.stop();
  store?.saveNow();
});

app.on('window-all-closed', () => {
  // Stay alive in the tray.
});
