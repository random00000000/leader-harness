export const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function relTime(iso, now = Date.now()) {
  if (!iso) return 'never';
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);
  const units = [
    ['day', 86400000],
    ['hour', 3600000],
    ['minute', 60000],
  ];
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  for (const [unit, ms] of units) if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
  return diff >= 0 ? 'in under a minute' : 'just now';
}

export function shortTime(iso) {
  const d = new Date(iso);
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function duration(ms) {
  if (!ms) return '–';
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function compact(n) {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);
}

export function cadenceLabel(c) {
  if (!c || c.mode === 'manual') return 'On order only';
  if (c.mode === 'daily') return `Daily at ${c.time}`;
  const m = Number(c.minutes);
  if (m % 1440 === 0) return m === 1440 ? 'Every day' : `Every ${m / 1440} days`;
  if (m % 60 === 0) return m === 60 ? 'Every hour' : `Every ${m / 60} hours`;
  return `Every ${m} min`;
}

function hash(str) {
  let h = 2166136261;
  for (const ch of String(str)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

const HERALD = [
  ['#7a1f1f', '#e2c071'],
  ['#1f3d7a', '#e8ecf2'],
  ['#1f5a3a', '#e2c071'],
  ['#4a2a6b', '#e2c071'],
  ['#2b2f36', '#d6b25e'],
  ['#6b3a1f', '#f1e2c0'],
];

// A heraldic shield with initials: the official's portrait.
export function emblem(name, size = 44) {
  const h = hash(name);
  const [field, charge] = HERALD[h % HERALD.length];
  const initials = String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
  const pattern = h % 3;
  const deco =
    pattern === 0
      ? `<path d="M6 6 L94 94" stroke="${charge}" stroke-opacity=".18" stroke-width="18"/>`
      : pattern === 1
        ? `<rect x="6" y="6" width="88" height="34" fill="${charge}" fill-opacity=".14"/>`
        : `<path d="M50 6 V110" stroke="${charge}" stroke-opacity=".16" stroke-width="22"/>`;
  return `<svg class="emblem" width="${size}" height="${size * 1.12}" viewBox="0 0 100 112" aria-hidden="true">
    <defs><clipPath id="sh${h}"><path d="M6 6 H94 V56 C94 84 72 100 50 108 C28 100 6 84 6 56 Z"/></clipPath></defs>
    <g clip-path="url(#sh${h})"><rect width="100" height="112" fill="${field}"/>${deco}</g>
    <path d="M6 6 H94 V56 C94 84 72 100 50 108 C28 100 6 84 6 56 Z" fill="none" stroke="${charge}" stroke-width="4"/>
    <text x="50" y="66" text-anchor="middle" font-family="Bahnschrift, 'Segoe UI', sans-serif" font-weight="700" font-size="${initials.length > 1 ? 34 : 42}" fill="${charge}">${esc(initials)}</text>
  </svg>`;
}

export function toast(message, kind = 'info') {
  const host = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => el.classList.add('out'), 3800);
  setTimeout(() => el.remove(), 4300);
}
