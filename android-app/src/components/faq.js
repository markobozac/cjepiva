/**
 * FAQ – native <details>/<summary> accordion (works without JS, searchable via
 * Find-in-page). Shared `name` makes it mutually exclusive in modern browsers.
 */
import { escapeHtml } from '../lib/utils.js';

export function renderFaq(root, items) {
  root.innerHTML = items
    .map(
      (f, i) => `
    <details class="faq-item" name="faq" id="faq-${f.id}"${i === 0 ? ' open' : ''}>
      <summary>
        <span>${escapeHtml(f.q)}</span>
        <span class="faq-toggle" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
        </span>
      </summary>
      <div class="faq-answer"><p>${escapeHtml(f.a)}</p></div>
    </details>`
    )
    .join('');
}
