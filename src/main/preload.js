// The only bridge between the renderer and the main process.
const { contextBridge, ipcRenderer } = require('electron');

const CHANNELS = new Set([
  'state:get',
  'styles:list',
  'styles:save',
  'styles:delete',
  'dialog:folder',
  'open:path',
  'official:spawn',
  'official:update',
  'official:setStatus',
  'official:dismiss',
  'official:run',
  'operation:launch',
  'operation:cancel',
  'decision:resolve',
  'briefing:read',
  'briefing:delete',
  'job:cancel',
  'settings:update',
]);

contextBridge.exposeInMainWorld('lh', {
  async call(channel, ...args) {
    if (!CHANNELS.has(channel)) throw new Error(`Unknown channel ${channel}`);
    const r = await ipcRenderer.invoke(channel, ...args);
    if (!r.ok) throw new Error(r.error);
    return r.value;
  },
  onState(cb) {
    ipcRenderer.on('state', (_e, state) => cb(state));
  },
  onNavigate(cb) {
    ipcRenderer.on('navigate', (_e, route) => cb(route));
  },
});
