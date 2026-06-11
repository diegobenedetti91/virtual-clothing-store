"use client";

import { useEffect, useState } from "react";
import { Zap } from "lucide-react";

interface FlashSale {
  id: string;
  title: string;
  endAt: string;
  discountType: string;
  discountValue: number;
}

export function FlashSaleTimer({ flashSale }: { flashSale: FlashSale }) {
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      const endTime = new Date(flashSale.endAt).getTime();
      const now = new Date().getTime();
      const diff = endTime - now;

      if (diff <= 0) {
        setExpired(true);
        setTimeLeft("");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [flashSale.endAt]);

  if (expired) return null;

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
      <Zap size={20} className="text-red-500 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-bold text-red-700">{flashSale.title}</p>
        <p className="text-xs text-red-600 mt-0.5">
          Termina em: <span className="font-mono font-bold">{timeLeft}</span>
        </p>
      </div>
    </div>
  );
}
