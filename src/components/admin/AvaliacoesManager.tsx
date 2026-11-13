"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Clock, ExternalLink, MessageSquare, Package, Star, Trash2, X } from "lucide-react";

interface Review {
  id: string; productId: string; authorName: string;
  rating: number; comment: string | null; photoUrl: string | null; approved: boolean;
  createdAt: string;
  product: { name: string; slug: string };
}

interface Props {
  /** Primeira foto de cada produto (productId → url), carregada na página */
  productImages?: Record<string, string | null>;
}

function Stars({ rating, size = 13 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} size={size} className={s <= rating ? "text-amber-400 fill-amber-400" : "text-gray-200 fill-gray-200"} />
      ))}
    </div>
  );
}

// Mantém a regra antiga (arquivo em /uploads) e aceita URL completa
const photoSrc = (p: string) => (p.startsWith("http") || p.startsWith("/") || p.startsWith("data:") ? p : `/uploads/${p}`);

type Tab = "pending" | "approved" | "all";

export default function AvaliacoesManager({ productImages = {} }: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("pending");
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/reviews")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setReviews(Array.isArray(d) ? d : []); setLoaded(true); } })
      .catch(() => !cancelled && setLoaded(true));
    return () => { cancelled = true; };
  }, []);

  const handleApprove = async (id: string, approved: boolean) => {
    await fetch("/api/admin/reviews", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, approved }) });
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, approved } : r)));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta avaliação? Essa ação não pode ser desfeita.")) return;
    await fetch(`/api/admin/reviews?id=${id}`, { method: "DELETE" });
    setReviews((prev) => prev.filter((r) => r.id !== id));
  };

  const pending = reviews.filter((r) => !r.approved);
  const approved = reviews.filter((r) => r.approved);
  const avg = approved.length ? approved.reduce((s, r) => s + r.rating, 0) / approved.length : null;
  const byStars = useMemo(() => [5, 4, 3, 2, 1].map((n) => ({ n, count: reviews.filter((r) => r.rating === n).length })), [reviews]);

  const base = tab === "pending" ? pending : tab === "approved" ? approved : reviews;
  const shown = ratingFilter ? base.filter((r) => r.rating === ratingFilter) : base;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Avaliações</h1>
        <p className="text-sm text-gray-500 mt-1">Aprove as avaliações dos clientes antes de elas aparecerem na página do produto.</p>
      </div>

      {/* Indicadores */}
      {!loaded ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="img-skeleton rounded-2xl h-24" />)}</div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className={`bg-white rounded-2xl border p-4 ${pending.length ? "border-amber-200" : "border-gray-200/70"}`}>
            <p className="text-[13px] text-gray-500 flex items-center gap-1.5"><Clock size={14} className="text-gray-400" /> Aguardando aprovação</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">{pending.length}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200/70 p-4">
            <p className="text-[13px] text-gray-500 flex items-center gap-1.5"><Star size={14} className="text-gray-400" /> Nota média publicada</p>
            <div className="mt-1 flex items-center gap-2">
              <p className="text-2xl font-semibold text-gray-900 tabular-nums">{avg != null ? avg.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—"}</p>
              {avg != null && <Stars rating={Math.round(avg)} />}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200/70 p-4">
            <p className="text-[13px] text-gray-500 flex items-center gap-1.5"><MessageSquare size={14} className="text-gray-400" /> Total de avaliações</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">{reviews.length}</p>
            <p className="text-xs text-gray-500">{approved.length} publicada{approved.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200/70 p-4">
            <p className="text-[13px] text-gray-500 mb-1.5">Distribuição das notas</p>
            <ul className="space-y-0.5">
              {byStars.map(({ n, count }) => (
                <li key={n} className="flex items-center gap-2 text-[11px] text-gray-500">
                  <span className="w-3 tabular-nums">{n}</span>
                  <span className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <span className="block h-full rounded-full bg-amber-400" style={{ width: `${reviews.length ? (count / reviews.length) * 100 : 0}%` }} />
                  </span>
                  <span className="w-5 text-right tabular-nums">{count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Abas + filtro por nota */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 border-b border-gray-200">
        <div className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
          {([["pending", "Pendentes", pending.length], ["approved", "Aprovadas", approved.length], ["all", "Todas", reviews.length]] as const).map(([key, label, count]) => {
            const active = tab === key;
            return (
              <button key={key} onClick={() => setTab(key)} className={`relative inline-flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors ${active ? "text-gray-900" : "text-gray-500 hover:text-gray-800"}`}>
                {label}
                <span className={`text-[11px] font-semibold rounded-full px-1.5 tabular-nums ${key === "pending" && count > 0 ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-600"}`}>{count}</span>
                <span className={`absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gray-900 transition-transform ${active ? "scale-x-100" : "scale-x-0"}`} />
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1 pb-2">
          <span className="text-xs text-gray-500 mr-1">Nota:</span>
          <button onClick={() => setRatingFilter(null)} className={`px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${ratingFilter == null ? "bg-gray-900 text-white ring-gray-900" : "ring-gray-200 text-gray-600 hover:bg-gray-50"}`}>Todas</button>
          {[5, 4, 3, 2, 1].map((n) => (
            <button key={n} onClick={() => setRatingFilter(ratingFilter === n ? null : n)} className={`inline-flex items-center gap-0.5 px-2 py-1 rounded-full text-xs font-medium ring-1 ${ratingFilter === n ? "bg-gray-900 text-white ring-gray-900" : "ring-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {n}<Star size={10} className={ratingFilter === n ? "fill-white" : "fill-amber-400 text-amber-400"} />
            </button>
          ))}
        </div>
      </div>

      {!loaded ? (
        <div className="grid gap-3 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="img-skeleton rounded-2xl h-40" />)}</div>
      ) : shown.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 py-16 text-center px-4">
          <Star size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="font-medium text-gray-700">
            {tab === "pending" && !ratingFilter ? "Nenhuma avaliação aguardando aprovação" : "Nenhuma avaliação encontrada"}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {reviews.length === 0 ? "Depois da entrega, os clientes recebem um e-mail convidando para avaliar o produto." : ratingFilter ? "Tente outra nota ou outra aba." : "Tudo em dia por aqui."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {shown.map((r) => {
            const img = productImages[r.productId];
            return (
              <article key={r.id} className={`bg-white rounded-2xl border shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-md transition-shadow p-4 flex flex-col ${r.approved ? "border-gray-200/70" : "border-amber-200"}`}>
                <div className="flex items-start gap-3">
                  <Link href={`/produtos/${r.product.slug}`} target="_blank" className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center" title="Ver produto na loja">
                    {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : <Package size={18} className="text-gray-400" />}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/produtos/${r.product.slug}`} target="_blank" className="inline-flex items-center gap-1 text-sm font-medium text-gray-900 hover:text-brand truncate max-w-full">
                      <span className="truncate">{r.product.name}</span> <ExternalLink size={12} className="shrink-0 text-gray-400" />
                    </Link>
                    <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                      <Stars rating={r.rating} />
                      <span className="text-xs font-semibold text-gray-700">{r.authorName}</span>
                      <span className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>
                  <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 ${r.approved ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-amber-200"}`}>
                    {r.approved ? "Publicada" : "Pendente"}
                  </span>
                </div>

                {(r.comment || r.photoUrl) && (
                  <div className="mt-3 flex gap-3">
                    {r.comment ? <p className="flex-1 text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-xl px-3 py-2">“{r.comment}”</p> : <span className="flex-1" />}
                    {r.photoUrl && (
                      <button onClick={() => setZoom(photoSrc(r.photoUrl!))} className="w-20 h-20 rounded-xl overflow-hidden shrink-0 ring-1 ring-gray-200 hover:ring-gray-400 transition" title="Ver foto maior">
                        <img src={photoSrc(r.photoUrl)} alt="Foto enviada pelo cliente" className="w-full h-full object-cover" />
                      </button>
                    )}
                  </div>
                )}
                {!r.comment && !r.photoUrl && <p className="mt-3 text-xs text-gray-400 italic">Avaliação só com nota, sem comentário.</p>}

                <div className="mt-auto pt-3 flex items-center gap-1.5">
                  {!r.approved ? (
                    <button onClick={() => handleApprove(r.id, true)} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-800">
                      <Check size={13} /> Aprovar e publicar
                    </button>
                  ) : (
                    <button onClick={() => handleApprove(r.id, false)} className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg ring-1 ring-gray-200 text-gray-600 hover:bg-gray-50">
                      <X size={13} /> Tirar do ar
                    </button>
                  )}
                  <button onClick={() => handleDelete(r.id)} className="ml-auto p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="Excluir avaliação" title="Excluir">
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Foto ampliada */}
      {zoom && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setZoom(null)}>
          <div className="absolute inset-0 bg-gray-900/70 backdrop-blur-sm" />
          <img src={zoom} alt="Foto da avaliação" className="relative max-h-[85vh] max-w-full rounded-2xl shadow-2xl animate-fade-up [animation-duration:0.25s]" />
          <button className="absolute top-4 right-4 p-2 rounded-xl bg-white/90 text-gray-700" aria-label="Fechar"><X size={18} /></button>
        </div>
      )}
    </div>
  );
}
