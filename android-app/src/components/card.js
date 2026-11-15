/**
 * Vaccine card component:
 * Clean, uncluttered design showing Title + Badge + Disease + Key Benefit (Description).
 * Details (Dose schedule, Age track, Cost, Notes) are expandable on click or hover.
 */
import { AGE_GROUPS, CATEGORIES } from '../lib/constants.js';
import { escapeHtml, highlight } from '../lib/utils.js';

const ICONS = {
  age: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  doses: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="m14 4 6 6M17 7l-9.5 9.5-3 .5.5-3L14.5 4.5M10 9l2 2M8 11l2 2M4 20l3-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  cost: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="3" y="6" width="18" height="13" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3 10h18M16 15h2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
};

export function renderCard(v, { tokens = [], currentAge = 'sve', index = 0 } = {}) {
  const cat = CATEGORIES[v.category];
  const h = (t) => highlight(t, tokens);
  const ageNames = AGE_GROUPS.filter((a) => v.age_groups.includes(a.key))
    .map((a) => a.title.toLowerCase())
    .join(', ');

  const track = AGE_GROUPS.map((a) => {
    const on = v.age_groups.includes(a.key);
    const cls = [on && 'on', on && currentAge === a.key && 'current'].filter(Boolean).join(' ');
    return `<li class="${cls}">${a.track}</li>`;
  }).join('');

  const subtitle = v.short_label && v.short_label !== v.name ? ` <span class="card-sub">(${h(v.short_label)})</span>` : '';

  return `
  <article class="card card--${v.category}" style="--i:${index}" id="cjepivo-${v.id}" aria-labelledby="title-${v.id}">
    <div class="card-top">
      <span class="badge badge--${v.category}">${cat.label}</span>
      <span class="card-icon" aria-hidden="true">${cat.icon}</span>
    </div>

    <header>
      <h3 class="card-title" id="title-${v.id}">${h(v.name)}${subtitle}</h3>
      <p class="card-disease">${h(v.disease)}</p>
      ${v.brands ? `<p class="card-brands">${h(v.brands)}</p>` : ''}
    </header>

    <!-- Glavna poruka / Benefit (uvijek vidljivo) -->
    <p class="card-desc">${h(v.description)}</p>

    <!-- Proširivi detalji na klik ili hover -->
    <details class="card-details">
      <summary class="card-toggle-btn">
        <span class="toggle-text">Detalji i raspored</span>
        <svg class="toggle-chevron" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </summary>
      
      <div class="card-extra">
        <p class="sr-only">Primjenjuje se: ${escapeHtml(ageNames)}.</p>
        <ol class="age-track" aria-hidden="true">${track}</ol>

        <dl class="card-facts">
          <div class="fact">${ICONS.age}<div><dt>Preporučena dob</dt><dd>${escapeHtml(v.age_label)}</dd></div></div>
          <div class="fact">${ICONS.doses}<div><dt>Shema cijepljenja</dt><dd>${escapeHtml(v.doses)}</dd></div></div>
          <div class="fact fact--cost">${ICONS.cost}<div><dt>Trošak / pokriće</dt><dd>${escapeHtml(v.cost_info)}</dd></div></div>
        </dl>

        ${v.notes ? `<p class="card-note"><span aria-hidden="true">💡</span><span>${escapeHtml(v.notes)}</span></p>` : ''}
      </div>
    </details>
  </article>`;
}
