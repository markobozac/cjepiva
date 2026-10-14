/**
 * Main application entrypoint:
 * - Load data (vaccines, faq)
 * - State management (category, age, query)
 * - URL query parameter synchronisation
 * - Sticky header observer
 * - Mount filters, search, cards, calculator, FAQ
 */
import './styles/index.css';
import './styles/calculator.css';
import vaccinesData from './data/vaccines.json';
import faqData from './data/faq.json';

import { AGE_MAP, AGE_GROUPS, matchesType } from './lib/constants.js';
import { normalize, escapeHtml, $ } from './lib/utils.js';
import { plural } from './lib/dates.js';

import { renderCard } from './components/card.js';
import { initTypeFilter, initAgeFilter } from './components/filters.js';
import { initSearch } from './components/search.js';
import { initCalculator } from './components/calculator.js';
import { renderFaq } from './components/faq.js';

// Pre-compute normalized search corpus on each vaccine
const vaccines = vaccinesData.map((v) => {
  const corpus = normalize(
    [
      v.name,
      v.short_label,
      v.disease,
      v.brands,
      v.description,
      v.notes,
      v.cost_info,
      ...(v.keywords || []),
    ]
      .filter(Boolean)
      .join(' ')
  );
  return { ...v, _corpus: corpus };
});

// App State
const state = {
  type: 'sve',       // 'sve' | 'obvezno' | 'dodatno'
  age: 'sve',        // 'sve' | 'rodenje' | '2m' | '4m' | '6m' | '12m' | 'predskolska' | 'skolska'
  query: '',
  tokens: [],
};

// DOM references
const cardGrid = $('#card-grid');
const resultsSummary = $('#results-summary');
const resetBtn = $('#reset-filters');
const emptyState = $('#empty-state');
const suggestionsEl = $('#suggestions');
const ageCallout = $('#age-callout');
const quickAgeRoot = $('#quick-age-buttons');
const controlsEl = $('#controls');

// 1. Initialise stats in hero
const obveznoCount = vaccines.filter((v) => v.category === 'obvezno').length;
const dodatnoCount = vaccines.filter((v) => v.category !== 'obvezno').length;

const statObvezno = $('#stat-obvezno');
if (statObvezno) {
  statObvezno.innerHTML = `<span class="dot"></span><div><strong>${obveznoCount}</strong><span>obveznih cjepiva</span></div>`;
}
const statDodatno = $('#stat-dodatno');
if (statDodatno) {
  statDodatno.innerHTML = `<span class="dot"></span><div><strong>${dodatnoCount}</strong><span>preporučenih</span></div>`;
}

// 2. Populate quick age buttons in hero
if (quickAgeRoot) {
  quickAgeRoot.innerHTML = AGE_GROUPS.map(
    (a) =>
      `<button type="button" class="chip" data-quick-age="${a.key}">
        <span>${escapeHtml(a.quick)}</span>
      </button>`
  ).join('');

  quickAgeRoot.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-quick-age]');
    if (btn) {
      setAge(btn.dataset.quickAge);
      $('#cjepiva')?.scrollIntoView({ behavior: 'smooth' });
    }
  });
}

// 3. Search suggestions
const SUGGESTIONS = ['hripavac', 'Rotarix', 'vodene kozice', 'Bexsero', 'krpeljni', 'pneumokok', 'Gardasil'];
if (suggestionsEl) {
  suggestionsEl.innerHTML = SUGGESTIONS.map(
    (s) => `<button type="button" class="chip" data-suggest="${s}">${escapeHtml(s)}</button>`
  ).join('');
  suggestionsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-suggest]');
    if (btn) {
      searchComponent.setQuery(btn.dataset.suggest);
    }
  });
}

// 4. Mount Filters and Search
const typeComponent = initTypeFilter($('#type-filter'), (newType) => {
  state.type = newType;
  updateUrl();
  render();
});

const ageComponent = initAgeFilter($('#age-filter'), vaccines, (newAge) => {
  state.age = newAge;
  updateUrl();
  render();
});

const searchComponent = initSearch($('#cjepiva'), ({ raw, tokens }) => {
  state.query = raw;
  state.tokens = tokens;
  updateUrl();
  render();
});

function setAge(newAge) {
  state.age = newAge;
  updateUrl();
  render();
}

function resetAllFilters() {
  state.type = 'sve';
  state.age = 'sve';
  state.query = '';
  state.tokens = [];
  searchComponent.setQuery('');
  updateUrl();
  render();
}

resetBtn?.addEventListener('click', resetAllFilters);

// 5. URL Query Sync (?vrsta=obvezno&dob=2m&q=rotarix)
function readUrl() {
  const params = new URLSearchParams(window.location.search);
  const type = params.get('vrsta');
  const age = params.get('dob');
  const q = params.get('q');

  if (type && ['sve', 'obvezno', 'dodatno'].includes(type)) {
    state.type = type;
  }
  if (age && (age === 'sve' || AGE_MAP[age])) {
    state.age = age;
  }
  if (q) {
    state.query = q;
    state.tokens = normalize(q).split(' ').filter(Boolean);
  }
}

function updateUrl() {
  const params = new URLSearchParams();
  if (state.type !== 'sve') params.set('vrsta', state.type);
  if (state.age !== 'sve') params.set('dob', state.age);
  if (state.query.trim()) params.set('q', state.query.trim());

  const str = params.toString();
  const url = str ? `${window.location.pathname}?${str}` : window.location.pathname;
  window.history.replaceState({}, '', url);
}

// 6. Sticky controls intersection observer shadow
if (controlsEl) {
  const observer = new IntersectionObserver(
    ([entry]) => {
      controlsEl.classList.toggle('is-stuck', entry.intersectionRatio < 1);
    },
    { threshold: [1] }
  );
  observer.observe(controlsEl);
}

// 7. Core filtering & rendering
function getFiltered() {
  return vaccines.filter((v) => {
    // Type filter
    if (!matchesType(v, state.type)) return false;

    // Age filter
    if (state.age !== 'sve' && !v.age_groups.includes(state.age)) return false;

    // Search query tokens
    if (state.tokens.length > 0) {
      const match = state.tokens.every((t) => v._corpus.includes(t));
      if (!match) return false;
    }

    return true;
  });
}

function render() {
  // Update control visual states
  typeComponent.update(state.type);
  ageComponent.update(state.age, state.type);

  const filtered = getFiltered();
  const isFiltered = state.type !== 'sve' || state.age !== 'sve' || state.tokens.length > 0;

  // Render Age Callout (when a specific age group is selected and no active text search)
  if (state.age !== 'sve' && state.tokens.length === 0) {
    const ageInfo = AGE_MAP[state.age];
    const obv = filtered.filter((v) => v.category === 'obvezno').length;
    const dod = filtered.length - obv;

    ageCallout.hidden = false;
    ageCallout.innerHTML = `
      <div class="age-callout-icon" aria-hidden="true">👶</div>
      <div>
        <h3>${escapeHtml(ageInfo.title)}</h3>
        <p>
          U ovoj dobi: <strong class="o">${obv} ${plural(obv, 'obvezno cjepivo', 'obvezna cjepiva', 'obveznih cjepiva')}</strong>
          ${dod > 0 ? ` i <strong class="d">${dod} ${plural(dod, 'dodatno', 'dodatna', 'dodatnih')}</strong>` : ''}.
        </p>
      </div>
    `;
  } else {
    ageCallout.hidden = true;
    ageCallout.innerHTML = '';
  }

  // Summary bar
  const total = filtered.length;
  let summaryText = `Prikazano <strong>${total}</strong> ${plural(total, 'cjepivo', 'cjepiva', 'cjepiva')}`;
  if (state.age !== 'sve') {
    summaryText += ` za <strong>${escapeHtml(AGE_MAP[state.age].title)}</strong>`;
  }
  if (state.type === 'obvezno') summaryText += ` (samo obvezna)`;
  if (state.type === 'dodatno') summaryText += ` (samo dodatna)`;
  if (state.tokens.length) {
    summaryText += ` za pojam „<strong>${escapeHtml(state.query)}</strong>”`;
  }
  resultsSummary.innerHTML = summaryText;

  resetBtn.hidden = !isFiltered;

  // Empty state handling
  if (total === 0) {
    cardGrid.innerHTML = '';
    emptyState.hidden = false;
  } else {
    emptyState.hidden = true;
    cardGrid.innerHTML = filtered
      .map((v, i) =>
        renderCard(v, {
          tokens: state.tokens,
          currentAge: state.age,
          index: i,
        })
      )
      .join('');
  }
}

// 8. Mount Calculator (Phase 2)
const plannerRoot = $('#kalkulator');
if (plannerRoot) {
  initCalculator(plannerRoot, vaccines);
}

// 9. Mount FAQ & Footer info
renderFaq($('#faq-list'), faqData);

const yearEl = $('#year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

const lastRevEl = $('#last-reviewed');
if (lastRevEl) lastRevEl.textContent = 'listopad 2026. (HZJZ program)';

// 10. Initialise
readUrl();
if (state.query) {
  searchComponent.setQuery(state.query);
} else {
  render();
}
