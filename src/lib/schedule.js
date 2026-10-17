/**
 * Builds a personalised vaccination timeline from birth date + vaccine data.
 */
import { applyOffset, offsetLabel, today, daysBetween } from './dates.js';

/** First 1 October on/after `date` – the start of the flu vaccination season. */
function nextFluSeason(date) {
  const oct = new Date(date.getFullYear(), 9, 1);
  return date <= oct ? oct : new Date(date.getFullYear() + 1, 9, 1);
}

/**
 * RSV protection for newborns entering their first RSV season (approx. October–March):
 * born in season -> at birth (maternity ward); born April–September -> 1 October before the season.
 */
export function rsvStart(birth) {
  const m = birth.getMonth(); // 0 = Jan
  if (m >= 9 || m <= 2) return birth;
  return new Date(birth.getFullYear(), 9, 1);
}

/**
 * @param {Date} birth
 * @param {Array} vaccines full vaccine list
 * @param {Set<string>} includeIds ids of non-mandatory vaccines to include
 * @returns {Array<Group>} sorted groups of doses sharing the same date/window
 */
export function buildSchedule(birth, vaccines, includeIds) {
  const now = today();
  const doses = [];

  for (const v of vaccines) {
    const included = v.category === 'obvezno' || includeIds.has(v.id);
    if (!included || !v.schedule?.length) continue;

    for (const s of v.schedule) {
      const type = s.type || 'on';
      let start = applyOffset(birth, s.at);
      let end = s.to ? applyOffset(birth, s.to) : null;
      if (type === 'yearly') start = nextFluSeason(start);
      let ageLabel = null;
      if (s.season === 'rsv') {
        start = rsvStart(birth);
        // Measure exists only from s.from (e.g. autumn 2026) – skip for older children.
        if (s.from && start < new Date(s.from + 'T00:00:00')) continue;
        ageLabel = +start === +birth ? 'Rođenje (RSV sezona)' : 'Prije prve RSV sezone';
      }
      doses.push({
        ageLabel,
        vaccine: v,
        label: s.label,
        hint: s.hint || '',
        type,
        at: s.at,
        start,
        end,
      });
    }
  }

  // Group doses that share type + dates (e.g. all 2-month vaccines in one visit).
  const groups = new Map();
  for (const d of doses) {
    const key = `${d.type}|${+d.start}|${d.end ? +d.end : ''}|${d.ageLabel || ''}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        type: d.type,
        start: d.start,
        end: d.end,
        ageLabel: d.ageLabel || (d.type === 'yearly' ? 'Svake jeseni' : offsetLabel(d.at)),
        doses: [],
      });
    }
    groups.get(key).doses.push(d);
  }

  const list = [...groups.values()].sort((a, b) => a.start - b.start || (a.end || a.start) - (b.end || b.start));

  for (const g of list) {
    g.doses.sort((a, b) => (a.vaccine.category === 'obvezno' ? 0 : 1) - (b.vaccine.category === 'obvezno' ? 0 : 1));
    const last = g.end || g.start;
    // Yearly events never become "past" – they recur.
    if (g.type !== 'yearly' && last < now) g.status = 'past';
    else if (g.start <= now) g.status = 'due';
    else g.status = 'future';
    g.daysUntil = daysBetween(now, g.start);
  }

  const next = list.find((g) => g.status !== 'past');
  if (next) next.isNext = true;

  return list;
}
