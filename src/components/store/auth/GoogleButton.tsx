"use client";

import { useEffect, useRef, useState } from "react";

interface GoogleId {
  initialize: (o: { client_id: string; callback: (r: { credential: string }) => void }) => void;
  renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
}
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
/** O login com Google está configurado? (sem o ID, o botão e o separador "ou" somem) */
export const GOOGLE_ENABLED = !!CLIENT_ID;
const SRC = "https://accounts.google.com/gsi/client";

/** Botão oficial do Google. Não aparece se o Google não estiver configurado. */
export default function GoogleButton({ onCredential, text = "continue_with" }: { onCredential: (credential: string) => void; text?: "signin_with" | "signup_with" | "continue_with" }) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onCredential);
  const [ready, setReady] = useState(false);

  useEffect(() => { cb.current = onCredential; }, [onCredential]);

  useEffect(() => {
    if (!CLIENT_ID) return;
    const render = () => {
      const id = window.google?.accounts?.id;
      if (!id || !ref.current) return;
      id.initialize({ client_id: CLIENT_ID, callback: (r) => cb.current(r.credential) });
      ref.current.innerHTML = "";
      id.renderButton(ref.current, { theme: "outline", size: "large", shape: "pill", text, width: Math.min(400, ref.current.offsetWidth || 320), logo_alignment: "center" });
      setReady(true);
    };
    if (window.google?.accounts?.id) { render(); return; }
    let script = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", render);
    return () => script?.removeEventListener("load", render);
  }, [text]);

  if (!CLIENT_ID) return null;
  return (
    <div className="relative min-h-[44px] flex justify-center">
      {!ready && <div className="absolute inset-0 img-skeleton rounded-full" />}
      <div ref={ref} className="w-full flex justify-center" />
    </div>
  );
}
