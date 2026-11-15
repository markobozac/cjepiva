/**
 * Main application entrypoint (5-Tab Android & Web App):
 * - Tab 1 ("pregled"): Starts directly on Pregled cjepiva (catalog, search, type & age filters)
 * - Tab 2 ("iskaznica"): Checklist of received vaccines per child (requires adding child first; supports N children)
 * - Tab 3 ("buduci"): All possible future dates when vaccines are due (excludes vaccines confirmed on Tab 2)
 * - Tab 4 ("pitanja"): Česta pitanja (FAQ)
 * - Tab 5 ("info"): Info (Author, why it was started, medical disclaimer & official HZJZ source)
 */
import './styles/index.css';
import './styles/calculator.css';
import './styles/app-features.css';
import vaccinesData from './data/vaccines.json';
import faqData from './data/faq.json';

import { AGE_MAP, matchesType } from './lib/constants.js';
import { normalize, escapeHtml, $ } from './lib/utils.js';
import { plural } from './lib/dates.js';
import { initUserInvalidFallback } from './lib/ui-helpers.js';

import { renderCard } from './components/card.js';
import { initTypeFilter, initAgeFilter } from './components/filters.js';
import { initSearch } from './components/search.js';
import { initChildManager } from './components/children.js';
import { initChecklistTab } from './components/checklist.js';
import { initUpcomingTab } from './components/upcoming.js';
import { renderFaq } from './components/faq.js';
import {
  initAnalytics,
  isAnalyticsEnabled,
  setAnalyticsEnabled,
  trackEvent,
} from './lib/analytics.js';

const VALID_TABS = ['pregled', 'iskaznica', 'buduci', 'pitanja', 'info'];

// Initialize privacy-safe Google Analytics 4 (Consent Mode v2)
initAnalytics();

// Initialize form validation interaction tracking (:user-invalid fallback)
initUserInvalidFallback(document);

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
  tab: 'pregled',
  type: 'sve',
  age: 'sve',
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
const controlsEl = $('#controls');

// 1. Tab Controller (each tab shows only its own view)
const tabPanels = document.querySelectorAll('[data-tab-panel]');
const tabButtons = document.querySelectorAll('[data-switch-tab]');

function setActiveTab(tabId) {
  if (!VALID_TABS.includes(tabId)) return;
  state.tab = tabId;

  tabPanels.forEach((panel) => {
    const isMatch = panel.dataset.tabPanel === tabId;
    panel.hidden = !isMatch;
  });

  tabButtons.forEach((btn) => {
    const isMatch = btn.dataset.switchTab === tabId;
    btn.classList.toggle('is-active', isMatch);
    if (btn.getAttribute('role') === 'tab') {
      btn.setAttribute('aria-selected', String(isMatch));
    }
  });

  window.scrollTo({ top: 0, behavior: 'instant' });
  updateUrl();
  trackEvent('tab_view', { tab_name: tabId });
}

document.addEventListener('click', (e) => {
  const tabBtn = e.target.closest('[data-switch-tab]');
  if (tabBtn) {
    e.preventDefault();
    setActiveTab(tabBtn.dataset.switchTab);
  }
});

// 2. Search suggestions
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

// 3. Mount Filters and Search for Tab 1 (Pregled cjepiva)
const typeComponent = initTypeFilter($('#type-filter'), (newType) => {
  state.type = newType;
  updateUrl();
  renderCatalog();
  trackEvent('filter_category', { category: newType });
});

const ageComponent = initAgeFilter($('#age-filter'), vaccines, (newAge) => {
  state.age = newAge;
  updateUrl();
  renderCatalog();
  trackEvent('filter_age', { age_group: newAge });
});

const searchComponent = initSearch($('#panel-pregled'), ({ raw, tokens }) => {
  state.query = raw;
  state.tokens = tokens;
  updateUrl();
  renderCatalog();
});

function resetAllFilters() {
  state.type = 'sve';
  state.age = 'sve';
  state.query = '';
  state.tokens = [];
  searchComponent.setQuery('');
  updateUrl();
  renderCatalog();
}

resetBtn?.addEventListener('click', resetAllFilters);

// 4. URL Query Sync (?tab=iskaznica&vrsta=obvezno&dob=2m&q=rotarix)
function readUrl() {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  const type = params.get('vrsta');
  const age = params.get('dob');
  const q = params.get('q');

  if (tab && VALID_TABS.includes(tab)) {
    state.tab = tab;
  }
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
  if (state.tab !== 'pregled') params.set('tab', state.tab);
  if (state.type !== 'sve') params.set('vrsta', state.type);
  if (state.age !== 'sve') params.set('dob', state.age);
  if (state.query.trim()) params.set('q', state.query.trim());

  const str = params.toString();
  const url = str ? `${window.location.pathname}?${str}` : window.location.pathname;
  window.history.replaceState({}, '', url);
}

// 5. Sticky controls intersection observer shadow
if (controlsEl) {
  const observer = new IntersectionObserver(
    ([entry]) => {
      controlsEl.classList.toggle('is-stuck', entry.intersectionRatio < 1);
    },
    { threshold: [1] }
  );
  observer.observe(controlsEl);
}

// 6. Core filtering & rendering for Tab 1 (Pregled cjepiva)
function getFiltered() {
  return vaccines.filter((v) => {
    if (!matchesType(v, state.type)) return false;
    if (state.age !== 'sve' && !v.age_groups.includes(state.age)) return false;
    if (state.tokens.length > 0) {
      const match = state.tokens.every((t) => v._corpus.includes(t));
      if (!match) return false;
    }
    return true;
  });
}

function renderCatalog() {
  typeComponent.update(state.type);
  ageComponent.update(state.age, state.type);

  const filtered = getFiltered();
  const isFiltered = state.type !== 'sve' || state.age !== 'sve' || state.tokens.length > 0;

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

// 7. Mount Multi-Child Dialog Manager, Tab 2 (Checklist), Tab 3 (Upcoming Due Dates), Tab 4 (FAQ), and Tab 5 (Info)
const childManager = initChildManager({
  barRoot: null,
  dialogEl: $('#child-profile-dialog'),
  backupDialogEl: null,
});

initChecklistTab($('#checklist-root'), vaccines, {
  onOpenChildModal: (child) => childManager.openChildModal(child),
});

initUpcomingTab($('#upcoming-root'), vaccines, {
  onOpenChildModal: (child) => childManager.openChildModal(child),
});

renderFaq($('#faq-list'), faqData);

const yearEl = $('#year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

const analyticsToggle = $('#analytics-consent-toggle');
if (analyticsToggle) {
  analyticsToggle.checked = isAnalyticsEnabled();
  analyticsToggle.addEventListener('change', () => {
    setAnalyticsEnabled(analyticsToggle.checked);
  });
}

// 8. Initialise
readUrl();
setActiveTab(state.tab);
if (state.query) {
  searchComponent.setQuery(state.query);
} else {
  renderCatalog();
}
