"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";
import { detectTrafficSource, readTrafficSource, storeTrafficSource } from "@/lib/trafficSource";

const SESSION_FLAG = "traffic_session_tracked";

/**
 * Detects where the visitor came from (UTM, ad click id, referrer, in-app browser),
 * keeps it in a first-party cookie and records one SESSION_START per browser session.
 * Runs once per full page load (client-side navigations keep the same referrer).
 */
export default function TrafficSourceTracker() {
  useEffect(() => {
    const detected = detectTrafficSource(window.location.href, document.referrer, window.location.hostname, navigator.userAgent);
    if (detected) storeTrafficSource(detected);

    let tracked = false;
    try {
      tracked = sessionStorage.getItem(SESSION_FLAG) === "1";
      if (!tracked) sessionStorage.setItem(SESSION_FLAG, "1");
    } catch {}
    if (tracked && !detected) return;

    // A new source in the middle of a session (e.g. clicked an ad later) also counts as a visit
    const s = detected ?? readTrafficSource();
    track("SESSION_START", {
      path: window.location.pathname,
      channel: s?.channel ?? "Direto",
      utmSource: s?.source,
      utmMedium: s?.medium,
      utmCampaign: s?.campaign,
    });
  }, []);
  return null;
}
