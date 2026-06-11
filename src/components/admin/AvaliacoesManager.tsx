"use client";

import { useEffect, useState } from "react";
import { Check, X, Star, Trash2 } from "lucide-react";
import Link from "next/link";

interface Review {
  id: string; productId: string; authorName: string;
  rating: number; comment: string | null; photoUrl: string | null; approved: boolean;
  createdAt: string;
  product: { name: string; slug: string };
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} size={12} className={s <= rating ? "text-yellow-400 fill-yellow-400" : "text-gray-200 fill-gray-200"} />
      ))}
    </div>
  );
}

export default function AvaliacoesManager() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "all">("pending");

  const load = () => {
    setLoading(true);
    fetch("/api/admin/reviews").then((r) => r.json()).then((d) => { setReviews(d); setLoading(false); });
  };
  useEffect(load, []);

  const handleApprove = async (id: string, approved: boolean) => {
    await fetch("/api/admin/reviews", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, approved }) });
    setReviews((prev) => prev.map((r) => r.id === id ? { ...r, approved } : r));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta avaliação?")) return;
    await fetch(`/api/admin/reviews?id=${id}`, { method: "DELETE" });
    setReviews((prev) => prev.filter((r) => r.id !== id));
  };

  const pending = reviews.filter((r) => !r.approved);
  const approved = reviews.filter((r) => r.approved);
  const shown = filter === "pending" ? pending : filter === "approved" ? approved : reviews;

  if (loading) return <div className="py-20 flex justify-center"><div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {([["pending", "Aguardando", pending.length], ["approved", "Aprovadas", approved.length], ["all", "Todas", reviews.length]] as const).map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${filter === key ? "bg-brand text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"}`}
          >
            {label} <span className="ml-1 opacity-70">({count})</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center text-gray-400 text-sm">
          {filter === "pending" ? "Nenhuma avaliação aguardando aprovação." : "Nenhuma avaliação encontrada."}
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((r) => (
            <div key={r.id} className={`bg-white rounded-2xl border shadow-sm p-5 ${!r.approved ? "border-yellow-200" : "border-gray-100"}`}>
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Stars rating={r.rating} />
                    <span className="text-xs font-bold text-gray-700">{r.authorName}</span>
                    <span className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString("pt-BR")}</span>
                    {!r.approved && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold">Pendente</span>}
                    {r.approved && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">Aprovada</span>}
                  </div>
                  <Link href={`/produtos/${r.product.slug}`} target="_blank" className="text-xs text-brand hover:underline font-medium">
                    {r.product.name}
                  </Link>
                  {r.comment && <p className="text-sm text-gray-700 mt-2 leading-relaxed">{r.comment}</p>}
                  {r.photoUrl && <img src={`/uploads/${r.photoUrl}`} alt="Foto" className="mt-2 w-24 h-24 object-cover rounded-lg" />}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!r.approved && (
                    <button onClick={() => handleApprove(r.id, true)} title="Aprovar" className="p-2 rounded-xl bg-green-50 text-green-600 hover:bg-green-100 transition-colors">
                      <Check size={15} />
                    </button>
                  )}
                  {r.approved && (
                    <button onClick={() => handleApprove(r.id, false)} title="Desaprovar" className="p-2 rounded-xl bg-yellow-50 text-yellow-600 hover:bg-yellow-100 transition-colors">
                      <X size={15} />
                    </button>
                  )}
                  <button onClick={() => handleDelete(r.id)} title="Excluir" className="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
