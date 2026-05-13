"use client";

import { useState, useRef } from "react";
import { Upload, Plus, X, Link as LinkIcon, ChevronLeft, ChevronRight } from "lucide-react";

interface ImageListInputProps {
  images: string[];
  onChange: (images: string[]) => void;
  aspect?: "square" | "landscape" | "portrait";
}

export default function ImageListInput({ images, onChange }: ImageListInputProps) {
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  const safeSelected = Math.min(selected, Math.max(0, images.length - 1));

  const handleFile = async (file: File) => {
    setError("");
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro no upload");
      const next = [...images, data.url];
      onChange(next);
      setSelected(next.length - 1);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao enviar imagem.");
    } finally {
      setUploading(false);
    }
  };

  const addUrl = () => {
    const trimmed = urlInput.trim();
    if (trimmed && !images.includes(trimmed)) {
      const next = [...images, trimmed];
      onChange(next);
      setUrlInput("");
      setSelected(next.length - 1);
    }
  };

  const remove = (idx: number) => {
    const next = images.filter((_, i) => i !== idx);
    onChange(next);
    setSelected(Math.min(safeSelected, Math.max(0, next.length - 1)));
  };

  const scrollStrip = (dir: "left" | "right") =>
    stripRef.current?.scrollBy({ left: dir === "left" ? -120 : 120, behavior: "smooth" });

  return (
    <div className="space-y-3">
      {images.length > 0 ? (
        <div className="space-y-2">
          {/* Preview principal */}
          <div className="relative rounded-xl overflow-hidden bg-gray-100 h-56 w-full">
            <img
              src={images[safeSelected]}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-product.svg"; }}
            />
            <button
              type="button"
              onClick={() => remove(safeSelected)}
              className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 shadow hover:bg-red-600 transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Tira de thumbnails */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => scrollStrip("left")}
              className="flex-shrink-0 w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 shadow-sm"
            >
              <ChevronLeft size={14} />
            </button>

            <div
              ref={stripRef}
              className="flex gap-2 overflow-x-auto flex-1 py-1 [&::-webkit-scrollbar]:hidden"
              style={{ scrollbarWidth: "none" }}
            >
              {images.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelected(i)}
                  className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                    i === safeSelected
                      ? "border-pink-500"
                      : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                >
                  <img
                    src={img}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-product.svg"; }}
                  />
                </button>
              ))}

              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="flex-shrink-0 w-14 h-14 rounded-lg border-2 border-dashed border-gray-200 hover:border-pink-400 hover:bg-pink-50/40 transition-all flex flex-col items-center justify-center gap-0.5 text-gray-400 hover:text-pink-500 disabled:opacity-60"
              >
                {uploading ? (
                  <div className="w-4 h-4 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Upload size={14} />
                    <span className="text-[10px] font-medium">Add</span>
                  </>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={() => scrollStrip("right")}
              className="flex-shrink-0 w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 shadow-sm"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-pink-400 hover:bg-pink-50/40 transition-all"
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Enviando imagem...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-1">
                <Upload size={22} className="text-gray-400" />
              </div>
              <p className="text-sm font-semibold text-gray-700">Clique ou arraste imagens aqui</p>
              <p className="text-xs text-gray-400">JPG, PNG, WEBP — até 5MB por imagem</p>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />

      <div className="flex gap-2">
        <div className="relative flex-1">
          <LinkIcon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addUrl(); } }}
            className="w-full border border-gray-300 rounded-xl pl-8 pr-4 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition"
            placeholder="Ou cole uma URL de imagem"
          />
        </div>
        <button
          type="button"
          onClick={addUrl}
          className="px-3 py-2 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}
