/**
 * Multi-Child Profile Manager & Modal (<dialog closedby="any">).
 */
import {
  getState,
  getActiveChild,
  upsertChild,
  deleteChild,
  AVATAR_PALETTES,
} from '../lib/storage.js';
import { toISODate, today, addDays, addMonths } from '../lib/dates.js';
import { $ } from '../lib/utils.js';
import { wireLightDismissDialog } from '../lib/ui-helpers.js';

export function getPalette(paletteId) {
  return AVATAR_PALETTES.find((p) => p.id === paletteId) || AVATAR_PALETTES[0];
}

export function initChildManager({ dialogEl, onChildChanged } = {}) {
  wireLightDismissDialog(dialogEl);

  const form = $('#child-profile-form', dialogEl);
  const idInput = $('#child-modal-id', dialogEl);
  const nameInput = $('#child-modal-name', dialogEl);
  const birthInput = $('#child-modal-birth', dialogEl);
  const weightInput = $('#child-modal-weight', dialogEl);
  const titleEl = $('#child-dialog-title', dialogEl);
  const deleteBtn = $('#child-modal-delete', dialogEl);
  const closeBtns = dialogEl ? dialogEl.querySelectorAll('[data-close-child-dialog]') : [];

  const t = today();
  if (birthInput) {
    birthInput.max = toISODate(addDays(t, 280));
    birthInput.min = toISODate(addMonths(t, -18 * 12));
  }

  function openChildModal(child = null) {
    if (!dialogEl) return;
    form?.reset();
    // Clear any stale validation fallback classes on reset
    dialogEl.querySelectorAll('.user-invalid-fallback, .user-valid-fallback').forEach((el) => {
      el.classList.remove('user-invalid-fallback', 'user-valid-fallback');
      el.removeAttribute('aria-invalid');
    });

    if (child) {
      if (titleEl) titleEl.textContent = `Uredi dijete: ${child.name}`;
      if (idInput) idInput.value = child.id;
      if (nameInput) nameInput.value = child.name || '';
      if (birthInput) birthInput.value = child.birthDate || '';
      if (weightInput) weightInput.value = child.weightKg || '';
      if (deleteBtn) deleteBtn.hidden = false;
    } else {
      if (titleEl) titleEl.textContent = 'Dodaj dijete';
      if (idInput) idInput.value = '';
      if (nameInput) nameInput.value = '';
      if (birthInput) birthInput.value = '';
      if (weightInput) weightInput.value = '';
      if (deleteBtn) deleteBtn.hidden = true;
    }

    if (typeof dialogEl.showModal === 'function') {
      dialogEl.showModal();
    } else {
      dialogEl.setAttribute('open', '');
    }
    nameInput?.focus();
  }

  closeBtns.forEach((btn) => btn.addEventListener('click', () => dialogEl.close()));

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const existingChild = idInput?.value
      ? getState().children.find((c) => c.id === idInput.value)
      : null;
    const scope =
      dialogEl.querySelector('input[name="child-modal-scope"]:checked')?.value ||
      existingChild?.scope ||
      'sve';
    const randomColor =
      AVATAR_PALETTES[Math.floor(Math.random() * AVATAR_PALETTES.length)].id;
    const avatarColor = existingChild?.avatarColor || randomColor;

    const saved = upsertChild({
      id: idInput?.value || undefined,
      name: nameInput?.value.trim() || 'Dijete',
      birthDate: birthInput?.value || '',
      weightKg: weightInput?.value ? Number(weightInput.value) : existingChild?.weightKg || null,
      scope,
      avatarColor,
    });
    dialogEl.close();
    onChildChanged?.(saved);
  });

  deleteBtn?.addEventListener('click', () => {
    const id = idInput?.value;
    if (!id) return;
    deleteChild(id);
    dialogEl.close();
    onChildChanged?.(getActiveChild());
  });

  return {
    openChildModal,
  };
}
