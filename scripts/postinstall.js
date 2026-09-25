// npm 11 can skip Electron's own postinstall, so we run its binary download
// ourselves. CI sets ELECTRON_SKIP_BINARY_DOWNLOAD=1: the checks never launch
// Electron, so the ~100 MB download is skipped there.
if (process.env.ELECTRON_SKIP_BINARY_DOWNLOAD) {
  console.log('Skipping the Electron binary download (ELECTRON_SKIP_BINARY_DOWNLOAD is set).');
} else {
  require('electron/install.js');
}
