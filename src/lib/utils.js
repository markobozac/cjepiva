/**
 * Small shared helpers: text normalisation (diacritic-insensitive search),
 * HTML escaping and highlight rendering.
 */

/** Lowercase + strip Croatian (and other) diacritics so "zausnjaci" matches "zaušnjaci". */
export function normalize(str = '') {
  return String(str)
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, (c) => ESC[c]);
}

/**
 * Escape `text` and wrap every occurrence of any query token in <mark>,
 * matching diacritic-insensitively while preserving the original characters.
 */
export function highlight(text = '', tokens = []) {
  if (!tokens.length) return escapeHtml(text);
  // Build a normalized copy with a 1:1 index map back to the original string.
  const map = [];
  let norm = '';
  for (let i = 0; i < text.length; i++) {
    const n = normalize(text[i]) || (text[i] === ' ' ? ' ' : '');
    for (let k = 0; k < n.length; k++) {
      norm += n[k];
      map.push(i);
    }
  }
  const ranges = [];
  for (const t of tokens) {
    let from = 0;
    let idx;
    while (t && (idx = norm.indexOf(t, from)) !== -1) {
      ranges.push([map[idx], map[idx + t.length - 1] + 1]);
      from = idx + t.length;
    }
  }
  if (!ranges.length) return escapeHtml(text);
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [ranges[0]];
  for (const r of ranges.slice(1)) {
    const last = merged[merged.length - 1];
    if (r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push(r);
  }
  let out = '';
  let pos = 0;
  for (const [s, e] of merged) {
    out += escapeHtml(text.slice(pos, s)) + '<mark>' + escapeHtml(text.slice(s, e)) + '</mark>';
    pos = e;
  }
  return out + escapeHtml(text.slice(pos));
}

export const $ = (sel, root = document) => root.querySelector(sel);
