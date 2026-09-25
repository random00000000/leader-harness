// Renders a briefing into a sandboxed iframe using a style (vars + css) on top
// of a layout (structure + base css). The iframe has scripts but no same-origin
// access, so custom styles can never reach the app.
import * as deck from './layouts/deck.js';
import * as dossier from './layouts/dossier.js';
import * as redbox from './layouts/redbox.js';
import * as tablet from './layouts/tablet.js';
import { BRIDGE_SCRIPT, DECISION_CSS } from './layouts/common.js';

export const LAYOUTS = {
  deck: { name: 'Slide Deck', module: deck },
  dossier: { name: 'Dossier', module: dossier },
  redbox: { name: 'Red Box', module: redbox },
  tablet: { name: 'Daily Brief', module: tablet },
};

function varsCss(vars) {
  const body = Object.entries(vars || {})
    .filter(([k]) => /^--[\w-]+$/.test(k))
    .map(([k, v]) => `${k}: ${String(v).replace(/[;{}<]/g, '')};`)
    .join(' ');
  return `:root { ${body} }`;
}

export function composeDocument(briefing, style, ctx) {
  const layout = (LAYOUTS[style.layout] || LAYOUTS.dossier).module;
  // Decision controls first, so layouts and styles can restyle them.
  const css = `${DECISION_CSS}\n${style.replaceLayoutCss ? '' : layout.css}\n${varsCss(style.vars)}\n${style.css || ''}`.replace(/<\/style/gi, '');
  const html = layout.render(briefing, ctx);
  // LH_FOCUS names a decision to bring into view (e.g. the one just taken).
  const focus = `window.LH_FOCUS = ${JSON.stringify(ctx.focus || null).replace(/</g, '\\u003c')};`;
  const script = `${focus}\n${BRIDGE_SCRIPT}\n${layout.script || ''}\nif (window.LH_FOCUS) document.querySelector('[data-decision-block="' + window.LH_FOCUS + '"]')?.scrollIntoView({ block: 'center' });`;
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; font-src data:">
<style>${css}</style></head><body>${html}<script>${script}</script></body></html>`;
}

export function mountStage(container, briefing, style, ctx) {
  const frame = document.createElement('iframe');
  frame.className = 'stage-frame';
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.setAttribute('title', `${briefing.title} (${style.name})`);
  frame.srcdoc = composeDocument(briefing, style, ctx);
  container.replaceChildren(frame);
  frame.addEventListener('load', () => frame.contentWindow?.focus());
  return frame;
}
