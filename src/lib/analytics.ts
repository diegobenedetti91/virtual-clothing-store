export async function track(type: string, data?: Record<string, any>) {
  if (typeof window === "undefined") return;

  const sessionId = typeof localStorage !== "undefined" ? localStorage.getItem("analytics_session_id") || generateSessionId() : null;
  if (sessionId) localStorage?.setItem("analytics_session_id", sessionId);

  const payload = {
    type,
    sessionId,
    ...data,
  };

  try {
    await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("Analytics track error:", error);
  }
}

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
