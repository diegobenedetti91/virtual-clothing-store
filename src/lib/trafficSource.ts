// Where a visitor came from (Instagram, Facebook, Google, campaign UTMs...).
//
// Detected in the browser on arrival and kept for 30 days in a first-party cookie
// (last identified source wins: a later direct visit does not erase it). The
// cookie is read again on the server when an order is created, so every order
// carries the source that brought the customer. No personal data is stored.

export const TRAFFIC_COOKIE = "traffic_source";
const MAX_AGE_DAYS = 30;

export interface TrafficSource {
  channel: string; // Instagram, Facebook, Google, Google Ads, WhatsApp, ...
  source?: string; // utm_source or referrer host
  medium?: string; // utm_medium (or derived: social, organic, cpc, referral)
  campaign?: string;
  content?: string;
  term?: string;
  referrer?: string; // referrer host
  landing?: string; // first page path of that visit
  ts?: number;
}

const clip = (v: string | null | undefined, max = 100) => (v ? v.trim().slice(0, max) || undefined : undefined);

const KNOWN_SOURCES: [RegExp, string][] = [
  [/^(ig|insta|instagram)/i, "Instagram"],
  [/^(fb|facebook|meta)/i, "Facebook"],
  [/^(tiktok|tt)$/i, "TikTok"],
  [/^(whatsapp|wpp|wa|zap)/i, "WhatsApp"],
  [/^(google|adwords)/i, "Google"],
  [/^(youtube|yt)/i, "YouTube"],
  [/^(pinterest)/i, "Pinterest"],
  [/^(bing)/i, "Bing"],
  [/^(email|e-mail|newsletter|mail)/i, "E-mail"],
];

const REFERRER_HOSTS: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/, "Facebook"],
  [/(^|\.)google\.[a-z.]+$/, "Google"],
  [/(^|\.)bing\.com$/, "Bing"],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, "WhatsApp"],
  [/(^|\.)(tiktok\.com)$/, "TikTok"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "YouTube"],
  [/(^|\.)(pinterest\.[a-z.]+|pin\.it)$/, "Pinterest"],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, "X (Twitter)"],
];

const PAID_MEDIUMS = /^(cpc|ppc|paid|paidsocial|paid_social|paid-social|ads?|cpm|display)$/i;

function channelFromUtm(source: string, medium?: string): string {
  const known = KNOWN_SOURCES.find(([re]) => re.test(source))?.[1];
  if (known === "Google" && medium && PAID_MEDIUMS.test(medium)) return "Google Ads";
  if (known) return known;
  return source.charAt(0).toUpperCase() + source.slice(1);
}

/**
 * Source of the current visit, or null when it is a direct/internal visit
 * (in which case the previously stored source is kept).
 */
export function detectTrafficSource(
  pageUrl: string,
  referrer: string,
  ownHost: string,
  userAgent = ""
): TrafficSource | null {
  let url: URL;
  try {
    url = new URL(pageUrl);
  } catch {
    return null;
  }
  const q = url.searchParams;
  const landing = clip(url.pathname, 200);

  let refHost: string | undefined;
  try {
    refHost = referrer ? new URL(referrer).hostname.replace(/^www\./, "").toLowerCase() : undefined;
  } catch {
    refHost = undefined;
  }
  const own = ownHost.replace(/^www\./, "").toLowerCase();
  if (refHost === own) refHost = undefined;

  const utmSource = clip(q.get("utm_source"));
  const utmMedium = clip(q.get("utm_medium"));
  const base = {
    campaign: clip(q.get("utm_campaign")),
    content: clip(q.get("utm_content")),
    term: clip(q.get("utm_term")),
    referrer: refHost,
    landing,
    ts: Date.now(),
  };

  // 1. Explicit campaign tags win
  if (utmSource) {
    return { channel: channelFromUtm(utmSource, utmMedium), source: utmSource.toLowerCase(), medium: utmMedium?.toLowerCase(), ...base };
  }

  const refChannel = refHost ? REFERRER_HOSTS.find(([re]) => re.test(refHost!))?.[1] : undefined;
  // In-app browsers often send no referrer, but identify themselves in the user agent
  const inApp = /Instagram/i.test(userAgent) ? "Instagram" : /FBAN|FBAV|FB_IAB/i.test(userAgent) ? "Facebook" : undefined;

  // 2. Ad click ids
  if (q.get("gclid") || q.get("gbraid") || q.get("wbraid")) {
    return { channel: "Google Ads", source: "google", medium: "cpc", ...base };
  }
  if (q.get("fbclid")) {
    // fbclid is added to every outbound link from Facebook and Instagram (ads or organic)
    const channel = refChannel === "Instagram" || inApp === "Instagram" ? "Instagram" : "Facebook";
    return { channel, source: channel.toLowerCase(), medium: "social", ...base };
  }

  // 3. Referrer
  if (refHost) {
    if (refChannel) {
      const medium = refChannel === "Google" || refChannel === "Bing" ? "organic" : "social";
      return { channel: refChannel, source: refChannel.toLowerCase(), medium, ...base };
    }
    return { channel: "Outros sites", source: refHost, medium: "referral", ...base };
  }

  // 4. Opened inside the Instagram/Facebook app without referrer (bio link, stories, DM)
  if (inApp) return { channel: inApp, source: inApp.toLowerCase(), medium: "social", ...base };

  return null;
}

export function serializeTrafficSource(s: TrafficSource): string {
  return encodeURIComponent(JSON.stringify(s));
}

/** Parses and sanitizes the cookie value (it comes from the browser, so it is untrusted). */
export function parseTrafficSource(raw: string | null | undefined): TrafficSource | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>;
    const str = (v: unknown, max = 100) => (typeof v === "string" ? clip(v, max) : undefined);
    const channel = str(d.channel, 50);
    if (!channel) return null;
    return {
      channel,
      source: str(d.source),
      medium: str(d.medium),
      campaign: str(d.campaign),
      content: str(d.content),
      term: str(d.term),
      referrer: str(d.referrer, 200),
      landing: str(d.landing, 200),
      ts: typeof d.ts === "number" ? d.ts : undefined,
    };
  } catch {
    return null;
  }
}

// ---- Browser helpers -------------------------------------------------------

export function readTrafficSource(): TrafficSource | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${TRAFFIC_COOKIE}=([^;]*)`));
  return parseTrafficSource(match?.[1]);
}

export function storeTrafficSource(s: TrafficSource): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${TRAFFIC_COOKIE}=${serializeTrafficSource(s)}; Max-Age=${MAX_AGE_DAYS * 86400}; Path=/; SameSite=Lax${secure}`;
}

/** Source fields as event parameters (Meta custom_data / internal analytics). */
export function trafficParams(s: TrafficSource | null): Record<string, string> {
  if (!s) return { traffic_channel: "Direto" };
  const out: Record<string, string> = { traffic_channel: s.channel };
  if (s.source) out.utm_source = s.source;
  if (s.medium) out.utm_medium = s.medium;
  if (s.campaign) out.utm_campaign = s.campaign;
  if (s.content) out.utm_content = s.content;
  return out;
}
