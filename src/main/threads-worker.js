// Runs the thread scan in an Electron utility process, so reading hundreds of
// session files never blocks the app.
const { scanThreads } = require('./threads');

process.parentPort.once('message', (e) => {
  try {
    process.parentPort.postMessage({ ok: true, result: scanThreads(e.data || {}) });
  } catch (err) {
    process.parentPort.postMessage({ ok: false, error: err.message });
  }
});
