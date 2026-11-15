/**
 * Tab 2: Checklist primljenih cjepiva (Digitalna cjepna iskaznica).
 * - Requires adding at least one child first (supports N children with instant switching).
 * - Displays a checklist of all vaccine doses where parents confirm:
 *   1) Which vaccine dose was received (checkbox)
 *   2) When it was received (date input)
 *   3) Optional note (text input)
 */
import { CATEGORIES } from '../lib/constants.js';
import {
  parseISODate,
  toISODate,
  today,
  applyOffset,
  offsetLabel,
  ageNow,
  formatLong,
  formatShort,
  plural,
} from '../lib/dates.js';
import {
  getState,
  getActiveChild,
  setActiveChild,
  getChildDoseRecords,
  setDoseRecord,
  makeDoseKey,
  subscribe,
} from '../lib/storage.js';
import { getPalette } from './children.js';
import { escapeHtml } from '../lib/utils.js';

/**
 * Builds the flat or grouped list of all trackable vaccine doses for a child.
 */
export function buildAllChildDoses(birth, vaccines) {
  const list = [];
  for (const v of vaccines) {
    if (v.schedule && v.schedule.length > 0) {
      for (const s of v.schedule) {
        const expectedDate = birth ? applyOffset(birth, s.at) : null;
        list.push({
          key: makeDoseKey(v.id, s.label),
          vaccine: v,
          doseLabel: s.label,
          hint: s.hint || '',
          at: s.at,
          ageGroupLabel: s.type === 'yearly' ? 'Sezonski (svake jeseni)' : offsetLabel(s.at),
          expectedDate,
        });
      }
    } else {
      // Vaccines without fixed offset schedule (e.g. HepB rodilište, Pneumokok proširena zaštita)
      const label = 'Prema uputi pedijatra';
      const fallbackAt = v.id === 'pneumokok-prosireno' ? '2m' : '0d';
      list.push({
        key: makeDoseKey(v.id, label),
        vaccine: v,
        doseLabel: label,
        hint: v.calendar_note || '',
        at: fallbackAt,
        ageGroupLabel: v.age_label || 'Prema uputi pedijatra',
        expectedDate: birth ? applyOffset(birth, fallbackAt) : null,
      });
    }
  }
  return list;
}

export function renderChildSelectorBar(activeChild, children) {
  const pillsHtml = children
    .map((c) => {
      const isCurrent = activeChild && c.id === activeChild.id;
      const pal = getPalette(c.avatarColor);
      const birth = parseISODate(c.birthDate);
      const ageLabel = birth ? ageNow(birth) : '';
      const initial = (c.name || 'D').charAt(0).toUpperCase();
      return `
        <div class="child-pill-group${isCurrent ? ' is-active' : ''}">
          <button
            type="button"
            class="child-pill-select"
            data-select-child="${escapeHtml(c.id)}"
            aria-pressed="${isCurrent}"
          >
            <span class="child-avatar" style="background:${pal.bg};color:${pal.fg};border-color:${pal.border}" aria-hidden="true">${escapeHtml(initial)}</span>
            <span class="child-pill-text">
              <strong>${escapeHtml(c.name)}</strong>
              ${ageLabel ? `<small>${escapeHtml(ageLabel)}</small>` : ''}
            </span>
          </button>
          ${
            isCurrent
              ? `<button type="button" class="child-pill-edit" data-edit-child="${escapeHtml(c.id)}" aria-label="Uredi profil ${escapeHtml(c.name)}" title="Uredi podatke djeteta">
                  <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>`
              : ''
          }
        </div>
      `;
    })
    .join('');

  return `
    <div class="child-switcher-inline">
      <div class="child-pills-scroll" role="group" aria-label="Odabir djeteta">
        ${pillsHtml}
        <button type="button" class="child-pill-add" data-add-child>
          <span>+ Dodaj dijete</span>
        </button>
      </div>
    </div>
  `;
}

export function renderNoChildPrompt(contextTitle, contextSubtitle) {
  return `
    <div class="empty-child-card">
      <div class="empty-child-icon" aria-hidden="true">👶</div>
      <h3>${escapeHtml(contextTitle)}</h3>
      <p>${escapeHtml(contextSubtitle)}</p>
      <p class="empty-child-note">Možete dodati jedno ili više djece i u svakom trenutku prebacivati prikaz između njih.</p>
      <button type="button" class="btn btn-primary" data-add-child>
        + Dodaj prvo dijete
      </button>
    </div>
  `;
}

export function initChecklistTab(root, vaccines, { onOpenChildModal }) {
  if (!root) return;

  let filterStatus = 'all'; // 'all' | 'obvezno' | 'completed' | 'pending'

  function render() {
    const { children } = getState();
    const activeChild = getActiveChild();

    if (!children.length || !activeChild) {
      root.innerHTML = renderNoChildPrompt(
        'Najprije dodajte dijete za praćenje cijepljenja',
        'Kako biste mogli označavati primljena cjepiva i upisivati datume cijepljenja, unesite ime i datum rođenja djeteta.'
      );
      return;
    }

    const birth = parseISODate(activeChild.birthDate);
    const now = today();
    const allDoses = buildAllChildDoses(birth, vaccines);
    const doseRecords = getChildDoseRecords(activeChild.id);

    for (const item of allDoses) {
      const rec = doseRecords[item.key];
      item.isCompleted = rec?.status === 'completed';
      item.dateAdministered = rec?.dateAdministered || '';
    }

    // Show only doses that are already received OR should have been received by the child's current age
    const ageRelevantDoses = allDoses
      .filter((item) => item.isCompleted || !item.expectedDate || item.expectedDate <= now)
      .sort((a, b) => {
        const ta = a.expectedDate ? a.expectedDate.getTime() : 0;
        const tb = b.expectedDate ? b.expectedDate.getTime() : 0;
        return ta - tb;
      });

    const completedCount = ageRelevantDoses.filter((item) => item.isCompleted).length;
    const totalCount = ageRelevantDoses.length;
    const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    const filteredDoses = ageRelevantDoses.filter((item) => {
      if (filterStatus === 'obvezno') return item.vaccine.category === 'obvezno';
      if (filterStatus === 'completed') return item.isCompleted;
      if (filterStatus === 'pending') return !item.isCompleted;
      return true;
    });

    // Group filtered doses by vaccine so multi-dose vaccines stay together in order (1. doza, 2. doza, 3. doza...)
    const vaxGroupMap = new Map();
    for (const item of filteredDoses) {
      const vid = item.vaccine.id;
      if (!vaxGroupMap.has(vid)) {
        const allForVax = ageRelevantDoses.filter((d) => d.vaccine.id === vid);
        const firstDate = allForVax[0]?.expectedDate ? allForVax[0].expectedDate.getTime() : 0;
        vaxGroupMap.set(vid, {
          vaccine: item.vaccine,
          firstDate,
          totalDueDoses: allForVax.length,
          completedDueDoses: allForVax.filter((d) => d.isCompleted).length,
          items: [],
        });
      }
      vaxGroupMap.get(vid).items.push(item);
    }

    const vaxGroups = [...vaxGroupMap.values()].sort((a, b) => {
      if (a.firstDate !== b.firstDate) return a.firstDate - b.firstDate;
      return (a.vaccine.category === 'obvezno' ? 0 : 1) - (b.vaccine.category === 'obvezno' ? 0 : 1);
    });

    const checklistRowsHtml = vaxGroups.length
      ? vaxGroups
          .map((group) => {
            const v = group.vaccine;
            const cat = CATEGORIES[v.category] || CATEGORIES.dodatno;
            const allVaxDone = group.completedDueDoses === group.totalDueDoses && group.totalDueDoses > 0;

            const dosesHtml = group.items
              .map((item) => {
                const defaultDate =
                  item.dateAdministered ||
                  (item.expectedDate && item.expectedDate <= today()
                    ? toISODate(item.expectedDate)
                    : toISODate(today()));
                const safeId = item.key.replace(/[^a-z0-9]/gi, '-');

                return `
                  <li class="chk-row${item.isCompleted ? ' is-completed' : ''}" data-dose-row="${escapeHtml(item.key)}">
                    <div class="chk-row-main">
                      <label class="chk-toggle-label" for="chk-box-${safeId}">
                        <input
                          type="checkbox"
                          id="chk-box-${safeId}"
                          class="chk-checkbox"
                          data-toggle-vax="${escapeHtml(item.vaccine.id)}"
                          data-toggle-label="${escapeHtml(item.doseLabel)}"
                          data-default-date="${escapeHtml(defaultDate)}"
                          ${item.isCompleted ? 'checked' : ''}
                        />
                        <span class="chk-custom-box" aria-hidden="true">
                          <svg viewBox="0 0 20 20" width="14" height="14"><path d="m4.5 10.5 3.5 3.5 7.5-7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        </span>
                      </label>

                      <div class="chk-info">
                        <div class="chk-title-line">
                          <span class="chk-dose-pill">${escapeHtml(item.doseLabel)}</span>
                          <strong class="chk-vax-name">${escapeHtml(item.vaccine.name)}</strong>
                        </div>
                        <p class="chk-sub">
                          <span>Dob: <strong>${escapeHtml(item.ageGroupLabel)}</strong></span>
                          ${item.expectedDate ? ` · <span>Okvirno: ${escapeHtml(formatShort(item.expectedDate))}</span>` : ''}
                        </p>
                      </div>

                      <div class="chk-status-tag">
                        ${
                          item.isCompleted
                            ? `<span class="pill pill--completed">Potvrđeno ✓</span>`
                            : `<span class="pill pill--past">Nije primljeno</span>`
                        }
                      </div>
                    </div>

                    <div class="chk-fields">
                      <div class="chk-field-group">
                        <label for="chk-date-${safeId}" class="chk-field-label">Kada je primljeno (datum)</label>
                        <input
                          type="date"
                          id="chk-date-${safeId}"
                          class="form-input chk-input-date"
                          value="${escapeHtml(item.dateAdministered)}"
                          data-date-vax="${escapeHtml(item.vaccine.id)}"
                          data-date-label="${escapeHtml(item.doseLabel)}"
                        />
                      </div>
                    </div>
                  </li>
                `;
              })
              .join('');

            return `
              <li class="chk-vax-group">
                <div class="chk-vax-header">
                  <div class="chk-vax-header-main">
                    <div class="chk-vax-header-title">
                      <strong>${escapeHtml(v.name)}</strong>
                    </div>
                    <p class="chk-vax-header-sub">${escapeHtml(v.short_label)} · ${escapeHtml(cat.short)}</p>
                  </div>
                  ${
                    group.totalDueDoses > 1
                      ? `<span class="chk-vax-progress${allVaxDone ? ' is-all-done' : ''}">
                          ${group.completedDueDoses} / ${group.totalDueDoses} ${plural(group.totalDueDoses, 'doza', 'doze', 'doza')}
                        </span>`
                      : ''
                  }
                </div>
                <ul class="chk-dose-sublist">
                  ${dosesHtml}
                </ul>
              </li>
            `;
          })
          .join('')
      : `<li class="chk-empty">Nema cjepiva za odabrani filtar.</li>`;

    root.innerHTML = `
      ${renderChildSelectorBar(activeChild, children)}

      <div class="booklet-summary-card">
        <div class="booklet-summary-top">
          <div>
            <span class="badge badge--obvezno">Dijete: ${escapeHtml(activeChild.name)}</span>
            <h3>Potvrđena cjepiva: ${completedCount} od ${totalCount} (${progressPct}%)</h3>
            <p class="booklet-summary-sub">
              Rođenje: <strong>${birth ? escapeHtml(formatLong(birth)) : '—'}</strong>
              ${birth ? ` (${escapeHtml(ageNow(birth))})` : ''}.
              Svako cjepivo koje ovdje potvrdite automatski se uklanja s popisa budućih termina na 3. kartici.
            </p>
          </div>
          <div class="booklet-filter-pills" role="group" aria-label="Filtriraj popis cjepiva">
            <button type="button" class="chip${filterStatus === 'all' ? ' is-active' : ''}" data-chk-filter="all">
              Sve doze (${totalCount})
            </button>
            <button type="button" class="chip${filterStatus === 'obvezno' ? ' is-active' : ''}" data-chk-filter="obvezno">
              Samo obvezna
            </button>
            <button type="button" class="chip${filterStatus === 'pending' ? ' is-active' : ''}" data-chk-filter="pending">
              Nepotvrđeno (${totalCount - completedCount})
            </button>
            <button type="button" class="chip${filterStatus === 'completed' ? ' is-active' : ''}" data-chk-filter="completed">
              Primljeno (${completedCount})
            </button>
          </div>
        </div>
        <div class="booklet-progress-bar" role="progressbar" aria-valuenow="${progressPct}" aria-valuemin="0" aria-valuemax="100">
          <div class="booklet-progress-fill" style="width:${progressPct}%"></div>
        </div>
      </div>

      <ul class="chk-list">
        ${checklistRowsHtml}
      </ul>
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
    const filterBtn = e.target.closest('[data-chk-filter]');
    if (filterBtn) {
      filterStatus = filterBtn.dataset.chkFilter;
      render();
    }
  });

  root.addEventListener('change', (e) => {
    const activeChild = getActiveChild();
    if (!activeChild) return;

    // 1. Checkbox toggled
    if (e.target.matches('[data-toggle-vax]')) {
      const vaxId = e.target.dataset.toggleVax;
      const doseLabel = e.target.dataset.toggleLabel;
      const isChecked = e.target.checked;
      const row = e.target.closest('[data-dose-row]');
      const dateInput = row?.querySelector('[data-date-vax]');

      const dateVal = isChecked
        ? dateInput?.value || e.target.dataset.defaultDate || toISODate(today())
        : '';

      setDoseRecord(activeChild.id, vaxId, doseLabel, {
        status: isChecked ? 'completed' : 'pending',
        dateAdministered: dateVal,
      });
      return;
    }

    // 2. Date received changed
    if (e.target.matches('[data-date-vax]')) {
      const vaxId = e.target.dataset.dateVax;
      const doseLabel = e.target.dataset.dateLabel;
      const newDate = e.target.value;

      // Setting a date automatically confirms the vaccine as received
      setDoseRecord(activeChild.id, vaxId, doseLabel, {
        status: newDate ? 'completed' : 'pending',
        dateAdministered: newDate,
      });
    }
  });

  subscribe(render);
  render();
}
