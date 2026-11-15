/**
 * Privacy-first Google Analytics 4 (GA4) module with GDPR Consent Mode v2.
 *
 * - Never collects or transmits personal data (child names, birthdates, or personal vaccination records).
 * - Disables all advertising features (ad_storage, ad_user_data, ad_personalization = 'denied').
 * - Respects the user's opt-in/opt-out toggle in the Info tab (`cjepiva_analytics_consent_v1`).
 * - Set `VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX` in `.env` to activate sending events to GA4.
 */

const CONSENT_STORAGE_KEY = 'cjepiva_analytics_consent_v1';
const GA_MEASUREMENT_ID = (import.meta.env?.VITE_GA_MEASUREMENT_ID || '').trim();

let initialized = false;

export function isAnalyticsEnabled() {
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (raw === null) return true; // Enabled by default for anonymous app statistics, user can opt out anytime
    return raw === 'true';
  } catch {
    return false;
  }
}

export function setAnalyticsEnabled(enabled) {
  const flag = Boolean(enabled);
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, String(flag));
  } catch {
    // ignore storage errors
  }

  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('consent', 'update', {
      analytics_storage: flag ? 'granted' : 'denied',
    });
  }

  if (flag && !initialized) {
    initAnalytics();
  }
}

export function initAnalytics() {
  if (typeof window === 'undefined') return;

  const consentGranted = isAnalyticsEnabled();

  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag() {
      window.dataLayer.push(arguments);
    };

  // Configure Google Consent Mode v2 (strictly no ads / remarketing)
  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: consentGranted ? 'granted' : 'denied',
  });

  if (!GA_MEASUREMENT_ID || initialized) return;
  initialized = true;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`;
  document.head.appendChild(script);

  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, {
    anonymize_ip: true,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    send_page_view: false,
  });
}

/**
 * Tracks an anonymous UI event (only if consent is enabled).
 * Never pass child names, birthdates, or health status into `params`.
 */
export function trackEvent(eventName, params = {}) {
  if (!isAnalyticsEnabled()) return;
  if (typeof window !== 'undefined' && typeof window.gtag === 'function' && GA_MEASUREMENT_ID) {
    window.gtag('event', eventName, params);
  }
}
