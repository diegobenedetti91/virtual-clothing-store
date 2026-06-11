"use client";

import { useEffect, useState } from "react";
import { Star, X } from "lucide-react";
import { useCustomer } from "@/hooks/useCustomer";

interface Review { id: string; authorName: string; rating: number; comment: string | null; photoUrl: string | null; createdAt: string }

function Stars({ rating, interactive = false, onChange }: { rating: number; interactive?: boolean; onChange?: (r: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          disabled={!interactive}
          onClick={() => onChange?.(s)}
          onMouseEnter={() => interactive && setHover(s)}
          onMouseLeave={() => interactive && setHover(0)}
          className={interactive ? "cursor-pointer" : "cursor-default pointer-events-none"}
        >
          <Star
            size={interactive ? 22 : 14}
            className={s <= (hover || rating) ? "text-yellow-400 fill-yellow-400" : "text-gray-200 fill-gray-200"}
          />
        </button>
      ))}
    </div>
  );
}

export default function ProductReviews({ productId }: { productId: string }) {
  const customer = useCustomer((s) => s.customer);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/products/${productId}/reviews`)
      .then((r) => r.json())
      .then((d) => { setReviews(d); setLoading(false); });
  }, [productId]);

  const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) setPhotoUrl(data.filename);
      else setError("Erro ao fazer upload da foto");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    if (!rating) { setError("Selecione uma nota de 1 a 5"); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/products/${productId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: comment.trim() || null, authorName, photoUrl: photoUrl || null }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erro ao enviar avaliação"); return; }
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-16 pt-10 border-t border-gray-100">
      <div className="flex items-center gap-4 mb-8">
        <h2 className="text-xl font-black text-gray-900">Avaliações</h2>
        {reviews.length > 0 && (
          <div className="flex items-center gap-2">
            <Stars rating={Math.round(avgRating)} />
            <span className="text-sm font-bold text-gray-700">{avgRating.toFixed(1)}</span>
            <span className="text-sm text-gray-400">({reviews.length})</span>
          </div>
        )}
      </div>

      {/* Reviews list */}
      {loading ? (
        <div className="py-8 flex justify-center"><div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>
      ) : reviews.length === 0 ? (
        <p className="text-gray-400 text-sm mb-8">Ainda sem avaliações. Seja o primeiro!</p>
      ) : (
        <div className="space-y-4 mb-10">
          {reviews.map((r) => (
            <div key={r.id} className="bg-gray-50 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <Stars rating={r.rating} />
                <span className="text-sm font-bold text-gray-800">{r.authorName}</span>
                <span className="text-xs text-gray-400 ml-auto">{new Date(r.createdAt).toLocaleDateString("pt-BR")}</span>
              </div>
              {r.comment && <p className="text-sm text-gray-600 leading-relaxed">{r.comment}</p>}
              {r.photoUrl && (
                <img
                  src={`/uploads/${r.photoUrl}`}
                  alt="Foto da avaliação"
                  onClick={() => setLightboxImage(`/uploads/${r.photoUrl}`)}
                  className="mt-3 w-32 h-32 object-cover rounded-lg cursor-pointer hover:opacity-90"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80" onClick={() => setLightboxImage(null)}>
          <div className="relative max-w-2xl max-h-[80vh]">
            <img src={lightboxImage} alt="Ampliada" className="max-w-full max-h-[80vh] object-contain" />
            <button onClick={() => setLightboxImage(null)} className="absolute top-4 right-4 bg-white rounded-full p-2 hover:bg-gray-100">
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Submit form */}
      <div className="bg-gray-50 rounded-2xl p-6">
        <h3 className="text-base font-bold text-gray-900 mb-4">Deixar uma avaliação</h3>
        {submitted ? (
          <div className="text-center py-4">
            <p className="text-green-600 font-semibold">Avaliação enviada!</p>
            <p className="text-sm text-gray-500 mt-1">Será publicada após aprovação pela loja.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Sua nota *</p>
              <Stars rating={rating} interactive onChange={setRating} />
            </div>
            {!customer && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Seu nome *</label>
                <input
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  required
                  placeholder="Como você quer aparecer?"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Comentário (opcional)</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="Conte o que achou do produto..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Foto (opcional)</label>
              <div className="flex gap-2 items-end">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  disabled={uploadingPhoto}
                  className="flex-1 text-sm"
                />
                {uploadingPhoto && <span className="text-xs text-gray-400">Enviando...</span>}
              </div>
              {photoUrl && <p className="text-xs text-green-600 mt-1.5">Foto adicionada ✓</p>}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:opacity-90 transition-colors disabled:opacity-60"
            >
              {submitting ? "Enviando..." : "Enviar avaliação"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
