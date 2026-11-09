"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { configureMetaPixel, metaPageView, metaTrack } from "@/lib/metaPixel";
import { getConsent, subscribeConsent } from "@/lib/cookieConsent";

/**
 * Configures the pixel id (from the admin settings) and fires PageView on every
 * client-side navigation inside the storefront. Rendered in the store layout
 * before the page content, so the id is set before any page effect fires events.
 */
export function MetaPixelPageView({ pixelId }: { pixelId: string | null }) {
  configureMetaPixel(pixelId);
  const pathname = usePathname();
  useEffect(() => {
    metaPageView();
  }, [pathname]);

  // First PageView for visitors who accept on the banner
  useEffect(
    () =>
      subscribeConsent(() => {
        if (getConsent() === "accepted") metaPageView();
      }),
    []
  );
  return null;
}

/** Fires ViewContent once per product page view. */
export function MetaViewContent({ productId, name, price }: { productId: string; name: string; price: number }) {
  useEffect(() => {
    metaTrack("ViewContent", {
      content_ids: [productId],
      content_type: "product",
      content_name: name,
      contents: [{ id: productId, quantity: 1, item_price: price }],
      value: price,
    });
  }, [productId, name, price]);
  return null;
}
