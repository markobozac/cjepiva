/**
 * Shared constants: age groups and category metadata.
 */

export const AGE_GROUPS = [
  { key: 'rodenje', label: 'Rođenje', sub: 'rodilište', track: 'Rođ.', quick: 'Novorođenče', title: 'Pri rođenju (rodilište)' },
  { key: '2m', label: '2 mj.', sub: 'mjeseca', track: '2 mj', quick: '2 mjeseca', title: 'S 2 mjeseca' },
  { key: '4m', label: '4 mj.', sub: 'mjeseca', track: '4 mj', quick: '4 mjeseca', title: 'S 4 mjeseca' },
  { key: '6m', label: '6 mj.', sub: 'mjeseci', track: '6 mj', quick: '6 mjeseci', title: 'Sa 6 mjeseci' },
  { key: '12m', label: '12 mj.', sub: '1 godina', track: '1 g', quick: '1 godina', title: 'S 12 mjeseci (1 godina)' },
  { key: 'predskolska', label: '2–6 g.', sub: 'predškolska', track: '2–6 g', quick: 'Predškolsko', title: 'U predškolskoj dobi (2–6 godina)' },
  { key: 'skolska', label: 'Škola', sub: 'školska dob', track: 'Škola', quick: 'Školsko', title: 'U školskoj dobi' },
];

export const AGE_MAP = Object.fromEntries(AGE_GROUPS.map((a) => [a.key, a]));

export const CATEGORIES = {
  obvezno: { label: 'Obvezno (HZZO)', short: 'Obvezno', icon: '🛡️', order: 0 },
  preporuceno_besplatno: { label: 'Preporučeno · besplatno', short: 'Preporučeno', icon: '💜', order: 1 },
  dodatno: { label: 'Dodatno / Preporučeno', short: 'Dodatno', icon: '✨', order: 2 },
};

/** Type filter options. "dodatno" also includes free-but-voluntary vaccines (HPV). */
export const TYPE_FILTERS = [
  { key: 'sve', label: 'Sva', aria: 'Sva cjepiva' },
  { key: 'obvezno', label: 'Obvezna', aria: 'Obvezna cjepiva (pokriva HZZO)' },
  { key: 'dodatno', label: 'Dodatna', aria: 'Dodatna i preporučena cjepiva' },
];

export function matchesType(vaccine, type) {
  if (type === 'sve') return true;
  if (type === 'obvezno') return vaccine.category === 'obvezno';
  return vaccine.category !== 'obvezno';
}
