// Every Senior Official keeps a Karpathy-style wiki (see the project's own
// "Leader Harness - Wiki"). If the official is pointed at a project, the wiki
// lives in that project; otherwise it lives in the official's home folder.
const fs = require('fs');
const path = require('path');

const TEMPLATES = path.join(__dirname, '..', '..', 'resources', 'wiki-templates');

// "victory-marche" / "victoryMarche" / "victory_marche" -> "Victory Marche"
function displayName(folderName) {
  return folderName
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

function findExistingWiki(root) {
  try {
    const entry = fs
      .readdirSync(root, { withFileTypes: true })
      .find((e) => e.isDirectory() && / - Wiki$/.test(e.name) && fs.existsSync(path.join(root, e.name, 'Wiki Home.md')));
    return entry ? path.join(root, entry.name) : null;
  } catch {
    return null;
  }
}

function fill(template, project) {
  return template.replace(/<Project>/g, project);
}

// Create the wiki if missing. Returns { wikiDir, projectName, created }.
function ensureWiki({ root, projectName, description }) {
  const existing = findExistingWiki(root);
  if (existing) return { wikiDir: existing, projectName: path.basename(existing).replace(/ - Wiki$/, ''), created: false };

  const wikiDir = path.join(root, `${projectName} - Wiki`);
  fs.mkdirSync(path.join(wikiDir, 'Systems'), { recursive: true });

  let home = fill(fs.readFileSync(path.join(TEMPLATES, 'Wiki Home.md'), 'utf8'), projectName);
  home = home
    .replace(/<One honest paragraph[^>]*>/, description || `${projectName}, managed by a Senior Official in the Leader Harness.`)
    .replace(/^- \[\[Systems\/<First System>.*\n/m, '')
    .replace(/^- <one link per Systems page.*\n/m, '');
  fs.writeFileSync(path.join(wikiDir, 'Wiki Home.md'), home);
  fs.writeFileSync(
    path.join(wikiDir, 'PROMPT-LEDGER.md'),
    fill(fs.readFileSync(path.join(TEMPLATES, 'PROMPT-LEDGER.md'), 'utf8'), projectName)
  );
  return { wikiDir, projectName, created: true };
}

// Optionally append the wiki mandate to the project's AGENTS.md so that
// interactive agent sessions (not just the official) maintain the wiki too.
function installMandate(projectRoot, projectName) {
  const agentsFile = path.join(projectRoot, 'AGENTS.md');
  const existing = fs.existsSync(agentsFile) ? fs.readFileSync(agentsFile, 'utf8') : '';
  if (existing.includes('## Persistent Project Wiki')) return false;
  const inject = fs.readFileSync(path.join(TEMPLATES, 'INJECT-AGENTS.md'), 'utf8');
  const mandate = fill(inject.slice(inject.indexOf('## Persistent Project Wiki')), projectName);
  fs.writeFileSync(agentsFile, (existing ? existing.trimEnd() + '\n\n' : '') + mandate);
  return true;
}

module.exports = { displayName, ensureWiki, installMandate, findExistingWiki };
