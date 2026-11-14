"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Bell, BellRing, Check, CheckCircle2, Loader2, Package, Printer, Volume2, VolumeX, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { NewOrder, NewOrderStep } from "@/lib/newOrders";

const SLOW = 30_000; // sem nada em andamento
const FAST = 8_000; // há pedido novo com etapa automática em andamento
const SOUND_KEY = "admin_new_order_sound";

function chime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    // Dois toques curtos e suaves (sem arquivo de áudio)
    [[880, 0], [1320, 0.16]].forEach(([freq, at]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.4);
    });
    setTimeout(() => ctx.close(), 1000);
  } catch {}
}

function StepRow({ step }: { step: NewOrderStep }) {
  const icon =
    step.state === "done" ? <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center"><Check size={12} strokeWidth={3} /></span>
    : step.state === "error" ? <span className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center"><AlertTriangle size={11} strokeWidth={2.5} /></span>
    : <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center"><Loader2 size={12} className="animate-spin" /></span>;
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-px shrink-0">{icon}</span>
      <span className="min-w-0">
        <span className={`block text-[13px] font-medium ${step.state === "error" ? "text-red-700" : "text-gray-800"}`}>{step.label}</span>
        {step.detail && <span className={`block text-[11.5px] leading-snug ${step.state === "error" ? "text-red-600" : "text-gray-500"}`}>{step.detail}</span>}
      </span>
    </li>
  );
}

function StatusLine({ order }: { order: NewOrder }) {
  if (order.ready) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-[13px] font-semibold text-emerald-800">
        <CheckCircle2 size={16} className="shrink-0" /> Pronto para preparar e despachar
      </div>
    );
  }
  if (order.hasError) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-800">
        <AlertTriangle size={16} className="shrink-0" /> Precisa da sua atenção
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 text-[13px] font-medium text-sky-800">
      <Loader2 size={15} className="shrink-0 animate-spin" /> Preparando tudo automaticamente…
    </div>
  );
}

/** Cartão em destaque de um pedido que acabou de chegar (o checklist vai marcando sozinho). */
function ArrivalCard({ order, onClose, onOpen }: { order: NewOrder; onClose: () => void; onOpen: () => void }) {
  return (
    <div role="status" className="pointer-events-auto w-[min(400px,calc(100vw-2rem))] rounded-2xl bg-white shadow-[0_24px_60px_-15px_rgba(0,0,0,0.35)] ring-1 ring-black/[0.06] overflow-hidden animate-toast-in">
      <div className="flex items-start gap-3 px-4 pt-4">
        <span className="w-10 h-10 rounded-full bg-brand-light text-brand flex items-center justify-center shrink-0">
          <BellRing size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand">Novo pedido pago</p>
          <p className="text-[15px] font-semibold text-gray-900 leading-tight">
            {order.orderNumber} · {formatCurrency(order.total)}
          </p>
          <p className="text-xs text-gray-500 truncate">
            {order.customerName} · {order.itemCount} {order.itemCount === 1 ? "peça" : "peças"} · {order.delivery}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar aviso" className="p-1.5 -mr-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
          <X size={16} />
        </button>
      </div>
      <ul className="px-4 pt-3 space-y-2">
        {order.steps.map((s) => <StepRow key={s.key} step={s} />)}
      </ul>
      <div className="px-4 pt-3"><StatusLine order={order} /></div>
      <div className="flex gap-2 p-4">
        {order.canPrintLabel && (
          <a
            href={`/api/admin/pedidos/${order.id}/etiqueta`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-gray-900 text-white text-[13px] font-semibold hover:bg-gray-800"
          >
            <Printer size={15} /> Imprimir etiqueta
          </a>
        )}
        <button type="button" onClick={onOpen} className={`flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg text-[13px] font-semibold ${order.canPrintLabel ? "ring-1 ring-gray-200 text-gray-800 hover:bg-gray-50" : "bg-gray-900 text-white hover:bg-gray-800"}`}>
          <Package size={15} /> Abrir pedido
        </button>
      </div>
    </div>
  );
}

/**
 * Avisos de novos pedidos no admin: sino com a lista + cartão em destaque quando chega um pedido,
 * mostrando se a etiqueta e a nota já saíram e quando está pronto para despachar.
 */
export default function NewOrdersCenter() {
  const router = useRouter();
  const pathname = usePathname();
  const [orders, setOrders] = useState<NewOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const [popups, setPopups] = useState<string[]>([]);
  const [sound, setSound] = useState(true);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | "unsupported">("unsupported");
  const known = useRef<Set<string> | null>(null);

  // Preferências do navegador são lidas ao abrir o painel (não existem no servidor)
  const togglePanel = () => {
    if (!open) {
      try { setSound(localStorage.getItem(SOUND_KEY) !== "0"); } catch {}
      setNotifPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
    }
    setOpen((v) => !v);
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/novos-pedidos", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { orders: NewOrder[]; total: number };
      setOrders(data.orders);
      setTotal(data.total);

      const ids = new Set(data.orders.map((o) => o.id));
      if (known.current === null) {
        // Primeira carga: destaca os pedidos de hoje que ainda não foram vistos (sem som)
        const recent = data.orders.filter((o) => Date.now() - new Date(o.createdAt).getTime() < 24 * 3600_000).slice(0, 2);
        setPopups(recent.map((o) => o.id));
      } else {
        const arrived = data.orders.filter((o) => !known.current!.has(o.id));
        if (arrived.length) {
          setPopups((p) => [...arrived.map((o) => o.id), ...p].slice(0, 3));
          let soundOn = true;
          try { soundOn = localStorage.getItem(SOUND_KEY) !== "0"; } catch {}
          if (soundOn) chime();
          if (document.hidden && typeof Notification !== "undefined" && Notification.permission === "granted") {
            const o = arrived[0];
            const n = new Notification(`Novo pedido ${o.orderNumber}`, {
              body: `${o.customerName} · ${formatCurrency(o.total)}${arrived.length > 1 ? ` (+${arrived.length - 1})` : ""}`,
              tag: o.id,
            });
            n.onclick = () => { window.focus(); router.push(`/admin/pedidos/${o.id}`); };
          }
        }
      }
      known.current = ids;
    } catch {}
  }, [router]);

  // Consulta periódica: mais rápida enquanto um pedido destacado ainda está sendo preparado
  const working = orders.some((o) => popups.includes(o.id) && !o.ready && !o.hasError);
  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const t = setInterval(() => { if (!document.hidden) void load(); }, working ? FAST : SLOW);
    const onVisible = () => { if (!document.hidden) void load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearTimeout(first); clearInterval(t); document.removeEventListener("visibilitychange", onVisible); };
  }, [load, working]);

  // Abriu o pedido: conta como visto
  useEffect(() => {
    const m = pathname?.match(/^\/admin\/pedidos\/([^/]+)$/);
    if (!m) return;
    const id = m[1];
    void fetch("/api/admin/novos-pedidos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [id] }) }).then(() => {
      setOrders((list) => list.filter((o) => o.id !== id));
      setTotal((n) => Math.max(0, n - 1));
      setPopups((p) => p.filter((x) => x !== id));
    });
  }, [pathname]);

  // "(2) Painel" no título da aba: dá para ver de outra aba
  useEffect(() => {
    const clean = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = total > 0 ? `(${total}) ${clean}` : clean;
  }, [total, pathname]);

  const openOrder = (id: string) => {
    setOpen(false);
    setPopups((p) => p.filter((x) => x !== id));
    router.push(`/admin/pedidos/${id}`);
  };
  const markAll = async () => {
    await fetch("/api/admin/novos-pedidos", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    setOrders([]);
    setTotal(0);
    setPopups([]);
    setOpen(false);
  };
  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    try { localStorage.setItem(SOUND_KEY, next ? "1" : "0"); } catch {}
    if (next) chime();
  };
  const askNotif = async () => {
    if (typeof Notification === "undefined") return;
    setNotifPerm(await Notification.requestPermission());
  };

  const popupOrders = popups.map((id) => orders.find((o) => o.id === id)).filter((o): o is NewOrder => !!o);

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={togglePanel}
          aria-label={total ? `${total} pedido(s) novo(s)` : "Novos pedidos"}
          aria-expanded={open}
          className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition ${open ? "bg-white shadow-sm ring-1 ring-gray-200" : "hover:bg-white"} ${total ? "text-gray-900" : "text-gray-500"}`}
        >
          {total ? <BellRing size={18} /> : <Bell size={18} />}
          {total > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-brand text-on-button text-[10.5px] font-bold flex items-center justify-center tabular-nums ring-2 ring-[#f6f7f9]">
              {total > 99 ? "99+" : total}
            </span>
          )}
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full mt-2 z-40 w-[min(420px,calc(100vw-2rem))] rounded-2xl bg-white shadow-2xl ring-1 ring-black/[0.06] overflow-hidden animate-fade-up [animation-duration:0.18s]">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900">Novos pedidos</p>
                {total > 0 && <span className="text-xs text-gray-400">{total}</span>}
                <button type="button" onClick={toggleSound} title={sound ? "Som ligado" : "Som desligado"} aria-label={sound ? "Desligar som" : "Ligar som"} className="ml-auto p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
                  {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
                {total > 0 && (
                  <button type="button" onClick={markAll} className="text-xs font-medium text-gray-500 hover:text-gray-900 px-2 py-1 rounded-lg hover:bg-gray-100">Marcar todos como vistos</button>
                )}
              </div>

              {orders.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <Bell size={26} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-500">Nenhum pedido novo por enquanto.</p>
                  <p className="text-xs text-gray-400 mt-0.5">Quando um pagamento for aprovado, ele aparece aqui.</p>
                </div>
              ) : (
                <ul className="max-h-[60vh] overflow-y-auto divide-y divide-gray-100">
                  {orders.map((o) => (
                    <li key={o.id} className="px-4 py-3 hover:bg-gray-50/70">
                      <button type="button" onClick={() => openOrder(o.id)} className="w-full text-left">
                        <div className="flex items-baseline gap-2">
                          <span className="text-[13px] font-semibold text-gray-900">{o.orderNumber}</span>
                          <span className="text-xs text-gray-500 truncate">{o.customerName}</span>
                          <span className="ml-auto text-[13px] font-semibold text-gray-900 tabular-nums">{formatCurrency(o.total)}</span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {o.steps.filter((s) => s.key !== "pagamento").map((s) => (
                            <span
                              key={s.key}
                              title={s.detail}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10.5px] font-medium ${
                                s.state === "done" ? "bg-emerald-50 text-emerald-700" : s.state === "error" ? "bg-red-50 text-red-700" : "bg-sky-50 text-sky-700"
                              }`}
                            >
                              {s.state === "done" ? <Check size={10} strokeWidth={3} /> : s.state === "error" ? <AlertTriangle size={10} /> : <Loader2 size={10} className="animate-spin" />}
                              {s.label === "Etiqueta de envio" ? "Etiqueta" : s.label === "Pedido no Bling" ? "Bling" : s.label}
                            </span>
                          ))}
                          <span className={`ml-auto text-[11px] font-semibold ${o.ready ? "text-emerald-700" : o.hasError ? "text-red-700" : "text-sky-700"}`}>
                            {o.ready ? "Pronto para despachar" : o.hasError ? "Precisa de atenção" : "Preparando…"}
                          </span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex items-center gap-2 px-4 py-2.5 border-t border-gray-100 bg-gray-50/60">
                <Link href="/admin/esteira" onClick={() => setOpen(false)} className="text-xs font-semibold text-gray-700 hover:text-gray-900">Ir para a Esteira →</Link>
                {notifPerm === "default" && (
                  <button type="button" onClick={askNotif} className="ml-auto text-xs font-medium text-brand hover:underline">Avisar também no computador</button>
                )}
                {notifPerm === "granted" && <span className="ml-auto text-[11px] text-gray-400">Aviso no computador ativado</span>}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Cartões em destaque (abaixo da barra superior, à direita) */}
      {popupOrders.length > 0 && (
        <div className="pointer-events-none fixed z-[180] right-4 top-20 flex flex-col gap-3">
          {popupOrders.map((o) => (
            <ArrivalCard key={o.id} order={o} onClose={() => setPopups((p) => p.filter((x) => x !== o.id))} onOpen={() => openOrder(o.id)} />
          ))}
        </div>
      )}
    </>
  );
}
