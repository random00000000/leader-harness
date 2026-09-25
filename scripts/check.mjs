// Quick sanity check without launching Electron: syntax-checks every source
// file and renders the welcome briefing through every built-in style.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
let failed = 0;

for (const file of walk(join(root, 'src')).filter((f) => f.endsWith('.js'))) {
  const isModule = file.includes(`${join('src', 'renderer')}`);
  try {
    execFileSync(process.execPath, isModule ? ['--input-type=module', '--check'] : ['--check', file], {
      input: isModule ? readFileSync(file) : undefined,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (e) {
    failed++;
    console.error(`SYNTAX ${file}\n${e.stderr}`);
  }
}

// Render the welcome briefing (plus a pending decision) in every style.
const require = createRequire(import.meta.url);
const state = { settings: { claudePath: '' }, decisions: [], briefings: [] };
require(join(root, 'src', 'main', 'welcome.js')).welcomeBriefing(state);
const b = state.briefings[0];
const ctx = { from: b.from, decisions: state.decisions };
const { composeDocument } = await import(pathToFileURL(join(root, 'src', 'renderer', 'stage.js')));
for (const f of readdirSync(join(root, 'styles'))) {
  const style = JSON.parse(readFileSync(join(root, 'styles', f), 'utf8'));
  try {
    const html = composeDocument(b, style, ctx);
    if (!html.includes(b.title) && !html.includes('Welcome')) throw new Error('title missing from output');
    // Every format must let the Leader decide inside the report.
    for (const mark of ['class="lh-decision"', 'class="lh-opt rec"', 'data-confirm', 'lh-decision {']) {
      if (!html.includes(mark)) throw new Error(`in-report decision controls missing (${mark})`);
    }
    console.log(`ok   style ${style.id} (${html.length} bytes)`);
  } catch (e) {
    failed++;
    console.error(`FAIL style ${style.id}: ${e.message}`);
  }
}

// Scheduler cadence maths.
const { isDue } = require(join(root, 'src', 'main', 'scheduler.js'));
const at = (h, m = 0) => { const d = new Date(2026, 8, 24, h, m); return d; };
const cases = [
  [isDue({ mode: 'daily', time: '08:00' }, null, at(9)), true],
  [isDue({ mode: 'daily', time: '08:00' }, null, at(7)), false],
  [isDue({ mode: 'daily', time: '08:00' }, at(8, 1).toISOString(), at(12)), false],
  [isDue({ mode: 'interval', minutes: 60 }, at(8).toISOString(), at(8, 59)), false],
  [isDue({ mode: 'interval', minutes: 60 }, at(8).toISOString(), at(9)), true],
  [isDue({ mode: 'manual' }, null, at(9)), false],
];
cases.forEach(([got, want], i) => {
  if (got !== want) { failed++; console.error(`FAIL cadence case ${i}: got ${got}`); }
});
console.log(failed ? `\n${failed} problem(s)` : '\nall checks passed');
process.exit(failed ? 1 : 0);
