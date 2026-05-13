#!/usr/bin/env node
// Purges Hostinger CDN cache after deployment.
// Requires HOSTINGER_API_TOKEN env variable.
// Get token at: hPanel → Account → API Tokens

const token = process.env.HOSTINGER_API_TOKEN;

if (!token) {
  console.log("[purge-cdn] HOSTINGER_API_TOKEN not set, skipping CDN purge");
  process.exit(0);
}

const domain = process.env.DOMAIN || "asthebrand.com.br";

try {
  const res = await fetch(`https://api.hostinger.com/v1/hosting/sites/${domain}/cdn/purge`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ purge_all: true }),
  });

  if (res.ok) {
    console.log("[purge-cdn] CDN cache purged successfully");
  } else {
    const body = await res.text();
    console.warn(`[purge-cdn] Purge returned ${res.status}: ${body}`);
  }
} catch (err) {
  console.warn("[purge-cdn] Failed to purge CDN:", err.message);
}
