/**
 * Tab 3: Budući termini cijepljenja (All possible future dates when a vaccine is due).
 * - Requires adding at least one child first (supports N children).
 * - Strictly excludes any vaccine dose that has already been confirmed on Tab 2!
 */
import { CATEGORIES } from '../lib/constants.js';
import {
  parseISODate,
  toISODate,
  today,
  ageNow,
  formatLong,
  formatShort,
  formatMonth,
  plural,
} from '../lib/dates.js';
import { buildSchedule } from '../lib/schedule.js';
import { buildICS, downloadFile, googleCalendarUrl } from '../lib/ics.js';
import {
  getState,
  getActiveChild,
  setActiveChild,
  upsertChild,
  getChildDoseRecords,
  setDoseRecord,
  makeDoseKey,
  subscribe,
} from '../lib/storage.js';
import { renderChildSelectorBar, renderNoChildPrompt } from './checklist.js';
import { escapeHtml } from '../lib/utils.js';

const MONTHS_SHORT = ['sij', 'velj', 'ožu', 'tra', 'svi', 'lip', 'srp', 'kol', 'ruj', 'lis', 'stu', 'pro'];

function whenText(g) {
  switch (g.type) {
    case 'window':
      return `U razdoblju ${formatShort(g.start)} – ${formatShort(g.end)}`;
    case 'earliest':
      return `Od ${formatLong(g.start)}`;
    case 'approx':
      return g.end
        ? `Okvirno ${g.start.getFullYear()}.–${g.end.getFullYear()}.`
        : `Okvirno ${formatMonth(g.start)}`;
    case 'yearly':
      return `Od ${formatMonth(g.start)}, svake jeseni`;
    default:
      return formatLong(g.start);
  }
}

function relText(g) {
  if (g.isConfirmed) return 'potvrđeno kao primljeno';
  if (g.status === 'past') return 'okvirni datum je prošao (još nije potvrđeno)';
  if (g.status === 'due') return g.type === 'yearly' ? 'sezona je u tijeku' : 'na redu je sada';
  const d = g.daysUntil;
  if (d === 0) return 'danas';
  if (d < 45) return `za ${d} ${plural(d, 'dan', 'dana', 'dana')}`;
  const m = Math.round(d / 30.44);
  if (m < 24) return `za ${m} ${plural(m, 'mjesec', 'mjeseca', 'mjeseci')}`;
  const y = Math.round(d / 365.25);
  return `za ${y} ${plural(y, 'godinu', 'godine', 'godina')}`;
}

function statusPillButton(g) {
  const currentYear = today().getFullYear();
  if (g.start.getFullYear() > currentYear && !g.isConfirmed) {
    return '';
  }
  if (g.isConfirmed) {
    return `<button
      type="button"
      class="pill pill-btn pill--completed"
      data-toggle-group-confirm="${escapeHtml(g.key)}"
      aria-pressed="true"
      title="Kliknite za poništavanje potvrde"
    >Potvrđeno ✓</button>`;
  }
  return `<button
    type="button"
    class="pill pill-btn pill--past"
    data-toggle-group-confirm="${escapeHtml(g.key)}"
    aria-pressed="false"
    title="Kliknite za potvrdu da je cjepivo primljeno"
  >Nepotvrđeno</button>`;
}

function dateBadge(g) {
  const approx = g.type === 'approx' || g.type === 'yearly';
  return `<div class="plan-date${approx ? ' plan-date--approx' : ''}" aria-hidden="true">
    ${approx ? '' : `<span class="plan-day">${g.start.getDate()}.</span>`}
    <span class="plan-month">${MONTHS_SHORT[g.start.getMonth()]}</span>
    <span class="plan-year">${g.start.getFullYear()}.</span>
  </div>`;
}

function eventPayload(g, childName) {
  const who = childName ? ` (${childName})` : '';
  const names = [...new Set(g.doses.map((d) => d.vaccine.short_label || d.vaccine.name))];
  const title = `Cijepljenje${who}: ${names.join(', ')}`;
  const lines = [
    `Dob: ${g.ageLabel}`,
    `Termin: ${whenText(g)}`,
    '',
    ...g.doses.map(
      (d) => `• ${d.vaccine.name} – ${d.label} [${CATEGORIES[d.vaccine.category].short}]${d.hint ? ` (${d.hint})` : ''}`
    ),
    '',
    'Dogovorite točan termin s pedijatrom.',
  ];
  return {
    uid: `${toISODate(g.start)}-${g.key.replace(/[^a-z0-9]/gi, '')}`,
    title,
    description: lines.join('\n'),
    start: g.start,
    yearly: g.type === 'yearly',
  };
}

export function initUpcomingTab(root, vaccines, { onOpenChildModal }) {
  if (!root) return;

  let currentRemainingGroups = [];
  const sessionConfirmedKeys = new Set();

  // Clear session-confirmed preview items when switching tabs so confirmed items hide on next visit
  document.addEventListener('click', (e) => {
    const tabBtn = e.target.closest('[data-switch-tab]');
    if (tabBtn && sessionConfirmedKeys.size > 0) {
      sessionConfirmedKeys.clear();
      render();
    }
  });

  function render() {
    const { children } = getState();
    const activeChild = getActiveChild();

    if (!children.length || !activeChild) {
      currentRemainingGroups = [];
      root.innerHTML = renderNoChildPrompt(
        'Dodajte dijete za prikaz budućih termina',
        'Unesite ime i datum rođenja djeteta kako bi aplikacija izračunala sve nadolazeće datume cijepljenja.'
      );
      return;
    }

    const birth = parseISODate(activeChild.birthDate);
    if (!birth) {
      root.innerHTML = renderNoChildPrompt(
        'Nedostaje datum rođenja djeteta',
        'Uredite profil djeteta i unesite datum rođenja za izračun termina.'
      );
      return;
    }

    const scope = activeChild.scope || 'sve';
    const includeIds =
      scope === 'obvezna'
        ? new Set()
        : new Set(vaccines.filter((v) => v.category !== 'obvezno').map((v) => v.id));

    const rawGroups = buildSchedule(birth, vaccines, includeIds);
    const doseRecords = getChildDoseRecords(activeChild.id);

    // Filter out any dose confirmed on Tab 2 (keep ones just clicked in this session so button shows "Potvrđeno ✓")
    const remainingGroups = [];
    let totalRemainingDoses = 0;

    for (const g of rawGroups) {
      const visibleDoses = g.doses.filter((d) => {
        const key = makeDoseKey(d.vaccine.id, d.label);
        const rec = doseRecords[key];
        return rec?.status !== 'completed' || sessionConfirmedKeys.has(key);
      });
      if (visibleDoses.length > 0) {
        const unconfirmedCount = visibleDoses.filter(
          (d) => doseRecords[makeDoseKey(d.vaccine.id, d.label)]?.status !== 'completed'
        ).length;
        totalRemainingDoses += unconfirmedCount;
        const isConfirmed = unconfirmedCount === 0;
        remainingGroups.push({
          ...g,
          doses: visibleDoses,
          isConfirmed,
          isNext: false,
        });
      }
    }

    // Mark the first upcoming/due unconfirmed group as next
    const nextGroup =
      remainingGroups.find((g) => !g.isConfirmed && g.status !== 'past') ||
      remainingGroups.find((g) => !g.isConfirmed) ||
      null;
    if (nextGroup) nextGroup.isNext = true;

    currentRemainingGroups = remainingGroups;

    const nextBannerHtml = nextGroup
      ? `<div class="plan-next">
          <div class="plan-next-icon" aria-hidden="true">⏰</div>
          <div class="plan-next-content">
            <p class="plan-next-label">Sljedeći nepotvrđeni termin za: ${escapeHtml(activeChild.name)} (${escapeHtml(nextGroup.ageLabel)})</p>
            <p class="plan-next-date">${escapeHtml(whenText(nextGroup))}</p>
            <p class="plan-next-list">${nextGroup.doses.map((d) => escapeHtml(d.vaccine.short_label || d.vaccine.name)).join(' · ')}</p>
          </div>
        </div>`
      : '';

    // Group remaining items by expected calendar year
    const yearSections = [];
    const yearMap = new Map();
    for (const g of remainingGroups) {
      const yr = g.start.getFullYear();
      let section = yearMap.get(yr);
      if (!section) {
        section = { year: yr, groups: [] };
        yearMap.set(yr, section);
        yearSections.push(section);
      }
      section.groups.push(g);
    }

    let cardIndex = 0;
    const timelineItemsHtml = yearSections.length
      ? yearSections
          .map((section) => {
            const cardsHtml = section.groups
              .map((g) => {
                const i = cardIndex++;
                const dosesHtml = g.doses
                  .map(
                    (d) => `
                    <li class="plan-dose plan-dose--${d.vaccine.category}">
                      <span class="plan-dose-dot" aria-hidden="true"></span>
                      <div class="plan-dose-main">
                        <p>
                          <strong>${escapeHtml(d.vaccine.name)}</strong>
                          <span class="plan-dose-label">${escapeHtml(d.label)}</span>
                        </p>
                        <p class="plan-dose-meta">
                          ${escapeHtml(d.vaccine.short_label)}${d.hint ? ` · ${escapeHtml(d.hint)}` : ''}
                        </p>
                      </div>
                    </li>`
                  )
                  .join('');

                return `
                  <li class="plan-item plan-item--grouped plan-item--${g.status}${g.isNext ? ' is-next' : ''}${g.isConfirmed ? ' is-confirmed-card' : ''}" style="--i:${i}">
                    <div class="plan-body">
                      <div class="plan-head">
                        <h4>${escapeHtml(g.ageLabel)}</h4>
                        ${statusPillButton(g)}
                      </div>
                      <p class="plan-when">${escapeHtml(whenText(g))}${relText(g) ? ` · <span>${escapeHtml(relText(g))}</span>` : ''}</p>
                      <ul class="plan-doses">${dosesHtml}</ul>
                    </div>
                  </li>
                `;
              })
              .join('');

            return `
              <li class="plan-year-section">
                <div class="plan-year-banner" role="heading" aria-level="4">
                  <span class="plan-year-banner-num">${section.year}.</span>
                </div>
                <ol class="plan-year-list">
                  ${cardsHtml}
                </ol>
              </li>
            `;
          })
          .join('')
      : `<li class="plan-none">🎉 Sva cjepiva u ovom rasporedu za <strong>${escapeHtml(activeChild.name)}</strong> su potvrđena kao primljena!</li>`;

    root.innerHTML = `
      ${renderChildSelectorBar(activeChild, children)}

      <div class="upcoming-header-card">
        <div class="plan-header">
          <div>
            <p class="eyebrow">Kalendar preostalih cjepiva</p>
            <h3 class="plan-title">${escapeHtml(activeChild.name)} · ${escapeHtml(ageNow(birth))}</h3>
            <p class="plan-sub">
              Rođenje: ${escapeHtml(formatLong(birth))} · Preostalo <strong>${totalRemainingDoses}</strong> ${plural(totalRemainingDoses, 'nepotvrđena doza', 'nepotvrđene doze', 'nepotvrđenih doza')} u <strong>${remainingGroups.length}</strong> ${plural(remainingGroups.length, 'terminu', 'termina', 'termina')}.
              <br /><small>Cjepiva potvrđena na 2. kartici („Primljena cjepiva”) automatski su skrivena s ovog popisa.</small>
            </p>
          </div>
          <div class="plan-actions">
            <div class="segmented" role="group" aria-label="Obuhvat budućih cjepiva">
              <button
                type="button"
                class="segmented-btn${scope === 'sve' ? ' is-active' : ''}"
                aria-pressed="${scope === 'sve'}"
                data-upcoming-scope="sve"
              >
                Obvezna + preporučena
              </button>
              <button
                type="button"
                class="segmented-btn${scope === 'obvezna' ? ' is-active' : ''}"
                aria-pressed="${scope === 'obvezna'}"
                data-upcoming-scope="obvezna"
              >
                Samo obvezna
              </button>
            </div>
            <button type="button" class="btn btn-primary" id="export-upcoming-ics"${remainingGroups.length ? '' : ' disabled'}>
              Spremi u kalendar (.ics)
            </button>
          </div>
        </div>
      </div>

      ${nextBannerHtml}

      <ol class="plan-timeline">
        ${timelineItemsHtml}
      </ol>
    `;
  }

  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-add-child]')) {
      onOpenChildModal?.(null);
      return;
    }
    const selectBtn = e.target.closest('[data-select-child]');
    if (selectBtn) {
      setActiveChild(selectBtn.dataset.selectChild);
      return;
    }
    const editBtn = e.target.closest('[data-edit-child]');
    if (editBtn) {
      const child = getState().children.find((c) => c.id === editBtn.dataset.editChild);
      if (child) onOpenChildModal?.(child);
      return;
    }

    const scopeBtn = e.target.closest('[data-upcoming-scope]');
    if (scopeBtn) {
      const activeChild = getActiveChild();
      if (activeChild) {
        upsertChild({ ...activeChild, scope: scopeBtn.dataset.upcomingScope });
      }
      return;
    }

    const groupConfirmBtn = e.target.closest('[data-toggle-group-confirm]');
    if (groupConfirmBtn) {
      const activeChild = getActiveChild();
      if (!activeChild) return;
      const groupKey = groupConfirmBtn.dataset.toggleGroupConfirm;
      const group = currentRemainingGroups.find((g) => g.key === groupKey);
      if (!group) return;

      const shouldConfirm = !group.isConfirmed;
      const defaultDate = toISODate(group.start && group.start <= today() ? group.start : today());

      for (const d of group.doses) {
        const key = makeDoseKey(d.vaccine.id, d.label);
        if (shouldConfirm) {
          sessionConfirmedKeys.add(key);
          setDoseRecord(activeChild.id, d.vaccine.id, d.label, {
            status: 'completed',
            dateAdministered: defaultDate,
          });
        } else {
          sessionConfirmedKeys.delete(key);
          setDoseRecord(activeChild.id, d.vaccine.id, d.label, {
            status: 'pending',
            dateAdministered: '',
          });
        }
      }
      return;
    }

    if (e.target.closest('#export-upcoming-ics')) {
      const activeChild = getActiveChild();
      if (!activeChild || !currentRemainingGroups.length) return;
      const events = currentRemainingGroups.map((g) => eventPayload(g, activeChild.name));
      const calName = `Cijepljenje – ${activeChild.name}`;
      downloadFile(buildICS(events, calName), `buduci-termini-${activeChild.name.toLowerCase()}.ics`);
    }
  });

  subscribe(render);
  render();
}
