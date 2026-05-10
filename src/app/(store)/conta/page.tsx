"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCustomer } from "@/hooks/useCustomer";
import { formatCurrency } from "@/lib/utils";
import { Package, LogOut, User, ChevronRight, MapPin, Phone, Mail, Edit3, Check, X } from "lucide-react";

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

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Aguardando", color: "bg-yellow-100 text-yellow-800" },
  CONFIRMED: { label: "Confirmado", color: "bg-blue-100 text-blue-800" },
  SHIPPED: { label: "Enviado", color: "bg-purple-100 text-purple-800" },
  DELIVERED: { label: "Entregue", color: "bg-green-100 text-green-800" },
  CANCELLED: { label: "Cancelado", color: "bg-red-100 text-red-800" },
};

const UF_LIST = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

export default function AccountPage() {
  const router = useRouter();
  const { customer, logout, loading } = useCustomer();
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
    if (!customer) return;
    fetch("/api/customer/orders").then((r) => r.json()).then((d) => { setOrders(d); setOrdersLoading(false); });
    fetch("/api/customer/profile").then((r) => r.json()).then((d: Profile) => {
      setProfile(d);
      setForm({
        name: d.name || "",
        phone: d.phone || "",
        street: d.street || "",
        number: d.number || "",
        neighborhood: d.neighborhood || "",
        city: d.city || "",
        state: d.state || "",
        zipCode: d.zipCode || "",
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
        name: profile.name || "",
        phone: profile.phone || "",
        street: profile.street || "",
        number: profile.number || "",
        neighborhood: profile.neighborhood || "",
        city: profile.city || "",
        state: profile.state || "",
        zipCode: profile.zipCode || "",
      });
    }
    setEditing(false);
  };

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const inputClass = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-pink-400 transition";
  const labelClass = "block text-xs font-semibold text-gray-500 mb-1";

  if (loading || !customer) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-gray-900">Minha conta</h1>
            <p className="text-gray-500 text-sm mt-0.5">{customer.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 transition-colors px-4 py-2 rounded-xl hover:bg-red-50"
          >
            <LogOut size={15} /> Sair
          </button>
        </div>

        {/* Profile card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-pink-100 rounded-full flex items-center justify-center shrink-0">
                <User size={20} className="text-pink-600" />
              </div>
              <div>
                <p className="font-bold text-gray-900">{profile?.name || customer.name}</p>
                <p className="text-sm text-gray-400">Dados da conta</p>
              </div>
            </div>
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 text-sm font-semibold text-pink-600 hover:text-pink-700 px-3 py-2 rounded-xl hover:bg-pink-50 transition-colors"
              >
                <Edit3 size={14} /> Editar
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={handleCancel} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-xl hover:bg-gray-100 transition-colors">
                  <X size={14} /> Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1 text-sm font-bold text-white bg-pink-600 hover:bg-pink-700 px-4 py-2 rounded-xl transition-colors disabled:opacity-60"
                >
                  {saving ? "Salvando..." : <><Check size={14} /> Salvar</>}
                </button>
              </div>
            )}
          </div>

          {saveOk && (
            <div className="mb-4 text-sm text-green-700 bg-green-50 border border-green-100 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <Check size={14} /> Dados salvos com sucesso!
            </div>
          )}

          {!editing ? (
            /* View mode */
            <div className="space-y-4">
              <div className="flex items-start gap-3 text-sm">
                <Mail size={15} className="text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">E-mail</p>
                  <p className="text-gray-900">{profile?.email || customer.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <Phone size={15} className="text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Celular / WhatsApp</p>
                  <p className="text-gray-900">{profile?.phone || <span className="text-gray-400 italic">Não informado</span>}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <MapPin size={15} className="text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Endereço de entrega</p>
                  {profile?.street ? (
                    <p className="text-gray-900">
                      {profile.street}{profile.number ? `, ${profile.number}` : ""}
                      {profile.neighborhood ? ` — ${profile.neighborhood}` : ""}<br />
                      {profile.city}{profile.state ? `/${profile.state}` : ""}
                      {profile.zipCode ? ` · CEP ${profile.zipCode}` : ""}
                    </p>
                  ) : (
                    <p className="text-gray-400 italic">Não informado</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Edit mode */
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Nome completo</label>
                <input value={form.name} onChange={f("name")} className={inputClass} placeholder="Seu nome" />
              </div>
              <div className="bg-gray-50 rounded-xl p-1 -mx-1">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide px-3 pt-2 pb-1">Contato</p>
                <div className="p-2">
                  <label className={labelClass}>Celular / WhatsApp</label>
                  <input value={form.phone} onChange={f("phone")} className={inputClass} placeholder="(00) 00000-0000" />
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-1 -mx-1">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide px-3 pt-2 pb-1">Endereço de entrega</p>
                <div className="p-2 grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className={labelClass}>Rua / Avenida</label>
                    <input value={form.street} onChange={f("street")} className={inputClass} placeholder="Ex: Rua das Flores" />
                  </div>
                  <div>
                    <label className={labelClass}>Número</label>
                    <input value={form.number} onChange={f("number")} className={inputClass} placeholder="123" />
                  </div>
                  <div>
                    <label className={labelClass}>Bairro</label>
                    <input value={form.neighborhood} onChange={f("neighborhood")} className={inputClass} placeholder="Centro" />
                  </div>
                  <div>
                    <label className={labelClass}>Cidade</label>
                    <input value={form.city} onChange={f("city")} className={inputClass} placeholder="São Paulo" />
                  </div>
                  <div>
                    <label className={labelClass}>Estado</label>
                    <select value={form.state} onChange={f("state")} className={inputClass}>
                      <option value="">UF</option>
                      {UF_LIST.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>CEP</label>
                    <input value={form.zipCode} onChange={f("zipCode")} className={inputClass} placeholder="00000-000" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Orders */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
            <Package size={18} className="text-pink-500" />
            <h2 className="font-bold text-gray-900">Meus pedidos</h2>
          </div>

          {ordersLoading ? (
            <div className="py-12 flex justify-center">
              <div className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : orders.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <Package size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum pedido ainda</p>
              <Link href="/produtos" className="text-pink-600 text-sm font-semibold hover:underline mt-2 inline-block">
                Ver produtos
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {orders.map((order) => {
                const status = STATUS_LABELS[order.status] || { label: order.status, color: "bg-gray-100 text-gray-700" };
                return (
                  <div key={order.id} className="px-6 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-gray-900 text-sm">#{order.orderNumber}</span>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${status.color}`}>{status.label}</span>
                      </div>
                      <span className="font-bold text-gray-900 text-sm">{formatCurrency(order.total)}</span>
                    </div>
                    <div className="text-xs text-gray-400 mb-2">
                      {new Date(order.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                    </div>
                    <div className="space-y-0.5">
                      {order.items.map((item) => (
                        <p key={item.id} className="text-xs text-gray-600">
                          {item.quantity}× {item.product.name}
                          {item.size ? ` (Tam: ${item.size})` : ""}
                          {item.color ? ` · ${item.color}` : ""}
                        </p>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-5 flex gap-3">
          <Link href="/favoritos" className="flex items-center gap-2 text-sm text-gray-600 hover:text-pink-600 transition-colors px-4 py-2.5 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-pink-200">
            Ver favoritos <ChevronRight size={14} />
          </Link>
          <Link href="/produtos" className="flex items-center gap-2 text-sm text-gray-600 hover:text-pink-600 transition-colors px-4 py-2.5 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-pink-200">
            Explorar produtos <ChevronRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
