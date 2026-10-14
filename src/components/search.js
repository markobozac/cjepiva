/**
 * Search input component with debounce, clear button and diacritic tokenisation.
 */
import { normalize, $ } from '../lib/utils.js';

export function initSearch(root, onSearch) {
  const input = $('#search-input', root);
  const clearBtn = $('#search-clear', root);
  let timer;

  function update() {
    const val = input.value;
    clearBtn.hidden = !val;
    const tokens = normalize(val).split(' ').filter(Boolean);
    onSearch({ raw: val, tokens });
  }

  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(update, 120);
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    input.focus();
    update();
  });

  return {
    setQuery(text) {
      input.value = text;
      update();
    },
    getQuery() {
      return input.value;
    },
  };
}
