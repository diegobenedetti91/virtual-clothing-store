"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCircle, Mail, Trash2 } from "lucide-react";
import Link from "next/link";

interface WaitlistEntry {
  id: string;
  email: string;
  name: string | null;
  size: string;
  color: string;
  notified: boolean;
  createdAt: string;
  product: { id: string; name: string; slug: string };
}

interface VariantGroup {
  productId: string;
  productName: string;
  productSlug: string;
  size: string;
  color: string;
  entries: WaitlistEntry[];
}

function groupByVariant(entries: WaitlistEntry[]): VariantGroup[] {
  const map = new Map<string, VariantGroup>();
  for (const e of entries) {
    const key = `${e.product.id}|${e.size}|${e.color}`;
    if (!map.has(key)) {
      map.set(key, {
        productId: e.product.id,
        productName: e.product.name,
        productSlug: e.product.slug,
        size: e.size,
        color: e.color,
        entries: [],
      });
    }
    map.get(key)!.entries.push(e);
  }
  return Array.from(map.values());
}

export default function WaitlistManager() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifying, setNotifying] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "notified" | "all">("pending");

  const load = () => {
    setLoading(true);
    fetch("/api/waitlist")
      .then((r) => r.json())
      .then((d) => { setEntries(d); setLoading(false); });
  };
  useEffect(load, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Remover este registro?")) return;
    await fetch(`/api/admin/waitlist?id=${id}`, { method: "DELETE" });
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const handleNotify = async (group: VariantGroup) => {
    const key = `${group.productId}|${group.size}|${group.color}`;
    setNotifying(key);
    try {
      const res = await fetch("/api/waitlist/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: group.productId,
          size: group.size,
          color: group.color,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`${data.sent} e-mail(s) enviado(s)!`);
        load();
      } else {
        alert("Erro ao enviar notificações");
      }
    } finally {
      setNotifying(null);
    }
  };

  const shown = entries.filter((e) =>
    filter === "pending" ? !e.notified : filter === "notified" ? e.notified : true
  );

  const groups = groupByVariant(shown);

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <div className="w-6 h-6 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const pendingCount = entries.filter((e) => !e.notified).length;

  return (
    <div className="space-y-6">
      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["pending", "notified", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              filter === f ? "bg-brand text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f === "pending" ? `Aguardando${pendingCount > 0 ? ` (${pendingCount})` : ""}` : f === "notified" ? "Notificados" : "Todos"}
          </button>
        ))}
      </div>

      {groups.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Bell size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum registro encontrado</p>
        </div>
      )}

      {groups.map((group) => {
        const key = `${group.productId}|${group.size}|${group.color}`;
        const variantLabel = [group.size, group.color].filter(Boolean).join(" / ") || "Sem variação";
        const pendingInGroup = group.entries.filter((e) => !e.notified).length;
        const isNotifying = notifying === key;

        return (
          <div key={key} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            {/* Group header */}
            <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border-b border-gray-100">
              <div>
                <Link
                  href={`/admin/produtos?edit=${group.productId}`}
                  className="font-bold text-gray-900 hover:text-pink-600 transition-colors"
                >
                  {group.productName}
                </Link>
                <p className="text-sm text-gray-500 mt-0.5">
                  Variação: <strong>{variantLabel}</strong>
                  {" · "}{group.entries.length} cliente{group.entries.length !== 1 ? "s" : ""}
                  {pendingInGroup > 0 && (
                    <span className="ml-1.5 bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                      {pendingInGroup} pendente{pendingInGroup !== 1 ? "s" : ""}
                    </span>
                  )}
                </p>
              </div>
              {pendingInGroup > 0 && (
                <button
                  onClick={() => handleNotify(group)}
                  disabled={isNotifying}
                  className="flex items-center gap-2 px-4 py-2 bg-brand hover:opacity-90 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-60"
                >
                  <Mail size={15} />
                  {isNotifying ? "Enviando..." : "Notificar todos"}
                </button>
              )}
              {pendingInGroup === 0 && (
                <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                  <CheckCircle size={15} />
                  Todos notificados
                </span>
              )}
            </div>

            {/* Entries table */}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Nome</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">E-mail</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Data</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {group.entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-gray-700">{entry.name || <span className="text-gray-400">—</span>}</td>
                    <td className="px-5 py-3 text-gray-600">{entry.email}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">
                      {new Date(entry.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-5 py-3">
                      {entry.notified ? (
                        <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-bold px-2.5 py-1 rounded-full">
                          <CheckCircle size={11} /> Notificado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full">
                          <Bell size={11} /> Aguardando
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                        aria-label="Remover"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
