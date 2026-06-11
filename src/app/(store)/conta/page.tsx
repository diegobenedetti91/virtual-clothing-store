"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCustomer } from "@/hooks/useCustomer";
import { formatCurrency, cn } from "@/lib/utils";
import {
  Package, LogOut, User, MapPin, Phone, Mail,
  Edit3, Check, X, ShoppingBag, Heart,
} from "lucide-react";

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  size?: string;
  color?: string;
  product: { name: string };
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
  items: OrderItem[];
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

const STATUS: Record<string, { label: string; dot: string; badge: string }> = {
  PENDING:   { label: "Aguardando",  dot: "bg-yellow-400", badge: "bg-yellow-50 text-yellow-700 border border-yellow-200" },
  CONFIRMED: { label: "Confirmado",  dot: "bg-blue-400",   badge: "bg-blue-50 text-blue-700 border border-blue-200" },
  SHIPPED:   { label: "Enviado",     dot: "bg-purple-400", badge: "bg-purple-50 text-purple-700 border border-purple-200" },
  DELIVERED: { label: "Entregue",    dot: "bg-green-400",  badge: "bg-green-50 text-green-700 border border-green-200" },
  CANCELLED: { label: "Cancelado",   dot: "bg-red-400",    badge: "bg-red-50 text-red-700 border border-red-200" },
};

const UF_LIST = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

export default function AccountPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { customer, logout, loading } = useCustomer();
  const [activeTab, setActiveTab] = useState<"profile" | "orders">(
    searchParams.get("tab") === "orders" ? "orders" : "profile"
  );
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [form, setForm] = useState({
    name: "", phone: "", street: "", number: "",
    neighborhood: "", city: "", state: "", zipCode: "",
  });

  useEffect(() => {
    if (!loading && !customer) router.push("/conta/login");
  }, [customer, loading, router]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "orders" || tab === "profile") setActiveTab(tab);
  }, [searchParams]);

  useEffect(() => {
    if (!customer) return;
    fetch("/api/customer/orders").then((r) => r.json()).then((d) => { setOrders(d); setOrdersLoading(false); });
    fetch("/api/customer/profile").then((r) => r.json()).then((d: Profile) => {
      setProfile(d);
      setForm({
        name: d.name || "", phone: d.phone || "",
        street: d.street || "", number: d.number || "",
        neighborhood: d.neighborhood || "", city: d.city || "",
        state: d.state || "", zipCode: d.zipCode || "",
      });
    });
  }, [customer]);

  const handleLogout = async () => {
    await fetch("/api/customer/logout", { method: "POST" });
    logout();
    router.push("/");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/customer/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const updated = await res.json();
      setProfile(updated);
      setEditing(false);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (profile) {
      setForm({
        name: profile.name || "", phone: profile.phone || "",
        street: profile.street || "", number: profile.number || "",
        neighborhood: profile.neighborhood || "", city: profile.city || "",
        state: profile.state || "", zipCode: profile.zipCode || "",
      });
    }
    setEditing(false);
  };

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition";
  const labelCls = "block text-xs font-semibold text-gray-500 mb-1";

  if (loading || !customer) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const initials = customer.name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50/80">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">

        {/* Hero card */}
        <div
          className="relative rounded-3xl p-6 mb-6 overflow-hidden"
          style={{ background: "linear-gradient(135deg, var(--brand), color-mix(in srgb, var(--brand) 60%, #1a1a2e))" }}
        >
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 w-28 h-28 bg-white/10 rounded-full pointer-events-none" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shrink-0 border border-white/30 shadow-inner">
                <span className="text-xl font-black text-white">{initials}</span>
              </div>
              <div>
                <p className="font-black text-white text-lg leading-tight">{customer.name}</p>
                <p className="text-white/65 text-sm mt-0.5">{customer.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-white/80 hover:text-white text-xs font-semibold bg-white/10 hover:bg-white/20 px-3 py-2 rounded-xl transition-colors shrink-0"
            >
              <LogOut size={13} /> Sair
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-gray-100 shadow-sm p-1 rounded-2xl mb-5">
          {(["profile", "orders"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200",
                activeTab === tab
                  ? "bg-brand text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
              )}
            >
              {tab === "profile" ? <User size={14} /> : <Package size={14} />}
              {tab === "profile" ? "Dados da conta" : "Meus Pedidos"}
              {tab === "orders" && orders.length > 0 && (
                <span className={cn(
                  "text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center leading-none",
                  activeTab === "orders" ? "bg-white text-brand" : "bg-brand text-white"
                )}>
                  {orders.length > 9 ? "9+" : orders.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Profile Tab ── */}
        {activeTab === "profile" && (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Informações pessoais</p>
                {!editing ? (
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1.5 text-xs font-bold text-brand hover:opacity-80 px-3 py-1.5 rounded-xl hover:bg-brand-light transition-colors"
                  >
                    <Edit3 size={12} /> Editar
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={handleCancel} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-xl hover:bg-gray-100 transition-colors">
                      <X size={12} /> Cancelar
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-1 text-xs font-bold text-white bg-brand hover:opacity-90 px-4 py-1.5 rounded-xl transition-colors disabled:opacity-60"
                    >
                      {saving ? "Salvando..." : <><Check size={12} /> Salvar</>}
                    </button>
                  </div>
                )}
              </div>

              {saveOk && (
                <div className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
                  <Check size={14} /> Dados salvos com sucesso!
                </div>
              )}

              {!editing ? (
                <div className="space-y-0 divide-y divide-gray-50">
                  {[
                    { icon: Mail, label: "E-mail", value: profile?.email || customer.email },
                    { icon: Phone, label: "Celular / WhatsApp", value: profile?.phone },
                    {
                      icon: MapPin, label: "Endereço de entrega",
                      value: profile?.street
                        ? `${profile.street}${profile.number ? `, ${profile.number}` : ""}${profile.neighborhood ? ` — ${profile.neighborhood}` : ""}\n${profile.city}${profile.state ? `/${profile.state}` : ""}${profile.zipCode ? ` · CEP ${profile.zipCode}` : ""}`
                        : null,
                    },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
                      <div className="w-8 h-8 bg-gray-50 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                        <Icon size={14} className="text-gray-400" />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
                        {value ? (
                          <p className="text-sm text-gray-800 whitespace-pre-line">{value}</p>
                        ) : (
                          <p className="text-sm text-gray-300 italic">Não informado</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className={labelCls}>Nome completo</label>
                    <input value={form.name} onChange={f("name")} className={inputCls} placeholder="Seu nome" />
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-3">Contato</p>
                    <label className={labelCls}>Celular / WhatsApp</label>
                    <input value={form.phone} onChange={f("phone")} className={inputCls} placeholder="(00) 00000-0000" />
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-3">Endereço de entrega</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <label className={labelCls}>Rua / Avenida</label>
                        <input value={form.street} onChange={f("street")} className={inputCls} placeholder="Ex: Rua das Flores" />
                      </div>
                      <div>
                        <label className={labelCls}>Número</label>
                        <input value={form.number} onChange={f("number")} className={inputCls} placeholder="123" />
                      </div>
                      <div>
                        <label className={labelCls}>Bairro</label>
                        <input value={form.neighborhood} onChange={f("neighborhood")} className={inputCls} placeholder="Centro" />
                      </div>
                      <div>
                        <label className={labelCls}>Cidade</label>
                        <input value={form.city} onChange={f("city")} className={inputCls} placeholder="São Paulo" />
                      </div>
                      <div>
                        <label className={labelCls}>Estado</label>
                        <select value={form.state} onChange={f("state")} className={inputCls}>
                          <option value="">UF</option>
                          {UF_LIST.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>CEP</label>
                        <input value={form.zipCode} onChange={f("zipCode")} className={inputCls} placeholder="00000-000" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Link href="/favoritos" className="flex items-center justify-center gap-2 text-sm font-medium text-gray-600 hover:text-brand py-3.5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-brand/30 hover:shadow-md transition-all">
                <Heart size={15} /> Favoritos
              </Link>
              <Link href="/produtos" className="flex items-center justify-center gap-2 text-sm font-medium text-gray-600 hover:text-brand py-3.5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-brand/30 hover:shadow-md transition-all">
                <ShoppingBag size={15} /> Produtos
              </Link>
            </div>
          </>
        )}

        {/* ── Orders Tab ── */}
        {activeTab === "orders" && (
          <div className="space-y-3">
            {ordersLoading ? (
              <div className="py-16 flex justify-center">
                <div className="w-7 h-7 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              </div>
            ) : orders.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Package size={28} className="text-gray-300" />
                </div>
                <p className="font-bold text-gray-700 mb-1">Nenhum pedido ainda</p>
                <p className="text-sm text-gray-400 mb-6">Que tal explorar nossa coleção?</p>
                <Link href="/produtos" className="inline-flex items-center gap-2 bg-brand text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition">
                  <ShoppingBag size={14} /> Ver produtos
                </Link>
              </div>
            ) : (
              orders.map((order) => {
                const s = STATUS[order.status] || { label: order.status, dot: "bg-gray-400", badge: "bg-gray-100 text-gray-700 border border-gray-200" };
                return (
                  <Link
                    href={`/pedido/${order.id}`}
                    key={order.id}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-brand/20 hover:shadow-md transition-all block"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="font-black text-gray-900 text-base">#{order.orderNumber}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(order.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${s.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                          {s.label}
                        </span>
                        <span className="font-black text-gray-900">{formatCurrency(order.total)}</span>
                      </div>
                    </div>
                    <div className="border-t border-gray-50 pt-3 space-y-1.5">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="w-5 h-5 bg-gray-100 rounded-lg flex items-center justify-center text-[10px] font-bold text-gray-600 shrink-0">
                            {item.quantity}×
                          </span>
                          <span>
                            {item.product.name}
                            {item.size ? <span className="text-gray-400"> · Tam: {item.size}</span> : null}
                            {item.color ? <span className="text-gray-400"> · {item.color}</span> : null}
                          </span>
                        </div>
                      ))}
                    </div>
                    {order.status === "CONFIRMED" && (
                      <div className="border-t border-gray-50 mt-3 pt-3">
                        <p className="text-xs text-gray-500 mb-2">Clique para ver detalhes ou cancelar este pedido</p>
                      </div>
                    )}
                  </Link>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
