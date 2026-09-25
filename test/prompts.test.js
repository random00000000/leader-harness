const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { toolsFor, persona, AUTHORITY } = require('../src/main/prompts');
const { makeOfficial, tempDir } = require('./helpers');

test('Observe may edit only inside its wiki, by a relative path', () => {
  const root = tempDir();
  const official = makeOfficial({ authority: 'observe', wikiDir: path.join(root, 'Tiny Project - Wiki') });
  const { allow, deny } = toolsFor(official, root);
  assert.ok(allow.includes('Edit(Tiny Project - Wiki/**)'));
  assert.ok(allow.includes('Write(Tiny Project - Wiki/**)'));
  assert.ok(!allow.includes('Edit'), 'no unscoped Edit');
  assert.ok(!allow.includes('Write'), 'no unscoped Write');
  assert.ok(!allow.includes('Bash'), 'no unrestricted shell');
  assert.deepEqual(deny, []);
});

test('Observe refuses a wiki outside the working directory', () => {
  const official = makeOfficial({ authority: 'observe', wikiDir: path.join(tempDir(), 'Elsewhere - Wiki') });
  assert.throws(() => toolsFor(official, tempDir()), /must be inside the working directory/);
});

test('Build cannot push, merge, rebase or hard-reset', () => {
  const { allow, deny } = toolsFor(makeOfficial({ authority: 'build' }), tempDir());
  assert.ok(allow.includes('Bash'));
  for (const rule of ['Bash(git push *)', 'Bash(git merge *)', 'Bash(git rebase *)', 'Bash(git reset --hard *)']) {
    assert.ok(deny.includes(rule), `denies ${rule}`);
  }
});

test('Ship may push but never force-push', () => {
  const { deny } = toolsFor(makeOfficial({ authority: 'ship' }), tempDir());
  assert.ok(!deny.includes('Bash(git push *)'));
  assert.ok(deny.includes('Bash(git push --force *)'));
  assert.ok(deny.includes('Bash(git push -f *)'));
});

test('an unknown authority falls back to Observe', () => {
  const root = tempDir();
  const official = makeOfficial({ authority: 'emperor', wikiDir: path.join(root, 'W - Wiki') });
  assert.ok(!toolsFor(official, root).allow.includes('Bash'));
  assert.ok(AUTHORITY.observe.wikiOnly);
});

test('every persona carries the workspace scope rule', () => {
  for (const authority of Object.keys(AUTHORITY)) {
    const text = persona(makeOfficial({ authority }));
    assert.match(text, /Stay inside your working directory/);
    assert.match(text, /never ask questions/);
  }
});
