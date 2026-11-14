"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { notify } from "@/lib/notify";
import OptimizedImg from "@/components/OptimizedImg";
import { useCart } from "@/hooks/useCart";
import { useCustomer } from "@/hooks/useCustomer";
import { formatCurrency, generateOrderNumber } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { metaTrack } from "@/lib/metaPixel";
import { AlertCircle, Check, ChevronLeft, ChevronRight, MessageCircle, ShoppingBag, CreditCard, Loader2, Truck, Lock, ShieldCheck, Smartphone, User as UserIcon, Wallet, Zap } from "lucide-react";
import { attributesLabel } from "@/lib/variantUtils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CompanySettings } from "@/types";
import { isValidCPFOrCNPJ } from "@/lib/utils";
import { isProfileComplete } from "@/lib/customerProfile";
import MercadoPagoTransparentCheckout from "@/components/store/MercadoPagoTransparentCheckout";
import CouponBox from "@/components/store/CouponBox";
import { PENDING_COUPON_KEY } from "@/components/store/CouponLinkCatcher";

interface QuoteResult {
  pixDiscount: number;
  couponDiscount: number;
  creditDiscount?: number;
  creditBalance?: number;
  creditNote?: string | null;
  cashbackEarn?: number;
  cashbackPercent?: number;
  coupon: { code: string; type: string } | null;
  couponMessage: string | null;
  couponError: string | null;
  total: number;
}

interface ShippingOption {
  servico: string;
  codigo: string;
  valor: number;
  prazo: number;
  erro: string;
}

/** Etapa do checkout: aberta (formulário), concluída (resumo + "Alterar") ou a seguir (só o título). */
function Step({
  n, title, icon: Icon, state, summary, onEdit, children,
}: {
  n: number; title: string; icon: React.ComponentType<{ size?: number; className?: string }>;
  state: "active" | "done" | "todo"; summary?: React.ReactNode; onEdit?: () => void; children?: React.ReactNode;
}) {
  return (
    <section id={`etapa-${n}`} className={`scroll-mt-28 bg-white rounded-2xl ring-1 transition-shadow ${state === "active" ? "ring-gray-300 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.15)]" : "ring-gray-200/70"} ${state === "todo" ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-3 px-5 sm:px-6 py-4">
        <span className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${state === "done" ? "bg-emerald-500 text-white" : state === "active" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"}`}>
          {state === "done" ? <Check size={14} strokeWidth={3} /> : n}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className={`text-[15px] font-semibold ${state === "todo" ? "text-gray-500" : "text-gray-900"}`}>{title}</h2>
          {state === "done" && summary && <div className="text-[13px] text-gray-500 mt-0.5 truncate">{summary}</div>}
        </div>
        {state === "done" && onEdit ? (
          <button type="button" onClick={onEdit} className="text-[13px] font-semibold text-brand hover:underline shrink-0">Alterar</button>
        ) : (
          <Icon size={17} className="text-gray-300 shrink-0" />
        )}
      </div>
      {state === "active" && <div className="px-5 sm:px-6 pb-5 sm:pb-6 -mt-1">{children}</div>}
    </section>
  );
}

/** Botões da etapa: Voltar · Continuar. */
function StepNav({ onBack, onNext, nextLabel }: { onBack?: () => void; onNext?: () => void; nextLabel?: string }) {
  return (
    <div className={`mt-6 flex items-center gap-3 ${onNext ? "" : "lg:mt-4"}`}>
      {onBack && (
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900 px-1 py-2">
          <ChevronLeft size={16} /> Voltar
        </button>
      )}
      {onNext && (
        <button type="button" onClick={onNext} className="ml-auto inline-flex items-center gap-2 bg-gray-900 text-white hover:bg-gray-800 px-5 py-3 rounded-xl text-sm font-semibold transition">
          <span className="sm:hidden">Continuar</span>
          <span className="hidden sm:inline">{nextLabel || "Continuar"}</span>
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}

/** Mensagem de campo com problema. */
function FieldError({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1 text-xs font-medium text-red-600 flex items-center gap-1"><AlertCircle size={12} /> {msg}</p> : null;
}

/** Opção liga/desliga do pagamento (Pix com desconto, usar crédito). */
function ToggleOption({ checked, onChange, icon: Icon, title, hint }: { checked: boolean; onChange: (v: boolean) => void; icon: React.ComponentType<{ size?: number; className?: string }>; title: string; hint?: string | null }) {
  return (
    <label className={`flex items-center gap-3 rounded-xl px-3.5 py-3 ring-1 cursor-pointer transition ${checked ? "ring-brand bg-brand-light/40" : "ring-gray-200 hover:ring-gray-300"}`}>
      <Icon size={17} className={checked ? "text-brand shrink-0" : "text-gray-400 shrink-0"} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-gray-900">{title}</span>
        {hint && <span className="block text-xs text-gray-500">{hint}</span>}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
      <span aria-hidden className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${checked ? "bg-brand" : "bg-gray-300"}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : ""}`} />
      </span>
    </label>
  );
}

export default function CheckoutPage() {
  const { items, total, clearCart } = useCart();
  const customer = useCustomer((s) => s.customer);
  const customerLoading = useCustomer((s) => s.loading);
  const router = useRouter();
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(false);
  // Checkout em etapas: 1 dados · 2 entrega · 3 pagamento
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [profileReady, setProfileReady] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingTipo, setShippingTipo] = useState<"fixo" | "correios" | null>(null);
  const [selectedShipping, setSelectedShipping] = useState<ShippingOption | null>(null);
  const [freteForaArea, setFreteForaArea] = useState<{ cidade: string; uf: string } | null>(null);
  const [showAllShipping, setShowAllShipping] = useState(false);

  // Address fields
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
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
      metaTrack("InitiateCheckout", {
        content_ids: [...new Set(items.map((i) => i.productId))],
        content_type: "product",
        contents: items.map((i) => ({ id: i.productId, quantity: i.quantity, item_price: i.price })),
        num_items: items.reduce((sum, i) => sum + i.quantity, 0),
        value: total(),
      });
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
      // Cadastro incompleto (ex.: conta criada pelo Google): completa antes de comprar e volta para cá
      if (!isProfileComplete(p)) {
        router.replace("/conta/completar-perfil?redirect=/checkout");
        return;
      }
      if (p.phone) setPhone((prev) => prev || p.phone);
      if (p.street) setStreet((prev) => prev || p.street);
      if (p.number) setNumber((prev) => prev || p.number);
      if (p.neighborhood) setNeighborhood((prev) => prev || p.neighborhood);
      if (p.city) setCity((prev) => prev || p.city);
      if (p.state) setState((prev) => prev || p.state);
      if (p.zipCode) setZipCode((prev) => prev || p.zipCode);
      if (p.cpfCnpj) setCpfCnpj((prev) => prev || p.cpfCnpj);
      setProfileReady(true);
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

  // Shipping list: by default only the 3 cheapest, always including the fastest and the selected one
  const shippingByPrice = [...shippingOptions].sort((a, b) => a.valor - b.valor);
  const cheapestShipping = shippingByPrice[0];
  const fastestShipping = shippingOptions.filter((o) => o.prazo > 0).sort((a, b) => a.prazo - b.prazo || a.valor - b.valor)[0];
  const visibleShippingOptions = showAllShipping
    ? shippingByPrice
    : (() => {
        const pick = shippingByPrice.slice(0, 3);
        for (const must of [fastestShipping, selectedShipping]) {
          if (must && !pick.some((o) => o.codigo === must.codigo)) pick[pick.length - 1] = must;
        }
        return [...new Map(pick.map((o) => [o.codigo, o])).values()].sort((a, b) => a.valor - b.valor);
      })();

  const collectEmail = settings?.checkoutCollectEmail;
  const collectAddress = settings?.checkoutCollectAddress;

  const mpAvailable = !!(settings?.mercadoPagoAtivo && settings?.mercadoPagoPublicKey);
  const mpTransparent = mpAvailable && !!settings?.mercadoPagoTransparente;
  const [transparentCheckout, setTransparentCheckout] = useState<{ amount: number; pixOnly: boolean } | null>(null);
  const nuPayAvailable = !!(settings?.nuPayAtivo && settings?.nuPayConfigured);
  const infinityPayAvailable = !!(settings?.infinityPayAtivo && settings?.infinityPayHandle && settings?.infinityPayConfigured);
  const whatsappAvailable = settings?.whatsappAtivo;
  const pixDiscount = settings?.pixDiscountPercent ?? 0;
  const pixDiscountAvailable = settings?.pixDiscountEnabled && pixDiscount > 0;

  const [applyPixDiscount, setApplyPixDiscount] = useState(false);

  type PaymentMethod = "whatsapp" | "mercadopago" | "nupay" | "infinitypay";

  // Pagamento no site primeiro (padrão); WhatsApp por último, como alternativa
  const paymentOptions: Array<{ id: PaymentMethod; label: string; desc: string; emoji: string }> = [
    ...(mpAvailable ? [{
      id: "mercadopago" as PaymentMethod,
      label: mpTransparent ? "Cartão ou Pix" : "Mercado Pago",
      desc: mpTransparent ? "Pague aqui mesmo, com cartão de crédito em até 12x ou Pix" : "Cartão de crédito, Pix ou boleto",
      emoji: "💳",
    }] : []),
    ...(nuPayAvailable ? [{ id: "nupay" as PaymentMethod, label: "NuPay", desc: "Pague pelo app do Nubank, no débito ou crédito parcelado", emoji: "🟣" }] : []),
    ...(infinityPayAvailable ? [{ id: "infinitypay" as PaymentMethod, label: "Infinity Pay", desc: "Cartão de crédito, Pix ou boleto", emoji: "♾️" }] : []),
    ...(whatsappAvailable ? [{ id: "whatsapp" as PaymentMethod, label: "WhatsApp", desc: "Combinamos a forma de pagamento pela conversa", emoji: "💬" }] : []),
  ];

  const defaultPayment: PaymentMethod = paymentOptions.length > 0 ? paymentOptions[0].id : "mercadopago";
  const [chosenPayment, setSelectedPayment] = useState<PaymentMethod>(defaultPayment);
  // As configurações chegam depois do primeiro render: se a escolhida não existe nesta loja, vale a primeira disponível
  const selectedPayment: PaymentMethod = paymentOptions.some((o) => o.id === chosenPayment) ? chosenPayment : paymentOptions[0]?.id ?? chosenPayment;

  // NuPay has no Pix, so the Pix discount never applies to it
  const pixDiscountApplies = applyPixDiscount && selectedPayment !== "nupay";

  // ─── Cupom: o servidor valida e calcula (mesma regra usada ao criar o pedido) ───
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [quoteKey, setQuoteKey] = useState<string | null>(null);

  // Cupom vindo de link (?cupom=CODIGO), guardado pelo CouponLinkCatcher
  useEffect(() => {
    try {
      const pending = localStorage.getItem(PENDING_COUPON_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura única do localStorage após a hidratação
      if (pending) setCouponCode(pending);
    } catch {}
  }, []);

  const quoteItems = items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    size: item.size,
    color: item.color,
    selectedAttributes: item.selectedAttributes,
  }));
  // Crédito da conta (cashback): o cliente escolhe usar ou não; o servidor calcula quanto pode
  const [useCredit, setUseCredit] = useState(true);
  // Cotação sempre no servidor: cupom, Pix, crédito e o cashback que a compra gera
  const quoteBody = quoteItems.length
    ? JSON.stringify({
        items: quoteItems,
        // Sem frete escolhido, cota só os produtos
        zipCode: selectedShipping ? zipCode : null,
        shippingMethod: selectedShipping?.codigo || null,
        pixOnly: pixDiscountApplies,
        couponCode,
        useCredit,
        customerEmail: email || customer?.email || null,
        cpfCnpj: cpfCnpj || null,
      })
    : null;
  const couponLoading = !!couponCode && !!quoteBody && quoteKey !== quoteBody;

  useEffect(() => {
    if (!quoteBody) return;
    let cancelled = false;
    // Pequeno atraso para não cotar a cada tecla do CPF/e-mail
    const t = setTimeout(() => {
      fetch("/api/checkout/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: quoteBody })
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          setQuote(data && typeof data.total === "number" ? data : null);
          setQuoteKey(quoteBody);
        })
        .catch(() => !cancelled && setQuoteKey(quoteBody));
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [quoteBody]);

  const applyCoupon = (code: string) => {
    const c = code.trim().toUpperCase();
    setCouponCode(c);
    try { localStorage.setItem(PENDING_COUPON_KEY, c); } catch {}
  };
  const removeCoupon = () => {
    setCouponCode(null);
    setQuote(null);
    try { localStorage.removeItem(PENDING_COUPON_KEY); } catch {}
  };

  const couponActive = !!(couponCode && quote?.coupon);
  const couponDiscount = couponActive ? quote!.couponDiscount : 0;
  // Parte do Pix: vem do servidor quando já cotado (com cupom pode não acumular)
  const discountAmount = quote ? quote.pixDiscount : pixDiscountApplies ? (total() * pixDiscount) / 100 : 0;
  const creditBalance = quote?.creditBalance ?? 0;
  const creditDiscount = useCredit ? quote?.creditDiscount ?? 0 : 0;
  const creditActive = creditDiscount > 0;
  const cashbackEarn = quote?.cashbackEarn ?? 0;
  const finalTotal = Math.max(0, total() + (selectedShipping?.valor || 0) - discountAmount - couponDiscount - creditDiscount);

  // CEP preenche rua, bairro, cidade e UF (ViaCEP). O CEP que veio do cadastro não sobrescreve o endereço salvo.
  const [cepLoading, setCepLoading] = useState(false);
  const lastCep = useRef<string | null>(null);
  const numberInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!collectAddress) return;
    const d = zipCode.replace(/\D/g, "");
    if (d.length !== 8 || d === lastCep.current) return;
    const first = lastCep.current === null;
    lastCep.current = d;
    if (first && street) return;
    const t = setTimeout(async () => {
      setCepLoading(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${d}/json/`, { signal: AbortSignal.timeout(6000) });
        const data = await res.json();
        if (!res.ok || data.erro) return;
        if (data.logradouro) setStreet(data.logradouro);
        if (data.bairro) setNeighborhood(data.bairro);
        if (data.localidade) setCity(data.localidade);
        if (data.uf) setState(data.uf);
        if (!number) numberInputRef.current?.focus();
      } catch {
        // Sem internet ou CEP desconhecido: o cliente preenche à mão
      } finally {
        setCepLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage ao CEP
  }, [zipCode, collectAddress]);

  // ─── Etapas ───
  const needsAddress = !!(collectAddress || (settings?.freteAtivo && settings?.freteTipo === "local"));
  const shippingRequired = !!(settings?.freteAtivo && (collectAddress || settings?.freteTipo === "local"));
  /** O que falta em cada etapa (mesmas regras do envio do pedido), por campo. */
  const stepErrors = (n: 1 | 2 | 3): Record<string, string> => {
    const e: Record<string, string> = {};
    if (n === 1) {
      if (!name.trim()) e.name = "Informe seu nome completo";
      if (phone.replace(/\D/g, "").length < 10) e.phone = "Informe um telefone com DDD";
      if (!cpfCnpj.trim()) e.cpfCnpj = "Informe o CPF ou CNPJ (vai na nota fiscal)";
      else if (!isValidCPFOrCNPJ(cpfCnpj)) e.cpfCnpj = "CPF/CNPJ inválido — confira os números";
      if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = "E-mail inválido";
    }
    if (n === 2 && needsAddress) {
      if (zipCode.replace(/\D/g, "").length !== 8) e.zipCode = "Informe o CEP com 8 números";
      if (collectAddress) {
        if (!street.trim()) e.street = "Informe a rua";
        if (!number.trim()) e.number = "Informe o número (ou S/N)";
        if (!city.trim()) e.city = "Informe a cidade";
        if (!state.trim()) e.state = "Escolha o estado";
      }
      if (freteForaArea) e.shipping = `Não entregamos em ${freteForaArea.cidade}${freteForaArea.uf ? `/${freteForaArea.uf}` : ""}`;
      else if (shippingRequired && shippingOptions.length > 0 && !selectedShipping) e.shipping = "Escolha a forma de entrega";
      else if (shippingRequired && shippingLoading) e.shipping = "Aguarde o cálculo do frete";
    }
    if (n === 3 && !paymentOptions.some((o) => o.id === selectedPayment)) e.payment = "Escolha a forma de pagamento";
    return e;
  };
  const scrollToStep = (n: number) =>
    setTimeout(() => document.getElementById(`etapa-${n}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  const goToStep = (n: 1 | 2 | 3) => {
    setErrors({});
    setStep(n);
    scrollToStep(n);
  };
  /** Avança só se a etapa atual estiver completa; senão marca os campos que faltam. */
  const advance = () => {
    const e = stepErrors(step);
    if (Object.keys(e).length) {
      setErrors(e);
      notify.warning("Falta completar esta etapa", { description: Object.values(e)[0] });
      return;
    }
    goToStep((step + 1) as 2 | 3);
  };
  /** Antes de pagar: confere tudo e, se faltar algo, volta para a etapa certa mostrando o quê. */
  const firstInvalidStep = (): { n: 1 | 2 | 3; e: Record<string, string> } | null => {
    for (const n of [1, 2, 3] as const) {
      const e = stepErrors(n);
      if (Object.keys(e).length) return { n, e };
    }
    return null;
  };

  // Cadastro completo: já abre na entrega (dados pessoais ficam resumidos, com "Alterar")
  const autoStepped = useRef(false);
  useEffect(() => {
    if (autoStepped.current || !profileReady || !settings) return;
    autoStepped.current = true;
    const t = setTimeout(() => {
      if (!Object.keys(stepErrors(1)).length) setStep(2);
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só uma vez, quando o cadastro chega
  }, [profileReady, settings]);

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

  // While the in-site payment is open the cart may already be cleared (Pix generated):
  // keep the page mounted so the Pix QR code stays on screen.
  if (items.length === 0 && !transparentCheckout) {
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
      ...(couponActive ? [`🏷️ *Cupom ${couponCode}:* -${formatCurrency(couponDiscount)}`] : []),
      ...(creditActive ? [`🎁 *Crédito da conta:* -${formatCurrency(creditDiscount)}`] : []),
      `💳 *Total:* ${formatCurrency(finalTotal)}`,
      ``,
      `_Pedido gerado em ${new Date().toLocaleString("pt-BR")}_`,
    ];

    return lines.join("\n");
  };

  const handleWhatsAppSubmit = async () => {
    try {
      validateCheckout();
    } catch (err) {
      notify.warning(String(err).replace("Error: ", ""));
      return;
    }

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
        customerId: customer?.id || null,
        shippingCost: selectedShipping?.valor || 0,
        shippingMethod: selectedShipping?.codigo || null,
        couponCode: couponActive ? couponCode : null,
        useCredit: creditActive,
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

const handleNuPaySubmit = async () => {
    try {
      validateCheckout();
    } catch (err) {
      notify.warning(String(err).replace("Error: ", ""));
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
        streetNumber: number || null,
        neighborhood: neighborhood || null,
        cpfCnpj: cpfCnpj || null,
        city: city || null,
        state: state || null,
        zipCode: zipCode || null,
        shippingMethod: selectedShipping?.codigo || null,
        couponCode: couponActive ? couponCode : null,
        useCredit: creditActive,
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

    // If collecting address, validate CPF/CNPJ
    if (!cpfCnpj?.trim()) throw new Error("CPF/CNPJ é obrigatório");
    if (!isValidCPFOrCNPJ(cpfCnpj)) throw new Error("CPF/CNPJ inválido");

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
      notify.warning(String(err).replace("Error: ", ""));
      return;
    }

    const res = await fetch("/api/checkout/mercadopago", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: name,
        customerEmail: email || null,
        customerPhone: phone,
        streetNumber: number || null,
        neighborhood: neighborhood || null,
        cpfCnpj: cpfCnpj || null,
        address: fullAddress || null,
        city: city || null,
        state: state || null,
        zipCode: zipCode || null,
        customerId: customer?.id || null,
        shippingCost: selectedShipping?.valor || 0,
        shippingMethod: selectedShipping?.codigo || null,
        couponCode: couponActive ? couponCode : null,
        useCredit: creditActive,
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

  // Fields sent with the in-site Mercado Pago payment (prices/shipping are recomputed on the server)
  const buildTransparentPayload = () => ({
    customerName: name,
    customerEmail: email || customer?.email || null,
    customerPhone: phone,
    streetNumber: number || null,
    neighborhood: neighborhood || null,
    cpfCnpj: cpfCnpj || null,
    address: fullAddress || null,
    city: city || null,
    state: state || null,
    zipCode: zipCode || null,
    shippingMethod: selectedShipping?.codigo || null,
    couponCode: couponActive ? couponCode : null,
    useCredit: creditActive,
    pixOnly: applyPixDiscount,
    items: items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      size: item.size,
      color: item.color,
      selectedAttributes: item.selectedAttributes,
    })),
  });

  const openTransparentCheckout = async () => {
    try {
      validateCheckout();
    } catch (err) {
      notify.warning(String(err).replace("Error: ", ""));
      return;
    }
    const payload = buildTransparentPayload();
    const res = await fetch("/api/checkout/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: payload.items, zipCode: payload.zipCode, shippingMethod: payload.shippingMethod, pixOnly: payload.pixOnly,
        couponCode: payload.couponCode, useCredit: payload.useCredit, customerEmail: payload.customerEmail, cpfCnpj: payload.cpfCnpj,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      notify.error("Não foi possível calcular o total", { description: data.error || "Tente de novo em instantes." });
      return;
    }
    setTransparentCheckout({ amount: data.total, pixOnly: applyPixDiscount });
  };

  const clearCartAfterOrder = () => {
    clearCart();
    if (email || customer?.email) {
      const e = email || customer!.email;
      fetch(`/api/cart/save?email=${encodeURIComponent(e)}`, { method: "DELETE" }).catch(() => {});
    }
  };

  const handleInfinityPaySubmit = async () => {
    try {
      validateCheckout();
    } catch (err) {
      notify.warning(String(err).replace("Error: ", ""));
      return;
    }

    const res = await fetch("/api/checkout/infinitypay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: name,
        customerEmail: email || null,
        customerPhone: phone,
        cpfCnpj: cpfCnpj || null,
        address: fullAddress || null,
        city: city || null,
        state: state || null,
        zipCode: zipCode || null,
        customerId: customer?.id || null,
        shippingCost: selectedShipping?.valor || 0,
        shippingMethod: selectedShipping?.codigo || null,
        couponCode: couponActive ? couponCode : null,
        useCredit: creditActive,
        discountAmount: discountAmount,
        pixOnly: applyPixDiscount,
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
    // Ainda não está no pagamento: o botão principal avança
    if (step < 3) return advance();
    const invalid = firstInvalidStep();
    if (invalid) {
      setStep(invalid.n);
      setErrors(invalid.e);
      scrollToStep(invalid.n);
      notify.warning(`Confira a etapa ${invalid.n}`, { description: Object.values(invalid.e)[0] });
      return;
    }
    if (freteForaArea) return;
    setLoading(true);
    try {
      const stockError = await validateStock();
      if (stockError) {
        notify.error("Estoque insuficiente para alguns itens", { description: `${stockError}\nAtualize o carrinho antes de continuar.`, duration: 10000 });
        return;
      }
      if (selectedPayment === "mercadopago" && mpTransparent) {
        await openTransparentCheckout();
      } else if (selectedPayment === "mercadopago" && mpAvailable) {
        await handleMercadoPagoSubmit(applyPixDiscount);
      } else if (selectedPayment === "nupay" && nuPayAvailable) {
        await handleNuPaySubmit();
      } else if (selectedPayment === "infinitypay" && infinityPayAvailable) {
        await handleInfinityPaySubmit();
      } else if (selectedPayment === "whatsapp" && whatsappAvailable) {
        await handleWhatsAppSubmit();
      } else {
        notify.warning("Forma de pagamento indisponível", { description: "Escolha outra opção para continuar." });
      }
    } catch {
      notify.error("Não foi possível finalizar o pedido", { description: "Nada foi cobrado. Tente novamente em instantes." });
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";
  const fieldCls = (k: string) => (errors[k] ? `${inputClass} !border-red-400 ring-2 ring-red-100` : inputClass);

  const UF_LIST = [
    "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
    "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
  ];

  const units = items.reduce((n, i) => n + i.quantity, 0);
  const usesShipping = !!(settings?.freteAtivo && (collectAddress || settings?.freteTipo === "local"));
  const PAY_ICON: Record<PaymentMethod, React.ComponentType<{ size?: number; className?: string }>> = {
    whatsapp: MessageCircle, mercadopago: CreditCard, nupay: Smartphone, infinitypay: CreditCard,
  };
  const submitLabel =
    selectedPayment === "whatsapp" ? "Enviar pedido pelo WhatsApp"
    : selectedPayment === "mercadopago" ? (mpTransparent ? "Pagar" : "Ir para o pagamento")
    : selectedPayment === "nupay" ? "Pagar com NuPay"
    : "Ir para o pagamento";
  const canSubmit = paymentOptions.some((o) => o.id === selectedPayment);

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">Finalizar compra</h1>
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5"><Lock size={13} /> Ambiente seguro · seus dados ficam protegidos</p>
          </div>
          <Link href="/carrinho" className="hidden sm:inline text-sm text-gray-500 hover:text-gray-900">← Voltar ao carrinho</Link>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-5 items-start">
            <div className="space-y-3">
              {/* 1. Dados */}
              <Step
                n={1}
                title="Seus dados"
                icon={UserIcon}
                state={step === 1 ? "active" : "done"}
                onEdit={() => goToStep(1)}
                summary={<>{name || "—"} · {phone || "sem telefone"}{cpfCnpj ? ` · CPF/CNPJ ${cpfCnpj}` : ""}</>}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Nome completo</label>
                    <input value={name} onChange={(e) => { setName(e.target.value); setErrors((x) => ({ ...x, name: "" })); }} className={fieldCls("name")} placeholder="Seu nome completo" autoComplete="name" />
                    <FieldError msg={errors.name} />
                  </div>
                  <div>
                    <label className={labelClass}>WhatsApp / Telefone</label>
                    <input value={phone} onChange={(e) => { setPhone(e.target.value); setErrors((x) => ({ ...x, phone: "" })); }} className={fieldCls("phone")} placeholder="(00) 00000-0000" inputMode="tel" autoComplete="tel" />
                    <FieldError msg={errors.phone} />
                  </div>
                  <div>
                    <label className={labelClass}>CPF / CNPJ <span className="font-normal text-gray-400">(para a nota fiscal)</span></label>
                    <input value={cpfCnpj} onChange={(e) => { setCpfCnpj(e.target.value); setErrors((x) => ({ ...x, cpfCnpj: "" })); }} className={fieldCls("cpfCnpj")} placeholder="000.000.000-00" inputMode="numeric" />
                    <FieldError msg={errors.cpfCnpj} />
                  </div>
                  {collectEmail && (
                    <div className="sm:col-span-2">
                      <label className={labelClass}>E-mail</label>
                      <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErrors((x) => ({ ...x, email: "" })); }} className={fieldCls("email")} placeholder="email@exemplo.com" autoComplete="email" />
                      <FieldError msg={errors.email} />
                    </div>
                  )}
                </div>
                <StepNav onNext={advance} nextLabel="Continuar para a entrega" />
              </Step>

              {/* 2. Entrega */}
              <Step
                n={2}
                title="Entrega"
                icon={Truck}
                state={step === 2 ? "active" : step > 2 ? "done" : "todo"}
                onEdit={() => goToStep(2)}
                summary={
                  <>
                    {collectAddress && street ? `${street}, ${number} · ${city}/${state}` : zipCode ? `CEP ${zipCode}` : "A combinar"}
                    {selectedShipping ? ` · ${selectedShipping.servico} (${selectedShipping.valor === 0 ? "grátis" : formatCurrency(selectedShipping.valor)})` : ""}
                  </>
                }
              >
                {needsAddress ? (
                  <div className="grid grid-cols-6 gap-4">
                    <div className="col-span-6 sm:col-span-2">
                      <label className={labelClass}>CEP</label>
                      <div className="relative">
                        <input value={zipCode} onChange={(e) => { setZipCode(e.target.value); setErrors((x) => ({ ...x, zipCode: "" })); }} className={fieldCls("zipCode")} placeholder="00000-000" inputMode="numeric" maxLength={9} autoComplete="postal-code" />
                        {cepLoading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
                      </div>
                      <FieldError msg={errors.zipCode} />
                    </div>
                    {collectAddress && (
                      <>
                        <div className="col-span-6 sm:col-span-4">
                          <label className={labelClass}>Rua / Avenida</label>
                          <input value={street} onChange={(e) => { setStreet(e.target.value); setErrors((x) => ({ ...x, street: "" })); }} className={fieldCls("street")} placeholder="Preenchido pelo CEP" autoComplete="address-line1" />
                          <FieldError msg={errors.street} />
                        </div>
                        <div className="col-span-2">
                          <label className={labelClass}>Número</label>
                          <input ref={numberInputRef} value={number} onChange={(e) => { setNumber(e.target.value); setErrors((x) => ({ ...x, number: "" })); }} className={fieldCls("number")} placeholder="123" />
                          <FieldError msg={errors.number} />
                        </div>
                        <div className="col-span-4">
                          <label className={labelClass}>Bairro</label>
                          <input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className={inputClass} placeholder="Bairro" />
                        </div>
                        <div className="col-span-4">
                          <label className={labelClass}>Cidade</label>
                          <input value={city} onChange={(e) => { setCity(e.target.value); setErrors((x) => ({ ...x, city: "" })); }} className={fieldCls("city")} placeholder="Cidade" autoComplete="address-level2" />
                          <FieldError msg={errors.city} />
                        </div>
                        <div className="col-span-2">
                          <label className={labelClass}>UF</label>
                          <select value={state} onChange={(e) => { setState(e.target.value); setErrors((x) => ({ ...x, state: "" })); }} className={fieldCls("state")}>
                            <option value="">—</option>
                            {UF_LIST.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                          </select>
                          <FieldError msg={errors.state} />
                        </div>
                      </>
                    )}
                  </div>
                ) : null}

                {/* Frete */}
                <div className={needsAddress ? "mt-5 pt-4 border-t border-gray-100" : ""}>
                  <p className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    Forma de entrega {shippingLoading && <Loader2 size={13} className="animate-spin text-gray-400" />}
                  </p>
                  {!usesShipping ? (
                    <p className="text-sm text-gray-500">O frete é combinado com a loja depois do pedido.</p>
                  ) : freteForaArea ? (
                    <p className="text-sm text-red-600">
                      Entregamos apenas em {settings?.freteLocalCidade || "nossa cidade"}{settings?.freteLocalUF ? `/${settings.freteLocalUF}` : ""}. Este CEP é de <b>{freteForaArea.cidade}{freteForaArea.uf ? `/${freteForaArea.uf}` : ""}</b>.
                    </p>
                  ) : zipCode.replace(/\D/g, "").length < 8 ? (
                    <p className="text-sm text-gray-400">Informe o CEP para ver as opções e prazos.</p>
                  ) : !shippingLoading && shippingOptions.length === 0 ? (
                    <p className="text-sm text-gray-500">Não conseguimos calcular agora — o frete será combinado.</p>
                  ) : (
                    <div className="space-y-2">
                      {visibleShippingOptions.map((opt) => {
                        const sel = selectedShipping?.codigo === opt.codigo;
                        return (
                          <label key={opt.codigo} className={`flex items-center gap-3 rounded-xl px-3.5 py-3 ring-1 cursor-pointer transition ${sel ? "ring-2 ring-brand bg-brand-light/40" : "ring-gray-200 hover:ring-gray-300"}`}>
                            <input type="radio" name="shipping" checked={sel} onChange={() => { setSelectedShipping(opt); setErrors((x) => ({ ...x, shipping: "" })); }} className="accent-[var(--brand)] w-4 h-4" />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-gray-900">{opt.servico}</span>
                              <span className="block text-xs text-gray-500">
                                {opt.prazo > 0 ? `${opt.prazo} dias úteis` : "Prazo a confirmar"}
                                {cheapestShipping?.codigo === opt.codigo && <span className="ml-1.5 text-emerald-600 font-medium">· mais barato</span>}
                                {fastestShipping?.codigo === opt.codigo && fastestShipping.codigo !== cheapestShipping?.codigo && <span className="ml-1.5 text-sky-600 font-medium">· mais rápido</span>}
                              </span>
                            </span>
                            <span className="text-sm font-semibold text-gray-900 tabular-nums">{opt.valor === 0 ? "Grátis" : formatCurrency(opt.valor)}</span>
                          </label>
                        );
                      })}
                      {shippingOptions.length > visibleShippingOptions.length && (
                        <button type="button" onClick={() => setShowAllShipping(true)} className="text-xs text-brand font-semibold hover:underline">
                          Ver mais {shippingOptions.length - visibleShippingOptions.length} opções
                        </button>
                      )}
                      {showAllShipping && shippingOptions.length > 3 && (
                        <button type="button" onClick={() => setShowAllShipping(false)} className="text-xs text-gray-500 hover:underline ml-3">Mostrar menos</button>
                      )}
                    </div>
                  )}
                  <FieldError msg={errors.shipping} />
                </div>
                <StepNav onBack={() => goToStep(1)} onNext={advance} nextLabel="Continuar para o pagamento" />
              </Step>

              {/* 3. Pagamento */}
              <Step n={3} title="Pagamento" icon={CreditCard} state={step === 3 ? "active" : "todo"}>
                {paymentOptions.length === 0 ? (
                  <p className="text-sm text-gray-500">Nenhuma forma de pagamento disponível no momento.</p>
                ) : (
                  <div className="space-y-2">
                    {paymentOptions.map((opt) => {
                      const sel = selectedPayment === opt.id;
                      const Icon = PAY_ICON[opt.id];
                      return (
                        <label key={opt.id} className={`flex items-center gap-3 rounded-xl px-3.5 py-3 ring-1 cursor-pointer transition ${sel ? "ring-2 ring-brand bg-brand-light/40" : "ring-gray-200 hover:ring-gray-300"}`}>
                          <input type="radio" name="payment" value={opt.id} checked={sel} onChange={() => setSelectedPayment(opt.id)} className="accent-[var(--brand)] w-4 h-4" />
                          <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${sel ? "bg-brand text-on-button" : "bg-gray-100 text-gray-500"}`}><Icon size={17} /></span>
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-gray-900">{opt.label}</span>
                            <span className="block text-xs text-gray-500">{opt.desc}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
                <FieldError msg={errors.payment} />

                {((pixDiscountAvailable && selectedPayment !== "nupay") || creditBalance > 0) && (
                  <div className="mt-5 pt-4 border-t border-gray-100 space-y-2">
                    <p className="text-sm font-semibold text-gray-800">Descontos</p>
                    {pixDiscountAvailable && selectedPayment !== "nupay" && (
                      <ToggleOption
                        checked={applyPixDiscount}
                        onChange={setApplyPixDiscount}
                        icon={Zap}
                        title={`Pagar com Pix e ganhar ${pixDiscount}% de desconto`}
                        hint={applyPixDiscount ? "Desconto aplicado — o pagamento será só por Pix." : "O pagamento passa a ser só por Pix."}
                      />
                    )}
                    {creditBalance > 0 && (
                      <ToggleOption
                        checked={useCredit}
                        onChange={setUseCredit}
                        icon={Wallet}
                        title={`Usar meu crédito${quote?.creditDiscount ? ` (−${formatCurrency(quote.creditDiscount)})` : ""}`}
                        hint={quote?.creditNote || `Você tem ${formatCurrency(creditBalance)} de cashback disponível.`}
                      />
                    )}
                  </div>
                )}
                {/* No celular o resumo fica embaixo: o botão de pagar também aparece aqui */}
                <div className="lg:hidden mt-5">
                  <button
                    type="submit"
                    disabled={loading || !!freteForaArea || !canSubmit}
                    className="w-full inline-flex items-center justify-center gap-2 bg-brand text-on-button py-3.5 rounded-xl font-semibold disabled:opacity-50"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : selectedPayment === "whatsapp" ? <MessageCircle size={18} /> : <Lock size={16} />}
                    {loading ? "Aguarde…" : `${submitLabel} · ${formatCurrency(finalTotal)}`}
                  </button>
                </div>
                <StepNav onBack={() => goToStep(2)} />
              </Step>
            </div>

            {/* Resumo (fixo no desktop) */}
            <aside className="lg:sticky lg:top-28 space-y-3">
              <div className="bg-white rounded-2xl ring-1 ring-gray-200/70 p-5">
                <h2 className="text-[15px] font-semibold text-gray-900 flex items-center gap-2">
                  <ShoppingBag size={16} className="text-gray-400" /> Resumo <span className="text-gray-400 font-normal">· {units} {units === 1 ? "peça" : "peças"}</span>
                </h2>
                <ul className="mt-3 space-y-3 max-h-64 overflow-y-auto pr-1">
                  {items.map((item) => (
                    <li key={`${item.productId}-${item.selectedAttributes ? JSON.stringify(item.selectedAttributes) : `${item.size ?? ""}-${item.color ?? ""}`}`} className="flex items-center gap-3">
                      <span className="relative shrink-0">
                        <OptimizedImg src={item.image} widths={[160]} sizes="48px" alt={item.name} className="w-12 h-12 object-cover rounded-lg bg-gray-100" />
                        <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-gray-900 text-white text-[10px] font-bold flex items-center justify-center">{item.quantity}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-medium text-gray-900 truncate">{item.name}</span>
                        <span className="block text-xs text-gray-500 truncate">
                          {item.selectedAttributes && Object.keys(item.selectedAttributes).length > 0
                            ? attributesLabel(item.selectedAttributes)
                            : [item.size, item.color].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="text-[13px] font-medium text-gray-900 tabular-nums">{formatCurrency(item.price * item.quantity)}</span>
                    </li>
                  ))}
                </ul>

                <dl className="mt-4 pt-4 border-t border-gray-100 space-y-1.5 text-sm">
                  <div className="flex justify-between text-gray-600"><dt>Subtotal</dt><dd className="tabular-nums">{formatCurrency(total())}</dd></div>
                  <div className="flex justify-between gap-3 text-gray-600">
                    <dt>Frete</dt>
                    <dd className="text-right tabular-nums">
                      {!usesShipping ? "A combinar"
                        : shippingLoading ? "Calculando…"
                        : freteForaArea ? <span className="text-red-500">Fora da área</span>
                        : selectedShipping ? (selectedShipping.valor === 0 ? "Grátis" : formatCurrency(selectedShipping.valor))
                        : zipCode.replace(/\D/g, "").length < 8 ? <span className="text-gray-400">Informe o CEP</span> : "A combinar"}
                    </dd>
                  </div>
                  {couponActive && couponDiscount > 0 && (
                    <div className="flex justify-between text-emerald-700"><dt>Cupom {couponCode}</dt><dd className="tabular-nums">−{formatCurrency(couponDiscount)}</dd></div>
                  )}
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-700"><dt>Desconto Pix ({pixDiscount}%)</dt><dd className="tabular-nums">−{formatCurrency(discountAmount)}</dd></div>
                  )}
                  {creditActive && (
                    <div className="flex justify-between text-emerald-700"><dt>Crédito da conta</dt><dd className="tabular-nums">−{formatCurrency(creditDiscount)}</dd></div>
                  )}
                </dl>

                <div className="mt-3">
                  <CouponBox
                    code={couponCode}
                    loading={couponLoading}
                    message={quote?.couponMessage ?? null}
                    error={couponCode && quote && !quote.coupon ? quote.couponError || "Cupom inválido" : null}
                    onApply={applyCoupon}
                    onRemove={removeCoupon}
                  />
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 flex items-baseline justify-between">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="text-2xl font-semibold tracking-tight text-gray-900 tabular-nums">{formatCurrency(finalTotal)}</span>
                </div>
                {cashbackEarn > 0 && (
                  <p className="mt-2 text-[12.5px] text-brand bg-brand-light rounded-lg px-2.5 py-1.5">
                    Você ganha <b>{formatCurrency(cashbackEarn)}</b> de cashback para a próxima compra
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || (step === 3 && (!!freteForaArea || !canSubmit))}
                  className="hidden lg:inline-flex mt-4 w-full items-center justify-center gap-2 bg-brand text-on-button hover:bg-brand-hover py-3.5 rounded-xl font-semibold transition disabled:opacity-50 shadow-[0_10px_24px_-12px_color-mix(in_srgb,var(--button)_70%,transparent)]"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : step < 3 ? <ChevronRight size={18} /> : selectedPayment === "whatsapp" ? <MessageCircle size={18} /> : <Lock size={16} />}
                  {loading ? "Aguarde…" : step === 1 ? "Continuar para a entrega" : step === 2 ? "Continuar para o pagamento" : canSubmit ? `${submitLabel} · ${formatCurrency(finalTotal)}` : "Nenhuma forma de pagamento"}
                </button>
                <p className="mt-2 text-[11.5px] text-gray-400 text-center flex items-center justify-center gap-1"><ShieldCheck size={12} /> Pagamento processado com segurança</p>
              </div>
              <Link href="/carrinho" className="sm:hidden block text-center text-sm text-gray-500 hover:text-gray-900">← Voltar ao carrinho</Link>
            </aside>
          </div>
        </form>
      </div>

      {transparentCheckout && settings?.mercadoPagoPublicKey && (
        <MercadoPagoTransparentCheckout
          publicKey={settings.mercadoPagoPublicKey}
          amount={transparentCheckout.amount}
          payerEmail={email || customer?.email || undefined}
          pixOnly={transparentCheckout.pixOnly}
          buildPayload={buildTransparentPayload}
          onOrderCreated={clearCartAfterOrder}
          onClose={() => setTransparentCheckout(null)}
        />
      )}
    </div>
  );
}
