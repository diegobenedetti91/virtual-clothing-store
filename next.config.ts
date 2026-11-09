import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  experimental: {
    // Next defaults to (CPU cores - 1) build workers. On Hostinger the host
    // reports 64 cores, so it spawned 63 workers and hit the account's
    // thread/process limit ("OS can't spawn worker thread", SIGABRT).
    cpus: 2,
  },
};

export default nextConfig;
