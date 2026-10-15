/**
 * Google Analytics 4 with consent (GDPR / ePrivacy).
 *
 * - Nothing is loaded and no cookie is set until the visitor clicks "Prihvaćam".
 * - Consent Mode v2: ad_* signals are always denied; Google signals off.
 * - Never send personal data: no birth date, no child name, no e-mail text.
 *   Only coarse, anonymous parameters (vaccine id, age group, scope, …).
 *
 * The Measurement ID comes from VITE_GA_ID (see .env). Empty → analytics off.
 */

const GA_ID = import.meta.env.VITE_GA_ID || '';
const STORAGE_KEY = 'cjepiva-analytics-consent'; // 'granted' | 'denied'

let loaded = false;

function readConsent() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeConsent(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* private mode – banner simply shows again next visit */
  }
}

function gtag() {
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments);
}

function loadGa() {
  if (loaded || !GA_ID) return;
  loaded = true;
  if (window.gtag) {
    // Re-granted after a withdrawal in the same page view.
    window[`ga-disable-${GA_ID}`] = false;
    gtag('consent', 'update', { analytics_storage: 'granted' });
    return;
  }
  window.dataLayer = window.dataLayer || [];
  window.gtag = gtag;

  gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  gtag('js', new Date());
  gtag('config', GA_ID, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    cookie_flags: 'SameSite=Lax;Secure',
  });

  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.append(s);
}

function clearGaCookies() {
  const host = location.hostname;
  const domains = ['', host, `.${host}`, `.${host.split('.').slice(-2).join('.')}`];
  for (const c of document.cookie.split(';')) {
    const name = c.split('=')[0].trim();
    if (name === '_ga' || name.startsWith('_ga_')) {
      for (const d of domains) {
        document.cookie = `${name}=; Max-Age=0; path=/${d ? `; domain=${d}` : ''}`;
      }
    }
  }
}

/** Send an event. Silently does nothing without consent. */
export function track(name, params = {}) {
  if (!loaded) return;
  gtag('event', name, params);
}

/** Child age bucket for analytics – never the date itself. */
export function ageBucket(birth, now = new Date()) {
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (birth > now) return 'prije_rodenja';
  if (months < 2) return '0-2m';
  if (months < 6) return '2-6m';
  if (months < 12) return '6-12m';
  if (months < 24) return '1-2g';
  if (months < 72) return '2-6g';
  if (months < 144) return '6-12g';
  return '12-18g';
}

function setConsent(value) {
  writeConsent(value);
  if (value === 'granted') {
    loadGa();
  } else {
    if (loaded) {
      gtag('consent', 'update', { analytics_storage: 'denied' });
      // Stop further sending in this page view.
      window[`ga-disable-${GA_ID}`] = true;
      loaded = false;
    }
    clearGaCookies();
  }
}

function renderBanner() {
  if (document.getElementById('consent-banner')) return;
  const el = document.createElement('div');
  el.id = 'consent-banner';
  el.className = 'consent-banner';
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', 'Privola za statistiku posjeta');
  el.innerHTML = `
    <p class="consent-text">
      Uz vaše dopuštenje koristimo <strong>Google Analytics</strong> za anonimnu statistiku posjeta
      (koji dijelovi stranice se koriste). Datum rođenja i ime djeteta <strong>nikad</strong> ne napuštaju vaš preglednik.
    </p>
    <div class="consent-actions">
      <button type="button" class="btn btn-sm btn-ghost" data-consent="denied">Ne, hvala</button>
      <button type="button" class="btn btn-sm btn-primary" data-consent="granted">Prihvaćam</button>
    </div>`;
  el.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-consent]');
    if (!btn) return;
    setConsent(btn.dataset.consent);
    el.remove();
  });
  document.body.append(el);
}

/** Call once on start-up. `settingsLink` reopens the banner (footer link). */
export function initAnalytics(settingsLink) {
  if (!GA_ID) {
    settingsLink?.closest('p')?.remove();
    return;
  }
  const consent = readConsent();
  if (consent === 'granted') loadGa();
  else if (consent !== 'denied') renderBanner();

  settingsLink?.addEventListener('click', (e) => {
    e.preventDefault();
    renderBanner();
    document.querySelector('#consent-banner [data-consent="granted"]')?.focus();
  });
}
