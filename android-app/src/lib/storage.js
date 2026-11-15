/**
 * Local-first persistent state store for Android & Web (100% offline, zero tracking).
 * Stores multi-child profiles, digital vaccination booklet (cjepna iskaznica) dose records,
 * smart notification preferences, post-vaccination symptom/temperature logs, and checklists.
 */

const STORAGE_KEY = 'cjepiva_vodic_app_v1';

export const AVATAR_PALETTES = [
  { id: 'blue', label: 'Plava', bg: '#e0effa', fg: '#1e5288', border: '#90c2e7' },
  { id: 'sage', label: 'Zelena', bg: '#dcf2e6', fg: '#1f5c3d', border: '#87cfa8' },
  { id: 'amber', label: 'Topla jantarna', bg: '#fdebd8', fg: '#893f16', border: '#f5b882' },
  { id: 'plum', label: 'Ljubičasta', bg: '#efe5f9', fg: '#4f3375', border: '#bfa3e6' },
];

export const DEFAULT_CHECKLIST_ITEMS = [
  { id: 'zdravstvena', label: 'Zdravstvena iskaznica djeteta', hint: 'Obvezno za upis pregleda u sustav HZZO-a' },
  { id: 'cjepna', label: 'Cjepna iskaznica (knjižica cijepljenja)', hint: 'Za upis primljene doze, datuma i serijskog broja (Lot)' },
  { id: 'hladni_lanac', label: 'Dodatno cjepivo u termo-vrećici (2–8 °C)', hint: 'Samo ako ste sami kupili preporučeno cjepivo u ljekarni' },
  { id: 'utjeha', label: 'Duda, bočica, voda ili najdraža igračka', hint: 'Dojenje ili duda tijekom/odmah nakon uboda dokazano smanjuje bol' },
  { id: 'odjeca', label: 'Lagana odjeća (bodi na kopčanje / kratki rukav)', hint: 'Dojenčad se cijepi u bedro, a starija djeca u nadlakticu' },
  { id: 'antipiretik', label: 'Provjeriti imate li doma paracetamol / čepiće', hint: 'Za slučaj povišene temperature nakon cijepljenja (osobito uz Bexsero ili 6 u 1)' },
];

function createDefaultState() {
  return {
    version: 1,
    activeChildId: null,
    children: [],
    doseRecords: {},      // { [childId]: { [doseKey]: { status, dateAdministered, batchNumber, clinicNote, photoDataUrl, updatedAt } } }
    symptomLogs: {},      // { [childId]: Array<{ id, timestamp, tempC, vaccineName, symptoms, medicationGiven, notes }> }
    checklists: {},       // { [childId]: { [itemId]: boolean } }
    notificationPrefs: {
      enabled: true,
      remind14Days: true,
      remind3Days: true,
      ageLimitAlerts: true,
      seasonalAlerts: true,
      lastScheduledAt: null,
    },
  };
}

let appState = loadFromDisk();
const listeners = new Set();

function loadFromDisk() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw);
    const def = createDefaultState();
    return {
      ...def,
      ...parsed,
      notificationPrefs: { ...def.notificationPrefs, ...(parsed.notificationPrefs || {}) },
    };
  } catch (err) {
    console.warn('Could not load state from localStorage:', err);
    return createDefaultState();
  }
}

function saveToDisk() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  } catch (err) {
    console.warn('Could not save state to localStorage:', err);
  }
}

function notify() {
  saveToDisk();
  for (const fn of listeners) {
    try {
      fn(appState);
    } catch (err) {
      console.error('State listener error:', err);
    }
  }
}

export function getState() {
  return appState;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getActiveChild() {
  if (!appState.children.length) return null;
  return (
    appState.children.find((c) => c.id === appState.activeChildId) ||
    appState.children[0]
  );
}

export function setActiveChild(childId) {
  if (appState.children.some((c) => c.id === childId)) {
    appState.activeChildId = childId;
    notify();
  }
}

export function upsertChild(childData) {
  const id = childData.id || `child-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const existingIdx = appState.children.findIndex((c) => c.id === id);

  const paletteId =
    childData.avatarColor ||
    AVATAR_PALETTES[Math.floor(Math.random() * AVATAR_PALETTES.length)].id;

  const record = {
    id,
    name: (childData.name || 'Dijete').trim(),
    birthDate: childData.birthDate || '',
    weightKg: childData.weightKg ? Number(childData.weightKg) : null,
    avatarColor: paletteId,
    scope: childData.scope || 'sve',
    notes: (childData.notes || '').trim(),
    updatedAt: Date.now(),
  };

  if (existingIdx >= 0) {
    appState.children[existingIdx] = { ...appState.children[existingIdx], ...record };
  } else {
    appState.children.push(record);
  }

  appState.activeChildId = id;
  if (!appState.doseRecords[id]) appState.doseRecords[id] = {};
  if (!appState.symptomLogs[id]) appState.symptomLogs[id] = [];
  if (!appState.checklists[id]) appState.checklists[id] = {};

  notify();
  return record;
}

export function deleteChild(childId) {
  appState.children = appState.children.filter((c) => c.id !== childId);
  delete appState.doseRecords[childId];
  delete appState.symptomLogs[childId];
  delete appState.checklists[childId];

  if (appState.activeChildId === childId) {
    appState.activeChildId = appState.children[0]?.id || null;
  }
  notify();
}

/**
 * Unique key for a specific dose of a vaccine: e.g. "heksavalentno::1. doza"
 */
export function makeDoseKey(vaccineId, doseLabel) {
  return `${vaccineId}::${doseLabel}`;
}

export function getChildDoseRecords(childId) {
  if (!childId) return {};
  return appState.doseRecords[childId] || {};
}

export function getDoseRecord(childId, vaccineId, doseLabel) {
  if (!childId) return null;
  const key = makeDoseKey(vaccineId, doseLabel);
  return appState.doseRecords[childId]?.[key] || null;
}

export function setDoseRecord(childId, vaccineId, doseLabel, recordPatch) {
  if (!childId) return;
  if (!appState.doseRecords[childId]) {
    appState.doseRecords[childId] = {};
  }
  const key = makeDoseKey(vaccineId, doseLabel);
  const prev = appState.doseRecords[childId][key] || {
    status: 'pending',
    dateAdministered: '',
    batchNumber: '',
    clinicNote: '',
    photoDataUrl: '',
  };
  appState.doseRecords[childId][key] = {
    ...prev,
    ...recordPatch,
    updatedAt: Date.now(),
  };
  notify();
}

export function getChildSymptomLogs(childId) {
  if (!childId) return [];
  return appState.symptomLogs[childId] || [];
}

export function addSymptomLog(childId, entry) {
  if (!childId) return null;
  if (!appState.symptomLogs[childId]) {
    appState.symptomLogs[childId] = [];
  }
  const newEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: entry.timestamp || new Date().toISOString().slice(0, 16),
    tempC: entry.tempC ? Number(entry.tempC) : null,
    vaccineName: (entry.vaccineName || '').trim(),
    symptoms: Array.isArray(entry.symptoms) ? entry.symptoms : [],
    medicationGiven: (entry.medicationGiven || '').trim(),
    notes: (entry.notes || '').trim(),
    createdAt: Date.now(),
  };
  appState.symptomLogs[childId].unshift(newEntry);
  notify();
  return newEntry;
}

export function deleteSymptomLog(childId, logId) {
  if (!childId || !appState.symptomLogs[childId]) return;
  appState.symptomLogs[childId] = appState.symptomLogs[childId].filter((l) => l.id !== logId);
  notify();
}

export function getChildChecklist(childId) {
  if (!childId) return {};
  return appState.checklists[childId] || {};
}

export function toggleChecklistItem(childId, itemId, checked) {
  if (!childId) return;
  if (!appState.checklists[childId]) appState.checklists[childId] = {};
  appState.checklists[childId][itemId] = Boolean(checked);
  notify();
}

export function updateNotificationPrefs(patch) {
  appState.notificationPrefs = {
    ...appState.notificationPrefs,
    ...patch,
  };
  notify();
}

export function exportAppData() {
  return JSON.stringify(appState, null, 2);
}

export function importAppData(jsonStr) {
  const parsed = JSON.parse(jsonStr);
  if (!parsed || !Array.isArray(parsed.children)) {
    throw new Error('Neispravan format sigurnosne kopije.');
  }
  const def = createDefaultState();
  appState = {
    ...def,
    ...parsed,
    notificationPrefs: { ...def.notificationPrefs, ...(parsed.notificationPrefs || {}) },
  };
  notify();
  return appState;
}
