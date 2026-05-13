"use client";

import { useState, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  images: string[];
  name: string;
}

export default function ProductGallery({ images, name }: Props) {
  const [current, setCurrent] = useState(0);
  const stripRef = useRef<HTMLDivElement>(null);
  const all = images.length ? images : ["/placeholder-product.svg"];

  const prev = () => setCurrent((c) => (c - 1 + all.length) % all.length);
  const next = () => setCurrent((c) => (c + 1) % all.length);

  const scrollStrip = (dir: "left" | "right") =>
    stripRef.current?.scrollBy({ left: dir === "left" ? -100 : 100, behavior: "smooth" });

  return (
    <div className="space-y-3">
      {/* Imagem principal */}
      <div className="relative rounded-3xl overflow-hidden bg-gray-100 shadow-sm aspect-[3/4]">
        <img
          src={all[current]}
          alt={name}
          className="w-full h-full object-cover object-top"
          onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-product.svg"; }}
        />

        {all.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center shadow hover:bg-white transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center shadow hover:bg-white transition-colors"
            >
              <ChevronRight size={18} />
            </button>

            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {all.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === current ? "bg-white w-4" : "bg-white/50 w-1.5"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Tira de thumbnails */}
      {all.length > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => scrollStrip("left")}
            className="flex-shrink-0 w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft size={14} />
          </button>

          <div
            ref={stripRef}
            className="flex gap-2 overflow-x-auto flex-1 py-0.5 [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: "none" }}
          >
            {all.map((img, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all ${
                  i === current ? "border-pink-600 shadow-md" : "border-transparent opacity-60 hover:opacity-100"
                }`}
                style={{ width: 64, height: 64 }}
              >
                <img src={img} alt="" className="w-full h-full object-cover object-top" />
              </button>
            ))}
          </div>

          <button
            onClick={() => scrollStrip("right")}
            className="flex-shrink-0 w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
