/**
 * Phase 2 – personalised vaccination calendar.
 * Everything is computed in the browser; nothing is sent or stored.
 */
import { CATEGORIES } from '../lib/constants.js';
import {
  parseISODate,
  toISODate,
  today,
  addDays,
  addMonths,
  ageNow,
  formatLong,
  formatShort,
  formatMonth,
  plural,
} from '../lib/dates.js';
import { buildSchedule } from '../lib/schedule.js';
import { buildICS, downloadFile, googleCalendarUrl } from '../lib/ics.js';
import { track, ageBucket } from '../lib/analytics.js';
import { escapeHtml, $ } from '../lib/utils.js';

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
  if (g.status === 'past') return '';
  if (g.status === 'due') return g.type === 'yearly' ? 'sezona je u tijeku' : 'na redu je sada';
  const d = g.daysUntil;
  if (d === 0) return 'danas';
  if (d < 45) return `za ${d} ${plural(d, 'dan', 'dana', 'dana')}`;
  const m = Math.round(d / 30.44);
  if (m < 24) return `za ${m} ${plural(m, 'mjesec', 'mjeseca', 'mjeseci')}`;
  const y = Math.round(d / 365.25);
  return `za ${y} ${plural(y, 'godinu', 'godine', 'godina')}`;
}

function statusPill(g) {
  if (g.status === 'past') return '<span class="pill pill--past">Prošlo</span>';
  if (g.isNext) return '<span class="pill pill--next">Sljedeće</span>';
  if (g.status === 'due') return '<span class="pill pill--due">Na redu</span>';
  if (g.daysUntil <= 30) return '<span class="pill pill--soon">Uskoro</span>';
  return '';
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
    'Vodič za cijepljenje – informativno, ne zamjenjuje savjet liječnika.',
  ];
  return {
    uid: `${toISODate(g.start)}-${g.key.replace(/[^a-z0-9]/gi, '')}`,
    title,
    description: lines.join('\n'),
    start: g.start,
    yearly: g.type === 'yearly',
  };
}


function getAgeMonths(birth, ref = today()) {
  if (ref < birth) return -1;
  let months = (ref.getFullYear() - birth.getFullYear()) * 12 + (ref.getMonth() - birth.getMonth());
  if (ref.getDate() < birth.getDate()) months--;
  return Math.max(0, months);
}

function getEligibleVaccinesForAge(birth, vaccines, scope = 'sve') {
  const months = getAgeMonths(birth);
  const isBorn = birth <= today();
  const list = [];
  const findVax = (id) => vaccines.find((v) => v.id === id);

  if (!isBorn) {
    const bcg = findVax('bcg');
    if (bcg) list.push({ vaccine: bcg, reason: 'U rodilištu odmah nakon rođenja', defaultChecked: true });
    const heksa = findVax('heksavalentno');
    if (heksa) list.push({ vaccine: heksa, reason: 'S navršena 2 mjeseca (1. doza)', defaultChecked: true });
    const pcv = findVax('pneumokok-obvezno');
    if (pcv) list.push({ vaccine: pcv, reason: 'S navršena 2 mjeseca (1. doza)', defaultChecked: true });
    if (scope !== 'obvezna') {
      const rsv = findVax('rsv');
      if (rsv) list.push({ vaccine: rsv, reason: 'Besplatna RSV zaštita (u rodilištu ili na jesen prije prve sezone)', defaultChecked: true });
      const rota = findVax('rotavirus');
      if (rota) list.push({ vaccine: rota, reason: 'Od 6 tjedana do najkasnije 6–8 mjeseci', defaultChecked: true });
      const bex = findVax('bexsero');
      if (bex) list.push({ vaccine: bex, reason: 'Od navršena 2 mjeseca (1. doza)', defaultChecked: true });
    }
    return list;
  }

  // 1. Mandatory vaccines
  if (months < 2) {
    const bcg = findVax('bcg');
    if (bcg) list.push({ vaccine: bcg, reason: 'Ako nije primljeno u rodilištu', defaultChecked: false });
  }

  if (months >= 2 && months <= 24) {
    const heksa = findVax('heksavalentno');
    if (heksa) {
      const r = months < 7 ? 'Redovito dojenačko cijepljenje (2., 4. ili 6. mjesec)' : 'Docjepljivanje u 2. godini života (12–18 mjeseci)';
      list.push({ vaccine: heksa, reason: r, defaultChecked: months < 7 });
    }
    const pcv = findVax('pneumokok-obvezno');
    if (pcv) {
      const r = months < 7 ? 'Redovito cijepljenje (2. i 4. mjesec)' : 'Docjepljivanje s navršenih 12 mjeseci';
      list.push({ vaccine: pcv, reason: r, defaultChecked: months < 7 });
    }
  }

  if (months >= 12 && months < 72) {
    const mpr = findVax('mpr');
    if (mpr) list.push({ vaccine: mpr, reason: 'Redovito s 12–14 mjeseci (ili nadoknada ako je propušteno)', defaultChecked: months >= 12 && months <= 15 });
  }

  if (months >= 60 && months <= 84) {
    const diTe = findVax('dtap-ipv-predskolsko');
    if (diTe) list.push({ vaccine: diTe, reason: 'Predškolsko cijepljenje (5–6 godina)', defaultChecked: true });
  }

  if (months >= 72 && months <= 96) {
    const mpr = findVax('mpr');
    if (mpr && !list.some((x) => x.vaccine.id === 'mpr')) {
      list.push({ vaccine: mpr, reason: '2. doza pri upisu u 1. razred OŠ', defaultChecked: true });
    }
  }

  // School boosters (dTap): 4th grade primary (~9–11 y) and 2nd grade secondary (~15–17 y)
  const dtap = findVax('skolsko-docjepljivanje');
  if (dtap && months >= 108 && months < 132) {
    list.push({ vaccine: dtap, reason: 'Docjepljivanje dTap u 4. razredu osnovne škole', defaultChecked: true });
  } else if (dtap && months >= 180 && months < 204) {
    list.push({ vaccine: dtap, reason: 'Docjepljivanje dTap u 2. razredu srednje škole', defaultChecked: true });
  }

  // 2. Optional / Recommended vaccines
  if (scope !== 'obvezna') {
    // RSV – free for infants entering their first RSV season (born since 1 April before the current/next season)
    const now = today();
    const seasonYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    if (birth >= new Date(seasonYear, 3, 1)) {
      const rsv = findVax('rsv');
      if (rsv) {
        list.push({
          vaccine: rsv,
          reason: 'Besplatno za bebe pred prvom RSV sezonom (pitajte pedijatra)',
          defaultChecked: true,
        });
      }
    }

    // Vodene kozice (od 12 mjeseci naviše)
    if (months >= 12) {
      const vari = findVax('varicella');
      if (vari) {
        list.push({
          vaccine: vari,
          reason: 'Od 12 mjeseci naviše – 2 doze (zaštita od vodenih kozica ako dijete nije preboljelo)',
          defaultChecked: months >= 12 && months <= 36,
        });
      }
    }

    // Sezonska gripa (od 6 mjeseci naviše)
    if (months >= 6) {
      const gripa = findVax('gripa');
      if (gripa) {
        list.push({
          vaccine: gripa,
          reason: 'Preporučuje se svake jeseni od navršenih 6 mjeseci',
          defaultChecked: true,
        });
      }
    }

    // Bexsero (Meningokok B - od 2 mjeseca naviše)
    if (months >= 2) {
      const bex = findVax('bexsero');
      if (bex) {
        let r = 'Od 2 mjeseca naviše (zaštita od meningitisa i sepse B)';
        if (months >= 12 && months <= 23) r = 'Dojenčad i mala djeca (12–23 mjeseca, 2 doze + docjepljivanje)';
        else if (months >= 24) r = 'Djeca od 2 godine naviše (2 doze s razmakom od min. 1 mjesec)';
        list.push({ vaccine: bex, reason: r, defaultChecked: false });
      }
    }

    // Meningokok ACWY (od 12 mjeseci naviše)
    if (months >= 12) {
      const men = findVax('menacwy');
      if (men) {
        list.push({
          vaccine: men,
          reason: 'Od 12 mjeseci naviše – 1 doza (zaštita od meningitisa grupa A, C, W, Y)',
          defaultChecked: false,
        });
      }
    }

    // Krpeljni meningoencefalitis (FSME - od 1. godine naviše)
    if (months >= 12) {
      const kme = findVax('kme');
      if (kme) {
        list.push({
          vaccine: kme,
          reason: 'Od navršene 1. godine – 3 doze (zaštita od krpeljnog meningoencefalitisa)',
          defaultChecked: false,
        });
      }
    }

    // Rotavirus (samo do 6 mjeseci)
    if (months <= 6) {
      const rota = findVax('rotavirus');
      if (rota) {
        list.push({
          vaccine: rota,
          reason: 'Isključivo dojenčad do 6 mjeseci starosti (oralno cjepivo)',
          defaultChecked: true,
        });
      }
    }

    // HPV (od 9 godina naviše)
    if (months >= 108) {
      const hpv = findVax('hpv');
      if (hpv) {
        list.push({
          vaccine: hpv,
          reason: 'Od 9 godina nadalje (u RH besplatno za 5.–8. razred i mlade)',
          defaultChecked: true,
        });
      }
    }
  }

  return list;
}

function draftDoctorEmail(nextGroup, childName, birth, selectedVaccines = [], ageStr = '') {
  const cName = childName || 'moje dijete';
  const birthStr = birth ? formatLong(birth) : '';
  const displayAge = ageStr || (nextGroup ? nextGroup.ageLabel : '');

  let doseList = '';
  if (selectedVaccines && selectedVaccines.length > 0) {
    doseList = selectedVaccines
      .map((v) => {
        const brandStr = v.brands ? ` (${v.brands.split('/')[0].trim()})` : (v.name !== v.short_label ? ` (${v.name})` : '');
        const reasonStr = v.eligibilityNote ? ` – ${v.eligibilityNote}` : '';
        return `• ${v.short_label || v.name}${brandStr}${reasonStr}`;
      })
      .join('\n');
  } else if (nextGroup) {
    doseList = nextGroup.doses
      .map((d) => `• ${d.vaccine.name} (${d.label}) – ${d.vaccine.short_label}`)
      .join('\n');
  } else {
    doseList = '• Provjera cjepnog statusa i preporučenih cjepiva';
  }

  const subject = `Upit za termin cijepljenja – ${childName || 'dijete'}${displayAge ? ` (${displayAge})` : ''}`;

  const body = `Poštovani/a,

javljam se vezano uz dogovor termina za pregled i cijepljenje za ${cName}${birthStr ? ` (rođeno: ${birthStr}${displayAge ? `, dob: ${displayAge}` : ''})` : ''}.

Za ovu dob i nadolazeći posjet željeli bismo dogovoriti cijepljenje protiv:
${doseList}

Ljubazno molim informaciju o slobodnim terminima za pregled i cijepljenje, kao i trebam li unaprijed pripremiti ili nabaviti dodatna cjepiva u ljekarni.

Srdačan pozdrav,
[Vaše ime i prezime]
[Broj mobitela]`;

  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return { subject, body, mailto };
}

export function initCalculator(root, vaccines) {
  const form = $('#planner-form', root);
  const birthInput = $('#birth-date', root);
  const nameInput = $('#child-name', root);
  const errorEl = $('#birth-error', root);
  const result = $('#planner-result', root);

  // Allow planning ahead (expected birth) and children up to 18 years.
  const t = today();
  birthInput.max = toISODate(addDays(t, 280));
  birthInput.min = toISODate(addMonths(t, -18 * 12));

  let state = { showPast: false, groups: [], birth: null, selectedAgeVaccines: null };

  function selectedExtras() {
    const checked = root.querySelector('input[name="schedule-scope"]:checked');
    const scope = checked ? checked.value : 'sve';
    if (scope === 'obvezna') {
      return new Set();
    }
    return new Set(vaccines.filter((v) => v.category !== 'obvezno').map((v) => v.id));
  }

  function validate() {
    const birth = parseISODate(birthInput.value);
    let msg = '';
    if (!birthInput.value) msg = '';
    else if (!birth) msg = 'Unesite ispravan datum.';
    else if (birthInput.value > birthInput.max) msg = 'Datum je predaleko u budućnosti.';
    else if (birthInput.value < birthInput.min) msg = 'Kalendar je namijenjen djeci do 18 godina.';
    errorEl.textContent = msg;
    errorEl.hidden = !msg;
    birthInput.setAttribute('aria-invalid', String(Boolean(msg)));
    return msg ? null : birth;
  }

  // Analytics: one event per distinct (date, scope) once the visitor stops editing.
  // Only an age bucket is sent – never the birth date or the child's name.
  let scheduleTimer;
  let lastReported = '';
  function reportSchedule(birth, scope, groups) {
    clearTimeout(scheduleTimer);
    const key = `${birthInput.value}|${scope}`;
    if (key === lastReported) return;
    scheduleTimer = setTimeout(() => {
      lastReported = key;
      track('schedule_created', {
        schedule_scope: scope,
        child_age_group: ageBucket(birth),
        upcoming_count: groups.filter((g) => g.status !== 'past').length,
        has_child_name: Boolean(nameInput.value.trim()),
      });
    }, 1500);
  }

  function renderEmpty() {
    result.innerHTML = `
      <div class="plan-empty">
        <div class="plan-empty-art" aria-hidden="true">
          <span>📅</span>
        </div>
        <h3>Vaš osobni raspored pojavit će se ovdje</h3>
        <p>Unesite datum rođenja i odmah ćete vidjeti kada je koje cjepivo na redu. Kalendar možete spremiti u Google ili Apple kalendar ili ga ispisati.</p>
      </div>`;
  }

  function render() {
    const birth = validate();
    if (!birth) {
      state.groups = [];
      renderEmpty();
      return;
    }
    const childName = nameInput.value.trim();
    const currentScope = root.querySelector('input[name="schedule-scope"]:checked')?.value || 'sve';
    const activeExtras = selectedExtras();
    const groups = buildSchedule(birth, vaccines, activeExtras);

    const born = birth <= today();
    const childAgeText = born ? ageNow(birth) : 'novorođenče';

    const eligibleList = getEligibleVaccinesForAge(birth, vaccines, currentScope);

    // Synchronize selectedAgeVaccines if birth date or scope changed
    const birthVal = birthInput.value;
    if (
      !state.selectedAgeVaccines ||
      state.lastBirth !== birthVal ||
      state.lastScope !== currentScope
    ) {
      state.selectedAgeVaccines = new Set(
        eligibleList.filter((item) => item.defaultChecked).map((item) => item.vaccine.id)
      );
      state.lastBirth = birthVal;
      state.lastScope = currentScope;
    }

    const selectedVaccines = eligibleList
      .filter((item) => state.selectedAgeVaccines.has(item.vaccine.id))
      .map((item) => ({ ...item.vaccine, eligibilityNote: item.reason }));

    state = { ...state, groups, birth, childName };
    reportSchedule(birth, currentScope, groups);

    const notes = vaccines.filter(
      (v) => v.calendar_note && (v.category === 'obvezno' || activeExtras.has(v.id))
    );

    const past = groups.filter((g) => g.status === 'past');
    const upcoming = groups.filter((g) => g.status !== 'past');
    const visible = state.showPast ? groups : upcoming;
    const next = groups.find((g) => g.isNext);

    const emailDraft = draftDoctorEmail(next, childName, birth, selectedVaccines, childAgeText);
    state.currentEmailDraft = emailDraft;

    const ageEligibleHtml = eligibleList.length
      ? `<div class="age-eligible-card" id="age-eligible-box">
          <div class="age-eligible-head">
            <span class="age-eligible-icon" aria-hidden="true">💡</span>
            <div>
              <h5>Moguća cjepiva za dob djeteta (${escapeHtml(childAgeText)})</h5>
              <p>Označite cjepiva o kojima se želite posavjetovati s pedijatrom — predložak e-maila i upit automatski se prilagođavaju:</p>
            </div>
          </div>
          <div class="age-eligible-grid" role="group" aria-label="Odabir mogućih cjepiva za dob djeteta">
            ${eligibleList
              .map((item) => {
                const isChecked = state.selectedAgeVaccines.has(item.vaccine.id);
                return `
                  <label class="age-vax-chip${isChecked ? ' is-checked' : ''}" for="age-vax-${item.vaccine.id}">
                    <input
                      type="checkbox"
                      id="age-vax-${item.vaccine.id}"
                      class="age-vax-input"
                      value="${item.vaccine.id}"${isChecked ? ' checked' : ''}
                    />
                    <div class="age-vax-info">
                      <div class="age-vax-top">
                        <strong class="age-vax-name">${escapeHtml(item.vaccine.short_label || item.vaccine.name)}</strong>
                        <span class="badge badge--${item.vaccine.category}">${escapeHtml(CATEGORIES[item.vaccine.category]?.short || 'Preporučeno')}</span>
                      </div>
                      <span class="age-vax-desc">${escapeHtml(item.reason)}</span>
                    </div>
                  </label>
                `;
              })
              .join('')}
          </div>
        </div>`
      : '';

    const emailDraftHtml = emailDraft
      ? `<div class="doctor-email-draft" id="doctor-email-box">
          <div class="email-draft-head">
            <div class="email-draft-title">
              <span class="email-draft-icon" aria-hidden="true">✉️</span>
              <div>
                <h5>Predložak e-maila za pedijatra / liječnika</h5>
                <p>Brzi nacrt poruke za naručivanje na cijepljenje (${escapeHtml(childAgeText)}${selectedVaccines.length ? ` · ${selectedVaccines.length} ${plural(selectedVaccines.length, 'cjepivo', 'cjepiva', 'cjepiva')}` : ''})</p>
              </div>
            </div>
            <div class="email-draft-actions">
              <button type="button" class="btn btn-sm btn-ghost" id="copy-email-btn">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>
                <span>Kopiraj tekst</span>
              </button>
              <a class="btn btn-sm btn-primary" id="open-email-client" href="${escapeHtml(emailDraft.mailto)}">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" fill="none" stroke="currentColor" stroke-width="1.8"/><polyline points="22,6 12,13 2,6" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>
                <span>Otvori u e-mail programu</span>
              </a>
            </div>
          </div>
          <div class="email-draft-preview">
            <p class="email-field"><strong>Predmet:</strong> ${escapeHtml(emailDraft.subject)}</p>
            <pre class="email-body-text">${escapeHtml(emailDraft.body)}</pre>
          </div>
          <p class="email-copy-feedback" id="email-copy-feedback" aria-live="polite" hidden>Tekst e-maila je kopiran u međuspremnik!</p>
        </div>`
      : '';

    const displayNames = selectedVaccines.length
      ? selectedVaccines.map((v) => escapeHtml(v.short_label || v.name)).join(' · ')
      : (next ? next.doses.map((d) => escapeHtml(d.vaccine.short_label || d.vaccine.name)).join(' · ') : '');

    const splitGridHtml = (ageEligibleHtml || emailDraftHtml)
      ? `<div class="plan-split-grid">
          <div class="plan-split-col plan-split-col--vax">${ageEligibleHtml}</div>
          <div class="plan-split-col plan-split-col--email">${emailDraftHtml}</div>
        </div>`
      : '';

    const nextHtml = (next || selectedVaccines.length)
      ? `<div class="plan-next">
          <div class="plan-next-icon" aria-hidden="true">⏰</div>
          <div class="plan-next-content">
            <p class="plan-next-label">Sljedeći termin / upit za dob (${escapeHtml(childAgeText)})</p>
            <p class="plan-next-date">${next ? escapeHtml(whenText(next)) : 'Prema dogovoru s pedijatrom'}</p>
            <p class="plan-next-list">${displayNames || 'Odaberite cjepiva u nastavku'}</p>
          </div>
        </div>
        ${splitGridHtml}`
      : splitGridHtml;

    const items = visible
      .map((g, i) => {
        const payload = eventPayload(g, childName);
        const doses = g.doses
          .map(
            (d) => `
            <li class="plan-dose plan-dose--${d.vaccine.category}">
              <span class="plan-dose-dot" aria-hidden="true"></span>
              <div>
                <p><strong>${escapeHtml(d.vaccine.name)}</strong> <span class="plan-dose-label">${escapeHtml(d.label)}</span></p>
                <p class="plan-dose-meta">
                  <span class="sr-only">${escapeHtml(CATEGORIES[d.vaccine.category].label)}. </span>
                  ${escapeHtml(d.vaccine.short_label)}${d.hint ? ` · ${escapeHtml(d.hint)}` : ''}
                </p>
              </div>
            </li>`
          )
          .join('');
        const gcal =
          g.status !== 'past'
            ? `<a class="plan-gcal" href="${escapeHtml(googleCalendarUrl(payload))}" target="_blank" rel="noopener" id="gcal-${i}">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 10h17M12 13v4M10 15h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                Dodaj u Google kalendar<span class="sr-only"> (otvara se u novoj kartici)</span>
              </a>`
            : '<p class="plan-past-hint">Provjerite u cjepnoj iskaznici je li cijepljenje obavljeno.</p>';
        return `
          <li class="plan-item plan-item--${g.status}${g.isNext ? ' is-next' : ''}" style="--i:${i}">
            ${dateBadge(g)}
            <div class="plan-body">
              <div class="plan-head">
                <h4>${escapeHtml(g.ageLabel)}</h4>
                ${statusPill(g)}
              </div>
              <p class="plan-when">${escapeHtml(whenText(g))}${relText(g) ? ` · <span>${escapeHtml(relText(g))}</span>` : ''}</p>
              <ul class="plan-doses">${doses}</ul>
              ${gcal}
            </div>
          </li>`;
      })
      .join('');

    result.innerHTML = `
      <div class="plan-header">
        <div>
          <p class="eyebrow">Osobni kalendar</p>
          <h3 class="plan-title">${childName ? escapeHtml(childName) : 'Vaše dijete'}${born ? ` · ${escapeHtml(ageNow(birth))}` : ''}</h3>
          <p class="plan-sub">${born ? 'Rođeno' : 'Očekivani datum rođenja'}: ${escapeHtml(formatLong(birth))} · ${upcoming.length} ${plural(
      upcoming.length,
      'nadolazeći termin',
      'nadolazeća termina',
      'nadolazećih termina'
    )}</p>
        </div>
        <div class="plan-actions">
          <button type="button" class="btn btn-primary" id="export-ics"${upcoming.length ? '' : ' disabled'}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Spremi u kalendar (.ics)
          </button>
          <button type="button" class="btn btn-ghost" id="print-plan">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M7 9V4h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v6H7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
            Ispiši / PDF
          </button>
        </div>
      </div>
      <p class="plan-ics-hint">Datoteka .ics otvara se u Apple kalendaru, Google kalendaru i Outlooku. Sadrži samo nadolazeće termine, a podsjetnik stiže 3 dana ranije.</p>
      ${nextHtml}
      ${
        past.length
          ? `<label class="plan-toggle" for="show-past">
              <input type="checkbox" id="show-past"${state.showPast ? ' checked' : ''} />
              <span class="switch" aria-hidden="true"></span>
              Prikaži prošle termine (${past.length})
            </label>`
          : ''
      }
      <ol class="plan-timeline">${items || '<li class="plan-none">Nema nadolazećih termina za odabrana cjepiva.</li>'}</ol>
      ${
        notes.length
          ? `<div class="plan-notes"><p><strong>Nije uključeno u kalendar:</strong></p><ul>${notes
              .map((v) => `<li><strong>${escapeHtml(v.name)}</strong>: ${escapeHtml(v.calendar_note)}</li>`)
              .join('')}</ul></div>`
          : ''
      }
      <p class="plan-disclaimer">Datumi su izračunati prema preporučenoj dobi i služe kao orijentir. Točan termin uvijek određuje pedijatar ili školska medicina.</p>`;
  }

  function exportICS() {
    const upcoming = state.groups.filter((g) => g.status !== 'past');
    if (!upcoming.length) return;
    const events = upcoming.map((g) => eventPayload(g, state.childName));
    const calName = `Cijepljenje${state.childName ? ` – ${state.childName}` : ''}`;
    const slug = (state.childName || 'dijete')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    downloadFile(buildICS(events, calName), `kalendar-cijepljenja-${slug || 'dijete'}.ics`);
    track('calendar_export', { method: 'ics', event_count: events.length });
  }

  function printPlan() {
    document.body.classList.add('print-plan');
    const cleanup = () => {
      document.body.classList.remove('print-plan');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    track('print_schedule', { event_count: state.groups.filter((g) => g.status !== 'past').length });
    window.print();
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    render();
    if (state.groups.length) result.focus({ preventScroll: false });
  });
  form.addEventListener('input', render);
  form.addEventListener('change', (e) => {
    if (e.target.name === 'schedule-scope') track('schedule_scope_change', { schedule_scope: e.target.value });
    render();
  });



  result.addEventListener('click', async (e) => {
    if (e.target.closest('#export-ics')) exportICS();
    if (e.target.closest('#print-plan')) printPlan();
    if (e.target.closest('.plan-gcal')) track('calendar_export', { method: 'google', event_count: 1 });
    if (e.target.closest('#open-email-client')) {
      track('email_to_pediatrician', { method: 'mailto', vaccine_count: state.selectedAgeVaccines?.size || 0 });
    }

    const copyBtn = e.target.closest('#copy-email-btn');
    if (copyBtn && state.currentEmailDraft) {
      const draft = state.currentEmailDraft;
      try {
        await navigator.clipboard.writeText(`Predmet: ${draft.subject}\n\n${draft.body}`);
        track('email_to_pediatrician', { method: 'copy', vaccine_count: state.selectedAgeVaccines?.size || 0 });
        const fb = $('#email-copy-feedback', result);
        if (fb) {
          fb.hidden = false;
          setTimeout(() => { if (fb) fb.hidden = true; }, 3000);
        }
        const span = copyBtn.querySelector('span');
        if (span) {
          const orig = span.textContent;
          span.textContent = 'Kopirano!';
          setTimeout(() => { span.textContent = orig; }, 2000);
        }
      } catch (err) {
        console.error('Clipboard copy failed:', err);
      }
    }
  });
  result.addEventListener('change', (e) => {
    if (e.target.id === 'show-past') {
      state.showPast = e.target.checked;
      render();
      $('#show-past', result)?.focus();
    }
    if (e.target.matches('.age-vax-input')) {
      const val = e.target.value;
      if (!state.selectedAgeVaccines) state.selectedAgeVaccines = new Set();
      track('vaccine_interest_toggle', { vaccine_id: val, checked: e.target.checked });
      if (e.target.checked) {
        state.selectedAgeVaccines.add(val);
      } else {
        state.selectedAgeVaccines.delete(val);
      }
      render();
    }
  });

  renderEmpty();
}
