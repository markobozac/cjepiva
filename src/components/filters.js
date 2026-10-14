/**
 * Type (segmented) filter + age timeline filter.
 * Both are groups of toggle buttons using aria-pressed.
 */
import { AGE_GROUPS, TYPE_FILTERS, matchesType } from '../lib/constants.js';

const SEG_COLORS = {
  sve: { bg: 'var(--primary-soft)', fg: 'var(--primary-strong)', line: 'transparent' },
  obvezno: { bg: 'var(--obvezno-soft)', fg: 'var(--obvezno)', line: 'var(--obvezno-line)' },
  dodatno: { bg: 'var(--dodatno-soft)', fg: 'var(--dodatno)', line: 'var(--dodatno-line)' },
};

export function initTypeFilter(root, onChange) {
  root.innerHTML =
    '<span class="segmented-indicator" aria-hidden="true"></span>' +
    TYPE_FILTERS.map(
      (f) =>
        `<button type="button" class="segmented-btn" id="type-${f.key}" data-type="${f.key}" aria-pressed="false" aria-label="${f.aria}">${f.label}</button>`
    ).join('');

  const indicator = root.querySelector('.segmented-indicator');

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-type]');
    if (btn) onChange(btn.dataset.type);
  });

  function moveIndicator(btn) {
    if (!btn) return;
    indicator.style.width = `${btn.offsetWidth}px`;
    indicator.style.translate = `${btn.offsetLeft}px 0`;
  }

  let current;
  const ro = new ResizeObserver(() => moveIndicator(root.querySelector(`[data-type="${current}"]`)));
  ro.observe(root);

  return {
    update(type) {
      current = type;
      const c = SEG_COLORS[type];
      root.style.setProperty('--seg-bg', c.bg);
      root.style.setProperty('--seg-fg', c.fg);
      root.style.setProperty('--seg-line', c.line);
      root.querySelectorAll('[data-type]').forEach((b) => {
        const on = b.dataset.type === type;
        b.setAttribute('aria-pressed', String(on));
        if (on) moveIndicator(b);
      });
    },
  };
}

export function initAgeFilter(root, vaccines, onChange) {
  const options = [{ key: 'sve', label: 'Sve dobi', sub: 'cijeli kalendar' }, ...AGE_GROUPS];

  function dots(key, type) {
    if (key === 'sve') return '';
    const list = vaccines.filter((v) => v.age_groups.includes(key) && matchesType(v, type));
    const cls = { obvezno: '', dodatno: 'd', preporuceno_besplatno: 'b' };
    return list
      .sort((a, b) => (a.category === 'obvezno' ? -1 : 1) - (b.category === 'obvezno' ? -1 : 1))
      .map((v) => `<i class="${cls[v.category]}"></i>`)
      .join('');
  }

  function render(type) {
    root.innerHTML = options
      .map((a) => {
        const count = a.key === 'sve' ? '' : vaccines.filter((v) => v.age_groups.includes(a.key) && matchesType(v, type)).length;
        const aria = a.key === 'sve' ? 'Sve dobi' : `${a.title}${count !== '' ? `, ${count} cjepiva` : ''}`;
        return `<button type="button" class="age-btn" id="age-${a.key}" data-age="${a.key}" aria-pressed="false" aria-label="${aria}">
          <span class="age-btn-label">${a.label}</span>
          <span class="age-btn-sub">${a.sub}</span>
          <span class="age-btn-count" aria-hidden="true">${dots(a.key, type)}</span>
        </button>`;
      })
      .join('');
  }

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-age]');
    if (btn) onChange(btn.dataset.age);
  });

  let lastType;
  return {
    update(age, type) {
      if (type !== lastType) {
        render(type);
        lastType = type;
      }
      root.querySelectorAll('[data-age]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.age === age)));
      const active = root.querySelector(`[data-age="${age}"]`);
      // Keep the active chip visible on narrow, horizontally scrolling screens.
      if (active && root.scrollWidth > root.clientWidth) {
        root.scrollTo({ left: active.offsetLeft - root.clientWidth / 2 + active.offsetWidth / 2, behavior: 'smooth' });
      }
    },
  };
}
