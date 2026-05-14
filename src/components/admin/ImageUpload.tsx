"use client";

import { useState, useRef } from "react";
import { Upload, X, Link as LinkIcon, ChevronDown } from "lucide-react";

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  aspect?: "square" | "landscape" | "portrait";
  placeholder?: string;
}

export default function ImageUpload({
  value,
  onChange,
  label,
  aspect = "landscape",
  placeholder = "https://...",
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const aspectClass =
    aspect === "square" ? "aspect-square" : aspect === "portrait" ? "aspect-[3/4]" : "h-44";

  const handleFile = async (file: File) => {
    setError("");
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro no upload");
      onChange(data.url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao enviar imagem.");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-2">
      {label && <p className="text-sm font-medium text-gray-700 mb-1.5">{label}</p>}

      {value ? (
        <div className="relative group rounded-xl overflow-hidden bg-gray-100">
          <img
            src={value}
            alt=""
            className={`w-full object-cover ${aspectClass}`}
            onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-product.svg"; }}
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="bg-white text-gray-900 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 hover:bg-gray-100 transition-colors"
            >
              <Upload size={13} /> Trocar
            </button>
            <button
              type="button"
              onClick={() => onChange("")}
              className="bg-red-500 text-white px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 hover:bg-red-600 transition-colors"
            >
              <X size={13} /> Remover
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-brand hover:bg-brand-light/40 transition-all"
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500 font-medium">Enviando imagem...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-1">
                <Upload size={22} className="text-gray-400" />
              </div>
              <p className="text-sm font-semibold text-gray-700">Clique ou arraste a imagem aqui</p>
              <p className="text-xs text-gray-400">JPG, PNG, WEBP — até 5MB</p>
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

      <button
        type="button"
        onClick={() => setShowUrl((v) => !v)}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        <LinkIcon size={11} />
        Usar URL em vez de upload
        <ChevronDown size={11} className={`transition-transform ${showUrl ? "rotate-180" : ""}`} />
      </button>

      {showUrl && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition"
        />
      )}
    </div>
  );
}
