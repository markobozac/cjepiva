/**
 * Privacy-first Google Analytics 4 (GA4) with opt-in consent (GDPR / ePrivacy).
 *
 * - Nothing is loaded and nothing is sent until the user agrees (consent prompt
 *   on first launch, or the toggle in the Info tab). Same rule as the web version.
 * - Never collects child names, birth dates or vaccination records.
 * - Advertising signals (ad_storage, ad_user_data, ad_personalization) always denied.
 * - Measurement ID comes from VITE_GA_MEASUREMENT_ID in `.env`. Empty → analytics off.
 */

const CONSENT_STORAGE_KEY = 'cjepiva_analytics_consent_v1'; // 'true' | 'false' | absent
const GA_MEASUREMENT_ID = (import.meta.env?.VITE_GA_MEASUREMENT_ID || '').trim();

let loaded = false;

function readConsent() {
  try {
    return localStorage.getItem(CONSENT_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** True once the user has answered the consent prompt (either way). */
export function hasConsentDecision() {
  return readConsent() !== null;
}

/** Analytics is on only after explicit consent. */
export function isAnalyticsEnabled() {
  return readConsent() === 'true';
}

/** Whether a Measurement ID is configured (no ID → never ask for consent). */
export function isAnalyticsConfigured() {
  return Boolean(GA_MEASUREMENT_ID);
}

function gtag() {
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments);
}

function loadGa() {
  if (loaded || !GA_MEASUREMENT_ID || typeof window === 'undefined') return;
  loaded = true;

  if (window.gtag) {
    // Re-enabled after a withdrawal during the same session.
    window[`ga-disable-${GA_MEASUREMENT_ID}`] = false;
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
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
  gtag('config', GA_MEASUREMENT_ID, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    send_page_view: false,
  });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`;
  document.head.appendChild(script);
}

export function setAnalyticsEnabled(enabled) {
  const flag = Boolean(enabled);
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, String(flag));
  } catch {
    // ignore storage errors
  }

  if (flag) {
    loadGa();
  } else if (loaded) {
    window.gtag('consent', 'update', { analytics_storage: 'denied' });
    window[`ga-disable-${GA_MEASUREMENT_ID}`] = true;
    loaded = false;
  }
}

/** Call once at startup: loads GA only if the user already consented. */
export function initAnalytics() {
  if (isAnalyticsEnabled()) loadGa();
}

/**
 * Tracks an anonymous UI event (only with consent).
 * Never pass child names, birthdates, or health status into `params`.
 */
export function trackEvent(eventName, params = {}) {
  if (!loaded || typeof window.gtag !== 'function') return;
  window.gtag('event', eventName, params);
}
