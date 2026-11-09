// LGPD cookie consent for marketing cookies (Meta Pixel).
// The choice lives in a first-party cookie so the server can read it too
// (Conversions API events are only sent for visitors who accepted).

export const CONSENT_COOKIE = "cookie_consent";
export const CONSENT_CHANGE_EVENT = "cookie-consent-change";
export const CONSENT_OPEN_EVENT = "cookie-consent-open";

export type ConsentValue = "accepted" | "rejected";

const MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export function isConsentAccepted(value: string | null | undefined): boolean {
  return value === "accepted";
}

export function getConsent(): ConsentValue | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`));
  const value = match?.[1];
  return value === "accepted" || value === "rejected" ? value : null;
}

function expireCookie(name: string) {
  const host = window.location.hostname;
  const domains = ["", host, `.${host.replace(/^www\./, "")}`];
  for (const domain of domains) {
    document.cookie = `${name}=; Max-Age=0; Path=/${domain ? `; Domain=${domain}` : ""}`;
  }
}

export function setConsent(value: ConsentValue): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${value}; Max-Age=${MAX_AGE}; Path=/; SameSite=Lax${secure}`;

  if (value === "rejected") {
    window.fbq?.("consent", "revoke");
    expireCookie("_fbp");
    expireCookie("_fbc");
  }
  window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
}

export function openConsentBanner(): void {
  window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
}

export function subscribeConsent(callback: () => void): () => void {
  window.addEventListener(CONSENT_CHANGE_EVENT, callback);
  return () => window.removeEventListener(CONSENT_CHANGE_EVENT, callback);
}
