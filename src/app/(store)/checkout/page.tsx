"use client";

import { useState, useEffect, useCallback } from "react";
import { useCart } from "@/hooks/useCart";
import { useCustomer } from "@/hooks/useCustomer";
import { formatCurrency, generateOrderNumber } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { MessageCircle, ShoppingBag, MapPin, CreditCard, Loader2, Truck } from "lucide-react";
import { attributesLabel } from "@/lib/variantUtils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CompanySettings } from "@/types";

interface ShippingOption {
  servico: string;
  codigo: string;
  valor: number;
  prazo: number;
  erro: string;
}

export default function CheckoutPage() {
  const { items, total, clearCart } = useCart();
  const customer = useCustomer((s) => s.customer);
  const customerLoading = useCustomer((s) => s.loading);
  const router = useRouter();
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingTipo, setShippingTipo] = useState<"fixo" | "correios" | null>(null);
  const [selectedShipping, setSelectedShipping] = useState<ShippingOption | null>(null);
  const [freteForaArea, setFreteForaArea] = useState<{ cidade: string; uf: string } | null>(null);

  // Address fields
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");

  useEffect(() => {
    if (!customerLoading && !customer) {
      router.replace("/conta/login?redirect=/checkout");
    }
  }, [customerLoading, customer, router]);

  useEffect(() => {
    if (items.length > 0) {
      track("CHECKOUT_START", { path: "/checkout", value: total() });
    }
  }, []);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then(setSettings);
  }, []);

  useEffect(() => {
    if (!customer) return;
    setName((prev) => prev || customer.name);
    setEmail((prev) => prev || customer.email);
    // Pre-fill address and phone from saved profile
    fetch("/api/customer/profile").then((r) => r.json()).then((p) => {
      if (!p) return;
      if (p.phone) setPhone((prev) => prev || p.phone);
      if (p.street) setStreet((prev) => prev || p.street);
      if (p.number) setNumber((prev) => prev || p.number);
      if (p.neighborhood) setNeighborhood((prev) => prev || p.neighborhood);
      if (p.city) setCity((prev) => prev || p.city);
      if (p.state) setState((prev) => prev || p.state);
      if (p.zipCode) setZipCode((prev) => prev || p.zipCode);
    });
  }, [customer]);

  const calcularFrete = useCallback(async (cep: string) => {
    if (!settings?.freteAtivo) return;
    const cepClean = cep.replace(/\D/g, "");
    if (cepClean.length !== 8) {
      setShippingOptions([]);
      setSelectedShipping(null);
      setFreteForaArea(null);
      return;
    }
    setShippingLoading(true);
    try {
      const res = await fetch("/api/shipping/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cepDestino: cepClean,
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        }),
      });
      if (res.status === 422) {
        const data = await res.json();
        setFreteForaArea({ cidade: data.cidade || "sua cidade", uf: data.uf || "" });
        setShippingOptions([]);
        setSelectedShipping(null);
        return;
      }
      setFreteForaArea(null);
      const data = await res.json();
      if (!res.ok) {
        setShippingOptions([]);
        setSelectedShipping(null);
        return;
      }
      const opcoes: ShippingOption[] = (data.opcoes || []).filter((o: ShippingOption) => o.erro === "0" && o.valor >= 0);
      setShippingTipo(data.tipo === "fixo" ? "fixo" : "correios");
      setShippingOptions(opcoes);
      if (opcoes.length > 0) setSelectedShipping(opcoes[0]);
      else setSelectedShipping(null);
    } catch {
      setShippingOptions([]);
      setSelectedShipping(null);
      setFreteForaArea(null);
    } finally {
      setShippingLoading(false);
    }
  }, [settings, items]);

  useEffect(() => {
    if (settings?.freteAtivo && zipCode) {
      calcularFrete(zipCode);
    }
  }, [zipCode, settings, calcularFrete]);

  const collectEmail = settings?.checkoutCollectEmail;
  const collectAddress = settings?.checkoutCollectAddress;

  const mpAvailable = !!(settings?.mercadoPagoAtivo && settings?.mercadoPagoPublicKey);
  const nuPayAvailable = !!(settings?.nuPayAtivo && settings?.nuPayClientId);
  const whatsappAvailable = settings?.whatsappAtivo;
  const pixDiscountEnabled = settings?.pixDiscountEnabled && settings?.pixDiscountPercent > 0;
  const pixDiscount = settings?.pixDiscountPercent || 0;

  type PaymentMethod = "whatsapp" | "mercadopago" | "nupay" | "pix";

  const paymentOptions: Array<{ id: PaymentMethod; label: string; desc: string; emoji: string; discount?: number }> = [
    ...(pixDiscountEnabled ? [{ id: "pix" as PaymentMethod, label: `PIX com Desconto`, desc: `Desconto de ${pixDiscount}% em pagamentos via PIX`, emoji: "💰", discount: pixDiscount }] : []),
    ...(whatsappAvailable ? [{ id: "whatsapp" as PaymentMethod, label: "WhatsApp", desc: "Combinamos a forma de pagamento pela conversa", emoji: "💬" }] : []),
    ...(mpAvailable ? [{ id: "mercadopago" as PaymentMethod, label: "Mercado Pago", desc: "Cartão de crédito, Pix ou boleto", emoji: "💳" }] : []),
    ...(nuPayAvailable ? [{ id: "nupay" as PaymentMethod, label: "NuPay", desc: "Débito, crédito Nubank ou Pix em até 24×", emoji: "🟣" }] : []),
  ];

  const defaultPayment: PaymentMethod = paymentOptions.length > 0 ? paymentOptions[0].id : "whatsapp";
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>(defaultPayment);

  const discountAmount = selectedPayment === "pix" ? (total() * pixDiscount) / 100 : 0;
  const finalTotal = total() + (selectedShipping?.valor || 0) - discountAmount;

  const fullAddress = collectAddress && street
    ? `${street}, ${number}${neighborhood ? ` - ${neighborhood}` : ""}, ${city}${state ? `/${state}` : ""}${zipCode ? ` - CEP: ${zipCode}` : ""}`
    : "";

  if (customerLoading || (!customerLoading && !customer)) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <ShoppingBag size={64} className="mx-auto text-gray-300 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Carrinho vazio</h2>
        <Link href="/produtos" className="text-brand underline">Ver produtos</Link>
      </div>
    );
  }


  const buildWhatsAppMessage = (orderNumber: string): string => {
    const intro = settings?.checkoutMessage ? settings.checkoutMessage + "\n\n" : "";

    const itemLines = items
      .map((item) => {
        const variation = item.selectedAttributes && Object.keys(item.selectedAttributes).length > 0
          ? attributesLabel(item.selectedAttributes)
          : [item.size && `Tam: ${item.size}`, item.color && `Cor: ${item.color}`].filter(Boolean).join(", ");
        return `• ${item.name}${variation ? ` (${variation})` : ""} - ${item.quantity}× ${formatCurrency(item.price)} = ${formatCurrency(item.price * item.quantity)}`;
      })
      .join("\n");

    const freteTexto = selectedShipping
      ? `${formatCurrency(selectedShipping.valor)} (${selectedShipping.servico}${selectedShipping.prazo > 0 ? ` – ${selectedShipping.prazo} dias úteis` : ""})`
      : "A combinar";

    const lines = [
      `${intro}🛍️ *NOVO PEDIDO - ${settings?.name || "Minha Loja"}*`,
      ``,
      `📋 *Nº do pedido:* ${orderNumber}`,
      `👤 *Cliente:* ${name}`,
      `📱 *Telefone:* ${phone}`,
      ...(email ? [`📧 *E-mail:* ${email}`] : []),
      ...(fullAddress ? [
        ``,
        `📍 *Endereço de entrega:*`,
        `   ${street}, ${number}`,
        ...(neighborhood ? [`   ${neighborhood}`] : []),
        `   ${city}${state ? `/${state}` : ""}`,
        ...(zipCode ? [`   CEP: ${zipCode}`] : []),
      ] : []),
      ``,
      `*Produtos:*`,
      itemLines,
      ``,
      `💰 *Subtotal:* ${formatCurrency(total())}`,
      `🚚 *Frete:* ${freteTexto}`,
      `💳 *Total:* ${formatCurrency(total() + (selectedShipping?.valor || 0))}`,
      ...(notes ? [``, `📝 *Observações:* ${notes}`] : []),
      ``,
      `_Pedido gerado em ${new Date().toLocaleString("pt-BR")}_`,
    ];

    return lines.join("\n");
  };

  const handleWhatsAppSubmit = async () => {
    const orderNumber = generateOrderNumber();
    await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: name,
        customerEmail: email || null,
        customerPhone: phone,
        address: fullAddress || null,
        city: city || null,
        state: state || null,
        zipCode: zipCode || null,
        notes: notes || null,
        customerId: customer?.id || null,
        shippingCost: selectedShipping?.valor || 0,
        shippingMethod: selectedShipping?.servico || null,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          size: item.size,
          color: item.color,
          selectedAttributes: item.selectedAttributes,
        })),
      }),
    });
    const message = buildWhatsAppMessage(orderNumber);
    const whatsapp = settings?.whatsapp?.replace(/\D/g, "") || "";
    const url = `https://api.whatsapp.com/send?${whatsapp ? `phone=${whatsapp}&` : ""}text=${encodeURIComponent(message)}`;
    clearCart();
    if (email || customer?.email) {
      const e = email || customer!.email;
      fetch(`/api/cart/save?email=${encodeURIComponent(e)}`, { method: "DELETE" }).catch(() => {});
    }
    window.open(url, "_blank");
  };

const handleNuPaySubmit = async (forcePixOnly: boolean = false) => {
    try {
      validateCheckout();
    } catch (err) {
      alert(String(err).replace("Error: ", ""));
      return;
    }

    const res = await fetch("/api/checkout/nupay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: name,
        customerEmail: email || null,
        customerPhone: phone,
        address: fullAddress || null,
        city: city || null,
        state: state || null,
        zipCode: zipCode || null,
        notes: notes || null,
        customerId: customer?.id || null,
        shippingCost: selectedShipping?.valor || 0,
        shippingMethod: selectedShipping?.servico || null,
        discountAmount: discountAmount,
        pixOnly: forcePixOnly,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          size: item.size,
          color: item.color,
          selectedAttributes: item.selectedAttributes,
        })),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao iniciar pagamento");
    // Clear cart only if payment initialization was successful
    clearCart();
    if (email || customer?.email) {
      const e = email || customer!.email;
      fetch(`/api/cart/save?email=${encodeURIComponent(e)}`, { method: "DELETE" }).catch(() => {});
    }
    window.location.href = data.paymentUrl;
  };

  const validateCheckout = () => {
    // Name and phone always required
    if (!name?.trim()) throw new Error("Nome é obrigatório");
    if (!phone?.trim()) throw new Error("Telefone é obrigatório");

    // If collecting address, validate all address fields
    if (settings?.checkoutCollectAddress || (settings?.freteAtivo && settings?.freteTipo === "local")) {
      if (!street?.trim()) throw new Error("Rua é obrigatória");
      if (!number?.trim()) throw new Error("Número é obrigatório");
      if (!city?.trim()) throw new Error("Cidade é obrigatória");
      if (!state?.trim()) throw new Error("Estado é obrigatório");
      if (!zipCode?.trim()) throw new Error("CEP é obrigatório");
    }

    // If local pickup with retirada, block if city doesn't match
    if (settings?.freteAtivo && settings?.freteTipo === "local" && settings?.freteLocalRetirada && freteForaArea) {
      throw new Error(
        `Desculpe, fazemos entrega apenas em ${settings.freteLocalCidade || "nossa cidade"}. ` +
        `Você está em ${freteForaArea.cidade}${freteForaArea.uf ? `/${freteForaArea.uf}` : ""}. ` +
        `Para retirada, entre em contato conosco.`
      );
    }
  };

  const handleMercadoPagoSubmit = async (forcePixOnly: boolean = false) => {
    try {
      validateCheckout();
    } catch (err) {
      alert(String(err).replace("Error: ", ""));
      return;
    }

    const res = await fetch("/api/checkout/mercadopago", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: name,
        customerEmail: email || null,
        customerPhone: phone,
        address: fullAddress || null,
        city: city || null,
        state: state || null,
        zipCode: zipCode || null,
        notes: notes || null,
        customerId: customer?.id || null,
        shippingCost: selectedShipping?.valor || 0,
        shippingMethod: selectedShipping?.servico || null,
        discountAmount: discountAmount,
        pixOnly: forcePixOnly,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          size: item.size,
          color: item.color,
          selectedAttributes: item.selectedAttributes,
        })),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao iniciar pagamento");
    // Clear cart only if payment initialization was successful
    clearCart();
    if (email || customer?.email) {
      const e = email || customer!.email;
      fetch(`/api/cart/save?email=${encodeURIComponent(e)}`, { method: "DELETE" }).catch(() => {});
    }
    window.location.href = data.initPoint;
  };

  const validateStock = async (): Promise<string | null> => {
    const results = await Promise.all(
      items.map(async (item) => {
        const params = new URLSearchParams({ productId: item.productId });
        if (item.selectedAttributes && Object.keys(item.selectedAttributes).length > 0) {
          params.set("attributes", JSON.stringify(item.selectedAttributes));
        } else {
          if (item.size) params.set("size", item.size);
          if (item.color) params.set("color", item.color);
        }
        const res = await fetch(`/api/stock?${params}`);
        const { available } = await res.json();
        if (available < item.quantity) {
          const variant = item.selectedAttributes && Object.keys(item.selectedAttributes).length > 0
            ? attributesLabel(item.selectedAttributes)
            : [item.size && `Tam: ${item.size}`, item.color && `Cor: ${item.color}`].filter(Boolean).join(", ");
          return `"${item.name}"${variant ? ` (${variant})` : ""}: apenas ${available} disponível${available !== 1 ? "is" : ""}`;
        }
        return null;
      })
    );
    const errors = results.filter(Boolean) as string[];
    return errors.length > 0 ? errors.join("\n") : null;
  };

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (freteForaArea) return;
    setLoading(true);
    try {
      const stockError = await validateStock();
      if (stockError) {
        alert(`Estoque insuficiente para alguns itens:\n\n${stockError}\n\nAtualize o carrinho antes de continuar.`);
        return;
      }
      if (selectedPayment === "pix") {
        // User selected PIX discount - use Mercado Pago or NuPay with PIX-only restriction
        // Prefer Mercado Pago if available, otherwise use NuPay
        if (mpAvailable) {
          await handleMercadoPagoSubmit(true);
        } else if (nuPayAvailable) {
          await handleNuPaySubmit(true);
        }
      } else if (selectedPayment === "mercadopago") {
        await handleMercadoPagoSubmit(false);
      } else if (selectedPayment === "nupay") {
        await handleNuPaySubmit(false);
      } else {
        await handleWhatsAppSubmit();
      }
    } catch {
      alert("Erro ao processar pedido. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

  const UF_LIST = [
    "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
    "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
  ];

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-gray-900 mb-1">Finalizar pedido</h1>
          <p className="text-gray-500 flex items-center gap-2 text-sm">
            <ShoppingBag size={16} className="text-brand" />
            Revise seus dados, escolha a forma de pagamento e finalize seu pedido.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">

              {/* Personal data */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3">
                <h2 className="text-base font-bold text-gray-900">Seus dados</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Nome completo *</label>
                    <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Seu nome completo" />
                  </div>
                  <div>
                    <label className={labelClass}>WhatsApp / Telefone *</label>
                    <input required value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} placeholder="(00) 00000-0000" />
                  </div>
                  {collectEmail && (
                    <div>
                      <label className={labelClass}>E-mail</label>
                      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="email@exemplo.com" />
                    </div>
                  )}
                </div>
              </div>

              {/* Address */}
              {collectAddress && (
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3">
                  <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <MapPin size={16} className="text-brand" />
                    Endereço de entrega
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className={labelClass}>Rua / Avenida *</label>
                      <input value={street} onChange={(e) => setStreet(e.target.value)} className={inputClass} placeholder="Ex: Rua das Flores" />
                    </div>
                    <div>
                      <label className={labelClass}>Número *</label>
                      <input value={number} onChange={(e) => setNumber(e.target.value)} className={inputClass} placeholder="Ex: 123" />
                    </div>
                    <div>
                      <label className={labelClass}>Bairro</label>
                      <input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className={inputClass} placeholder="Ex: Centro" />
                    </div>
                    <div>
                      <label className={labelClass}>Cidade *</label>
                      <input value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} placeholder="Ex: São Paulo" />
                    </div>
                    <div>
                      <label className={labelClass}>Estado</label>
                      <select value={state} onChange={(e) => setState(e.target.value)} className={inputClass}>
                        <option value="">Selecione</option>
                        {UF_LIST.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>CEP</label>
                      <input value={zipCode} onChange={(e) => setZipCode(e.target.value)} className={inputClass} placeholder="00000-000" />
                    </div>
                  </div>
                </div>
              )}

              {/* CEP para entrega local quando coleta de endereço está desativada */}
              {!collectAddress && settings?.freteAtivo && settings?.freteTipo === "local" && (
                <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-3">
                  <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <MapPin size={16} className="text-brand" />
                    Verificar área de entrega
                  </h2>
                  <div>
                    <label className={labelClass}>CEP</label>
                    <input
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                      className={inputClass}
                      placeholder="00000-000"
                      maxLength={9}
                    />
                    {freteForaArea && (
                      <p className="text-sm text-red-600 mt-2 font-medium">
                        Entregamos apenas em {settings.freteLocalCidade || "nossa cidade"}{settings.freteLocalUF ? `/${settings.freteLocalUF}` : ""}. O CEP informado pertence a: <strong>{freteForaArea.cidade}{freteForaArea.uf ? `/${freteForaArea.uf}` : ""}</strong>.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <label className={labelClass}>Observações (opcional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className={inputClass}
                  placeholder="Alguma preferência, dúvida ou observação..."
                />
              </div>
            </div>

            {/* Sidebar direita - Resumo do pedido + Forma de pagamento */}
            <div className="lg:col-span-1">
              <div className="flex flex-col sticky top-24 max-h-screen gap-5">
                {/* Order summary */}
                <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm overflow-y-auto">
                  <h2 className="text-base font-bold text-gray-900 mb-4 sticky top-0 bg-white">Seu pedido</h2>

                  <div className="space-y-2 mb-3">
                    {items.map((item) => (
                    <div key={`${item.productId}-${item.selectedAttributes ? JSON.stringify(item.selectedAttributes) : `${item.size ?? ""}-${item.color ?? ""}`}`} className="flex items-start gap-3">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-14 h-14 object-cover rounded-xl bg-gray-100 shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-product.svg"; }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {item.selectedAttributes && Object.keys(item.selectedAttributes).length > 0
                            ? attributesLabel(item.selectedAttributes)
                            : [item.size && `Tam: ${item.size}`, item.color && `Cor: ${item.color}`].filter(Boolean).join(" · ")}
                        </p>
                        <p className="text-sm font-medium text-gray-700 mt-0.5">
                          {formatCurrency(item.price)} × {item.quantity}
                        </p>
                      </div>
                    </div>
                    ))}
                  </div>

                  <div className="border-t border-gray-100 pt-4 space-y-2 mb-4">
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Subtotal</span>
                    <span>{formatCurrency(total())}</span>
                  </div>

                  {settings?.freteAtivo && (collectAddress || settings?.freteTipo === "local") ? (
                    <div>
                      <div className="flex justify-between text-sm text-gray-500 mb-1">
                        <span className="flex items-center gap-1"><Truck size={13} />Frete</span>
                        {shippingLoading && <Loader2 size={13} className="animate-spin text-gray-400" />}
                      </div>
                      {!shippingLoading && freteForaArea && (
                        <p className="text-xs text-red-500 font-medium">Fora da área de entrega ({freteForaArea.cidade}{freteForaArea.uf ? `/${freteForaArea.uf}` : ""}).</p>
                      )}
                      {!shippingLoading && !freteForaArea && shippingOptions.length > 0 && (
                        <div className="space-y-1">
                          {shippingOptions.map((opt) => (
                            <label
                              key={opt.codigo}
                              className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg border cursor-pointer transition-all ${selectedShipping?.codigo === opt.codigo ? "border-brand bg-brand/5 font-semibold" : "border-gray-200 hover:border-gray-300"}`}
                            >
                              <span className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name="shipping"
                                  checked={selectedShipping?.codigo === opt.codigo}
                                  onChange={() => setSelectedShipping(opt)}
                                  className="accent-brand"
                                />
                                {opt.servico}
                                {opt.prazo > 0 && <span className="text-gray-400">({opt.prazo} dias úteis)</span>}
                              </span>
                              <span>{opt.valor === 0 ? "Grátis" : formatCurrency(opt.valor)}</span>
                            </label>
                          ))}
                        </div>
                      )}
                      {!shippingLoading && !freteForaArea && shippingOptions.length === 0 && zipCode.replace(/\D/g, "").length === 8 && (
                        <p className="text-xs text-gray-400">Não foi possível calcular. Será combinado.</p>
                      )}
                      {!shippingLoading && zipCode.replace(/\D/g, "").length < 8 && (
                        <p className="text-xs text-gray-400">Informe o CEP para calcular.</p>
                      )}
                    </div>
                  ) : (
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Frete</span>
                      <span className="text-gray-400">A combinar</span>
                    </div>
                  )}

                    {discountAmount > 0 && (
                      <div className="flex justify-between text-sm text-green-600 font-semibold">
                        <span>🎉 Desconto PIX ({pixDiscount}%)</span>
                        <span>-{formatCurrency(discountAmount)}</span>
                      </div>
                    )}

                    <div className="flex justify-between font-black text-gray-900 text-lg pt-2 border-t border-gray-100">
                      <span>Total</span>
                      <span>{formatCurrency(finalTotal)}</span>
                    </div>
                  </div>
                </div>

                {/* Payment method selector */}
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3">
                  <div>
                    <h2 className="text-base font-bold text-gray-900">Forma de pagamento</h2>
                    <p className="text-sm text-gray-500 mt-1">Escolha como você deseja pagar</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {paymentOptions.map((opt) => (
                      <label
                        key={opt.id}
                        className={`relative flex flex-col p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedPayment === opt.id
                            ? "border-brand bg-brand/10 shadow-md shadow-brand/20"
                            : "border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-3xl">{opt.emoji}</span>
                          <input
                            type="radio"
                            name="payment"
                            value={opt.id}
                            checked={selectedPayment === opt.id}
                            onChange={() => setSelectedPayment(opt.id)}
                            className="accent-brand w-4 h-4 mt-0.5 flex-shrink-0"
                          />
                        </div>
                        <p className="font-bold text-xs text-gray-900 mt-2 leading-tight">{opt.label}</p>

                        {selectedPayment === opt.id && (
                          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-brand rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </label>
                    ))}
                  </div>
                </div>

                {selectedPayment === "pix" ? (
                  <button type="submit" disabled={loading || !!freteForaArea} className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white py-3.5 rounded-xl font-bold hover:from-yellow-600 hover:to-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-yellow-200">
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <span className="text-xl">🎉</span>}
                    {loading ? "Aguarde..." : `Pagar com PIX (${pixDiscount}% off)`}
                  </button>
                ) : selectedPayment === "nupay" ? (
                  <button type="submit" disabled={loading || !!freteForaArea} className="w-full bg-purple-600 text-white py-3.5 rounded-xl font-bold hover:bg-purple-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-purple-100">
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
                    {loading ? "Aguarde..." : "Pagar com NuPay"}
                  </button>
                ) : selectedPayment === "mercadopago" ? (
                  <button type="submit" disabled={loading || !!freteForaArea} className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-blue-100">
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
                    {loading ? "Aguarde..." : "Pagar com Mercado Pago"}
                  </button>
                ) : (
                  <button type="submit" disabled={loading || !!freteForaArea} className="w-full bg-green-600 text-white py-3.5 rounded-xl font-bold hover:bg-green-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-green-100">
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <MessageCircle size={18} />}
                    {loading ? "Gerando pedido..." : "Enviar pelo WhatsApp"}
                  </button>
                )}
                <Link href="/carrinho" className="block text-center text-sm text-gray-400 hover:text-gray-600 mt-3 transition-colors">
                  ← Voltar ao carrinho
                </Link>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
