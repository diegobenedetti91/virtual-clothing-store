"use client";

import { useEffect, useMemo, useState } from "react";
import CreditPanel, { type CreditData } from "@/components/customer/CreditPanel";
import OptimizedImg from "@/components/OptimizedImg";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCustomer } from "@/hooks/useCustomer";
import { formatCurrency, cn, ORDER_STATUS } from "@/lib/utils";
import {
  ArrowRight, Check, ChevronRight, Edit3, Heart, LogOut, Mail, MapPin, MessageCircle, Package, Phone, ShoppingBag, Truck, User, Wallet, X,
} from "lucide-react";

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  size?: string | null;
  color?: string | null;
  product: { name: string; images?: string | null };
}
interface Order {
  id: string;
  orderNumber: string;
  status: string;
  returnStatus?: string | null;
  total: number;
  createdAt: string;
  shippingMethod?: string | null;
  trackingCode?: string | null;
  items: OrderItem[];
  canCancel?: boolean;
  canReturn?: boolean;
  returns?: { status: string }[];
}
interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
}

const UF_LIST = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const ACTIVE = ["PENDING", "CONFIRMED", "SHIPPED", "PRONTO_PARA_RETIRADA"];
const DONE = ["DELIVERED", "RETIRADO"];

const stepOf = (s: string) =>
  s === "PENDING" ? 0 : s === "CONFIRMED" ? 1 : s === "SHIPPED" || s === "PRONTO_PARA_RETIRADA" ? 2 : DONE.includes(s) ? 3 : -1;

/** Frase curta do que está acontecendo com o pedido. */
function orderHint(o: Order) {
  const pickup = o.shippingMethod === "retirada";
  if (o.returns?.some((r) => r.status === "PENDING" || r.status === "AWAITING_RETURN")) return "Devolução em andamento";
  switch (o.status) {
    case "PENDING": return "Aguardando a confirmação do pagamento";
    case "CONFIRMED": return pickup ? "Separando seu pedido para retirada" : "Preparando o envio";
    case "SHIPPED": return o.trackingCode ? `A caminho · rastreio ${o.trackingCode}` : "A caminho";
    case "PRONTO_PARA_RETIRADA": return "Pronto para retirar na loja";
    case "DELIVERED": return o.canReturn ? "Entregue · ainda dá para pedir devolução" : "Entregue";
    case "RETIRADO": return "Retirado na loja";
    case "CANCELLED": return "Cancelado";
    default: return "";
  }
}

const firstImage = (raw?: string | null) => { try { const v = JSON.parse(raw || "[]"); return Array.isArray(v) ? (v[0] as string) ?? null : null; } catch { return null; } };

function MiniSteps({ status }: { status: string }) {
  const step = stepOf(status);
  if (step < 0) return null;
  return (
    <div className="flex gap-1" aria-label={`Etapa ${step + 1} de 4`}>
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= step ? "bg-brand" : "bg-gray-200")} />
      ))}
    </div>
  );
}

function OrderCard({ order }: { order: Order }) {
  const st = ORDER_STATUS[order.status] || { label: order.status, color: "bg-gray-100 text-gray-700" };
  const units = order.items.reduce((s, i) => s + i.quantity, 0);
  return (
    <Link href={`/pedido/${order.id}`} className="group block bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-4 hover:shadow-md hover:-translate-y-0.5 transition-all">
      <div className="flex items-start gap-3">
        <div className="flex -space-x-3 shrink-0">
          {order.items.slice(0, 3).map((it) => {
            const img = firstImage(it.product.images);
            return (
              <span key={it.id} className="w-12 h-14 rounded-xl ring-2 ring-white bg-gray-100 overflow-hidden">
                {img ? <OptimizedImg src={img} widths={[160]} sizes="48px" alt="" className="w-full h-full object-cover" /> : <Package size={16} className="m-auto mt-4 text-gray-400" />}
              </span>
            );
          })}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">Pedido {order.orderNumber}</p>
              <p className="text-xs text-gray-500">
                {new Date(order.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })} · {units} {units === 1 ? "peça" : "peças"}
              </p>
            </div>
            <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold ${st.color}`}>{st.label}</span>
          </div>
          <p className="text-xs text-gray-600 mt-1.5 truncate">{order.items.map((i) => i.product.name).join(", ")}</p>
        </div>
      </div>
      <div className="mt-3"><MiniSteps status={order.status} /></div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-gray-600 truncate">{orderHint(order)}</p>
        <span className="shrink-0 inline-flex items-center gap-1 text-sm font-semibold text-gray-900 tabular-nums">
          {formatCurrency(order.total)}
          <ChevronRight size={16} className="text-gray-400 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>
    </Link>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { customer, logout, loading } = useCustomer();
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState<"orders" | "credit" | "profile">(initialTab === "profile" ? "profile" : initialTab === "credito" ? "credit" : "orders");
  const [credit, setCredit] = useState<CreditData | null>(null);
  const [orderFilter, setOrderFilter] = useState<"active" | "done" | "all">("all");
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState<null | "personal" | "address">(null);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [whatsapp, setWhatsapp] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", street: "", number: "", neighborhood: "", city: "", state: "", zipCode: "" });

  useEffect(() => {
    if (!loading && !customer) router.push("/conta/login");
  }, [customer, loading, router]);

  useEffect(() => {
    const t = searchParams.get("tab");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza a aba com a URL (?tab=)
    if (t === "orders" || t === "profile") setTab(t);
  }, [searchParams]);

  const fillForm = (d: Profile) =>
    setForm({
      name: d.name || "", phone: d.phone || "", street: d.street || "", number: d.number || "",
      neighborhood: d.neighborhood || "", city: d.city || "", state: d.state || "", zipCode: d.zipCode || "",
    });

  useEffect(() => {
    if (!customer) return;
    let cancelled = false;
    fetch("/api/customer/orders").then((r) => r.json()).then((d) => { if (!cancelled) { setOrders(Array.isArray(d) ? d : []); setOrdersLoaded(true); } });
    fetch("/api/customer/profile").then((r) => r.json()).then((d: Profile) => { if (!cancelled) { setProfile(d); fillForm(d); } });
    fetch("/api/customer/credit").then((r) => (r.ok ? r.json() : null)).then((d) => { if (!cancelled && d) setCredit(d); }).catch(() => {});
    fetch("/api/settings").then((r) => r.json()).then((s) => !cancelled && setWhatsapp(s?.whatsapp || null)).catch(() => {});
    return () => { cancelled = true; };
  }, [customer]);

  const activeOrders = useMemo(() => orders.filter((o) => ACTIVE.includes(o.status)), [orders]);
  const featured = activeOrders[0];
  const filtered = orderFilter === "active" ? activeOrders : orderFilter === "done" ? orders.filter((o) => !ACTIVE.includes(o.status)) : orders;

  const handleLogout = async () => {
    await fetch("/api/customer/logout", { method: "POST" });
    logout();
    router.push("/");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/customer/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const updated = await res.json().catch(() => ({}));
      // O servidor valida telefone, CPF e CEP: mostra o motivo e mantém a edição aberta
      if (!res.ok) {
        setSaveError(updated?.error || "Não foi possível salvar. Confira os dados.");
        return;
      }
      setSaveError(null);
      setProfile(updated);
      fillForm(updated);
      setEditing(null);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
    } finally {
      setSaving(false);
    }
  };
  const handleCancel = () => { if (profile) fillForm(profile); setEditing(null); setSaveError(null); };
  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white placeholder:text-gray-400 transition";
  const labelCls = "block text-xs font-medium text-gray-600 mb-1";

  if (loading || !customer) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const firstName = customer.name.split(" ")[0];
  const initials = customer.name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();
  const missing = profile ? [!profile.phone && "celular", !profile.street && "endereço"].filter(Boolean) as string[] : [];
  const waDigits = (whatsapp || "").replace(/\D/g, "");
  const waLink = waDigits ? `https://wa.me/${waDigits.length <= 11 ? "55" : ""}${waDigits}` : null;

  const editButtons = (
    <div className="flex gap-2">
      <button onClick={handleCancel} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded-lg hover:bg-gray-100"><X size={12} /> Cancelar</button>
      <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-brand hover:opacity-90 px-4 py-1.5 rounded-lg disabled:opacity-60">
        {saving ? "Salvando…" : <><Check size={12} /> Salvar</>}
      </button>
    </div>
  );

  const showCredit = !!credit && (!!credit.program || credit.entries.length > 0);

  return (
    <div className="min-h-screen bg-gray-50/80">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-10 space-y-5">
        {/* Saudação */}
        <div className="flex items-center gap-4">
          <span className="w-14 h-14 rounded-2xl bg-brand text-white flex items-center justify-center text-lg font-semibold shadow-sm shrink-0">{initials}</span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Olá, {firstName}!</h1>
            <p className="text-sm text-gray-500 truncate">{customer.email}</p>
          </div>
          <button onClick={handleLogout} className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 px-3 py-2 rounded-xl hover:bg-white ring-1 ring-transparent hover:ring-gray-200 transition">
            <LogOut size={14} /> Sair
          </button>
        </div>

        {/* Pedido em andamento */}
        {featured && (
          <Link href={`/pedido/${featured.id}`} className="group block rounded-2xl p-5 text-white shadow-lg overflow-hidden relative" style={{ background: "linear-gradient(135deg, var(--brand), color-mix(in srgb, var(--brand) 55%, #111827))" }}>
            <span className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-white/10" />
            <div className="relative">
              <p className="text-xs font-medium text-white/70 uppercase tracking-wider flex items-center gap-1.5"><Truck size={13} /> Pedido em andamento</p>
              <div className="mt-1 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-semibold">{orderHint(featured)}</p>
                  <p className="text-sm text-white/70">Pedido {featured.orderNumber} · {formatCurrency(featured.total)}</p>
                </div>
                <span className="shrink-0 inline-flex items-center gap-1 text-sm font-semibold bg-white/15 group-hover:bg-white/25 rounded-xl px-3 py-2 transition">
                  Acompanhar <ArrowRight size={15} />
                </span>
              </div>
              <div className="mt-4 flex gap-1">
                {[0, 1, 2, 3].map((i) => <span key={i} className={cn("h-1.5 flex-1 rounded-full", i <= stepOf(featured.status) ? "bg-white" : "bg-white/25")} />)}
              </div>
              {activeOrders.length > 1 && <p className="mt-2 text-xs text-white/70">+ {activeOrders.length - 1} outro{activeOrders.length > 2 ? "s" : ""} pedido{activeOrders.length > 2 ? "s" : ""} em andamento</p>}
            </div>
          </Link>
        )}

        {/* Abas */}
        <div className="flex gap-1 bg-white ring-1 ring-gray-200/70 p-1 rounded-2xl">
          {(showCredit
            ? ([["orders", "Meus pedidos", Package], ["credit", "Meu crédito", Wallet], ["profile", "Meus dados", User]] as const)
            : ([["orders", "Meus pedidos", Package], ["profile", "Meus dados", User]] as const)
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn("flex-1 inline-flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl transition-all", tab === key ? "bg-gray-900 text-white shadow-sm" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50")}
            >
              <Icon size={15} /> {label}
              {key === "orders" && orders.length > 0 && <span className={cn("text-[11px] rounded-full px-1.5 tabular-nums", tab === key ? "bg-white/20" : "bg-gray-100 text-gray-600")}>{orders.length}</span>}
              {key === "profile" && missing.length > 0 && <span className="w-2 h-2 rounded-full bg-amber-500" />}
              {key === "credit" && credit && credit.available > 0 && <span className={cn("text-[11px] rounded-full px-1.5 tabular-nums", tab === key ? "bg-white/20" : "bg-violet-100 text-violet-700")}>{formatCurrency(credit.available)}</span>}
            </button>
          ))}
        </div>

        {/* Crédito (cashback) */}
        {tab === "credit" && <CreditPanel data={credit} />}

        {/* Pedidos */}
        {tab === "orders" && (
          <div className="space-y-3">
            {orders.length > 0 && (
              <div className="flex gap-1.5">
                {([["all", "Todos"], ["active", "Em andamento"], ["done", "Concluídos e cancelados"]] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setOrderFilter(k)} className={cn("px-3 py-1.5 rounded-full text-xs font-medium ring-1 transition", orderFilter === k ? "bg-gray-900 text-white ring-gray-900" : "bg-white text-gray-600 ring-gray-200 hover:bg-gray-50")}>
                    {l}
                  </button>
                ))}
              </div>
            )}
            {!ordersLoaded ? (
              Array.from({ length: 2 }).map((_, i) => <div key={i} className="img-skeleton rounded-2xl h-36" />)
            ) : orders.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200/70 py-14 text-center px-4">
                <span className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3"><Package size={26} className="text-gray-300" /></span>
                <p className="font-semibold text-gray-800">Você ainda não fez nenhum pedido</p>
                <p className="text-sm text-gray-500 mt-1 mb-5">Quando comprar, você acompanha tudo por aqui: pagamento, envio e entrega.</p>
                <Link href="/produtos" className="inline-flex items-center gap-2 bg-brand text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90"><ShoppingBag size={15} /> Ver produtos</Link>
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-10">Nenhum pedido neste filtro.</p>
            ) : (
              filtered.map((o) => <OrderCard key={o.id} order={o} />)
            )}
          </div>
        )}

        {/* Dados */}
        {tab === "profile" && (
          <div className="space-y-4">
            {saveOk && <div className="text-sm text-emerald-800 bg-emerald-50 rounded-xl px-4 py-2.5 flex items-center gap-2"><Check size={15} /> Dados salvos!</div>}
            {saveError && <div className="text-sm text-red-800 bg-red-50 rounded-xl px-4 py-2.5" role="alert">{saveError}</div>}
            {missing.length > 0 && !editing && (
              <div className="rounded-2xl bg-amber-50 ring-1 ring-amber-200 px-4 py-3 text-sm text-amber-900 flex items-center justify-between gap-3">
                <span>Complete seu {missing.join(" e ")} para finalizar as próximas compras mais rápido.</span>
                <button onClick={() => setEditing(!profile?.phone ? "personal" : "address")} className="shrink-0 text-xs font-semibold underline">Completar</button>
              </div>
            )}

            {/* Dados pessoais */}
            <section className="bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5">
              <header className="flex items-center justify-between mb-4">
                <h2 className="text-[15px] font-semibold text-gray-900 flex items-center gap-2"><User size={16} className="text-gray-400" /> Dados pessoais</h2>
                {editing === "personal" ? editButtons : (
                  <button onClick={() => setEditing("personal")} disabled={editing !== null} className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-40"><Edit3 size={12} /> Editar</button>
                )}
              </header>
              {editing === "personal" ? (
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2"><label className={labelCls}>Nome completo</label><input value={form.name} onChange={f("name")} className={inputCls} /></div>
                  <div><label className={labelCls}>Celular / WhatsApp</label><input value={form.phone} onChange={f("phone")} placeholder="(00) 00000-0000" className={inputCls} /></div>
                  <div><label className={labelCls}>E-mail</label><input value={profile?.email || customer.email} disabled className={`${inputCls} bg-gray-50 text-gray-500`} /></div>
                </div>
              ) : (
                <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  {[
                    { icon: User, label: "Nome", value: profile?.name || customer.name },
                    { icon: Mail, label: "E-mail", value: profile?.email || customer.email },
                    { icon: Phone, label: "Celular / WhatsApp", value: profile?.phone },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-start gap-2.5 min-w-0">
                      <Icon size={15} className="text-gray-400 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <dt className="text-xs text-gray-500">{label}</dt>
                        <dd className={cn("break-words", value ? "text-gray-900" : "text-gray-400 italic")}>{value || "Não informado"}</dd>
                      </div>
                    </div>
                  ))}
                </dl>
              )}
            </section>

            {/* Endereço */}
            <section className="bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5">
              <header className="flex items-center justify-between mb-4">
                <h2 className="text-[15px] font-semibold text-gray-900 flex items-center gap-2"><MapPin size={16} className="text-gray-400" /> Endereço de entrega</h2>
                {editing === "address" ? editButtons : (
                  <button onClick={() => setEditing("address")} disabled={editing !== null} className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-40"><Edit3 size={12} /> {profile?.street ? "Editar" : "Adicionar"}</button>
                )}
              </header>
              {editing === "address" ? (
                <div className="grid grid-cols-6 gap-3">
                  <div className="col-span-6 sm:col-span-2"><label className={labelCls}>CEP</label><input value={form.zipCode} onChange={f("zipCode")} placeholder="00000-000" className={inputCls} /></div>
                  <div className="col-span-4 sm:col-span-3"><label className={labelCls}>Rua / Avenida</label><input value={form.street} onChange={f("street")} className={inputCls} /></div>
                  <div className="col-span-2 sm:col-span-1"><label className={labelCls}>Número</label><input value={form.number} onChange={f("number")} className={inputCls} /></div>
                  <div className="col-span-6 sm:col-span-2"><label className={labelCls}>Bairro</label><input value={form.neighborhood} onChange={f("neighborhood")} className={inputCls} /></div>
                  <div className="col-span-4 sm:col-span-3"><label className={labelCls}>Cidade</label><input value={form.city} onChange={f("city")} className={inputCls} /></div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className={labelCls}>UF</label>
                    <select value={form.state} onChange={f("state")} className={inputCls}><option value="">—</option>{UF_LIST.map((uf) => <option key={uf} value={uf}>{uf}</option>)}</select>
                  </div>
                </div>
              ) : profile?.street ? (
                <p className="text-sm text-gray-800 leading-relaxed">
                  {profile.street}{profile.number ? `, ${profile.number}` : ""}{profile.neighborhood ? ` — ${profile.neighborhood}` : ""}
                  <br />
                  <span className="text-gray-500">{profile.city}{profile.state ? `/${profile.state}` : ""}{profile.zipCode ? ` · CEP ${profile.zipCode}` : ""}</span>
                </p>
              ) : (
                <p className="text-sm text-gray-400 italic">Nenhum endereço salvo. Ele é preenchido automaticamente no checkout.</p>
              )}
            </section>
          </div>
        )}

        {/* Atalhos */}
        <div className={cn("grid gap-3", waLink ? "grid-cols-3" : "grid-cols-2")}>
          <Link href="/favoritos" className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium text-gray-700 py-3.5 bg-white rounded-2xl ring-1 ring-gray-200/70 hover:shadow-md hover:-translate-y-0.5 transition-all">
            <Heart size={16} className="text-brand" /> Favoritos
          </Link>
          <Link href="/produtos" className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium text-gray-700 py-3.5 bg-white rounded-2xl ring-1 ring-gray-200/70 hover:shadow-md hover:-translate-y-0.5 transition-all">
            <ShoppingBag size={16} className="text-brand" /> Continuar comprando
          </Link>
          {waLink && (
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium text-gray-700 py-3.5 bg-white rounded-2xl ring-1 ring-gray-200/70 hover:shadow-md hover:-translate-y-0.5 transition-all">
              <MessageCircle size={16} className="text-[#25D366]" /> Falar com a loja
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
