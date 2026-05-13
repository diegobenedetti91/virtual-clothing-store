import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  async headers() {
    return [
      {
        // Tell LiteSpeed and proxies not to cache HTML pages
        source: "/((?!_next/static|_next/image|favicon.ico).*)",
        headers: [
          { key: "X-LiteSpeed-Cache-Control", value: "no-cache" },
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
    ];
  },
};

export default nextConfig;
