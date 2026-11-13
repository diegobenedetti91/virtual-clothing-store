"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Box, CheckCircle2, ChevronDown, Clock, ExternalLink, MapPin, Package, RefreshCw, Search, Truck, Weight, X } from "lucide-react";
import { KpiCard } from "@/components/admin/charts/Charts";
import { Button, ButtonLink } from "@/components/admin/ui/Button";

interface ItemInfo {
  productId: string;
  nome: string;
  quantidade: number;
  variante: string;
  volumeCm3: number;
  pesoGramas: number;
  embalagemNome: string | null;
}
interface PackagePresetRaw {
  id: string;
  name: string;
  comprimento: number;
  largura: number;
  altura: number;
  pesoGramas: number;
}
interface Sugestao {
  embalagens: PackagePresetRaw[];
  pesoTotalGramas: number;
  volumeTotalCm3: number;
  observacao: string;
  cabe: boolean;
}
interface EnvioOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  createdAt: string;
  itens: ItemInfo[];
  sugestao: Sugestao;
}

type Tab = "all" | "one" | "many" | "none";
const DAY = 86400000;

/** Situação do empacotamento sugerido pela API. */
function packKind(o: EnvioOrder): Exclude<Tab, "all"> {
  if (!o.sugestao.cabe || o.sugestao.embalagens.length === 0) return "none";
  return o.sugestao.embalagens.length > 1 ? "many" : "one";
}

export default function EnviosManager() {
  const [orders, setOrders] = useState<EnvioOrder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reload, setReload] = useState(0);
  const [now, setNow] = useState(0);
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [shipFor, setShipFor] = useState<EnvioOrder | null>(null);
  const [tracking, setTracking] = useState("");
  const [saving, setSaving] = useState(false);
  const [shipError, setShipError] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/envios")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setOrders(d.orders || []);
        setNow(Date.now());
        setLoaded(true);
        setRefreshing(false);
      })
      .catch(() => { if (!cancelled) { setLoaded(true); setRefreshing(false); } });
    return () => { cancelled = true; };
  }, [reload]);

  const refresh = () => { setRefreshing(true); setReload((n) => n + 1); };
  const toggle = (id: string) => setExpanded((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const counts = useMemo(() => ({
    all: orders.length,
    one: orders.filter((o) => packKind(o) === "one").length,
    many: orders.filter((o) => packKind(o) === "many").length,
    none: orders.filter((o) => packKind(o) === "none").length,
  }), [orders]);

  const visible = orders.filter((o) => {
    if (tab !== "all" && packKind(o) !== tab) return false;
    const nq = q.trim().toLowerCase();
    if (!nq) return true;
    return o.orderNumber.toLowerCase().includes(nq) || o.customerName.toLowerCase().includes(nq) || (o.city || "").toLowerCase().includes(nq);
  });

  const pieces = orders.reduce((s, o) => s + o.itens.reduce((n, i) => n + i.quantidade, 0), 0);
  const weightKg = orders.reduce((s, o) => s + o.sugestao.pesoTotalGramas, 0) / 1000;
  const oldestDays = orders.length && now ? Math.floor((now - Math.min(...orders.map((o) => new Date(o.createdAt).getTime()))) / DAY) : 0;

  const openShip = (o: EnvioOrder) => { setShipFor(o); setTracking(""); setShipError(""); };
  const confirmShip = async () => {
    if (!shipFor) return;
    setSaving(true);
    setShipError("");
    try {
      const res = await fetch(`/api/orders/${shipFor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "SHIPPED", trackingCode: tracking.trim() || undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Não foi possível marcar como enviado");
      }
      setToast(`${shipFor.orderNumber} marcado como enviado · cliente avisado por e-mail`);
      setTimeout(() => setToast(null), 3500);
      setShipFor(null);
      setReload((n) => n + 1);
    } catch (e) {
      setShipError(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "one", label: "Cabe em 1 embalagem" },
    { key: "many", label: "Várias embalagens" },
    { key: "none", label: "Sem embalagem sugerida" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Envios pendentes</h1>
          <p className="text-sm text-gray-500 mt-1">Pedidos pagos esperando envio, com a embalagem sugerida, o peso e o volume de cada um.</p>
        </div>
        <div className="flex items-center gap-2">
          <ButtonLink href="/admin/embalagens" variant="secondary" icon={Box}>Embalagens</ButtonLink>
          <Button variant="secondary" size="icon" icon={RefreshCw} onClick={refresh} loading={refreshing} aria-label="Atualizar" className="h-9 w-9" />
        </div>
      </div>

      {!loaded ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="img-skeleton rounded-2xl h-[100px]" />)}</div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard icon={Package} label="Aguardando envio" value={String(orders.length)} current={orders.length} />
          <KpiCard icon={Box} label="Peças para separar" value={String(pieces)} current={pieces} />
          <KpiCard icon={Weight} label="Peso total" value={`${weightKg.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg`} current={weightKg} hint="Peças + embalagens sugeridas" />
          <KpiCard icon={Clock} label="Mais antigo" value={orders.length ? (oldestDays === 0 ? "hoje" : `${oldestDays} dia${oldestDays > 1 ? "s" : ""}`) : "—"} current={oldestDays} hint="Há quanto tempo o pedido mais antigo foi feito" />
        </div>
      )}

      {/* Abas + busca */}
      <div className="flex flex-col lg:flex-row lg:items-end gap-3">
        <div className="border-b border-gray-200 flex gap-1 overflow-x-auto [scrollbar-width:none] flex-1">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`relative inline-flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors ${tab === t.key ? "text-gray-900" : "text-gray-500 hover:text-gray-800"}`}>
              {t.label}
              <span className={`text-[11px] font-semibold rounded-full px-1.5 tabular-nums ${t.key === "none" && counts.none > 0 ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-600"}`}>{counts[t.key]}</span>
              <span className={`absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gray-900 transition-transform ${tab === t.key ? "scale-x-100" : "scale-x-0"}`} />
            </button>
          ))}
        </div>
        <label className="relative lg:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pedido, cliente ou cidade" className="w-full pl-8 pr-3 py-2 text-[13px] rounded-xl border border-gray-200 bg-white" />
        </label>
      </div>

      {!loaded ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="img-skeleton rounded-2xl h-24" />)}</div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 py-14 text-center px-4">
          <CheckCircle2 size={34} className="mx-auto text-emerald-400 mb-3" />
          <p className="font-medium text-gray-700">Tudo enviado!</p>
          <p className="text-sm text-gray-500 mt-1">Quando um pedido for pago, ele aparece aqui com a embalagem sugerida.</p>
        </div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-10">Nenhum pedido neste filtro.</p>
      ) : (
        <div className="space-y-3">
          {visible.map((o) => {
            const kind = packKind(o);
            const isOpen = expanded.has(o.id);
            const units = o.itens.reduce((n, i) => n + i.quantidade, 0);
            const days = now ? Math.floor((now - new Date(o.createdAt).getTime()) / DAY) : 0;
            const boxes = o.sugestao.embalagens;
            const uniqueBoxes = [...new Map(boxes.map((c) => [c.id ?? c.name, c])).values()];
            return (
              <div key={o.id} className={`bg-white rounded-2xl border shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:shadow-md ${days >= 2 ? "border-amber-200" : "border-gray-200/70"}`}>
                <div className="flex flex-col md:flex-row md:items-center gap-3 p-4">
                  <button onClick={() => toggle(o.id)} className="flex items-start gap-3 text-left min-w-0 flex-1">
                    <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><Package size={18} /></span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">{o.orderNumber}</span>
                        <span className={`text-[11px] font-medium inline-flex items-center gap-1 ${days >= 2 ? "text-amber-700" : "text-gray-400"}`}>
                          <Clock size={11} /> {days === 0 ? "hoje" : `há ${days} dia${days > 1 ? "s" : ""}`}
                        </span>
                      </span>
                      <span className="block text-xs text-gray-600 truncate">
                        {o.customerName}
                        {o.city && <> · <MapPin size={11} className="inline -mt-0.5" /> {o.city}{o.state ? `/${o.state}` : ""}</>}
                      </span>
                      <span className="block text-[11px] text-gray-400 mt-0.5">{units} peça{units !== 1 ? "s" : ""} · {(o.sugestao.pesoTotalGramas / 1000).toFixed(2)} kg · {(o.sugestao.volumeTotalCm3 / 1000).toFixed(1)} L</span>
                    </span>
                  </button>
                  <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium ${kind === "none" ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
                    {kind === "none" ? <AlertTriangle size={14} /> : <Box size={14} />}
                    <span className="max-w-[260px] truncate" title={o.sugestao.observacao}>{kind === "none" ? o.sugestao.observacao : `${boxes.length > 1 ? `${boxes.length}× ` : ""}${uniqueBoxes[0]?.name}`}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="dark" size="sm" icon={Truck} onClick={() => openShip(o)}>
                      Marcar enviado
                    </Button>
                    <ButtonLink href={`/admin/pedidos/${o.id}`} variant="ghost" size="icon" icon={ExternalLink} aria-label="Abrir pedido" title="Abrir pedido (etiqueta e Bling)" />
                    <Button variant="ghost" size="icon" onClick={() => toggle(o.id)} aria-label={isOpen ? "Recolher" : "Ver itens"} aria-expanded={isOpen}>
                      <ChevronDown className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </Button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-gray-100 px-4 py-4 grid md:grid-cols-2 gap-4 animate-fade-up [animation-duration:0.2s]">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-2">Separar</p>
                      <ul className="space-y-1.5">
                        {o.itens.map((it, i) => (
                          <li key={i} className="flex items-start justify-between gap-3 text-sm">
                            <span className="min-w-0">
                              <span className="font-medium text-gray-900">{it.quantidade}× {it.nome}</span>
                              {it.variante && <span className="block text-xs text-gray-500">{it.variante}</span>}
                              {it.embalagemNome && <span className="inline-block mt-0.5 text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{it.embalagemNome}</span>}
                            </span>
                            <span className="text-xs text-gray-500 shrink-0 tabular-nums">{it.pesoGramas * it.quantidade} g</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className={`rounded-xl p-3.5 ${kind === "none" ? "bg-amber-50" : "bg-gray-50"}`}>
                      <p className="text-xs font-semibold text-gray-500 mb-2">Embalagem sugerida</p>
                      {uniqueBoxes.length > 0 ? (
                        <ul className="space-y-1.5">
                          {uniqueBoxes.map((c, i) => {
                            const qtd = boxes.filter((b) => (b.id ?? b.name) === (c.id ?? c.name)).length;
                            return (
                              <li key={i} className="flex items-center gap-2.5 bg-white rounded-lg px-3 py-2">
                                <Box size={16} className="text-amber-700 shrink-0" />
                                <span className="text-sm">
                                  <b className="text-gray-900">{qtd > 1 ? `${qtd}× ` : ""}{c.name}</b>
                                  <span className="block text-xs text-gray-500 tabular-nums">{c.comprimento}×{c.largura}×{c.altura} cm · tara {c.pesoGramas} g</span>
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="text-sm text-amber-800">Nenhuma embalagem ativa cadastrada. <Link href="/admin/embalagens" className="underline font-medium hover:text-amber-950">Cadastrar embalagens</Link></p>
                      )}
                      <p className={`mt-2 text-xs ${kind === "none" ? "text-amber-800" : "text-gray-600"}`}>{o.sugestao.observacao}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmar envio */}
      {shipFor && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => !saving && setShipFor(null)} />
          <div className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col animate-fade-up [animation-duration:0.3s]">
            <div className="px-6 h-16 flex items-center justify-between border-b border-gray-100 shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">Enviar {shipFor.orderNumber}</h2>
              <Button variant="ghost" size="icon" icon={X} onClick={() => setShipFor(null)} aria-label="Fechar" />
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm">
                <p className="font-medium text-gray-900">{shipFor.customerName}</p>
                <p className="text-xs text-gray-500">{[shipFor.city && `${shipFor.city}${shipFor.state ? `/${shipFor.state}` : ""}`, shipFor.zipCode && `CEP ${shipFor.zipCode}`].filter(Boolean).join(" · ")}</p>
                <p className="text-xs text-gray-500 mt-1">{shipFor.itens.reduce((n, i) => n + i.quantidade, 0)} peça(s) · {shipFor.sugestao.observacao}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Código de rastreio (opcional)</label>
                <input autoFocus value={tracking} onChange={(e) => setTracking(e.target.value.toUpperCase())} placeholder="Ex.: AD123456789BR" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono" />
                <p className="text-xs text-gray-500 mt-1.5">O cliente recebe um e-mail avisando que o pedido saiu{tracking.trim() ? ", com este código de rastreio" : ""}.</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 shrink-0 space-y-2">
              {shipError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{shipError}</p>}
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setShipFor(null)} disabled={saving}>Cancelar</Button>
                <Button variant="primary" icon={Truck} onClick={confirmShip} loading={saving}>
                  Confirmar envio
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] animate-fade-up [animation-duration:0.25s]">
          <div className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm shadow-xl bg-gray-900 text-white"><CheckCircle2 size={16} /> {toast}</div>
        </div>
      )}
    </div>
  );
}
