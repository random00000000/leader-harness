// Builds a versioned, smoke-tested release of Leader Harness next to the repo
// and points the "Leader Harness" shortcut at it. See PLAN - Reliability.
//
//   npm run release            build, smoke-test, tag and switch to the release
//   npm run release -- --dev   same, but allowed from a branch or dirty tree
//                              (no tag; for testing the release process itself)
//   npm run rollback           point the shortcut at the previous release
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
// Builds live outside the repo (which may sit in a synced folder such as
// OneDrive; each build is ~370 MB). Only the shortcut sits in the repo.
// It must be %LOCALAPPDATA%\Programs: folders created directly under
// %LOCALAPPDATA% are unreadable to Chromium's sandboxed processes, and the
// app crashes at startup there (FACT, 2026-09-25).
const RELEASES = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), '.local', 'share'), 'Programs', 'Leader Harness', 'releases');
const SHORTCUT = path.join(ROOT, 'Leader Harness.lnk');
const KEEP = 3;

const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();
const say = (msg) => console.log(`\n▸ ${msg}`);
const fail = (msg) => {
  console.error(`\n✖ ${msg}`);
  process.exit(1);
};

function exePath(version) {
  return path.join(RELEASES, `v${version}`, 'win-unpacked', 'Leader Harness.exe');
}

function versions() {
  if (!fs.existsSync(RELEASES)) return [];
  const cmp = (a, b) => {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
    return 0;
  };
  return fs
    .readdirSync(RELEASES)
    .filter((d) => /^v\d+\.\d+\.\d+$/.test(d) && fs.existsSync(exePath(d.slice(1))))
    .map((d) => d.slice(1))
    .sort(cmp);
}

function currentVersion() {
  try {
    return fs.readFileSync(path.join(RELEASES, 'current.txt'), 'utf8').trim();
  } catch {
    return null;
  }
}

function pointShortcutAt(version) {
  const target = exePath(version);
  const ps = `$s = (New-Object -ComObject WScript.Shell).CreateShortcut('${SHORTCUT.replace(/'/g, "''")}');
$s.TargetPath = '${target.replace(/'/g, "''")}';
$s.WorkingDirectory = '${path.dirname(target).replace(/'/g, "''")}';
$s.Description = 'Leader Harness v${version}';
$s.IconLocation = '${target.replace(/'/g, "''")},0';
$s.Save()`;
  sh('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps]);
  fs.writeFileSync(path.join(RELEASES, 'current.txt'), `${version}\n`);
}

// Launch the packaged app in capture mode against throwaway data: it must
// start, render every screen, and exit cleanly. The scheduler never starts.
function smokeTest(version) {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'lh-smoke-data-'));
  const shots = fs.mkdtempSync(path.join(os.tmpdir(), 'lh-smoke-shots-'));
  const routes = ['#/briefings', '#/decisions', '#/officials', '#/appoint', '#/activity', '#/studio', '#/settings'];
  const r = spawnSync(exePath(version), [], {
    env: { ...process.env, LH_USER_DATA: data, LH_CAPTURE: shots, LH_ROUTES: routes.join('\n') },
    timeout: 120000,
    encoding: 'utf8',
  });
  const captured = fs.existsSync(shots) ? fs.readdirSync(shots).filter((f) => f.endsWith('.png')) : [];
  const tooSmall = captured.filter((f) => fs.statSync(path.join(shots, f)).size < 20000);
  if (r.status !== 0 || captured.length !== routes.length || tooSmall.length) {
    fail(`Smoke test failed for v${version}: exit ${r.status}, ${captured.length}/${routes.length} screens, ${tooSmall.length} blank.\n${(r.stderr || '').slice(-1500)}`);
  }
  fs.rmSync(data, { recursive: true, force: true });
  fs.rmSync(shots, { recursive: true, force: true });
}

function prune() {
  const all = versions();
  const current = currentVersion();
  for (const v of all.slice(0, Math.max(0, all.length - KEEP))) {
    if (v === current) continue;
    fs.rmSync(path.join(RELEASES, `v${v}`), { recursive: true, force: true });
    console.log(`  removed old release v${v}`);
  }
}

function release() {
  const dev = process.argv.includes('--dev');
  const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

  say(`Releasing v${version}${dev ? ' (dev: no tag)' : ''}`);
  if (!dev) {
    if (sh('git', ['status', '--porcelain'])) fail('The working tree has uncommitted changes. Release only from a clean main.');
    if (sh('git', ['rev-parse', '--abbrev-ref', 'HEAD']) !== 'main') fail('Release only from main.');
    sh('git', ['fetch', '--quiet', 'origin']);
    if (sh('git', ['rev-parse', 'HEAD']) !== sh('git', ['rev-parse', 'origin/main'])) fail('main is not the same as origin/main. Pull or push first.');
    const tagged = spawnSync('git', ['rev-parse', '--verify', '--quiet', `refs/tags/v${version}`], { cwd: ROOT, encoding: 'utf8' });
    if (tagged.status === 0 && tagged.stdout.trim() !== sh('git', ['rev-parse', 'HEAD^{commit}'])) {
      fail(`v${version} is already tagged on another commit. Bump the version in package.json (in a pull request) first.`);
    }
  }

  say('Checks');
  const check = spawnSync('npm run check', { cwd: ROOT, stdio: 'inherit', shell: true });
  if (check.status !== 0) fail('npm run check failed.');

  say('Build');
  const out = path.join(RELEASES, `v${version}`);
  fs.rmSync(out, { recursive: true, force: true });
  // The output path contains a space ("Leader Harness"), so it is quoted for the shell.
  const build = spawnSync(`npx electron-builder --win --dir "--config.directories.output=${out}"`, { cwd: ROOT, stdio: 'inherit', shell: true });
  if (build.status !== 0 || !fs.existsSync(exePath(version))) fail('The build failed.');

  say('Smoke test');
  smokeTest(version);

  if (!dev) {
    say('Tag');
    spawnSync('git', ['tag', '-a', `v${version}`, '-m', `Leader Harness v${version}`], { cwd: ROOT, stdio: 'inherit' });
  }

  say('Switch');
  const previous = currentVersion();
  pointShortcutAt(version);
  prune();
  console.log(`\n✔ Leader Harness v${version} is current${previous && previous !== version ? ` (was v${previous}; "npm run rollback" returns to it)` : ''}.`);
  console.log(`  Shortcut: ${SHORTCUT}`);
  console.log('  Quit the running app from its tray icon, then open the shortcut to use the new version.');
}

function rollback() {
  const current = currentVersion();
  const older = versions().filter((v) => v !== current);
  const target = current ? older.filter((v) => versions().indexOf(v) < versions().indexOf(current)).pop() : older.pop();
  if (!target) fail('There is no earlier release to roll back to.');
  pointShortcutAt(target);
  console.log(`✔ Rolled back to v${target} (was v${current}). Quit the app from its tray icon and reopen the shortcut.`);
}

if (process.argv.includes('--rollback')) rollback();
else release();
