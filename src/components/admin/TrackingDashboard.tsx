"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, CheckCircle2, Clock, Copy, ExternalLink, Info, MapPin, Package, PackageCheck, PackageX, RefreshCw, Search, Truck, XCircle,
} from "lucide-react";
import { getCarrierTracking } from "@/lib/carrierTracking";
import { KpiCard } from "@/components/admin/charts/Charts";
import { Button, ButtonLink, buttonClasses } from "@/components/admin/ui/Button";

interface ShippingStats {
  labelInvalid: number;
  posted: number;
  inTransit: number;
  delivered: number;
  exception: number;
  cancelled: number;
  pending: number;
  shipmentErrors: number;
}
interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  trackingCode: string | null;
  shipmentStatus: string | null;
  labelValid: boolean | null;
  labelError: string | null;
  createdAt: string;
  trackingEvents: Array<{ status: string; timestamp: string; location: string | null }>;
  melhorEnvioShipmentId: string | null;
}
interface ShipmentError {
  id: string;
  orderNumber: string;
  customerName: string;
  error: string | null;
  retryable: boolean;
  lastAttempt: string | null;
}

type Filter = "attention" | "all" | "posted" | "in_transit" | "delivered" | "exception" | "labelInvalid" | "cancelled";
const DAY = 86400000;
/** Etiqueta criada há mais que isso e ainda sem coleta merece atenção. */
const STALE_POSTED_DAYS = 3;

const STATUS: Record<string, { label: string; tone: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  posted: { label: "Aguardando coleta", tone: "bg-blue-50 text-blue-700", icon: Package },
  in_transit: { label: "Em trânsito", tone: "bg-violet-50 text-violet-700", icon: Truck },
  delivered: { label: "Entregue", tone: "bg-emerald-50 text-emerald-700", icon: PackageCheck },
  returned: { label: "Devolvido", tone: "bg-purple-50 text-purple-700", icon: PackageX },
  exception: { label: "Problema na entrega", tone: "bg-red-50 text-red-700", icon: AlertTriangle },
  cancelled: { label: "Cancelado", tone: "bg-gray-100 text-gray-600", icon: XCircle },
};
const statusOf = (s: string | null) => STATUS[s || ""] || { label: "Processando", tone: "bg-gray-100 text-gray-600", icon: Clock };

function ago(iso: string, now: number) {
  const h = Math.floor((now - new Date(iso).getTime()) / 3600000);
  if (h < 1) return "agora";
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} dia${d > 1 ? "s" : ""}`;
}

/** Etiqueta inválida, problema na entrega ou etiqueta parada sem coleta. */
function needsAttention(o: Order, now: number) {
  return (
    o.labelValid === false ||
    o.shipmentStatus === "exception" ||
    (o.shipmentStatus === "posted" && now - new Date(o.createdAt).getTime() > STALE_POSTED_DAYS * DAY)
  );
}

export default function TrackingDashboard() {
  const [stats, setStats] = useState<ShippingStats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [shipmentErrors, setShipmentErrors] = useState<ShipmentError[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reload, setReload] = useState(0);
  const [now, setNow] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/tracking-stats")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setStats(data.stats || null);
        setOrders(data.orders || []);
        setShipmentErrors(data.shipmentErrors || []);
        setNow(Date.now());
        setLoaded(true);
        setRefreshing(false);
      })
      .catch(() => { if (!cancelled) { setLoaded(true); setRefreshing(false); } });
    return () => { cancelled = true; };
  }, [reload]);

  const refresh = () => { setRefreshing(true); setReload((n) => n + 1); };

  const attentionCount = useMemo(() => orders.filter((o) => needsAttention(o, now)).length, [orders, now]);

  const visible = useMemo(() => {
    const nq = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter === "attention" && !needsAttention(o, now)) return false;
      if (filter === "labelInvalid" && o.labelValid !== false) return false;
      if (!["all", "attention", "labelInvalid"].includes(filter) && o.shipmentStatus !== filter) return false;
      if (!nq) return true;
      return o.orderNumber.toLowerCase().includes(nq) || o.customerName.toLowerCase().includes(nq) || (o.trackingCode || "").toLowerCase().includes(nq);
    });
  }, [orders, filter, q, now]);

  // Gera/recria a etiqueta de um pedido (mesma rota de antes)
  const handleRetryShipment = async (orderId: string) => {
    setRetryingId(orderId);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/shipment-retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const result = await res.json();
      setNotice(result.success ? { ok: true, text: result.message || "Etiqueta criada com sucesso" } : { ok: false, text: result.message || result.error || "Não foi possível gerar a etiqueta" });
    } catch {
      setNotice({ ok: false, text: "Erro ao chamar a API" });
    } finally {
      setRetryingId(null);
      setReload((n) => n + 1);
    }
  };

  // Tenta de novo todos os pagos sem etiqueta (GET da mesma rota)
  const handleRetryAll = async () => {
    setIsRetrying(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/shipment-retry");
      const r = await res.json();
      const results: { orderNumber: string; status: string; message: string }[] = r.results || [];
      const failedList = results.filter((x) => x.status !== "success").map((x) => `${x.orderNumber}: ${x.message}`);
      setNotice({
        ok: (r.failed || 0) === 0,
        text: `${r.successful ?? 0} etiqueta(s) criada(s), ${r.failed ?? 0} falha(s).${failedList.length ? ` ${failedList.slice(0, 3).join(" · ")}` : ""}`,
      });
    } catch {
      setNotice({ ok: false, text: "Erro ao processar as tentativas" });
    } finally {
      setIsRetrying(false);
      setReload((n) => n + 1);
    }
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const TABS: { key: Filter; label: string; count: number; urgent?: boolean }[] = [
    { key: "all", label: "Todos", count: orders.length },
    { key: "attention", label: "Precisa de atenção", count: attentionCount, urgent: true },
    { key: "posted", label: "Aguardando coleta", count: stats?.posted ?? 0 },
    { key: "in_transit", label: "Em trânsito", count: stats?.inTransit ?? 0 },
    { key: "delivered", label: "Entregues", count: stats?.delivered ?? 0 },
    { key: "exception", label: "Com problema", count: stats?.exception ?? 0, urgent: true },
    { key: "labelInvalid", label: "Etiqueta inválida", count: stats?.labelInvalid ?? 0, urgent: true },
    { key: "cancelled", label: "Cancelados", count: stats?.cancelled ?? 0 },
  ];

  const GRID = "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.8fr)_160px]";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Rastreamento</h1>
          <p className="text-sm text-gray-500 mt-1">Situação de todas as etiquetas do Melhor Envio, do pagamento até a entrega.</p>
        </div>
        <Button variant="secondary" icon={RefreshCw} onClick={refresh} loading={refreshing} className="self-start sm:self-auto">
          Atualizar
        </Button>
      </div>

      {!loaded ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="img-skeleton rounded-2xl h-[100px]" />)}</div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <KpiCard icon={Package} label="Aguardando coleta" value={String(stats?.posted ?? 0)} current={stats?.posted ?? 0} />
          <KpiCard icon={Truck} label="Em trânsito" value={String(stats?.inTransit ?? 0)} current={stats?.inTransit ?? 0} />
          <KpiCard icon={PackageCheck} label="Entregues" value={String(stats?.delivered ?? 0)} current={stats?.delivered ?? 0} />
          <KpiCard icon={AlertTriangle} label="Com problema" value={String(stats?.exception ?? 0)} current={stats?.exception ?? 0} hint="Ocorrência informada pela transportadora" />
          <KpiCard icon={XCircle} label="Etiquetas inválidas" value={String(stats?.labelInvalid ?? 0)} current={stats?.labelInvalid ?? 0} hint="Precisam ser recriadas" />
          <KpiCard icon={PackageX} label="Pagos sem etiqueta" value={String(stats?.shipmentErrors ?? 0)} current={stats?.shipmentErrors ?? 0} hint="A geração automática falhou" />
        </div>
      )}

      {notice && (
        <div className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${notice.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
          {notice.ok ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> : <AlertTriangle size={16} className="shrink-0 mt-0.5" />}
          <span className="flex-1 break-words">{notice.text}</span>
          <Button variant="ghost" size="iconSm" icon={XCircle} onClick={() => setNotice(null)} aria-label="Fechar" className="-my-1 -mr-1 shrink-0 text-current opacity-60 hover:bg-black/5 hover:text-current hover:opacity-100" />
        </div>
      )}

      {/* Pedidos pagos sem etiqueta (erro na geração automática) */}
      {shipmentErrors.length > 0 && (
        <section className="bg-white rounded-2xl border border-red-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <header className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 bg-red-50/70 border-b border-red-100 rounded-t-2xl">
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-red-800 flex items-center gap-2"><PackageX size={16} /> Pedidos pagos sem etiqueta ({shipmentErrors.length})</h2>
              <p className="text-xs text-red-700/80 mt-0.5">A geração automática falhou. Corrija a causa (saldo, CEP ou endereço) e gere de novo.</p>
            </div>
            <Button variant="danger" size="sm" icon={RefreshCw} onClick={handleRetryAll} loading={isRetrying} className="self-start sm:self-auto">
              Retentar todos
            </Button>
          </header>
          <ul className="divide-y divide-gray-100">
            {shipmentErrors.map((o) => (
              <li key={o.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{o.orderNumber} <span className="text-gray-500 font-normal">· {o.customerName}</span></p>
                  <p className="text-xs text-red-600 break-words">{o.retryable && <b>[Saldo] </b>}{o.error || "Erro desconhecido"}</p>
                  {o.lastAttempt && now > 0 && <p className="text-[11px] text-gray-400">Última tentativa {ago(o.lastAttempt, now)}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="dark" size="sm" icon={Package} onClick={() => handleRetryShipment(o.id)} loading={retryingId === o.id} disabled={isRetrying}>
                    Gerar etiqueta
                  </Button>
                  <ButtonLink href={`/admin/pedidos/${o.id}`} variant="secondary" size="sm">Ver pedido</ButtonLink>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Abas + busca */}
      <div className="flex flex-col xl:flex-row xl:items-end gap-3">
        <div className="border-b border-gray-200 flex gap-1 overflow-x-auto [scrollbar-width:none] flex-1">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setFilter(t.key)} className={`relative inline-flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors ${filter === t.key ? "text-gray-900" : "text-gray-500 hover:text-gray-800"}`}>
              {t.label}
              <span className={`text-[11px] font-semibold rounded-full px-1.5 tabular-nums ${t.urgent && t.count > 0 ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-600"}`}>{t.count}</span>
              <span className={`absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gray-900 transition-transform ${filter === t.key ? "scale-x-100" : "scale-x-0"}`} />
            </button>
          ))}
        </div>
        <label className="relative xl:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pedido, cliente ou rastreio" className="w-full pl-8 pr-3 py-2 text-[13px] rounded-xl border border-gray-200 bg-white" />
        </label>
      </div>

      {/* Lista */}
      {!loaded ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="img-skeleton rounded-2xl h-20" />)}</div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 py-12 text-center px-4">
          <Truck size={30} className="mx-auto text-gray-300 mb-3" />
          <p className="font-medium text-gray-700">{orders.length === 0 ? "Nenhuma etiqueta gerada ainda" : filter === "attention" ? "Nada precisando de atenção" : "Nenhum envio neste filtro"}</p>
          <p className="text-sm text-gray-500 mt-1">{orders.length === 0 ? "As etiquetas são geradas automaticamente quando o pagamento é aprovado." : "Veja as outras abas."}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className={`hidden lg:grid ${GRID} gap-3 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 border-b border-gray-100 bg-gray-50/60 rounded-t-2xl`}>
            <span>Pedido</span><span>Situação</span><span>Rastreio</span><span>Último evento</span><span className="text-right">Ações</span>
          </div>
          <ul className="divide-y divide-gray-100">
            {visible.map((o) => {
              const invalid = o.labelValid === false;
              const st = statusOf(o.shipmentStatus);
              const Icon = invalid ? XCircle : st.icon;
              const last = o.trackingEvents?.[0];
              const attention = needsAttention(o, now);
              const tr = o.trackingCode ? getCarrierTracking(o.trackingCode) : null;
              return (
                <li key={o.id} className={`grid grid-cols-1 ${GRID} gap-2 lg:gap-3 px-4 py-3.5 ${attention ? "bg-amber-50/40" : ""}`}>
                  <div className="min-w-0">
                    <Link href={`/admin/pedidos/${o.id}`} className="text-sm font-semibold text-gray-900 hover:text-brand">{o.orderNumber}</Link>
                    <p className="text-xs text-gray-500 truncate">{o.customerName}</p>
                    {now > 0 && <p className="text-[11px] text-gray-400">pedido {ago(o.createdAt, now)}</p>}
                  </div>
                  <div className="min-w-0">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-semibold ${invalid ? "bg-red-50 text-red-700" : st.tone}`}>
                      <Icon size={12} /> {invalid ? "Etiqueta inválida" : st.label}
                    </span>
                    {invalid && o.labelError && <p className="text-[11px] text-red-600 mt-1 line-clamp-2" title={o.labelError}>{o.labelError}</p>}
                    {!invalid && o.shipmentStatus === "posted" && attention && <p className="text-[11px] text-amber-700 mt-1">Sem coleta há mais de {STALE_POSTED_DAYS} dias</p>}
                  </div>
                  <div className="min-w-0">
                    {o.trackingCode ? (
                      <div className="flex items-center gap-1.5">
                        <a href={tr?.url} target="_blank" rel="noopener noreferrer" className="font-mono text-[13px] text-gray-900 hover:underline truncate">{o.trackingCode}</a>
                        <Button variant="ghost" size="iconSm" onClick={() => copy(o.trackingCode!, o.id)} aria-label="Copiar rastreio" className="shrink-0 text-gray-400">
                          {copied === o.id ? <CheckCircle2 className="text-emerald-600" /> : <Copy />}
                        </Button>
                      </div>
                    ) : <span className="text-xs text-gray-400">Ainda sem código</span>}
                    {tr?.carrier && <p className="text-[11px] text-gray-400">{tr.carrier}</p>}
                  </div>
                  <div className="min-w-0">
                    {last ? (
                      <div className="relative pl-4">
                        <span className="absolute left-0 top-1.5 w-2 h-2 rounded-full bg-brand" />
                        <p className="text-[13px] text-gray-800 line-clamp-2">{last.status}</p>
                        <p className="text-[11px] text-gray-400">
                          {new Date(last.timestamp).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                          {last.location && <> · <MapPin size={10} className="inline -mt-0.5" /> {last.location}</>}
                        </p>
                      </div>
                    ) : <span className="text-xs text-gray-400">Nenhum evento ainda</span>}
                  </div>
                  <div className="flex items-center lg:justify-end gap-1">
                    {invalid && (
                      <Button variant="danger" size="xs" icon={RefreshCw} onClick={() => handleRetryShipment(o.id)} loading={retryingId === o.id}>
                        Recriar
                      </Button>
                    )}
                    {tr?.url && (
                      <a href={tr.url} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "ghost", size: "iconSm", className: "text-gray-400" })} aria-label="Rastrear na transportadora" title="Rastrear na transportadora"><Truck /></a>
                    )}
                    <ButtonLink href={`/admin/pedidos/${o.id}`} variant="ghost" size="iconSm" icon={ExternalLink} aria-label="Abrir pedido" title="Abrir pedido" className="text-gray-400" />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="flex gap-3 rounded-2xl bg-blue-50/70 px-4 py-3 text-sm text-blue-900">
        <Info size={16} className="shrink-0 mt-0.5" />
        <ul className="space-y-0.5 text-[13px]">
          <li>A situação é sincronizada automaticamente com o Melhor Envio (aviso da transportadora e verificação periódica).</li>
          <li>Etiquetas inválidas precisam ser recriadas; pedidos com problema na entrega merecem contato com o cliente.</li>
          <li>O cliente recebe e-mail quando o pedido é coletado e quando é entregue.</li>
        </ul>
      </div>
    </div>
  );
}
