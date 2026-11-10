import type { NextRequest } from "next/server";
import { TRAFFIC_COOKIE, parseTrafficSource } from "@/lib/trafficSource";

/** Traffic source fields to store on an order, read from the visitor's cookie. */
export function getTrafficOrderContext(req: NextRequest) {
  const s = parseTrafficSource(req.cookies.get(TRAFFIC_COOKIE)?.value);
  return {
    trafficChannel: s?.channel ?? "Direto",
    utmSource: s?.source ?? null,
    utmMedium: s?.medium ?? null,
    utmCampaign: s?.campaign ?? null,
    utmContent: s?.content ?? null,
    utmTerm: s?.term ?? null,
    trafficReferrer: s?.referrer ?? null,
    landingPage: s?.landing ?? null,
  };
}
