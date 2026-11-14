"use client";

import { useEffect, useMemo, useState } from "react";
import { confirmDialog } from "@/lib/notify";
import OptimizedImg from "@/components/OptimizedImg";
import Link from "next/link";
import { Bell, BellRing, CheckCircle2, ChevronDown, Mail, Package, PackageCheck, PackageX, Search, Trash2, Users } from "lucide-react";
import { Button } from "@/components/admin/ui/Button";
import { KpiCard } from "@/components/admin/charts/Charts";
import { fmt } from "@/components/admin/charts/theme";
import { getStockForSelection, normalizeVariantStock } from "@/lib/variantUtils";

interface WaitlistEntry {
  id: string;
  email: string;
  name: string | null;
  size: string;
  color: string;
  variantKey: string;
  notified: boolean;
  createdAt: string;
  product: { id: string; name: string; slug: string };
}

export interface WaitlistProductInfo {
  image: string | null;
  stock: number;
  variantStock: unknown[];
  active: boolean;
}

interface VariantGroup {
  key: string;
  productId: string;
  productName: string;
  productSlug: string;
  variantKey: string;
  variantLabel: string;
  selection: Record<string, string>;
  entries: WaitlistEntry[];
}

type Tab = "pending" | "notified" | "all";

/** Lê a variação gravada (novo formato: atributos em JSON; antigo: tamanho/cor). */
function parseVariant(entry: WaitlistEntry): { label: string; selection: Record<string, string> } {
  if (entry.variantKey) {
    try {
      const parsed = JSON.parse(entry.variantKey);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        if ("size" in parsed || "color" in parsed) {
          const sel: Record<string, string> = {};
          if (parsed.size) sel["Tamanho"] = parsed.size;
          if (parsed.color) sel["Cor"] = parsed.color;
          return { label: [parsed.size, parsed.color].filter(Boolean).join(" / "), selection: sel };
        }
        return { label: Object.entries(parsed).map(([k, v]) => `${k}: ${v}`).join(" / "), selection: parsed as Record<string, string> };
      }
    } catch { /* formato antigo */ }
  }
  const sel: Record<string, string> = {};
  if (entry.size) sel["Tamanho"] = entry.size;
  if (entry.color) sel["Cor"] = entry.color;
  return { label: [entry.size, entry.color].filter(Boolean).join(" / "), selection: sel };
}

function groupByVariant(entries: WaitlistEntry[]): VariantGroup[] {
  const map = new Map<string, VariantGroup>();
  for (const e of entries) {
    const key = `${e.product.id}|${e.variantKey || `${e.size}|${e.color}`}`;
    if (!map.has(key)) {
      const v = parseVariant(e);
      map.set(key, {
        key,
        productId: e.product.id,
        productName: e.product.name,
        productSlug: e.product.slug,
        variantKey: e.variantKey,
        variantLabel: v.label,
        selection: v.selection,
        entries: [],
      });
    }
    map.get(key)!.entries.push(e);
  }
  return Array.from(map.values());
}

export default function WaitlistManager({ productInfo = {} }: { productInfo?: Record<string, WaitlistProductInfo> }) {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [reload, setReload] = useState(0);
  const [notifying, setNotifying] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("pending");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/waitlist")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setEntries(Array.isArray(d) ? d : []); setLoaded(true); } })
      .catch(() => !cancelled && setLoaded(true));
    return () => { cancelled = true; };
  }, [reload]);

  /** Estoque atual daquela variação (null = não sabemos). */
  const stockOf = (g: VariantGroup): number | null => {
    const info = productInfo[g.productId];
    if (!info) return null;
    const variants = normalizeVariantStock(info.variantStock);
    if (variants.length === 0 || Object.keys(g.selection).length === 0) return info.stock;
    return getStockForSelection(variants, g.selection);
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmDialog({ title: "Remover da lista de espera?", message: "O cliente não será avisado quando o produto voltar.", confirmText: "Remover", tone: "danger" }))) return;
    await fetch(`/api/admin/waitlist?id=${id}`, { method: "DELETE" });
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const handleNotify = async (group: VariantGroup) => {
    const pending = group.entries.filter((e) => !e.notified).length;
    const stock = stockOf(group);
    const ok = await confirmDialog({
      title: `Avisar ${pending} cliente${pending === 1 ? "" : "s"} por e-mail?`,
      message: stock === 0
        ? "Atenção: esta variação ainda está SEM ESTOQUE na loja. O cliente vai chegar e não vai conseguir comprar."
        : "Eles recebem o e-mail “voltou ao estoque” com o link do produto.",
      confirmText: "Enviar e-mails",
      tone: stock === 0 ? "danger" : "default",
    });
    if (!ok) return;
    setNotifying(group.key);
    setNotice(null);
    try {
      const res = await fetch("/api/waitlist/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: group.productId, variantKey: group.variantKey }),
      });
      const data = await res.json();
      if (res.ok) {
        setNotice({ ok: true, text: `${data.sent} e-mail(s) enviado(s) para quem esperava ${group.productName}${group.variantLabel ? ` (${group.variantLabel})` : ""}.` });
        setReload((n) => n + 1);
      } else {
        setNotice({ ok: false, text: data.error || "Erro ao enviar notificações" });
      }
    } finally {
      setNotifying(null);
    }
  };

  const pendingEntries = useMemo(() => entries.filter((e) => !e.notified), [entries]);
  const counts: Record<Tab, number> = { pending: pendingEntries.length, notified: entries.length - pendingEntries.length, all: entries.length };

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const shown = entries.filter((e) => (tab === "pending" ? !e.notified : tab === "notified" ? e.notified : true));
    return groupByVariant(shown)
      .filter((g) => !q || g.productName.toLowerCase().includes(q) || g.variantLabel.toLowerCase().includes(q) || g.entries.some((e) => e.email.toLowerCase().includes(q)))
      // Maior demanda primeiro
      .sort((a, b) => b.entries.length - a.entries.length);
  }, [entries, tab, query]);

  const allPendingGroups = useMemo(() => groupByVariant(pendingEntries), [pendingEntries]);
  const backInStock = allPendingGroups.filter((g) => (stockOf(g) ?? 0) > 0).length;
  const productsWaiting = new Set(pendingEntries.map((e) => e.product.id)).size;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Users} label="Pessoas esperando" value={fmt.num(pendingEntries.length)} current={pendingEntries.length} />
        <KpiCard icon={Package} label="Produtos com espera" value={fmt.num(productsWaiting)} current={productsWaiting} />
        <KpiCard icon={PackageCheck} label="Já voltaram ao estoque" value={fmt.num(backInStock)} current={backInStock} hint="Variações com estoque e clientes ainda não avisados" />
        <KpiCard icon={BellRing} label="Já notificados" value={fmt.num(counts.notified)} current={counts.notified} />
      </div>

      {backInStock > 0 && tab !== "notified" && (
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 px-4 py-3 text-sm text-emerald-900">
          <PackageCheck size={18} className="text-emerald-600 shrink-0" />
          <span><b>{backInStock}</b> variação(ões) já têm estoque e clientes esperando o aviso. Avise agora — é venda quase certa.</span>
        </div>
      )}
      {notice && (
        <div className={`rounded-xl px-4 py-2.5 text-sm ${notice.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{notice.text}</div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-end gap-3 border-b border-gray-200">
        <div className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
          {([["pending", "Aguardando"], ["notified", "Notificados"], ["all", "Todos"]] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={`relative inline-flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium whitespace-nowrap ${tab === k ? "text-gray-900" : "text-gray-500 hover:text-gray-800"}`}>
              {label}
              <span className={`text-[11px] font-semibold rounded-full px-1.5 tabular-nums ${k === "pending" && counts.pending > 0 ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-600"}`}>{counts[k]}</span>
              <span className={`absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gray-900 transition-transform ${tab === k ? "scale-x-100" : "scale-x-0"}`} />
            </button>
          ))}
        </div>
        <label className="relative sm:ml-auto sm:w-72 mb-2">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Produto, variação ou e-mail" className="w-full pl-8 pr-3 py-2 text-[13px] rounded-xl border border-gray-200 bg-white" />
        </label>
      </div>

      {!loaded ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="img-skeleton rounded-2xl h-20" />)}</div>
      ) : groups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 py-16 text-center">
          <Bell size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="font-medium text-gray-700">{tab === "pending" ? "Ninguém esperando agora" : "Nenhum registro"}</p>
          <p className="text-sm text-gray-500 mt-1">Quando um produto esgota, o cliente pode pedir na página do produto para ser avisado.</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {groups.map((g) => {
            const info = productInfo[g.productId];
            const stock = stockOf(g);
            const pending = g.entries.filter((e) => !e.notified).length;
            const isOpen = expanded === g.key;
            return (
              <li key={g.key} className={`bg-white rounded-2xl border shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-md ${pending > 0 && (stock ?? 0) > 0 ? "border-emerald-200" : "border-gray-200/70"}`}>
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 p-3.5">
                  <span className="w-14 h-14 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                    {info?.image ? <OptimizedImg widths={[160]} sizes="48px" loading="lazy" src={info.image} alt="" className="w-full h-full object-cover" /> : <Package size={18} className="m-auto mt-4 text-gray-400" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/produtos/${g.productId}`} className="text-sm font-semibold text-gray-900 hover:text-brand truncate block">{g.productName}</Link>
                    <p className="text-xs text-gray-500 truncate">{g.variantLabel || "Sem variação"}{info && !info.active && " · produto oculto na loja"}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] font-medium">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800"><Users size={11} />{g.entries.length} {g.entries.length === 1 ? "pessoa" : "pessoas"}</span>
                      {stock == null ? null : stock > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700"><PackageCheck size={11} />{stock} em estoque</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 text-red-700"><PackageX size={11} />sem estoque</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-auto">
                    {pending > 0 ? (
                      <Button
                        variant={(stock ?? 1) > 0 ? "dark" : "secondary"}
                        size="sm"
                        icon={Mail}
                        onClick={() => handleNotify(g)}
                        loading={notifying === g.key}
                        loadingText="Enviando…"
                        title={(stock ?? 1) > 0 ? undefined : "Ainda sem estoque — avise depois de repor"}
                      >
                        {`Avisar ${pending}`}
                      </Button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700"><CheckCircle2 size={14} /> Todos avisados</span>
                    )}
                    <Button variant="ghost" size="icon" icon={ChevronDown} onClick={() => setExpanded(isOpen ? null : g.key)} aria-label={isOpen ? "Esconder clientes" : "Ver clientes"} aria-expanded={isOpen} className={`text-gray-400 [&_svg]:transition-transform ${isOpen ? "[&_svg]:rotate-180" : ""}`} />
                  </div>
                </div>
                {isOpen && (
                  <ul className="border-t border-gray-100 divide-y divide-gray-50">
                    {g.entries.map((e) => (
                      <li key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                        <span className="min-w-0 flex-1">
                          <span className="block text-gray-800 truncate">{e.name || e.email}</span>
                          {e.name && <span className="block text-xs text-gray-400 truncate">{e.email}</span>}
                        </span>
                        <span className="text-xs text-gray-400 hidden sm:inline">{new Date(e.createdAt).toLocaleDateString("pt-BR")}</span>
                        {e.notified ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5"><CheckCircle2 size={11} /> avisado</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 rounded-full px-2 py-0.5"><Bell size={11} /> aguardando</span>
                        )}
                        <Button variant="dangerGhost" size="iconSm" icon={Trash2} onClick={() => handleDelete(e.id)} aria-label="Remover" className="text-gray-300" />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
