"use client";

import { useEffect, useMemo, useState } from "react";
import { Package, Check, X, Upload, Truck, Send, ExternalLink, ArrowRight, Clock, Inbox, CheckCircle2, XCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { getCarrierTracking } from "@/lib/carrierTracking";
import { Button } from "@/components/admin/ui/Button";

interface Return {
  id: string;
  orderId: string;
  status: string;
  reason: string;
  createdAt: string;
  responseDate?: string;
  adminNotes?: string;
  images?: string;
  returnedItems?: Array<{ itemId: string; quantity: number }>;
  refundAmount: number;
  refundedAt?: string | null;
  trackingCode?: string | null;
  labelSentAt?: string | null;
  order: {
    orderNumber: string;
    customerName: string;
    total: number;
    items: Array<{
      id: string;
      quantity: number;
      price: number;
      size?: string | null;
      color?: string | null;
      product: { name: string; images?: string | null };
    }>;
  };
  customer: {
    name: string;
    email: string;
  };
}

const STATUS_TABS = [
  { status: "PENDING", label: "Novas", icon: Inbox },
  { status: "AWAITING_RETURN", label: "Peça a caminho", icon: Truck },
  { status: "APPROVED", label: "Aprovadas", icon: CheckCircle2 },
  { status: "REJECTED", label: "Recusadas", icon: XCircle },
];

export default function DevolucoesPage() {
  const [selectedReturn, setSelectedReturn] = useState<Return | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [editingTracking, setEditingTracking] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("PENDING");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);

  const [allReturns, setAllReturns] = useState<Return[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(0);
  const [reloadTick, setReloadTick] = useState(0);
  const returns = useMemo(() => allReturns.filter((r) => r.status === statusFilter), [allReturns, statusFilter]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/returns")
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || "Erro ao buscar devoluções");
          setAllReturns([]);
        } else {
          setAllReturns(Array.isArray(data) ? data : []);
          setNow(Date.now());
        }
      })
      .catch(() => !cancelled && setError("Erro ao buscar devoluções"))
      .finally(() => !cancelled && setLoaded(true));
    return () => { cancelled = true; };
  }, [reloadTick]);

  const fetchReturns = () => setReloadTick((n) => n + 1);

  const openReturn = (ret: Return) => {
    setSelectedReturn(ret);
    setTrackingCode(ret.trackingCode || "");
    setEditingTracking(false);
    setAdminNotes("");
    setImages([]);
    setError(null);
  };

  const closeModal = () => {
    setSelectedReturn(null);
    setAdminNotes("");
    setTrackingCode("");
    setImages([]);
    setError(null);
  };

  const handleSendTracking = async () => {
    if (!selectedReturn) return;
    if (!trackingCode.trim()) {
      setError("Informe o código de rastreio da etiqueta gerada no Melhor Envio");
      return;
    }

    setProcessingId(selectedReturn.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/returns/${selectedReturn.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SEND_TRACKING", trackingCode }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao enviar código de rastreio");
        return;
      }

      setNotice({ ok: true, message: `Código ${data.trackingCode} enviado por email ao cliente (pedido ${selectedReturn.order.orderNumber}).` });
      closeModal();
      fetchReturns();
    } catch (err) {
      console.error("Erro ao enviar código de rastreio:", err);
      setError("Erro ao enviar código de rastreio");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecision = async (status: "APPROVED" | "REJECTED") => {
    if (!selectedReturn) return;
    if (!adminNotes.trim()) {
      setError(status === "APPROVED" ? "Descreva a análise do produto antes de aprovar" : "Informe o motivo da recusa");
      return;
    }
    if (status === "APPROVED" && !confirm(`Aprovar a devolução? Será feito o estorno de ${formatCurrency(refundOf(selectedReturn))} e os itens voltarão ao estoque.`)) {
      return;
    }

    setProcessingId(selectedReturn.id);
    setError(null);
    try {
      const imagesData = await Promise.all(
        images.map(async (file) => {
          const formData = new FormData();
          formData.append("file", file);
          const res = await fetch("/api/upload", { method: "POST", body: formData });
          return await res.json();
        })
      );

      const res = await fetch(`/api/admin/returns/${selectedReturn.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          adminNotes,
          images: imagesData,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao processar devolução");
        return;
      }

      if (status === "APPROVED") {
        setNotice(
          data.refund
            ? { ok: data.refund.success, message: data.refund.success ? data.refund.message : `Devolução aprovada, mas o estorno FALHOU: ${data.refund.message}. Faça o estorno manualmente no gateway.` }
            : { ok: true, message: "Devolução aprovada e itens devolvidos ao estoque." }
        );
      } else {
        setNotice({ ok: true, message: "Devolução recusada. O cliente foi avisado por email." });
      }

      closeModal();
      fetchReturns();
    } catch (err) {
      console.error("Erro ao processar devolução:", err);
      setError(err instanceof Error ? err.message : "Erro ao processar devolução");
    } finally {
      setProcessingId(null);
    }
  };

  const returnedLines = (ret: Return) =>
    (ret.returnedItems || []).map((ri) => {
      const item = ret.order.items.find((i) => i.id === ri.itemId);
      return { ...ri, item };
    });

  const refundOf = (ret: Return) =>
    returnedLines(ret).reduce((sum, line) => sum + (line.item ? line.item.price * line.quantity : 0), 0);

  const statusBadge = (status: string) => {
    const styles: Record<string, [string, string]> = {
      PENDING: ["Nova", "bg-amber-50 text-amber-700 ring-amber-200"],
      AWAITING_RETURN: ["Peça a caminho", "bg-blue-50 text-blue-700 ring-blue-200"],
      APPROVED: ["Aprovada", "bg-green-50 text-green-700 ring-green-200"],
      REJECTED: ["Recusada", "bg-red-50 text-red-700 ring-red-200"],
    };
    const [label, cls] = styles[status] || [status, "bg-gray-50 text-gray-700 ring-gray-200"];
    return <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${cls}`}>{label}</span>;
  };

  const trackingLink = (code: string) => {
    const { carrier, url } = getCarrierTracking(code);
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-sm font-semibold text-gray-900 hover:underline" onClick={(e) => e.stopPropagation()}>
        {code}
        {carrier && <span className="font-sans text-xs text-gray-500">({carrier})</span>}
        <ExternalLink size={14} />
      </a>
    );
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of allReturns) c[r.status] = (c[r.status] || 0) + 1;
    return c;
  }, [allReturns]);
  const waitingDays = (ret: Return) => Math.floor((now - new Date(ret.labelSentAt || ret.createdAt).getTime()) / (24 * 60 * 60 * 1000));
  const firstImage = (ret: Return, itemId: string) => {
    const it = ret.order.items.find((i) => i.id === itemId);
    try { const imgs = JSON.parse(it?.product.images || "[]"); return Array.isArray(imgs) ? (imgs[0] as string) ?? null : null; } catch { return null; }
  };
  const NEXT_STEP: Record<string, string> = {
    PENDING: "Gerar a logística reversa e enviar o código ao cliente",
    AWAITING_RETURN: "Quando a peça chegar, analisar e aprovar ou recusar",
    APPROVED: "Concluída",
    REJECTED: "Concluída",
  };

  if (!loaded) {
    return (
      <div className="space-y-4">
        <div className="img-skeleton rounded-2xl h-24" />
        <div className="img-skeleton rounded-2xl h-40" />
        <div className="img-skeleton rounded-2xl h-40" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Devoluções e trocas</h1>
        <p className="text-sm text-gray-500 mt-1">Acompanhe cada solicitação do pedido até o estorno.</p>
      </div>

      {/* Como funciona */}
      <ol className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {[
          { n: 1, title: "Cliente solicita", desc: "Pelo site, escolhendo as peças e o motivo", icon: Package },
          { n: 2, title: "Você envia o código", desc: "Gere a reversa no Melhor Envio e envie o código", icon: Send },
          { n: 3, title: "Peça chega", desc: "Confira o produto quando receber", icon: Truck },
          { n: 4, title: "Aprova ou recusa", desc: "Ao aprovar: estorno e volta ao estoque", icon: Check },
        ].map((s) => (
          <li key={s.n} className="flex items-start gap-3 rounded-2xl bg-white border border-gray-200/70 px-3.5 py-3">
            <span className="w-7 h-7 rounded-full bg-gray-900 text-white text-xs font-semibold flex items-center justify-center shrink-0">{s.n}</span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-gray-900 flex items-center gap-1.5"><s.icon size={13} className="text-gray-400" />{s.title}</p>
              <p className="text-[11px] text-gray-500 leading-snug">{s.desc}</p>
            </div>
          </li>
        ))}
      </ol>

      {notice && (
        <div className={`flex justify-between items-start gap-3 rounded-xl px-4 py-3 ring-1 ${notice.ok ? "bg-emerald-50 ring-emerald-200 text-emerald-800" : "bg-red-50 ring-red-200 text-red-800"}`}>
          <p className="text-sm font-medium">{notice.message}</p>
          <Button variant="ghost" size="iconSm" icon={X} onClick={() => setNotice(null)} aria-label="Fechar" className="-my-1 -mr-2 text-current opacity-60 hover:opacity-100 hover:bg-black/5 hover:text-current" />
        </div>
      )}

      {/* Abas com contadores */}
      <div className="border-b border-gray-200 flex gap-1 overflow-x-auto [scrollbar-width:none]">
        {STATUS_TABS.map((tab) => {
          const n = counts[tab.status] || 0;
          const active = statusFilter === tab.status;
          const urgent = (tab.status === "PENDING" || tab.status === "AWAITING_RETURN") && n > 0;
          return (
            <button
              key={tab.status}
              onClick={() => setStatusFilter(tab.status)}
              className={`relative inline-flex items-center gap-2 px-3 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors ${active ? "text-gray-900" : "text-gray-500 hover:text-gray-800"}`}
            >
              <tab.icon size={15} />
              {tab.label}
              <span className={`text-[11px] font-semibold rounded-full px-1.5 tabular-nums ${urgent ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-600"}`}>{n}</span>
              <span className={`absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gray-900 transition-transform ${active ? "scale-x-100" : "scale-x-0"}`} />
            </button>
          );
        })}
      </div>

      {error && !selectedReturn && <p className="text-sm text-red-700 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

      {returns.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 py-16 text-center">
          <Package size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="font-medium text-gray-700">
            {statusFilter === "PENDING" ? "Nenhuma solicitação nova" : statusFilter === "AWAITING_RETURN" ? "Nenhuma peça a caminho" : "Nada por aqui"}
          </p>
          <p className="text-sm text-gray-500 mt-1">{statusFilter === "PENDING" ? "Quando um cliente pedir devolução, ela aparece aqui." : "Veja as outras abas."}</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {returns.map((ret) => {
            const days = waitingDays(ret);
            const late = (ret.status === "PENDING" && days >= 2) || (ret.status === "AWAITING_RETURN" && days >= 10);
            const lines = returnedLines(ret);
            return (
              <button
                key={ret.id}
                onClick={() => openReturn(ret)}
                className={`text-left bg-white rounded-2xl p-4 ring-1 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-md hover:-translate-y-0.5 transition-all ${late ? "ring-amber-300" : "ring-gray-200/80"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{ret.order.orderNumber}</p>
                    <p className="text-xs text-gray-500 truncate">{ret.customer?.name || ret.order.customerName}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {statusBadge(ret.status)}
                    <p className="text-sm font-semibold text-gray-900 mt-1 tabular-nums">{formatCurrency(ret.status === "APPROVED" ? ret.refundAmount : refundOf(ret))}</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {lines.slice(0, 4).map((l) => {
                      const img = firstImage(ret, l.itemId);
                      return (
                        <span key={l.itemId} className="w-9 h-9 rounded-lg ring-2 ring-white bg-gray-100 overflow-hidden" title={l.item?.product.name}>
                          {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : <Package size={14} className="m-auto mt-2.5 text-gray-400" />}
                        </span>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-600 truncate">{lines.map((l) => `${l.quantity}× ${l.item?.product.name ?? "item"}`).join(", ")}</p>
                </div>

                <p className="mt-3 text-xs text-gray-600 line-clamp-2 bg-gray-50 rounded-lg px-3 py-2">“{ret.reason}”</p>

                <div className="mt-3 flex items-center justify-between gap-2 text-[11px]">
                  {ret.status === "PENDING" || ret.status === "AWAITING_RETURN" ? (
                    <span className="inline-flex items-center gap-1 font-medium text-gray-700"><ArrowRight size={12} className="text-brand" /> {NEXT_STEP[ret.status]}</span>
                  ) : (
                    <span className="text-gray-400">Respondida {ret.responseDate ? `em ${new Date(ret.responseDate).toLocaleDateString("pt-BR")}` : ""}</span>
                  )}
                  {(ret.status === "PENDING" || ret.status === "AWAITING_RETURN") && (
                    <span className={`shrink-0 inline-flex items-center gap-1 ${late ? "text-amber-700 font-semibold" : "text-gray-400"}`}>
                      <Clock size={11} /> {days === 0 ? "hoje" : `${days} dia${days > 1 ? "s" : ""}`}
                    </span>
                  )}
                </div>
                {ret.trackingCode && <p className="mt-2 text-[11px] text-gray-500 flex items-center gap-1.5"><Truck size={12} /> {trackingLink(ret.trackingCode)}</p>}
              </button>
            );
          })}
        </div>
      )}

      {selectedReturn && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex justify-end z-[60]" onClick={closeModal}>
          <div className="bg-white w-full max-w-2xl h-full flex flex-col shadow-2xl animate-fade-up [animation-duration:0.3s]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start gap-4 px-6 py-5 border-b border-gray-100">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-bold text-gray-900">Devolução {selectedReturn.order.orderNumber}</h2>
                  {statusBadge(selectedReturn.status)}
                </div>
                <p className="text-sm text-gray-500 mt-1">Solicitada em {new Date(selectedReturn.createdAt).toLocaleDateString("pt-BR")}</p>
              </div>
              <Button variant="ghost" size="icon" icon={X} onClick={closeModal} aria-label="Fechar" className="shrink-0 text-gray-400" />
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Cliente</dt>
                  <dd className="text-sm font-medium text-gray-900 mt-1">{selectedReturn.customer.name}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">E-mail</dt>
                  <dd className="text-sm text-gray-900 mt-1 break-all">
                    <a href={`mailto:${selectedReturn.customer.email}`} className="hover:underline">{selectedReturn.customer.email}</a>
                  </dd>
                </div>
              </dl>

              <section>
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Motivo</h3>
                <p className="text-sm text-gray-900 leading-relaxed bg-gray-50 rounded-lg px-4 py-3">{selectedReturn.reason}</p>
              </section>

              <section>
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Itens a devolver</h3>
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {returnedLines(selectedReturn).map((line) => (
                    <div key={line.itemId} className="flex justify-between items-start gap-4 px-4 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900">{line.item?.product.name ?? "Item não encontrado no pedido"}</p>
                        {line.item && (line.item.size || line.item.color) && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {[line.item.size && `Tamanho ${line.item.size}`, line.item.color && line.item.color].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-medium text-gray-900">{line.item ? formatCurrency(line.item.price * line.quantity) : "-"}</p>
                        {line.item && <p className="text-xs text-gray-500">{line.quantity} × {formatCurrency(line.item.price)}</p>}
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center px-4 py-3 bg-gray-50 rounded-b-lg">
                    <span className="text-sm text-gray-600">
                      Valor a estornar{selectedReturn.status === "APPROVED" && (selectedReturn.refundedAt ? " · estornado" : " · estorno pendente")}
                    </span>
                    <span className="text-base font-bold text-gray-900">
                      {formatCurrency(selectedReturn.status === "APPROVED" ? selectedReturn.refundAmount : refundOf(selectedReturn))}
                    </span>
                  </div>
                </div>
              </section>

              {/* Etapa 1: admin gera a etiqueta no Melhor Envio e envia o código ao cliente */}
              {(selectedReturn.status === "PENDING" || (selectedReturn.status === "AWAITING_RETURN" && editingTracking)) && (
                <section>
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Truck size={14} /> Código de postagem
                  </h3>
                  <p className="text-xs text-gray-500 mb-3">
                    Gere a logística reversa no Melhor Envio e informe o código. O cliente recebe o código por e-mail para postar a mercadoria.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      value={trackingCode}
                      onChange={(e) => setTrackingCode(e.target.value.toUpperCase())}
                      placeholder="Ex: AD984698169BR"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                    />
                    <Button variant="primary" icon={Send} onClick={handleSendTracking} loading={processingId === selectedReturn.id}>
                      Enviar ao cliente
                    </Button>
                  </div>
                  {selectedReturn.status === "AWAITING_RETURN" && (
                    <Button variant="ghost" size="xs" onClick={() => { setEditingTracking(false); setTrackingCode(selectedReturn.trackingCode || ""); }} className="mt-2">
                      Cancelar alteração
                    </Button>
                  )}
                </section>
              )}

              {selectedReturn.trackingCode && !(selectedReturn.status === "AWAITING_RETURN" && editingTracking) && (
                <section>
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Truck size={14} /> Postagem
                  </h3>
                  <div className="flex flex-wrap items-center justify-between gap-3 border border-gray-200 rounded-lg px-4 py-3">
                    <div>
                      {trackingLink(selectedReturn.trackingCode)}
                      {selectedReturn.labelSentAt && (
                        <p className="text-xs text-gray-500 mt-0.5">Enviado ao cliente em {new Date(selectedReturn.labelSentAt).toLocaleString("pt-BR")}</p>
                      )}
                    </div>
                    {selectedReturn.status === "AWAITING_RETURN" && (
                      <Button size="sm" onClick={() => setEditingTracking(true)}>
                        Alterar código
                      </Button>
                    )}
                  </div>
                </section>
              )}

              {(selectedReturn.status === "APPROVED" || selectedReturn.status === "REJECTED") && (
                <>
                  {selectedReturn.adminNotes && (
                    <section>
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Análise do produto</h3>
                      <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-lg px-4 py-3">{selectedReturn.adminNotes}</p>
                    </section>
                  )}

                  {selectedReturn.images && JSON.parse(selectedReturn.images).length > 0 && (
                    <section>
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Imagens</h3>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                        {JSON.parse(selectedReturn.images).map((img: any, idx: number) => (
                          <a key={idx} href={img.url} target="_blank" rel="noopener noreferrer">
                            <img src={img.url} alt={`Imagem ${idx + 1}`} className="w-full aspect-square object-cover rounded-lg border border-gray-200 hover:opacity-90 transition" />
                          </a>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}

              {(selectedReturn.status === "PENDING" || selectedReturn.status === "AWAITING_RETURN") && (
                <section className="space-y-4">
                  {selectedReturn.status === "AWAITING_RETURN" && (
                    <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                      Aprove ou recuse somente com a mercadoria em mãos. Ao aprovar, os itens voltam ao estoque e o valor é estornado ao cliente.
                    </p>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                      {selectedReturn.status === "PENDING" ? "Motivo da recusa" : "Análise do produto"} *
                    </label>
                    <textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder={selectedReturn.status === "PENDING" ? "Preencha somente se for recusar a solicitação antes da postagem..." : "Descreva a análise realizada no produto..."}
                      rows={selectedReturn.status === "PENDING" ? 3 : 4}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent resize-none"
                    />
                  </div>

                  {selectedReturn.status === "AWAITING_RETURN" && (
                    <div>
                      <span className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Imagens do produto</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => setImages(Array.from(e.target.files || []))}
                        className="hidden"
                        id="image-upload"
                      />
                      <label htmlFor="image-upload" className="flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-lg px-4 py-4 text-sm text-gray-600 cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition">
                        <Upload size={16} />
                        {images.length > 0 ? `${images.length} imagem(ns) selecionada(s) · trocar` : "Adicionar imagens"}
                      </label>
                      {images.length > 0 && (
                        <div className="mt-3 grid grid-cols-4 sm:grid-cols-6 gap-2">
                          {images.map((img, idx) => (
                            <img key={idx} src={URL.createObjectURL(img)} alt={`Preview ${idx + 1}`} className="w-full aspect-square object-cover rounded-lg border border-gray-200" />
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-gray-500 mt-2">A análise e as imagens vão por e-mail ao cliente junto com a decisão.</p>
                    </div>
                  )}
                </section>
              )}

              {error && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <Button variant="ghost" onClick={closeModal}>
                Fechar
              </Button>
              {(selectedReturn.status === "PENDING" || selectedReturn.status === "AWAITING_RETURN") && (
                <Button
                  icon={X}
                  onClick={() => handleDecision("REJECTED")}
                  loading={processingId === selectedReturn.id}
                  className="text-red-700 ring-red-200 hover:bg-red-50 hover:text-red-800 hover:ring-red-300"
                >
                  Recusar
                </Button>
              )}
              {selectedReturn.status === "AWAITING_RETURN" && (
                <Button variant="success" icon={Check} onClick={() => handleDecision("APPROVED")} loading={processingId === selectedReturn.id}>
                  Aprovar e estornar
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
