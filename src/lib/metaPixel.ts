// Meta Pixel (browser side).
//
// The pixel is initialised lazily on the first call, so it only loads on pages
// that actually fire an event (the storefront) and never on the admin.
// Every conversion event is also mirrored to /api/meta/event, which forwards it
// to the Conversions API with the same event_id so Meta deduplicates the pair.

import { getConsent } from "@/lib/cookieConsent";

// Set by <MetaPixelPageView pixelId=...> (store layout) from the admin settings.
let PIXEL_ID: string | null = null;

export function configureMetaPixel(pixelId: string | null | undefined): void {
  PIXEL_ID = pixelId || null;
}

export type MetaBrowserEvent = "ViewContent" | "AddToCart" | "InitiateCheckout" | "Purchase";

export interface MetaContent {
  id: string;
  quantity: number;
  item_price?: number;
}

export interface MetaCustomData {
  currency?: string;
  value?: number;
  content_ids?: string[];
  content_type?: "product" | "product_group";
  content_name?: string;
  contents?: MetaContent[];
  num_items?: number;
  order_id?: string;
}

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  push: Fbq;
  loaded: boolean;
  version: string;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

// Nothing loads or fires until the visitor accepts marketing cookies (LGPD).
// Same bootstrap as Meta's official snippet: a queueing stub plus the async
// fbevents.js loader. Calls made before the script arrives are replayed.
function ensurePixel(): Fbq | null {
  if (typeof window === "undefined" || !PIXEL_ID) return null;
  if (getConsent() !== "accepted") return null;
  if (window.fbq) {
    window.fbq("consent", "grant"); // in case it was revoked earlier in this page session
    return window.fbq;
  }

  const stub = function (...args: unknown[]) {
    if (stub.callMethod) stub.callMethod(...args);
    else stub.queue.push(args);
  } as Fbq;
  stub.push = stub;
  stub.loaded = true;
  stub.version = "2.0";
  stub.queue = [];
  window.fbq = stub;
  if (!window._fbq) window._fbq = stub;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);

  stub("init", PIXEL_ID);
  return stub;
}

export function newMetaEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function metaPageView(): void {
  ensurePixel()?.("track", "PageView");
}

/**
 * Fires a standard event on the pixel and (unless `mirror` is false) sends the
 * same event to the Conversions API through our backend.
 */
export function metaTrack(
  eventName: MetaBrowserEvent,
  customData: MetaCustomData,
  options: { eventId?: string; mirror?: boolean } = {}
): void {
  const fbq = ensurePixel();
  if (!fbq) return;

  const eventId = options.eventId ?? newMetaEventId();
  const data = { currency: "BRL", ...customData };
  fbq("track", eventName, data, { eventID: eventId });

  if (options.mirror === false) return;
  fetch("/api/meta/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({ eventName, eventId, customData: data, eventSourceUrl: window.location.href }),
  }).catch(() => {});
}
