"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, ArrowRight, Check, CheckCircle2, Clock, CreditCard, GripVertical, MoreHorizontal, Package,
  PackageCheck, RefreshCw, Search, Store, Tag, Truck, X, XCircle,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/admin/ui/Button";

type Status = "PENDING" | "CONFIRMED" | "PRONTO_PARA_RETIRADA" | "SHIPPED" | "RETIRADO" | "DELIVERED" | "CANCELLED";

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  total: number;
  status: Status;
  createdAt: string;
  updatedAt: string;
  paymentMethod: string | null;
  shippingMethod: string | null;
  city: string | null;
  state: string | null;
  trackingCode: string | null;
  melhorEnvioShipmentId: string | null;
  labelValid: boolean | null;
  shipmentRetryError: string | null;
  blingPedidoId: string | null;
  couponCode: string | null;
  itemCount: number;
  thumbs: { name: string; image: string | null }[];
}

const TRANSITIONS: Record<Status, Status[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SHIPPED", "PRONTO_PARA_RETIRADA", "CANCELLED"],
  SHIPPED: ["DELIVERED", "CANCELLED"],
  PRONTO_PARA_RETIRADA: ["RETIRADO", "CANCELLED"],
  RETIRADO: [],
  DELIVERED: [],
  CANCELLED: [],
};

const LABEL: Record<Status, string> = {
  PENDING: "Aguardando pagamento",
  CONFIRMED: "Pago",
  PRONTO_PARA_RETIRADA: "Pronto para retirada",
  SHIPPED: "Enviado",
  RETIRADO: "Retirado",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
};

const ACTION_LABEL: Partial<Record<Status, string>> = {
  CONFIRMED: "Confirmar pagamento",
  SHIPPED: "Marcar como enviado",
  PRONTO_PARA_RETIRADA: "Pronto para retirada",
  RETIRADO: "Cliente retirou",
  DELIVERED: "Marcar como entregue",
  CANCELLED: "Cancelar pedido",
};

interface Column {
  key: string;
  title: string;
  hint: string;
  statuses: Status[];
  /** status que um card recebe ao ser solto aqui */
  dropAs: Status;
  accent: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const COLUMNS: Column[] = [
  { key: "pending", title: "Aguardando pagamento", hint: "Últimos 7 dias", statuses: ["PENDING"], dropAs: "PENDING", accent: "bg-amber-400", icon: Clock },
  { key: "paid", title: "Pago · separar e enviar", hint: "Prioridade do dia", statuses: ["CONFIRMED"], dropAs: "CONFIRMED", accent: "bg-blue-500", icon: Package },
  { key: "pickup", title: "Pronto para retirada", hint: "Esperando o cliente", statuses: ["PRONTO_PARA_RETIRADA"], dropAs: "PRONTO_PARA_RETIRADA", accent: "bg-orange-400", icon: Store },
  { key: "shipped", title: "Enviado", hint: "A caminho do cliente", statuses: ["SHIPPED"], dropAs: "SHIPPED", accent: "bg-violet-500", icon: Truck },
  { key: "done", title: "Concluído", hint: "Últimos 15 dias", statuses: ["DELIVERED", "RETIRADO"], dropAs: "DELIVERED", accent: "bg-emerald-500", icon: CheckCircle2 },
];

const CANCEL_REASONS = ["Cliente desistiu", "Produto indisponível", "Endereço de entrega inválido", "Problema no pagamento", "Pedido duplicado", "Outro"];

const DAY = 24 * 60 * 60 * 1000;
function ago(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 60) return `há ${Math.max(1, min)} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} dia${d > 1 ? "s" : ""}`;
}
const isPickup = (o: Order) => o.shippingMethod === "retirada";
const isLocal = (o: Order) => o.shippingMethod === "local";
const usesLabel = (o: Order) => !!o.shippingMethod && /^\d+$/.test(o.shippingMethod);

/** Próximo passo natural do pedido (botão principal do card). */
function nextStep(o: Order): Status | null {
  if (o.status === "PENDING") return "CONFIRMED";
  if (o.status === "CONFIRMED") return isPickup(o) ? "PRONTO_PARA_RETIRADA" : "SHIPPED";
  if (o.status === "PRONTO_PARA_RETIRADA") return "RETIRADO";
  if (o.status === "SHIPPED") return "DELIVERED";
  return null;
}

interface PendingAction { order: Order; to: Status }

export default function EsteiraPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [blingEnabled, setBlingEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);
  const [q, setQ] = useState("");
  const [onlyAttention, setOnlyAttention] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [action, setAction] = useState<PendingAction | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [dragging, setDragging] = useState<Order | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [now, setNow] = useState(0);

  // Carrega e atualiza a cada 30 s (só com a aba visível)
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/esteira")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setOrders(d.orders || []);
        setBlingEnabled(!!d.blingEnabled);
        setNow(Date.now());
        setLoaded(true);
        setRefreshing(false);
      })
      .catch(() => !cancelled && setRefreshing(false));
    const t = setInterval(() => { if (document.visibilityState === "visible") setTick((n) => n + 1); }, 30000);
    return () => { cancelled = true; clearInterval(t); };
  }, [tick]);

  const refresh = () => { setRefreshing(true); setTick((n) => n + 1); };

  const showToast = (ok: boolean, text: string) => {
    setToast({ ok, text });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  const needsAttention = (o: Order) => {
    if (o.status === "CONFIRMED" && now - new Date(o.updatedAt).getTime() > 2 * DAY) return true;
    if (o.status === "CONFIRMED" && usesLabel(o) && (o.shipmentRetryError || o.labelValid === false || !o.melhorEnvioShipmentId)) return true;
    if (blingEnabled && o.status !== "PENDING" && !o.blingPedidoId) return true;
    return false;
  };

  const visible = useMemo(() => {
    const nq = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (onlyAttention && !needsAttention(o)) return false;
      if (!nq) return true;
      return o.orderNumber.toLowerCase().includes(nq) || o.customerName.toLowerCase().includes(nq) || (o.trackingCode || "").toLowerCase().includes(nq);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, q, onlyAttention, blingEnabled, now]);

  /** Executa a mudança de status (com dados extras do modal, se houver). */
  const run = async (order: Order, to: Status, extra: { trackingCode?: string; reason?: string } = {}) => {
    setBusy(order.id);
    try {
      const res = to === "CANCELLED"
        ? await fetch("/api/orders/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderNumber: order.orderNumber, reason: extra.reason }) })
        : await fetch(`/api/orders/${order.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: to, ...(extra.trackingCode !== undefined ? { trackingCode: extra.trackingCode || undefined } : {}) }),
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível atualizar o pedido");
      setOrders((prev) =>
        to === "CANCELLED"
          ? prev.filter((o) => o.id !== order.id)
          : prev.map((o) => (o.id === order.id ? { ...o, status: to, updatedAt: new Date().toISOString(), trackingCode: extra.trackingCode ?? o.trackingCode } : o))
      );
      showToast(true, `${order.orderNumber}: ${LABEL[to].toLowerCase()}${to === "SHIPPED" || to === "CANCELLED" ? " · cliente avisado por e-mail" : ""}`);
    } catch (e) {
      showToast(false, e instanceof Error ? e.message : "Erro ao atualizar");
    } finally {
      setBusy(null);
    }
  };

  /** Ações que precisam de dados pedem confirmação; o resto vai direto. */
  const request = (order: Order, to: Status) => {
    setMenuFor(null);
    if (to === "SHIPPED" || to === "CANCELLED") setAction({ order, to });
    else run(order, to);
  };

  const bulk = async (to: Status) => {
    const list = orders.filter((o) => selected.has(o.id) && TRANSITIONS[o.status].includes(to));
    if (list.length === 0) return showToast(false, `Nenhum pedido selecionado pode ir para "${LABEL[to]}"`);
    for (const o of list) await run(o, to);
    setSelected(new Set());
  };

  const onDrop = (col: Column) => {
    setOverCol(null);
    const o = dragging;
    setDragging(null);
    if (!o || col.statuses.includes(o.status)) return;
    const to = col.key === "done" ? (isPickup(o) || o.status === "PRONTO_PARA_RETIRADA" ? "RETIRADO" : "DELIVERED") : col.dropAs;
    if (!TRANSITIONS[o.status].includes(to)) return showToast(false, `Não dá para mover de "${LABEL[o.status]}" para "${LABEL[to]}"`);
    request(o, to);
  };

  const canDropOn = (col: Column) => {
    if (!dragging || col.statuses.includes(dragging.status)) return false;
    const to = col.key === "done" ? (dragging.status === "PRONTO_PARA_RETIRADA" ? "RETIRADO" : "DELIVERED") : col.dropAs;
    return TRANSITIONS[dragging.status].includes(to);
  };

  const pickupCount = orders.filter((o) => o.status === "PRONTO_PARA_RETIRADA").length;
  const hasPickupOrders = pickupCount > 0 || orders.some((o) => isPickup(o) && o.status === "CONFIRMED");
  const columns = COLUMNS.filter((c) => c.key !== "pickup" || hasPickupOrders);
  const attentionCount = orders.filter(needsAttention).length;
  const toShip = orders.filter((o) => o.status === "CONFIRMED").length;

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Esteira de pedidos</h1>
          <p className="text-sm text-gray-500 mt-1">
            {toShip > 0 ? <><b className="text-gray-900">{toShip}</b> pedido{toShip > 1 ? "s" : ""} pago{toShip > 1 ? "s" : ""} para separar e enviar. </> : "Tudo em dia por aqui. "}
            Arraste os cards entre as colunas ou use o botão de cada pedido.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pedido, cliente ou rastreio" className="w-60 pl-8 pr-3 py-2 text-[13px] rounded-xl border border-gray-200 bg-white" />
          </label>
          <button
            onClick={() => setOnlyAttention((v) => !v)}
            aria-pressed={onlyAttention}
            className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[13px] font-medium ring-1 transition ${onlyAttention ? "bg-amber-50 text-amber-800 ring-amber-300" : "bg-white text-gray-600 ring-gray-200 hover:bg-gray-50"}`}
          >
            <AlertTriangle size={14} /> Precisa de atenção
            {attentionCount > 0 && <span className="ml-0.5 text-[11px] font-semibold bg-amber-500 text-white rounded-full px-1.5 tabular-nums">{attentionCount}</span>}
          </button>
          <Button size="icon" icon={RefreshCw} onClick={refresh} loading={refreshing} aria-label="Atualizar" className="h-9 w-9" />
        </div>
      </div>

      {/* Ações em lote */}
      {selected.size > 0 && (
        <div className="sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded-2xl bg-gray-900 text-white px-4 py-2.5 shadow-lg animate-fade-up [animation-duration:0.25s]">
          <span className="text-sm font-semibold mr-2">{selected.size} selecionado{selected.size > 1 ? "s" : ""}</span>
          {(["CONFIRMED", "SHIPPED", "PRONTO_PARA_RETIRADA", "DELIVERED", "RETIRADO"] as Status[]).map((s) => (
            <Button key={s} variant="ghost" size="xs" icon={ArrowRight} onClick={() => bulk(s)} className="text-white bg-white/10 hover:bg-white/20 hover:text-white focus-visible:ring-offset-gray-900">
              {LABEL[s]}
            </Button>
          ))}
          <Button variant="ghost" size="xs" icon={X} onClick={() => setSelected(new Set())} className="ml-auto text-white/70 hover:bg-white/10 hover:text-white focus-visible:ring-offset-gray-900">Limpar seleção</Button>
        </div>
      )}

      {/* Quadro */}
      {!loaded ? (
        <div className="flex gap-4 overflow-hidden">{COLUMNS.map((c) => <div key={c.key} className="img-skeleton rounded-2xl h-[480px] w-72 shrink-0" />)}</div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 md:-mx-8 md:px-8 snap-x [scrollbar-width:thin]">
          {columns.map((col) => {
            const list = visible.filter((o) => col.statuses.includes(o.status));
            const total = list.reduce((s, o) => s + o.total, 0);
            const droppable = canDropOn(col);
            const Icon = col.icon;
            return (
              <section
                key={col.key}
                onDragOver={(e) => { if (droppable) { e.preventDefault(); setOverCol(col.key); } }}
                onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
                onDrop={() => onDrop(col)}
                className={`snap-start shrink-0 w-[300px] flex flex-col rounded-2xl transition-all duration-200 ${
                  overCol === col.key ? "bg-brand-light ring-2 ring-[var(--brand)]" : droppable ? "bg-gray-100/80 ring-2 ring-dashed ring-gray-300" : "bg-gray-100/60"
                }`}
              >
                <header className="px-3 pt-3 pb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-5 rounded-full ${col.accent}`} />
                    <Icon size={15} className="text-gray-500" />
                    <h2 className="text-[13px] font-semibold text-gray-900 truncate">{col.title}</h2>
                    <span className="ml-auto text-[11px] font-semibold text-gray-600 bg-white rounded-full px-2 py-0.5 ring-1 ring-gray-200 tabular-nums">{list.length}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1 pl-3.5">{col.hint}{list.length > 0 && <> · <span className="tabular-nums">{formatCurrency(total)}</span></>}</p>
                </header>

                <div className="flex-1 px-2 pb-2 space-y-2 min-h-[420px] max-h-[calc(100vh-260px)] overflow-y-auto [scrollbar-width:thin]">
                  {list.length === 0 && (
                    <div className="h-32 flex flex-col items-center justify-center text-center text-xs text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                      <Icon size={20} className="mb-1.5 opacity-50" />
                      {droppable ? "Solte aqui" : "Nenhum pedido"}
                    </div>
                  )}
                  {list.map((o) => {
                    const step = nextStep(o);
                    const others = TRANSITIONS[o.status].filter((s) => s !== step);
                    const stale = o.status === "CONFIRMED" && now - new Date(o.updatedAt).getTime() > 2 * DAY;
                    const isSel = selected.has(o.id);
                    return (
                      <article
                        key={o.id}
                        draggable={TRANSITIONS[o.status].length > 0}
                        onDragStart={(e) => { setDragging(o); e.dataTransfer.effectAllowed = "move"; }}
                        onDragEnd={() => { setDragging(null); setOverCol(null); }}
                        className={`group relative bg-white rounded-xl p-3 ring-1 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all duration-200 hover:shadow-md ${
                          isSel ? "ring-2 ring-[var(--brand)]" : stale ? "ring-amber-300" : "ring-gray-200/80"
                        } ${dragging?.id === o.id ? "opacity-40 scale-[0.98]" : ""} ${busy === o.id ? "pointer-events-none opacity-60" : ""}`}
                      >
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={isSel}
                            onChange={() => setSelected((prev) => { const n = new Set(prev); if (n.has(o.id)) n.delete(o.id); else n.add(o.id); return n; })}
                            className={`mt-0.5 w-4 h-4 rounded accent-[var(--brand)] cursor-pointer transition-opacity ${isSel || selected.size > 0 ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                            aria-label={`Selecionar ${o.orderNumber}`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <Link href={`/admin/pedidos/${o.id}`} className="text-[13px] font-semibold text-gray-900 hover:text-brand truncate">{o.orderNumber}</Link>
                              <span className="text-[11px] text-gray-400 shrink-0">{ago(o.createdAt)}</span>
                              {TRANSITIONS[o.status].length > 0 && <GripVertical size={14} className="ml-auto text-gray-300 opacity-0 group-hover:opacity-100 cursor-grab shrink-0" />}
                            </div>
                            <p className="text-xs text-gray-600 truncate">{o.customerName}{o.city ? ` · ${o.city}${o.state ? `/${o.state}` : ""}` : ""}</p>
                          </div>
                        </div>

                        <div className="mt-2.5 flex items-center gap-2">
                          <div className="flex -space-x-2">
                            {o.thumbs.map((t, i) => (
                              <span key={i} className="w-8 h-8 rounded-lg ring-2 ring-white bg-gray-100 overflow-hidden shrink-0" title={t.name}>
                                {t.image ? <img src={t.image} alt="" className="w-full h-full object-cover" /> : <Package size={14} className="m-auto mt-2 text-gray-400" />}
                              </span>
                            ))}
                          </div>
                          <span className="text-[11px] text-gray-500">{o.itemCount} {o.itemCount === 1 ? "peça" : "peças"}</span>
                          <span className="ml-auto text-sm font-semibold text-gray-900 tabular-nums">{formatCurrency(o.total)}</span>
                        </div>

                        {/* Etiquetas de situação */}
                        <div className="mt-2 flex flex-wrap gap-1 text-[10.5px] font-medium">
                          {o.paymentMethod && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600"><CreditCard size={10} />{o.paymentMethod}</span>}
                          {isPickup(o) && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-orange-50 text-orange-700"><Store size={10} />Retirada</span>}
                          {isLocal(o) && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600"><Truck size={10} />Entrega local</span>}
                          {usesLabel(o) && o.status !== "PENDING" && (
                            o.melhorEnvioShipmentId && o.labelValid !== false
                              ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700"><PackageCheck size={10} />Etiqueta ok</span>
                              : <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-50 text-red-700" title={o.shipmentRetryError || undefined}><AlertTriangle size={10} />{o.labelValid === false ? "Etiqueta inválida" : o.shipmentRetryError ? "Erro na etiqueta" : "Sem etiqueta"}</span>
                          )}
                          {blingEnabled && o.status !== "PENDING" && (
                            o.blingPedidoId
                              ? <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700">Bling ✓</span>
                              : <span className="px-1.5 py-0.5 rounded-md bg-red-50 text-red-700">Fora do Bling</span>
                          )}
                          {o.couponCode && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-700"><Tag size={10} />{o.couponCode}</span>}
                          {stale && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800"><Clock size={10} />parado {ago(o.updatedAt)}</span>}
                          {o.trackingCode && o.status === "SHIPPED" && <span className="px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600 font-mono">{o.trackingCode}</span>}
                        </div>

                        {/* Ações */}
                        {(step || others.length > 0) && (
                          <div className="mt-2.5 flex items-center gap-1.5">
                            {step && (
                              <Button variant="dark" size="xs" icon={ArrowRight} loading={busy === o.id} onClick={() => request(o, step)} className="flex-1">
                                {ACTION_LABEL[step]}
                              </Button>
                            )}
                            {others.length > 0 && (
                              <div className="relative">
                                <Button variant="ghost" size="iconSm" icon={MoreHorizontal} onClick={() => setMenuFor(menuFor === o.id ? null : o.id)} aria-label="Mais ações" aria-expanded={menuFor === o.id} />
                                {menuFor === o.id && (
                                  <>
                                    <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                                    <div className="absolute right-0 bottom-full mb-1 z-20 w-52 rounded-xl bg-white shadow-xl ring-1 ring-black/10 py-1 animate-fade-up [animation-duration:0.15s]">
                                      {others.map((s) => (
                                        <button
                                          key={s}
                                          onClick={() => request(o, s)}
                                          className={`w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left hover:bg-gray-50 ${s === "CANCELLED" ? "text-red-600" : "text-gray-700"}`}
                                        >
                                          {s === "CANCELLED" ? <XCircle size={14} /> : <ArrowRight size={14} />}
                                          {ACTION_LABEL[s]}
                                        </button>
                                      ))}
                                      <Link href={`/admin/pedidos/${o.id}`} className="flex items-center gap-2 px-3 py-2 text-[13px] text-gray-700 hover:bg-gray-50 border-t border-gray-100">
                                        <Package size={14} /> Ver detalhes, etiqueta e Bling
                                      </Link>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {action && <ActionModal action={action} onClose={() => setAction(null)} onConfirm={(extra) => { const a = action; setAction(null); run(a.order, a.to, extra); }} />}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] animate-fade-up [animation-duration:0.25s]">
          <div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm shadow-xl ${toast.ok ? "bg-gray-900 text-white" : "bg-red-600 text-white"}`}>
            {toast.ok ? <Check size={16} /> : <AlertTriangle size={16} />}
            {toast.text}
            <Button variant="ghost" size="iconSm" icon={X} onClick={() => setToast(null)} aria-label="Fechar" className="ml-1 -mr-1.5 text-white/70 hover:bg-white/15 hover:text-white" />
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────── Modal: enviar (código de rastreio) e cancelar (motivo) ───────── */

function ActionModal({ action, onClose, onConfirm }: { action: PendingAction; onClose: () => void; onConfirm: (extra: { trackingCode?: string; reason?: string }) => void }) {
  const { order, to } = action;
  const [tracking, setTracking] = useState(order.trackingCode || "");
  const [reason, setReason] = useState(CANCEL_REASONS[0]);
  const [custom, setCustom] = useState("");
  const cancel = to === "CANCELLED";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 animate-fade-up [animation-duration:0.25s]">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${cancel ? "bg-red-50 text-red-600" : "bg-violet-50 text-violet-600"}`}>
          {cancel ? <XCircle size={22} /> : <Truck size={22} />}
        </div>
        <h3 className="text-lg font-semibold text-gray-900">{cancel ? `Cancelar ${order.orderNumber}?` : `Enviar ${order.orderNumber}`}</h3>
        <p className="text-sm text-gray-500 mt-1">
          {cancel
            ? "O estoque volta para a loja, o pagamento é estornado quando possível e o cliente recebe um e-mail."
            : "O cliente recebe um e-mail avisando que o pedido saiu, com o código de rastreio."}
        </p>

        {cancel ? (
          <div className="mt-4 space-y-2">
            <label className="block text-xs font-medium text-gray-600">Motivo do cancelamento</label>
            <div className="grid grid-cols-2 gap-1.5">
              {CANCEL_REASONS.map((r) => (
                <button key={r} type="button" onClick={() => setReason(r)} className={`text-left text-xs px-2.5 py-2 rounded-lg ring-1 transition ${reason === r ? "ring-2 ring-red-400 bg-red-50 text-red-800" : "ring-gray-200 text-gray-600 hover:bg-gray-50"}`}>{r}</button>
              ))}
            </div>
            {reason === "Outro" && <input autoFocus value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Descreva o motivo" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />}
          </div>
        ) : (
          <div className="mt-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">Código de rastreio {order.trackingCode ? "(da etiqueta)" : "(opcional)"}</label>
            <input autoFocus value={tracking} onChange={(e) => setTracking(e.target.value.toUpperCase().trim())} placeholder="Ex.: AD123456789BR" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono" />
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Voltar</Button>
          <Button
            variant={cancel ? "danger" : "dark"}
            icon={cancel ? XCircle : Truck}
            onClick={() => onConfirm(cancel ? { reason: reason === "Outro" ? custom.trim() || "Outro" : reason } : { trackingCode: tracking })}
          >
            {cancel ? "Cancelar pedido" : "Confirmar envio"}
          </Button>
        </div>
      </div>
    </div>
  );
}
