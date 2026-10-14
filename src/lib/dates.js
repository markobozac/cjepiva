/**
 * Date helpers for the vaccination calculator.
 * All dates are local calendar dates (no time component) to avoid TZ drift.
 */

/** Parse "YYYY-MM-DD" (from <input type="date">) into a local Date at midnight. */
export function parseISODate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.getMonth() === +m[2] - 1 ? d : null;
}

export function toISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function today() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

/** Add months, clamping to the last day of the target month (31.1. + 1m → 28./29.2.). */
export function addMonths(date, months) {
  const y = date.getFullYear();
  const m = date.getMonth() + months;
  const lastDay = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(date.getDate(), lastDay));
}

export function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/**
 * Parse an offset string like "2m", "6w", "0d", "5y", "12m+6w", "4y+6m".
 * Returns { months, days }.
 */
export function parseOffset(str) {
  let months = 0;
  let days = 0;
  for (const part of String(str).split('+')) {
    const m = /^(\d+(?:\.\d+)?)([dwmy])$/.exec(part.trim());
    if (!m) throw new Error(`Neispravan pomak: ${str}`);
    const n = +m[1];
    if (m[2] === 'd') days += n;
    if (m[2] === 'w') days += n * 7;
    if (m[2] === 'm') months += n;
    if (m[2] === 'y') months += n * 12;
  }
  return { months, days };
}

export function applyOffset(birth, str) {
  const { months, days } = parseOffset(str);
  return addDays(addMonths(birth, months), days);
}

/** Croatian plural form picker: (1, 'mjesec', 'mjeseca', 'mjeseci'). */
export function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** Human-readable age for an offset string, e.g. "2m" → "2 mjeseca", "0d" → "Rođenje". */
export function offsetLabel(str) {
  const { months, days } = parseOffset(str);
  if (!months && !days) return 'Rođenje';
  const parts = [];
  if (months) {
    if (months >= 24 || (months >= 12 && months % 12 === 0)) {
      const y = Math.floor(months / 12);
      const rest = months % 12;
      parts.push(`${y} ${plural(y, 'godina', 'godine', 'godina')}`);
      if (rest) parts.push(`${rest} ${plural(rest, 'mjesec', 'mjeseca', 'mjeseci')}`);
    } else {
      parts.push(`${months} ${plural(months, 'mjesec', 'mjeseca', 'mjeseci')}`);
    }
  }
  if (days) {
    const w = days % 7 === 0 ? days / 7 : null;
    parts.push(w ? `${w} ${plural(w, 'tjedan', 'tjedna', 'tjedana')}` : `${days} ${plural(days, 'dan', 'dana', 'dana')}`);
  }
  return parts.join(' i ');
}

/** Current age of the child as a friendly string. */
export function ageNow(birth, ref = today()) {
  if (ref < birth) {
    const d = Math.round((birth - ref) / 86400000);
    return `rođenje za ${d} ${plural(d, 'dan', 'dana', 'dana')}`;
  }
  let months = (ref.getFullYear() - birth.getFullYear()) * 12 + (ref.getMonth() - birth.getMonth());
  if (ref.getDate() < birth.getDate()) months--;
  if (months < 1) {
    const d = Math.round((ref - birth) / 86400000);
    return `${d} ${plural(d, 'dan', 'dana', 'dana')}`;
  }
  if (months < 24) return `${months} ${plural(months, 'mjesec', 'mjeseca', 'mjeseci')}`;
  const y = Math.floor(months / 12);
  return `${y} ${plural(y, 'godina', 'godine', 'godina')}`;
}

const fmtLong = new Intl.DateTimeFormat('hr-HR', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtShort = new Intl.DateTimeFormat('hr-HR', { day: 'numeric', month: 'numeric', year: 'numeric' });
const fmtMonth = new Intl.DateTimeFormat('hr-HR', { month: 'long', year: 'numeric' });

export const formatLong = (d) => fmtLong.format(d);
export const formatShort = (d) => fmtShort.format(d);
/** "rujan 2032." – Intl gives genitive-free month name in hr-HR with month+year. */
export const formatMonth = (d) => fmtMonth.format(d);

export function daysBetween(a, b) {
  return Math.round((b - a) / 86400000);
}
