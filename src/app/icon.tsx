import { ImageResponse } from "next/og";
import { getCompanySettings } from "@/lib/company";

export const dynamic = "force-dynamic";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
  const settings = await getCompanySettings();

  if (settings?.logo) {
    try {
      const res = await fetch(settings.logo);
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        const ct = res.headers.get("content-type") || "image/png";
        return new Response(buffer, { headers: { "Content-Type": ct } });
      }
    } catch {
      // fall through to default
    }
  }

  const initial = (settings?.name || "L")[0].toUpperCase();
  const color = settings?.buttonColor || settings?.primaryColor || "#ec4899";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: color,
          borderRadius: "6px",
          color: "white",
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        {initial}
      </div>
    ),
    { ...size }
  );
}
