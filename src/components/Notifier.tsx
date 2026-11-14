"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { answerConfirm, dismissToast, getServerState, getState, subscribe, type Toast } from "@/lib/notify";

const TONE = {
  success: { icon: CheckCircle2, color: "text-emerald-500", bar: "bg-emerald-500" },
  error: { icon: XCircle, color: "text-red-500", bar: "bg-red-500" },
  warning: { icon: AlertTriangle, color: "text-amber-500", bar: "bg-amber-500" },
  info: { icon: Info, color: "text-sky-500", bar: "bg-sky-500" },
} as const;

function ToastItem({ toast }: { toast: Toast }) {
  const [paused, setPaused] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const remaining = useRef(toast.duration);
  const startedAt = useRef(0);
  const t = TONE[toast.tone];
  const Icon = t.icon;

  useEffect(() => {
    if (paused || leaving) return;
    startedAt.current = Date.now();
    const timer = setTimeout(() => setLeaving(true), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - startedAt.current;
    };
  }, [paused, leaving]);

  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => dismissToast(toast.id), 180);
    return () => clearTimeout(timer);
  }, [leaving, toast.id]);

  return (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={`pointer-events-auto relative w-full sm:w-[360px] overflow-hidden rounded-xl bg-white shadow-[0_10px_30px_-8px_rgba(0,0,0,0.25)] ring-1 ring-black/[0.06] transition-all duration-200 ${
        leaving ? "opacity-0 translate-y-1 scale-[0.98]" : "animate-fade-up [animation-duration:0.22s]"
      }`}
    >
      <div className="flex items-start gap-3 py-3 pl-3.5 pr-2.5">
        <Icon size={19} className={`${t.color} shrink-0 mt-px`} />
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-medium text-gray-900 leading-snug whitespace-pre-line break-words">{toast.title}</p>
          {toast.description && <p className="mt-0.5 text-[12.5px] text-gray-500 leading-snug whitespace-pre-line break-words">{toast.description}</p>}
        </div>
        <button type="button" onClick={() => setLeaving(true)} aria-label="Fechar aviso" className="shrink-0 -mt-0.5 p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition">
          <X size={15} />
        </button>
      </div>
      {/* Barra do tempo restante (para quando o mouse está em cima) */}
      <span
        className={`absolute bottom-0 left-0 h-[2px] ${t.bar} opacity-60`}
        style={{ animation: `notify-progress ${toast.duration}ms linear forwards`, animationPlayState: paused ? "paused" : "running" }}
      />
    </div>
  );
}

function ConfirmBox() {
  const { confirm } = useSyncExternalStore(subscribe, getState, getServerState);
  const okRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!confirm) return;
    const previous = document.activeElement as HTMLElement | null;
    // Ação perigosa (excluir): o foco começa em "Cancelar" para um Enter sem querer não apagar nada
    (confirm.tone === "danger" ? cancelRef : okRef).current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); answerConfirm(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [confirm]);

  if (!confirm) return null;
  const danger = confirm.tone === "danger";
  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/25 backdrop-blur-[2px] animate-[fade-in_0.15s_ease-out]" onClick={() => answerConfirm(false)} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`confirm-${confirm.id}-t`}
        aria-describedby={confirm.message ? `confirm-${confirm.id}-d` : undefined}
        className="relative w-full max-w-[380px] rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-black/5 animate-fade-up [animation-duration:0.2s]"
      >
        <div className="flex items-start gap-3">
          <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${danger ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-700"}`}>
            {danger ? <AlertTriangle size={18} /> : <Info size={18} />}
          </span>
          <div className="min-w-0 pt-1">
            <h2 id={`confirm-${confirm.id}-t`} className="text-[15px] font-semibold text-gray-900 leading-snug">{confirm.title}</h2>
            {confirm.message && <p id={`confirm-${confirm.id}-d`} className="mt-1 text-[13px] text-gray-500 leading-relaxed whitespace-pre-line">{confirm.message}</p>}
          </div>
        </div>
        <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button ref={cancelRef} type="button" onClick={() => answerConfirm(false)} className="h-9 px-4 rounded-lg text-[13px] font-medium text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400">
            {confirm.cancelText}
          </button>
          <button
            ref={okRef}
            type="button"
            onClick={() => answerConfirm(true)}
            className={`h-9 px-4 rounded-lg text-[13px] font-semibold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${danger ? "bg-red-600 hover:bg-red-700 focus-visible:ring-red-500" : "bg-gray-900 hover:bg-gray-800 focus-visible:ring-gray-900"}`}
          >
            {confirm.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Monta uma vez no layout raiz: mostra os avisos (canto) e as confirmações (centro). */
export default function Notifier() {
  const { toasts } = useSyncExternalStore(subscribe, getState, getServerState);
  return (
    <>
      {/* Celular: no topo (não cobre a barra "Finalizar" do carrinho/checkout). Computador: canto inferior direito. */}
      <div aria-live="polite" className="pointer-events-none fixed z-[190] inset-x-0 top-0 sm:top-auto sm:bottom-0 sm:inset-x-auto sm:right-0 flex flex-col-reverse sm:flex-col items-center sm:items-end gap-2 p-3 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:p-4">
        {toasts.map((t) => <ToastItem key={t.id} toast={t} />)}
      </div>
      <ConfirmBox />
    </>
  );
}
