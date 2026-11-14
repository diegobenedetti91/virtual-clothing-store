"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Eye, Flame, Megaphone, MousePointerClick, Search, ShoppingBag, Sparkles, TicketPercent, TrendingDown, Trophy, Users, X, Zap } from "lucide-react";
import OptimizedImg from "@/components/OptimizedImg";
import { Button, buttonClasses } from "@/components/admin/ui/Button";
import { ChartCard, KpiCard } from "@/components/admin/charts/Charts";
import { fmt } from "@/components/admin/charts/theme";
import { notify } from "@/lib/notify";

type Tag = "hot_no_sale" | "champion" | "low_interest" | null;
interface Row {
  id: string; name: string; slug: string; image: string | null; price: number; comparePrice: number | null; stock: number; active: boolean;
  onFlashSale: boolean; views: number; people: number; cartAdds: number; unitsSold: number; orders: number; conversion: number | null;
  interested: number; tag: Tag;
}
interface History { id: string; productName: string; reason: string; trigger: string; couponCode: string | null; createdAt: string; sent: number; skipped: number; clicks: number; purchases: number }

const TAGS: Record<Exclude<Tag, null>, { label: string; cls: string; icon: React.ComponentType<{ size?: number }>; hint: string }> = {
  hot_no_sale: { label: "Muito visto, pouco vendido", cls: "bg-orange-50 text-orange-700 ring-orange-200", icon: Flame, hint: "Muita gente olha e pouca compra: ótimo candidato a promoção" },
  champion: { label: "Campeão", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200", icon: Trophy, hint: "Vende bem para quem vê" },
  low_interest: { label: "Pouca procura", cls: "bg-gray-100 text-gray-500 ring-gray-200", icon: TrendingDown, hint: "Quase ninguém vê: destaque na home, Instagram ou categoria" },
};
const REASON: Record<string, string> = { PRICE_DROP: "Preço baixou", COUPON: "Cupom", FLASH_SALE: "Promoção relâmpago" };
const FILTERS: { key: "all" | Exclude<Tag, null>; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "hot_no_sale", label: "Muito visto, pouco vendido" },
  { key: "champion", label: "Campeões" },
  { key: "low_interest", label: "Pouca procura" },
];

/** Interesse por produto: o que é visto x vendido, e avisos de promoção para os interessados. */
export default function InteresseManager() {
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [history, setHistory] = useState<History[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [q, setQ] = useState("");
  const [notifyFor, setNotifyFor] = useState<Row | null>(null);

  const load = useCallback(async (d: number) => {
    try {
      const r = await fetch(`/api/admin/interesse?dias=${d}`);
      const j = await r.json();
      if (r.ok) { setRows(j.rows); setHistory(j.history); }
    } catch {
      notify.error("Não foi possível carregar o interesse por produto");
    }
  }, []);
  useEffect(() => {
    const t = setTimeout(() => load(days), 0);
    return () => clearTimeout(t);
  }, [days, load]);

  const visible = useMemo(() => {
    const nq = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => (filter === "all" || r.tag === filter) && (!nq || r.name.toLowerCase().includes(nq)));
  }, [rows, filter, q]);
  const maxViews = Math.max(1, ...(rows ?? []).map((r) => r.views));
  const totals = useMemo(() => {
    const list = rows ?? [];
    return {
      views: list.reduce((s, r) => s + r.views, 0),
      hot: list.filter((r) => r.tag === "hot_no_sale").length,
      interested: list.reduce((s, r) => s + r.interested, 0),
      sent: history.reduce((s, h) => s + h.sent, 0),
    };
  }, [rows, history]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl bg-white p-1 ring-1 ring-gray-200">
          {[7, 30, 90].map((d) => (
            <button key={d} type="button" onClick={() => { setDays(d); setRows(null); }} className={`px-3 py-1.5 text-[13px] font-medium rounded-lg transition ${days === d ? "bg-gray-900 text-white shadow" : "text-gray-600 hover:bg-gray-100"}`}>
              {d} dias
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500">Visualizações, carrinho e vendas do período. “Interessados” = clientes com conta que viram ou puseram no carrinho nos últimos 60 dias.</p>
      </div>

      {!rows ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="img-skeleton rounded-2xl h-[104px]" />)}</div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard icon={Eye} label="Produtos abertos" value={fmt.num(totals.views)} current={totals.views} hint={`${rows.length} produtos vistos no período`} />
          <KpiCard icon={Flame} label="Muito vistos, pouco vendidos" value={fmt.num(totals.hot)} current={totals.hot} hint="Candidatos a promoção" />
          <KpiCard icon={Users} label="Interessados com conta" value={fmt.num(totals.interested)} current={totals.interested} hint="Podem ser avisados por e-mail" />
          <KpiCard icon={Megaphone} label="Avisos enviados" value={fmt.num(totals.sent)} current={totals.sent} hint="Nos últimos 20 avisos" />
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex gap-1 rounded-xl bg-white p-1 ring-1 ring-gray-200 overflow-x-auto [scrollbar-width:none]">
          {FILTERS.map((f) => {
            const n = f.key === "all" ? rows?.length ?? 0 : (rows ?? []).filter((r) => r.tag === f.key).length;
            return (
              <button key={f.key} type="button" onClick={() => setFilter(f.key)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium whitespace-nowrap transition ${filter === f.key ? "bg-gray-900 text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}>
                {f.label}
                <span className={`text-[11px] tabular-nums rounded-full px-1.5 ${filter === f.key ? "bg-white/20" : "bg-gray-100 text-gray-500"}`}>{n}</span>
              </button>
            );
          })}
        </div>
        <label className="relative flex-1 min-w-0 lg:max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produto" className="w-full h-9 pl-8 pr-3 text-[13px] rounded-xl border border-gray-200 bg-white" />
        </label>
      </div>

      {!rows ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="img-skeleton rounded-2xl h-16" />)}</div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 py-14 text-center px-4">
          <Eye size={28} className="mx-auto text-gray-300 mb-2" />
          <p className="font-medium text-gray-700">Nenhum produto aqui</p>
          <p className="text-sm text-gray-500 mt-1">As visualizações começam a aparecer conforme os clientes navegam na loja.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="hidden lg:grid grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_70px_70px_70px_80px_90px_170px] gap-3 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 border-b border-gray-100 bg-gray-50/60">
            <span>Produto</span><span>Visualizações</span><span className="text-right">Pessoas</span><span className="text-right">Carrinho</span><span className="text-right">Vendidas</span><span className="text-right">Conversão</span><span className="text-right">Interessados</span><span className="text-right">Ações</span>
          </div>
          <ul className="divide-y divide-gray-100">
            {visible.map((r) => {
              const t = r.tag ? TAGS[r.tag] : null;
              const TagIcon = t?.icon;
              return (
                <li key={r.id} className="grid grid-cols-[1fr_auto] lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_70px_70px_70px_80px_90px_170px] gap-3 items-center px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-11 h-11 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                      {r.image ? <OptimizedImg widths={[160]} sizes="48px" loading="lazy" src={r.image} alt="" className="w-full h-full object-cover" /> : null}
                    </span>
                    <span className="min-w-0">
                      <Link href={`/admin/produtos/${r.id}`} className="block text-sm font-medium text-gray-900 truncate hover:underline">{r.name}</Link>
                      <span className="flex flex-wrap items-center gap-1 mt-0.5 text-[11px]">
                        <span className="text-gray-500 tabular-nums">{fmt.brl(r.price)}</span>
                        <span className={r.stock <= 0 ? "text-red-600" : "text-gray-400"}>· {r.stock <= 0 ? "sem estoque" : `${r.stock} em estoque`}</span>
                        {r.onFlashSale && <span className="inline-flex items-center gap-0.5 px-1.5 rounded-md bg-red-50 text-red-700"><Zap size={10} />relâmpago</span>}
                        {t && TagIcon && <span title={t.hint} className={`inline-flex items-center gap-1 px-1.5 rounded-md ring-1 ${t.cls}`}><TagIcon size={10} />{t.label}</span>}
                      </span>
                    </span>
                  </div>
                  <div className="hidden lg:flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden"><div className="h-full rounded-full bg-[#eb6834]" style={{ width: `${(r.views / maxViews) * 100}%` }} /></div>
                    <span className="text-sm font-semibold text-gray-900 tabular-nums w-10 text-right">{fmt.num(r.views)}</span>
                  </div>
                  <span className="hidden lg:block text-sm text-gray-700 text-right tabular-nums">{fmt.num(r.people)}</span>
                  <span className="hidden lg:block text-sm text-gray-700 text-right tabular-nums">{fmt.num(r.cartAdds)}</span>
                  <span className="hidden lg:block text-sm text-gray-700 text-right tabular-nums">{fmt.num(r.unitsSold)}</span>
                  <span className={`hidden lg:block text-sm text-right tabular-nums ${r.conversion != null && r.conversion < 3 && r.views >= 10 ? "text-orange-600 font-semibold" : "text-gray-700"}`}>{r.conversion != null ? fmt.pct(r.conversion) : "—"}</span>
                  <span className="hidden lg:block text-sm text-gray-700 text-right tabular-nums">{fmt.num(r.interested)}</span>
                  <div className="flex items-center justify-end gap-1">
                    <span className="lg:hidden text-xs text-gray-500 mr-1 tabular-nums">{r.views} vistas · {r.unitsSold} vend.</span>
                    <Button variant="dark" size="xs" icon={Megaphone} onClick={() => setNotifyFor(r)} disabled={r.stock <= 0} title={r.stock <= 0 ? "Sem estoque" : "Avisar os interessados por e-mail"}>Avisar</Button>
                    <Link href="/admin/flash-sales" title="Criar promoção relâmpago" aria-label="Criar promoção relâmpago" className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-900"><Zap size={15} /></Link>
                    <Link href="/admin/cupons" title="Criar cupom" aria-label="Criar cupom" className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-900"><TicketPercent size={15} /></Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <ChartCard title="Avisos enviados" subtitle="Resultado de cada aviso: cliques no e-mail e compras do produto pelos destinatários em até 14 dias">
        {history.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Nenhum aviso enviado ainda.</p>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="py-2 px-2 font-medium">Data</th><th className="py-2 px-2 font-medium">Produto</th><th className="py-2 px-2 font-medium">Motivo</th>
                  <th className="py-2 px-2 font-medium text-right">Enviados</th><th className="py-2 px-2 font-medium text-right">Cliques</th><th className="py-2 px-2 font-medium text-right">Compras</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 px-2 text-gray-500 whitespace-nowrap">{new Date(h.createdAt).toLocaleDateString("pt-BR")}</td>
                    <td className="py-2 px-2 text-gray-900 max-w-[220px] truncate">{h.productName}</td>
                    <td className="py-2 px-2 text-gray-600 whitespace-nowrap">
                      {REASON[h.reason] || h.reason}{h.couponCode ? ` · ${h.couponCode}` : ""}
                      <span className="ml-1.5 text-[10.5px] rounded px-1 bg-gray-100 text-gray-500">{h.trigger === "auto" ? "automático" : "manual"}</span>
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">{h.sent}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{h.clicks}{h.sent ? <span className="text-gray-400 text-xs"> ({fmt.pct((h.clicks / h.sent) * 100)})</span> : null}</td>
                    <td className="py-2 px-2 text-right tabular-nums font-semibold text-emerald-700">{h.purchases}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>

      {notifyFor && <NotifyDialog row={notifyFor} onClose={() => setNotifyFor(null)} onSent={() => { setNotifyFor(null); load(days); }} />}
    </div>
  );
}

/* ───────── Avisar interessados ───────── */

interface Preview {
  audience: { interested: number; eligible: number; excluded: { bought: number; optOut: number; monthlyLimit: number; sameProduct: number }; sources: { viewed: number; cart: number; wishlist: number } };
  offer: null | { error: string } | { headline: string; detail: string; priceBefore: number | null; priceNow: number; couponCode: string | null };
  coupons: { code: string; type: string; value: number }[];
  limit: { perCustomer: number; days: number };
}

function NotifyDialog({ row, onClose, onSent }: { row: Row; onClose: () => void; onSent: () => void }) {
  const [reason, setReason] = useState<"PRICE_DROP" | "COUPON" | "FLASH_SALE">(row.onFlashSale ? "FLASH_SALE" : row.comparePrice && row.comparePrice > row.price ? "PRICE_DROP" : "COUPON");
  const [coupon, setCoupon] = useState("");
  const [priceBefore, setPriceBefore] = useState(row.comparePrice && row.comparePrice > row.price ? String(row.comparePrice).replace(".", ",") : "");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      const qs = new URLSearchParams({ motivo: reason });
      if (reason === "COUPON" && coupon) qs.set("cupom", coupon);
      const pb = parseFloat(priceBefore.replace(",", "."));
      if (reason === "PRICE_DROP" && pb > 0) qs.set("de", String(pb));
      fetch(`/api/admin/interesse/${row.id}?${qs}`).then((r) => r.json()).then(setPreview).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [reason, coupon, priceBefore, row.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const offerOk = preview?.offer && !("error" in preview.offer) ? preview.offer : null;
  const offerErr = preview?.offer && "error" in preview.offer ? preview.offer.error : null;
  const eligible = preview?.audience.eligible ?? 0;
  const ex = preview?.audience.excluded;

  const send = async () => {
    setSending(true);
    try {
      const res = await fetch(`/api/admin/interesse/${row.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, couponCode: coupon || undefined, priceBefore: parseFloat(priceBefore.replace(",", ".")) || undefined }),
      });
      const j = await res.json();
      if (res.ok) { notify.success(j.message); onSent(); }
      else notify.warning("Aviso não enviado", { description: j.message || j.error });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/30 backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Avisar interessados" className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 animate-fade-up [animation-duration:0.2s] max-h-[90vh] overflow-y-auto">
        <div className="flex items-start gap-3 p-5 border-b border-gray-100">
          <span className="w-11 h-11 rounded-lg bg-gray-100 overflow-hidden shrink-0">{row.image ? <OptimizedImg widths={[160]} sizes="48px" src={row.image} alt="" className="w-full h-full object-cover" /> : null}</span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold text-gray-900">Avisar interessados</h2>
            <p className="text-xs text-gray-500 truncate">{row.name} · {fmt.brl(row.price)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">Motivo do aviso</p>
            <div className="grid grid-cols-3 gap-2">
              {([["PRICE_DROP", "Preço baixou", TrendingDown], ["COUPON", "Cupom", TicketPercent], ["FLASH_SALE", "Relâmpago", Zap]] as const).map(([k, l, Icon]) => (
                <button key={k} type="button" onClick={() => setReason(k)} className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-[12.5px] font-medium ring-1 transition ${reason === k ? "ring-2 ring-gray-900 bg-gray-50 text-gray-900" : "ring-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                  <Icon size={16} /> {l}
                </button>
              ))}
            </div>
          </div>

          {reason === "PRICE_DROP" && (
            <label className="block">
              <span className="text-xs font-semibold text-gray-500">Preço anterior (“de”)</span>
              <input inputMode="decimal" value={priceBefore} onChange={(e) => setPriceBefore(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="Ex.: 199,90" className="mt-1 w-40 h-9 px-3 text-[13px] rounded-lg border border-gray-200" />
              <span className="block text-[11px] text-gray-400 mt-1">Preço atual: {fmt.brl(row.price)}. Usamos o “preço de” do produto se não informar.</span>
            </label>
          )}
          {reason === "COUPON" && (
            <label className="block">
              <span className="text-xs font-semibold text-gray-500">Cupom</span>
              <select value={coupon} onChange={(e) => setCoupon(e.target.value)} className="mt-1 w-full h-9 px-2.5 text-[13px] rounded-lg border border-gray-200 bg-white">
                <option value="">Escolha um cupom ativo…</option>
                {preview?.coupons.map((c) => (
                  <option key={c.code} value={c.code}>{c.code} — {c.type === "FREE_SHIPPING" ? "frete grátis" : c.type === "FIXED" ? fmt.brl(c.value) : `${c.value}%`}</option>
                ))}
              </select>
              <Link href="/admin/cupons" className="inline-block text-[11px] text-gray-500 hover:text-gray-900 mt-1 underline">Criar um cupom novo</Link>
            </label>
          )}

          {/* Prévia */}
          {offerErr ? (
            <p className="flex items-start gap-2 rounded-xl bg-amber-50 ring-1 ring-amber-200 px-3 py-2.5 text-[13px] text-amber-900"><AlertTriangle size={15} className="shrink-0 mt-0.5" /> {offerErr}</p>
          ) : offerOk ? (
            <div className="rounded-xl ring-1 ring-gray-200 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1"><Sparkles size={11} /> Prévia do e-mail</p>
              <p className="text-sm font-semibold text-gray-900 mt-1">{offerOk.headline}</p>
              <p className="text-xs text-gray-500">{offerOk.detail}</p>
            </div>
          ) : null}

          {preview && (
            <div className="rounded-xl bg-gray-50 px-3 py-3 text-[13px]">
              <p className="font-semibold text-gray-900 flex items-center gap-1.5"><Users size={14} /> {eligible} cliente{eligible === 1 ? "" : "s"} vão receber</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {preview.audience.interested} interessado{preview.audience.interested === 1 ? "" : "s"} no total
                {preview.audience.sources.viewed ? ` · ${preview.audience.sources.viewed} viram` : ""}
                {preview.audience.sources.cart ? ` · ${preview.audience.sources.cart} no carrinho` : ""}
                {preview.audience.sources.wishlist ? ` · ${preview.audience.sources.wishlist} favoritaram` : ""}
              </p>
              {ex && (ex.bought + ex.optOut + ex.monthlyLimit + ex.sameProduct > 0) && (
                <ul className="mt-2 text-xs text-gray-500 space-y-0.5">
                  {ex.bought > 0 && <li className="flex items-center gap-1.5"><ShoppingBag size={11} /> {ex.bought} já compraram</li>}
                  {ex.sameProduct > 0 && <li className="flex items-center gap-1.5"><MousePointerClick size={11} /> {ex.sameProduct} já foram avisados deste produto nos últimos {preview.limit.days} dias</li>}
                  {ex.monthlyLimit > 0 && <li className="flex items-center gap-1.5"><Megaphone size={11} /> {ex.monthlyLimit} já receberam {preview.limit.perCustomer} avisos em {preview.limit.days} dias (trava)</li>}
                  {ex.optOut > 0 && <li className="flex items-center gap-1.5"><X size={11} /> {ex.optOut} pediram para não receber</li>}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end p-4 border-t border-gray-100">
          <button type="button" onClick={onClose} className={buttonClasses({ variant: "ghost", size: "sm" })}>Cancelar</button>
          <Button variant="primary" size="sm" icon={Megaphone} onClick={send} loading={sending} loadingText="Enviando…" disabled={!offerOk || eligible === 0}>
            {eligible ? `Enviar para ${eligible}` : "Ninguém para avisar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
