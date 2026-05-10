"use client";

import { useState } from "react";

interface Props {
  images: string[];
  name: string;
}

export default function ProductGallery({ images, name }: Props) {
  const [current, setCurrent] = useState(0);
  const all = images.length ? images : ["/placeholder-product.svg"];

  return (
    <div className="space-y-3">
      <div className="aspect-[3/4] rounded-3xl overflow-hidden bg-gray-100 shadow-sm">
        <img
          src={all[current]}
          alt={name}
          className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-product.svg"; }}
        />
      </div>
      {all.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {all.map((img, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-18 h-18 shrink-0 rounded-xl overflow-hidden border-2 transition-all ${
                i === current ? "border-pink-600 shadow-md" : "border-transparent opacity-60 hover:opacity-100"
              }`}
              style={{ width: 68, height: 68 }}
            >
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
