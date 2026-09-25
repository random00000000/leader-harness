const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ensureWiki, displayName } = require('../src/main/wiki');
const { detectRateLimit } = require('../src/main/runner');
const { tempDir } = require('./helpers');

test('folder names become Title Case display names', () => {
  assert.equal(displayName('northwind-platform'), 'Northwind Platform');
  assert.equal(displayName('northwindPlatform'), 'Northwind Platform');
  assert.equal(displayName('northwind_platform'), 'Northwind Platform');
});

test('ensureWiki creates the wiki with its fixed files', () => {
  const root = tempDir();
  const r = ensureWiki({ root, projectName: 'Tiny Project', description: 'A test project.' });
  assert.equal(r.created, true);
  assert.equal(r.wikiDir, path.join(root, 'Tiny Project - Wiki'));
  const home = fs.readFileSync(path.join(r.wikiDir, 'Wiki Home.md'), 'utf8');
  assert.match(home, /# Tiny Project — Wiki Home/);
  assert.match(home, /A test project\./);
  assert.doesNotMatch(home, /<Project>|<First System>/);
  const ledger = fs.readFileSync(path.join(r.wikiDir, 'PROMPT-LEDGER.md'), 'utf8');
  assert.match(ledger, /\| Date \| Model \| Request \| Result \(one line\) \| AI Notes \| Human Notes \|/);
  assert.ok(fs.statSync(path.join(r.wikiDir, 'Systems')).isDirectory());
});

test('ensureWiki reuses an existing wiki instead of creating a second one', () => {
  const root = tempDir();
  const existing = path.join(root, 'Old Name - Wiki');
  fs.mkdirSync(existing);
  fs.writeFileSync(path.join(existing, 'Wiki Home.md'), '# Old Name — Wiki Home\n');
  const r = ensureWiki({ root, projectName: 'New Name' });
  assert.equal(r.created, false);
  assert.equal(r.wikiDir, existing);
  assert.equal(r.projectName, 'Old Name');
  assert.equal(fs.existsSync(path.join(root, 'New Name - Wiki')), false);
});

test('usage limits are detected with their reset time', () => {
  assert.equal(detectRateLimit('Claude AI usage limit reached|1760000000'), new Date(1760000000 * 1000).toISOString());
  const fallback = new Date(detectRateLimit("You've hit your limit · resets 3pm")).getTime();
  assert.ok(Math.abs(fallback - (Date.now() + 30 * 60e3)) < 5000, 'falls back to 30 minutes');
  assert.equal(detectRateLimit('Everything went fine'), null);
  assert.equal(detectRateLimit(''), null);
});
