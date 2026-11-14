"use client";

import { useEffect, useMemo, useState } from "react";
import { confirmDialog } from "@/lib/notify";
import {
  AlertTriangle, Bot, Check, CheckCircle2, CreditCard, LockOpen, Palette, Plug, RotateCcw, Save, Store, Truck,
} from "lucide-react";
import { AI_MODELS, DEFAULT_AI_MODEL } from "@/lib/aiModels";
import { CompanySettings } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { BRAZILIAN_REGIONS } from "@/lib/regions";
import { Button } from "./ui/Button";
import ImageUpload from "./ImageUpload";
import ImageListInput from "./ImageListInput";
import {
  Card, Field, Hint, IntegrationCard, SecretInput, StatusBadge, ToggleRow, inputClass, labelClass, statusOf,
} from "./settings/ui";

interface Props {
  initialSettings: CompanySettings | null;
}

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

type SectionKey = "loja" | "aparencia" | "pagamentos" | "frete" | "integracoes" | "ia";
const SECTIONS: { key: SectionKey; label: string; hint: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { key: "loja", label: "Loja", hint: "Nome, logo, contato, meta e impostos", icon: Store },
  { key: "aparencia", label: "Aparência", hint: "Cores e banner da home", icon: Palette },
  { key: "pagamentos", label: "Checkout e pagamentos", hint: "Formas de pagamento", icon: CreditCard },
  { key: "frete", label: "Frete e entregas", hint: "Cálculo, Melhor Envio, prazos", icon: Truck },
  { key: "integracoes", label: "Integrações", hint: "Bling e Meta Ads", icon: Plug },
  { key: "ia", label: "Atendimento com IA", hint: "Assistente da loja", icon: Bot },
];

/** Estado do formulário a partir das configurações salvas. */
function fromSettings(s: CompanySettings | null) {
  const x = (s ?? {}) as CompanySettings & {
    diasUteisProduzao?: number | null; monthlyRevenueGoal?: number | null; salesTaxRate?: number | null;
    cashbackEnabled?: boolean; cashbackPercent?: number; cashbackReleaseDays?: number; cashbackValidityDays?: number;
    cashbackMaxUsePercent?: number; cashbackMinOrder?: number; cashbackStackCoupon?: boolean; cashbackStackPix?: boolean;
    promoAutoNotify?: boolean;
  };
  return {
    name: x.name || "",
    logo: x.logo || "",
    phone: x.phone || "",
    whatsapp: x.whatsapp || "",
    instagram: x.instagram || "",
    address: x.address || "",
    cnpj: x.cnpj || "",
    description: x.description || "",
    primaryColor: x.primaryColor || "#ec4899",
    buttonColor: x.buttonColor || x.primaryColor || "#ec4899",
    menuColor: x.menuColor || x.primaryColor || "#ec4899",
    bannerImages: JSON.parse(x.bannerImages || "[]") as string[],
    heroBadge: x.heroBadge || "",
    heroTitle: x.heroTitle || "",
    heroButtonText: x.heroButtonText || "",
    heroButtonSecondaryText: x.heroButtonSecondaryText || "",
    checkoutType: x.checkoutType || "whatsapp",
    checkoutCollectEmail: x.checkoutCollectEmail || false,
    checkoutCollectAddress: x.checkoutCollectAddress || false,
    checkoutMessage: x.checkoutMessage || "",
    mpPublicKey: x.mercadoPagoPublicKey || "",
    mpAccessToken: x.mercadoPagoAccessToken || "",
    mercadoPagoTransparente: !!x.mercadoPagoTransparente,
    mercadoPagoAtivo: x.mercadoPagoAtivo ?? x.checkoutType === "gateway",
    nuPayClientId: x.nuPayClientId || "",
    nuPayClientSecret: x.nuPayClientSecret || "",
    nuPaySandbox: !!x.nuPaySandbox,
    nuPayAtivo: x.nuPayAtivo ?? x.checkoutType === "nupay",
    infinityPayHandle: x.infinityPayHandle || "",
    infinityPayApiKey: x.infinityPayApiKey || "",
    infinityPayAtivo: x.infinityPayAtivo ?? false,
    whatsappAtivo: x.whatsappAtivo ?? true,
    pixDiscountEnabled: x.pixDiscountEnabled ?? false,
    cashbackEnabled: x.cashbackEnabled ?? false,
    cashbackPercent: String(x.cashbackPercent ?? 5).replace(".", ","),
    cashbackReleaseDays: String(x.cashbackReleaseDays ?? 7),
    cashbackValidityDays: String(x.cashbackValidityDays ?? 90),
    cashbackMaxUsePercent: String(x.cashbackMaxUsePercent ?? 50).replace(".", ","),
    cashbackMinOrder: x.cashbackMinOrder ? String(x.cashbackMinOrder).replace(".", ",") : "",
    cashbackStackCoupon: x.cashbackStackCoupon ?? false,
    cashbackStackPix: x.cashbackStackPix ?? true,
    promoAutoNotify: x.promoAutoNotify ?? false,
    pixDiscountPercent: (x.pixDiscountPercent ?? 0).toString(),
    blingAtivo: x.blingAtivo ?? false,
    blingNfeAuto: x.blingNfeAuto ?? false,
    blingClientId: x.blingClientId || "",
    blingClientSecret: x.blingClientSecret || "",
    freteAtivo: x.freteAtivo || false,
    freteTipo: x.freteTipo || "fixo",
    freteLocalCidade: x.freteLocalCidade || "",
    freteLocalUF: x.freteLocalUF || "",
    freteLocalRegioes: x.freteLocalRegioes ? x.freteLocalRegioes.split("|") : ([] as string[]),
    freteLocalRetirada: x.freteLocalRetirada || false,
    freteValorFixo: x.freteValorFixo?.toString() || "0",
    freteCEPOrigem: x.freteCEPOrigem || "",
    fretePesoDefault: x.fretePesoDefaultGramas?.toString() || "500",
    melhorEnvioToken: x.melhorEnvioToken || "",
    melhorEnvioApiToken: x.melhorEnvioApiToken || "",
    melhorEnvioWebhookSecret: x.melhorEnvioWebhookSecret || "",
    metaPixelId: x.metaPixelId || "",
    metaCapiAccessToken: x.metaCapiAccessToken || "",
    metaTestEventCode: x.metaTestEventCode || "",
    aiAssistantEnabled: !!x.aiAssistantEnabled,
    aiApiKey: x.aiApiKey || "",
    aiModel: x.aiModel || DEFAULT_AI_MODEL,
    aiPolicies: x.aiPolicies || "",
    aiDailyMessageLimit: String(x.aiDailyMessageLimit ?? 300),
    pacoteAltura: x.fretePacoteAltura?.toString() || "5",
    pacoteLargura: x.fretePacoteLargura?.toString() || "12",
    pacoteComprimento: x.fretePacoteComprimento?.toString() || "17",
    diasUteisProduzao: x.diasUteisProduzao?.toString() || "2",
    monthlyRevenueGoal: x.monthlyRevenueGoal?.toString() || "",
    salesTaxRate: x.salesTaxRate != null ? String(x.salesTaxRate).replace(".", ",") : "",
  };
}
type FormState = ReturnType<typeof fromSettings>;

/** Corpo do PUT /api/settings — mesmos campos e conversões de sempre. */
function toPayload(f: FormState) {
  return {
    name: f.name, logo: f.logo, phone: f.phone, whatsapp: f.whatsapp, instagram: f.instagram, address: f.address, cnpj: f.cnpj, description: f.description,
    primaryColor: f.primaryColor, buttonColor: f.buttonColor, menuColor: f.menuColor, bannerImages: f.bannerImages, checkoutType: f.checkoutType,
    checkoutCollectEmail: f.checkoutCollectEmail, checkoutCollectAddress: f.checkoutCollectAddress,
    checkoutMessage: f.checkoutMessage, mercadoPagoPublicKey: f.mpPublicKey || null, mercadoPagoAccessToken: f.mpAccessToken || null,
    mercadoPagoAtivo: f.mercadoPagoAtivo, mercadoPagoTransparente: f.mercadoPagoTransparente,
    nuPayClientId: f.nuPayClientId || null, nuPayClientSecret: f.nuPayClientSecret || null, nuPayAtivo: f.nuPayAtivo, nuPaySandbox: f.nuPaySandbox,
    infinityPayHandle: f.infinityPayHandle || null, infinityPayApiKey: f.infinityPayApiKey || null, infinityPayAtivo: f.infinityPayAtivo,
    whatsappAtivo: f.whatsappAtivo,
    heroBadge: f.heroBadge, heroTitle: f.heroTitle, heroButtonText: f.heroButtonText, heroButtonSecondaryText: f.heroButtonSecondaryText,
    pixDiscountEnabled: f.pixDiscountEnabled, pixDiscountPercent: parseFloat(f.pixDiscountPercent) || 0,
    cashbackEnabled: f.cashbackEnabled,
    cashbackPercent: parseFloat(f.cashbackPercent.replace(",", ".")) || 0,
    cashbackReleaseDays: parseInt(f.cashbackReleaseDays) || 0,
    cashbackValidityDays: parseInt(f.cashbackValidityDays) || 90,
    cashbackMaxUsePercent: parseFloat(f.cashbackMaxUsePercent.replace(",", ".")) || 0,
    cashbackMinOrder: parseFloat(f.cashbackMinOrder.replace(/\./g, "").replace(",", ".")) || 0,
    cashbackStackCoupon: f.cashbackStackCoupon,
    cashbackStackPix: f.cashbackStackPix,
    promoAutoNotify: f.promoAutoNotify,
    blingAtivo: f.blingAtivo, blingNfeAuto: f.blingNfeAuto, blingClientId: f.blingClientId || null, blingClientSecret: f.blingClientSecret || null,
    freteAtivo: f.freteAtivo, freteTipo: f.freteTipo, freteLocalCidade: f.freteLocalCidade || null, freteLocalUF: f.freteLocalUF || null,
    freteLocalRegioes: f.freteLocalRegioes.length > 0 ? f.freteLocalRegioes.join("|") : null, freteLocalRetirada: f.freteLocalRetirada,
    freteValorFixo: parseFloat(f.freteValorFixo) || 0,
    freteCEPOrigem: f.freteCEPOrigem || null,
    fretePesoDefaultGramas: parseInt(f.fretePesoDefault) || 500,
    melhorEnvioToken: f.melhorEnvioToken || null,
    melhorEnvioApiToken: f.melhorEnvioApiToken || null,
    melhorEnvioWebhookSecret: f.melhorEnvioWebhookSecret || null,
    metaPixelId: f.metaPixelId || null,
    metaCapiAccessToken: f.metaCapiAccessToken || null,
    metaTestEventCode: f.metaTestEventCode || null,
    aiAssistantEnabled: f.aiAssistantEnabled,
    aiApiKey: f.aiApiKey || null,
    aiModel: f.aiModel,
    aiPolicies: f.aiPolicies || null,
    aiDailyMessageLimit: parseInt(f.aiDailyMessageLimit) || 300,
    fretePacoteAltura: parseInt(f.pacoteAltura) || 5,
    fretePacoteLargura: parseInt(f.pacoteLargura) || 12,
    fretePacoteComprimento: parseInt(f.pacoteComprimento) || 17,
    diasUteisProduzao: parseInt(f.diasUteisProduzao) || 2,
    // "15.000,50" (com vírgula: ponto é milhar) ou "15000.50" (sem vírgula: ponto é decimal)
    monthlyRevenueGoal:
      parseFloat(f.monthlyRevenueGoal.includes(",") ? f.monthlyRevenueGoal.replace(/\./g, "").replace(",", ".") : f.monthlyRevenueGoal) || null,
    salesTaxRate: parseFloat(f.salesTaxRate.replace(",", ".")) || null,
  };
}

export default function SettingsForm({ initialSettings }: Props) {
  const [form, setForm] = useState<FormState>(() => fromSettings(initialSettings));
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(fromSettings(initialSettings)));
  const [section, setSection] = useState<SectionKey>("loja");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const dirty = JSON.stringify(form) !== savedSnapshot;

  // Aviso do navegador ao sair com mudanças não salvas
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // Abre a seção vinda da URL (ex.: /admin/configuracoes#ia)
  useEffect(() => {
    const hash = window.location.hash.replace("#", "") as SectionKey;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura única do hash após a hidratação
    if (SECTIONS.some((s) => s.key === hash)) setSection(hash);
  }, []);

  const goTo = (key: SectionKey) => {
    setSection(key);
    history.replaceState(null, "", `#${key}`);
  };

  // ─── Situação de cada integração (selos) ───
  const st = useMemo(() => ({
    whatsapp: statusOf(form.whatsappAtivo, !!form.whatsapp.replace(/\D/g, "")),
    mp: statusOf(form.mercadoPagoAtivo, !!form.mpPublicKey && !!form.mpAccessToken),
    nupay: statusOf(form.nuPayAtivo, !!form.nuPayClientId && !!form.nuPayClientSecret, form.nuPaySandbox),
    infinity: statusOf(form.infinityPayAtivo, !!form.infinityPayHandle && !!form.infinityPayApiKey),
    bling: statusOf(form.blingAtivo, !!form.blingClientId && !!form.blingClientSecret),
    me: statusOf(
      form.freteAtivo && (form.freteTipo === "melhorenvio" || form.freteTipo === "hibrido"),
      !!form.melhorEnvioToken
    ),
    meta: statusOf(!!form.metaPixelId || !!form.metaCapiAccessToken, !!form.metaPixelId),
    ai: statusOf(form.aiAssistantEnabled, !!form.aiApiKey),
  }), [form]);
  const blingAuthorized = !!initialSettings?.blingAccessToken;

  // Seções com algo pendente ganham um ponto âmbar no menu
  const attention: Partial<Record<SectionKey, boolean>> = {
    loja: !form.name.trim(),
    pagamentos: [st.mp, st.nupay, st.infinity, st.whatsapp].includes("missing"),
    frete: st.me === "missing",
    integracoes: st.bling === "missing" || (form.blingAtivo && !blingAuthorized),
    ia: st.ai === "missing",
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setNotice(null);
    if (!form.name.trim()) {
      goTo("loja");
      setNotice({ ok: false, text: "Informe o nome da loja antes de salvar." });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(form)),
      });
      if (!res.ok) throw new Error();
      setSavedSnapshot(JSON.stringify(form));
      setNotice({ ok: true, text: "Configurações salvas. As mudanças já valem na loja." });
      setTimeout(() => setNotice((n) => (n?.ok ? null : n)), 4000);
    } catch {
      setNotice({ ok: false, text: "Erro ao salvar configurações. Tente de novo." });
    } finally {
      setLoading(false);
    }
  };

  const discard = async () => {
    if (!(await confirmDialog({ title: "Descartar as mudanças?", message: "O que você alterou e ainda não salvou será perdido.", confirmText: "Descartar", tone: "danger" }))) return;
    setForm(JSON.parse(savedSnapshot));
  };

  const whatsappPreview = [
    form.checkoutMessage ? form.checkoutMessage + "\n\n" : "",
    `🛍️ *NOVO PEDIDO - ${form.name || "Minha Loja"}*`,
    ``,
    `📋 *Nº do pedido:* PD2605090001`,
    `👤 *Cliente:* Maria Silva`,
    `📱 *Telefone:* (11) 99999-9999`,
    ...(form.checkoutCollectEmail ? [`📧 *E-mail:* maria@email.com`] : []),
    ...(form.checkoutCollectAddress ? [`📍 *Endereço:* Rua das Flores, 123 - São Paulo`] : []),
    ``,
    `*Produtos:*`,
    `• Vestido Floral (Tam: M, Cor: Rosa) - 1× ${formatCurrency(89.9)} = ${formatCurrency(89.9)}`,
    `• Blusa Básica (Tam: P) - 2× ${formatCurrency(45.9)} = ${formatCurrency(91.8)}`,
    ``,
    `💰 *Total:* ${formatCurrency(181.7)}`,
    `🚚 *Frete:* A combinar`,
  ].join("\n");

  const usesCep = form.freteTipo === "melhorenvio" || form.freteTipo === "hibrido" || form.freteTipo === "correios";
  const current = SECTIONS.find((s) => s.key === section)!;

  return (
    <form onSubmit={handleSubmit} noValidate className="pb-24">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Configurações da loja</h1>
          <p className="text-sm text-gray-500 mt-1">Dados da loja, aparência, pagamentos, frete e integrações. Salve no fim — nada muda na loja até salvar.</p>
        </div>
        {dirty && <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 ring-1 ring-amber-200 rounded-full px-2.5 py-1 self-start sm:self-auto"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Mudanças não salvas</span>}
      </div>

      {notice && (
        <div className={`mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${notice.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
          {notice.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />} {notice.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[230px_minmax(0,1fr)] gap-6">
        {/* Navegação das seções */}
        <nav className="lg:sticky lg:top-24 lg:self-start -mx-4 px-4 lg:mx-0 lg:px-0 overflow-x-auto [scrollbar-width:none]" aria-label="Seções">
          <ul className="flex lg:flex-col gap-1 min-w-max lg:min-w-0">
            {SECTIONS.map((s) => {
              const active = section === s.key;
              const Icon = s.icon;
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    onClick={() => goTo(s.key)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition ${active ? "bg-white shadow-sm ring-1 ring-gray-200 text-gray-900" : "text-gray-600 hover:bg-white/70 hover:text-gray-900"}`}
                  >
                    <Icon size={17} className={active ? "text-brand" : "text-gray-400"} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium whitespace-nowrap">{s.label}</span>
                      <span className="hidden lg:block text-[11px] text-gray-400 truncate">{s.hint}</span>
                    </span>
                    {attention[s.key] && <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title="Algo precisa de atenção" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div key={section} className="space-y-5 animate-fade-up [animation-duration:0.3s] min-w-0">
          <div className="hidden lg:block">
            <h2 className="text-lg font-semibold text-gray-900">{current.label}</h2>
            <p className="text-sm text-gray-500">{current.hint}</p>
          </div>

          {/* ───────── LOJA ───────── */}
          {section === "loja" && (
            <>
              <Card title="Identidade" description="Como a loja aparece para os clientes.">
                <Field label="Nome da loja *">
                  <input value={form.name} onChange={(e) => set("name", e.target.value)} className={`${inputClass} ${!form.name.trim() ? "border-amber-300" : ""}`} placeholder="Ex.: Moda da Mari" />
                </Field>
                <Field label="Descrição" hint="Aparece no rodapé e na seção de destaque da home.">
                  <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} className={inputClass} placeholder="Uma frase descrevendo sua loja…" />
                </Field>
                <ImageUpload value={form.logo} onChange={(v) => set("logo", v)} label="Logo da loja" aspect="landscape" />
              </Card>

              <Card title="Contato" description="Usado no rodapé, no menu e nos botões de WhatsApp.">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Telefone">
                    <input value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputClass} placeholder="(00) 00000-0000" />
                  </Field>
                  <Field label="WhatsApp da loja" hint="Com código do país e DDD. Ex.: 5511999999999 (55 = Brasil, 11 = DDD).">
                    <input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} className={inputClass} placeholder="5511999999999" inputMode="tel" />
                  </Field>
                  <Field label="Instagram">
                    <input value={form.instagram} onChange={(e) => set("instagram", e.target.value)} className={inputClass} placeholder="@sualoja" />
                  </Field>
                  <Field label="CNPJ" hint="Também usado na emissão de etiquetas do Melhor Envio.">
                    <input value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} className={inputClass} placeholder="12.345.678/0001-00" />
                  </Field>
                  <Field label="Endereço da loja física" className="sm:col-span-2" hint="Também é o endereço de remetente das etiquetas.">
                    <input value={form.address} onChange={(e) => set("address", e.target.value)} className={inputClass} placeholder="Rua, número - Bairro, Cidade/UF" />
                  </Field>
                </div>
              </Card>

              <Card title="Impostos sobre as vendas" description="Usado no DRE e no lucro líquido dos relatórios. Sem ele, o lucro aparece maior do que é.">
                <Field label="Alíquota (%)" hint="No Simples Nacional, use a alíquota efetiva do DAS (o valor do DAS ÷ faturamento do mês). Seu contador informa; no comércio costuma ficar entre 4% e 6%." className="max-w-xs">
                  <input inputMode="decimal" value={form.salesTaxRate} onChange={(e) => set("salesTaxRate", e.target.value.replace(/[^\d.,]/g, "").slice(0, 6))} className={inputClass} placeholder="Ex.: 4,5" />
                </Field>
              </Card>

              <Card title="Meta de faturamento" description="Aparece no painel com o quanto já foi vendido no mês, a projeção e quanto vender por dia. Só você vê.">
                <Field label="Meta do mês (R$)" hint="Deixe em branco para não usar meta. Vale para todos os meses até você mudar." className="max-w-xs">
                  <input inputMode="decimal" value={form.monthlyRevenueGoal} onChange={(e) => set("monthlyRevenueGoal", e.target.value.replace(/[^\d.,]/g, ""))} className={inputClass} placeholder="Ex.: 15000" />
                </Field>
              </Card>
            </>
          )}

          {/* ───────── APARÊNCIA ───────── */}
          {section === "aparencia" && (
            <>
              <Card title="Cores" description="A cor dos botões e a do menu valem para a loja e para o admin.">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {([
                    ["primaryColor", "Cor principal", "Base para as outras cores."],
                    ["buttonColor", "Cor dos botões", "Comprar, salvar e destaques."],
                    ["menuColor", "Cor do menu", "Itens ativos e ícones do cabeçalho."],
                  ] as const).map(([k, label, hint]) => (
                    <div key={k}>
                      <label className={labelClass}>{label}</label>
                      <div className="flex items-center gap-2 rounded-xl ring-1 ring-gray-200 p-1.5 pr-3">
                        <input type="color" value={form[k]} onChange={(e) => set(k, e.target.value)} className="w-9 h-9 rounded-lg cursor-pointer border-0 p-0 bg-transparent" aria-label={label} />
                        <span className="text-sm text-gray-700 font-mono">{form[k]}</span>
                        {k !== "primaryColor" && form[k] !== form.primaryColor && (
                          <Button variant="ghost" size="iconSm" icon={RotateCcw} onClick={() => set(k, form.primaryColor)} aria-label="Usar a cor principal" className="ml-auto text-gray-400" />
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{hint}</p>
                    </div>
                  ))}
                </div>
                {/* Prévia ao vivo */}
                <div className="rounded-2xl ring-1 ring-gray-200 overflow-hidden">
                  <div className="bg-gray-900 text-white text-[11px] text-center py-1.5">Prévia do cabeçalho da loja</div>
                  <div className="bg-white px-4 py-3 flex items-center gap-3 border-b border-gray-100">
                    <span className="font-bold text-gray-900 text-sm truncate">{form.name || "Sua loja"}</span>
                    <span className="flex-1 h-8 rounded-full bg-gray-100" />
                    <span className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold" style={{ backgroundColor: form.buttonColor }}>DD</span>
                  </div>
                  <div className="bg-white px-4 py-2.5 flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ backgroundColor: `color-mix(in srgb, ${form.menuColor} 14%, white)`, color: form.menuColor }}>Início</span>
                    <span className="px-3 py-1.5 rounded-full text-xs font-semibold text-gray-600">Produtos</span>
                    <span className="ml-auto px-4 py-2 rounded-xl text-white text-xs font-semibold" style={{ backgroundColor: form.buttonColor }}>Adicionar ao carrinho</span>
                  </div>
                </div>
              </Card>

              <Card title="Banner da página inicial" description="Imagens do carrossel (formato paisagem) e os textos sobre elas.">
                <ImageListInput images={form.bannerImages} onChange={(v) => set("bannerImages", v)} aspect="landscape" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Etiqueta acima do título" hint="Texto pequeno em destaque.">
                    <input value={form.heroBadge} onChange={(e) => set("heroBadge", e.target.value)} className={inputClass} placeholder="Ex.: NOVA COLEÇÃO" />
                  </Field>
                  <Field label="Título principal" hint="Se vazio, usa o nome da loja.">
                    <input value={form.heroTitle} onChange={(e) => set("heroTitle", e.target.value)} className={inputClass} placeholder="Ex.: Estilo que fala por você" />
                  </Field>
                  <Field label="Botão principal" hint="Padrão: “Ver coleção”.">
                    <input value={form.heroButtonText} onChange={(e) => set("heroButtonText", e.target.value)} className={inputClass} placeholder="Ex.: Ver coleção" />
                  </Field>
                  <Field label="Botão secundário" hint="Se vazio, mostra o link do Instagram.">
                    <input value={form.heroButtonSecondaryText} onChange={(e) => set("heroButtonSecondaryText", e.target.value)} className={inputClass} placeholder="Ex.: Explorar coleção" />
                  </Field>
                </div>
              </Card>
            </>
          )}

          {/* ───────── PAGAMENTOS ───────── */}
          {section === "pagamentos" && (
            <>
              <Hint tone="blue">O cliente escolhe como pagar no checkout. Ligue as formas que você usa; cada uma mostra se está pronta para receber.</Hint>

              <IntegrationCard title="Mercado Pago" icon="💳" description="Cartão de crédito, Pix e boleto." status={st.mp} on={form.mercadoPagoAtivo} onToggle={(v) => set("mercadoPagoAtivo", v)}>
                <Hint>Em <b>mercadopago.com.br → Seu negócio → Configurações → Credenciais</b>, use as credenciais de <b>produção</b>.</Hint>
                <Field label="Public Key (chave pública)" hint="Identifica sua conta no navegador.">
                  <input value={form.mpPublicKey} onChange={(e) => set("mpPublicKey", e.target.value)} className={`${inputClass} font-mono`} placeholder="APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                </Field>
                <Field label="Access Token (chave secreta)" hint="Usada só no servidor. Nunca compartilhe.">
                  <SecretInput value={form.mpAccessToken} onChange={(v) => set("mpAccessToken", v)} placeholder="APP_USR-xxxxxxxx…" />
                </Field>
                <ToggleRow
                  title="Pagamento dentro do site (checkout transparente)"
                  hint="O cliente digita o cartão ou gera o Pix sem sair da loja. Desligado, ele vai para a página do Mercado Pago. Requer chave Pix cadastrada na conta."
                  checked={form.mercadoPagoTransparente}
                  onChange={(v) => set("mercadoPagoTransparente", v)}
                />
              </IntegrationCard>

              <IntegrationCard title="Pix com desconto" icon="⚡" description="Desconto para quem paga no Pix." status={form.pixDiscountEnabled ? (parseFloat(form.pixDiscountPercent) > 0 ? "active" : "missing") : "off"} on={form.pixDiscountEnabled} onToggle={(v) => set("pixDiscountEnabled", v)}>
                <Field label="Percentual de desconto (%)" hint={`O cliente vê “Pix com desconto (${form.pixDiscountPercent || 0}% off)” e paga só com Pix.`} className="max-w-[200px]">
                  <input type="number" min="0" max="100" step="0.5" value={form.pixDiscountPercent} onChange={(e) => set("pixDiscountPercent", e.target.value)} className={inputClass} placeholder="Ex.: 5" />
                </Field>
              </IntegrationCard>

              <IntegrationCard
                title="Cashback"
                icon="💜"
                description="Parte de cada compra volta como crédito na conta do cliente para a próxima compra."
                status={form.cashbackEnabled ? (parseFloat(form.cashbackPercent.replace(",", ".")) || 0 > 0 ? "active" : "missing") : "off"}
                on={form.cashbackEnabled}
                onToggle={(v) => set("cashbackEnabled", v)}
              >
                <Hint>
                  O cliente vê o cashback na página do produto, no carrinho e no checkout. O crédito só é liberado depois da entrega + o prazo abaixo (assim, devolução cancela o cashback) e vale pela validade escolhida. Na conta do cliente aparecem saldo, extrato e vencimentos.
                </Hint>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="Cashback (%)" hint="Sobre os produtos pagos, sem frete. Moda costuma usar de 5% a 10%.">
                    <input inputMode="decimal" value={form.cashbackPercent} onChange={(e) => set("cashbackPercent", e.target.value.replace(/[^\d.,]/g, "").slice(0, 5))} className={inputClass} placeholder="Ex.: 5" />
                  </Field>
                  <Field label="Liberar após a entrega (dias)" hint="Use o prazo de devolução (7 dias).">
                    <input inputMode="numeric" value={form.cashbackReleaseDays} onChange={(e) => set("cashbackReleaseDays", e.target.value.replace(/\D/g, "").slice(0, 3))} className={inputClass} placeholder="7" />
                  </Field>
                  <Field label="Validade do crédito (dias)" hint="Contada da liberação. O cliente é avisado 7 dias antes de vencer.">
                    <input inputMode="numeric" value={form.cashbackValidityDays} onChange={(e) => set("cashbackValidityDays", e.target.value.replace(/\D/g, "").slice(0, 4))} className={inputClass} placeholder="90" />
                  </Field>
                  <Field label="Crédito paga até (%) do pedido" hint="Dos produtos, após descontos. Ex.: 50% garante dinheiro novo em toda compra.">
                    <input inputMode="decimal" value={form.cashbackMaxUsePercent} onChange={(e) => set("cashbackMaxUsePercent", e.target.value.replace(/[^\d.,]/g, "").slice(0, 5))} className={inputClass} placeholder="50" />
                  </Field>
                  <Field label="Compra mínima para usar (R$)" hint="Em produtos. Deixe vazio para qualquer valor.">
                    <input inputMode="decimal" value={form.cashbackMinOrder} onChange={(e) => set("cashbackMinOrder", e.target.value.replace(/[^\d.,]/g, "").slice(0, 10))} className={inputClass} placeholder="Ex.: 100" />
                  </Field>
                </div>
                <ToggleRow title="Pode usar junto com cupom" hint="Desligado: o cliente escolhe entre o cupom e o crédito." checked={form.cashbackStackCoupon} onChange={(v) => set("cashbackStackCoupon", v)} />
                <ToggleRow title="Pode usar junto com o desconto do Pix" hint="Desligado: com Pix com desconto, o crédito não é aplicado." checked={form.cashbackStackPix} onChange={(v) => set("cashbackStackPix", v)} />
              </IntegrationCard>

              <IntegrationCard
                title="Avisos de promoção para interessados"
                icon="📣"
                description="E-mail “o produto que você viu baixou de preço / está em promoção” para quem viu, favoritou ou deixou o produto no carrinho."
                status={form.promoAutoNotify ? "active" : "off"}
                on={form.promoAutoNotify}
                onToggle={(v) => set("promoAutoNotify", v)}
              >
                <Hint>
                  <b>Ligado:</b> o aviso sai sozinho quando uma promoção relâmpago começa ou quando você baixa o preço de um produto.{" "}
                  <b>Desligado:</b> o admin pergunta “Avisar os interessados?” nesses momentos. Nos dois casos, você também pode avisar quando quiser em <b>Análises → Interesse por produto</b>.
                  Cada cliente recebe no máximo <b>3 e-mails de promoção a cada 30 dias</b>, nunca dois do mesmo produto nesse período, e pode se descadastrar pelo link do e-mail.
                </Hint>
              </IntegrationCard>

              <IntegrationCard title="NuPay" icon="🟣" description="Débito, crédito Nubank ou Pix em até 24×." status={st.nupay} on={form.nuPayAtivo} onToggle={(v) => set("nuPayAtivo", v)}>
                <Hint>Após o credenciamento, o NuPay for Business envia a <b>Merchant Key</b> e o <b>Merchant Token</b>. As notificações de pagamento são configuradas sozinhas em cada pedido.</Hint>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Merchant Key">
                    <input value={form.nuPayClientId} onChange={(e) => set("nuPayClientId", e.target.value)} className={`${inputClass} font-mono`} placeholder="X-Merchant-Key" />
                  </Field>
                  <Field label="Merchant Token" hint="Chave secreta usada no servidor.">
                    <SecretInput value={form.nuPayClientSecret} onChange={(v) => set("nuPayClientSecret", v)} placeholder="X-Merchant-Token" />
                  </Field>
                </div>
                <ToggleRow title="Ambiente de testes (sandbox)" hint="Desligue para receber pagamentos reais." checked={form.nuPaySandbox} onChange={(v) => set("nuPaySandbox", v)} />
              </IntegrationCard>

              <IntegrationCard title="Infinity Pay" icon="♾️" description="Cartão de crédito, Pix ou boleto." status={st.infinity} on={form.infinityPayAtivo} onToggle={(v) => set("infinityPayAtivo", v)}>
                <Hint>
                  Configure o webhook no painel Infinity Pay apontando para:{" "}
                  <b className="break-all">{typeof window !== "undefined" ? window.location.origin : ""}/api/checkout/infinitypay/webhook</b>
                </Hint>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Handle (InfiniteTag)" hint="Seu usuário no app, sem o $.">
                    <input value={form.infinityPayHandle} onChange={(e) => set("infinityPayHandle", e.target.value)} className={inputClass} placeholder="sualoja" />
                  </Field>
                  <Field label="API Key" hint="Chave secreta usada no servidor.">
                    <SecretInput value={form.infinityPayApiKey} onChange={(v) => set("infinityPayApiKey", v)} placeholder="Sua API Key" />
                  </Field>
                </div>
              </IntegrationCard>

              <IntegrationCard title="Pedido pelo WhatsApp" icon="💬" description="O cliente envia o pedido pelo WhatsApp e vocês combinam pagamento e entrega." status={st.whatsapp} on={form.whatsappAtivo} onToggle={(v) => set("whatsappAtivo", v)}>
                {!form.whatsapp.replace(/\D/g, "") && <Hint tone="amber">Cadastre o WhatsApp da loja na seção <button type="button" onClick={() => goTo("loja")} className="underline font-medium cursor-pointer rounded hover:text-amber-950">Loja</button>.</Hint>}
                <Field label="Mensagem inicial (opcional)">
                  <textarea value={form.checkoutMessage} onChange={(e) => set("checkoutMessage", e.target.value)} rows={2} className={inputClass} placeholder="Ex.: Olá! Gostaria de fazer um pedido:" />
                </Field>
                <ToggleRow title="Pedir e-mail do cliente" hint="Inclui o campo de e-mail no checkout." checked={form.checkoutCollectEmail} onChange={(v) => set("checkoutCollectEmail", v)} />
                <ToggleRow title="Pedir endereço de entrega" hint="Inclui o campo de endereço no checkout." checked={form.checkoutCollectAddress} onChange={(v) => set("checkoutCollectAddress", v)} />
                <div>
                  <p className={labelClass}>Prévia da mensagem</p>
                  <div className="bg-[#e5ddd5] rounded-xl p-4">
                    <div className="bg-white rounded-xl p-3 max-w-xs shadow-sm">
                      <pre className="text-xs text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">{whatsappPreview}</pre>
                    </div>
                  </div>
                </div>
              </IntegrationCard>
            </>
          )}

          {/* ───────── FRETE ───────── */}
          {section === "frete" && (
            <>
              <Card title="Frete no checkout" description="Como o frete é calculado e onde você entrega." action={<StatusBadge status={form.freteAtivo ? "active" : "off"} label={form.freteAtivo ? "Calculando frete" : "A combinar"} />}>
                <ToggleRow title="Calcular frete no checkout" hint="Desligado, o frete aparece como “a combinar”." checked={form.freteAtivo} onChange={(v) => set("freteAtivo", v)} />
                {form.freteAtivo && (
                  <>
                    <div>
                      <p className={labelClass}>Tipo de cálculo</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2">
                        {[
                          { value: "local", label: "Entrega local", desc: "Só na sua cidade" },
                          { value: "fixo", label: "Fixo", desc: "Mesmo valor para todos" },
                          { value: "correios", label: "Correios", desc: "PAC/SEDEX pelo CEP" },
                          { value: "melhorenvio", label: "Melhor Envio", desc: "Várias transportadoras" },
                          { value: "hibrido", label: "Híbrido", desc: "Fixo local + transportadora" },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => set("freteTipo", opt.value)}
                            className={`flex flex-col gap-0.5 p-3 rounded-xl text-left ring-1 transition ${form.freteTipo === opt.value ? "ring-2 ring-[var(--brand)] bg-brand-light" : "ring-gray-200 hover:bg-gray-50"}`}
                          >
                            <span className="font-semibold text-sm text-gray-900 flex items-center gap-1">{form.freteTipo === opt.value && <Check size={13} className="text-brand" />}{opt.label}</span>
                            <span className="text-[11px] text-gray-500">{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {form.freteTipo === "local" && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <Field label="Cidade atendida" className="sm:col-span-2">
                            <input value={form.freteLocalCidade} onChange={(e) => set("freteLocalCidade", e.target.value)} className={inputClass} placeholder="Ex.: São Paulo" />
                          </Field>
                          <Field label="Estado (UF)">
                            <select value={form.freteLocalUF} onChange={(e) => set("freteLocalUF", e.target.value)} className={inputClass}>
                              <option value="">Selecione</option>
                              {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                            </select>
                          </Field>
                        </div>
                        <p className="text-xs text-gray-400 -mt-2">Cidade e UF validam o CEP do cliente (evita confusão com cidades de mesmo nome em outros estados).</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Field label="CEP da loja (origem)">
                            <input value={form.freteCEPOrigem} onChange={(e) => set("freteCEPOrigem", e.target.value)} className={inputClass} placeholder="00000-000" maxLength={9} />
                          </Field>
                          <Field label="Valor da entrega local (R$)" hint="Use 0 para entrega grátis.">
                            <input type="number" step="0.01" min="0" value={form.freteValorFixo} onChange={(e) => set("freteValorFixo", e.target.value)} className={inputClass} placeholder="0,00" />
                          </Field>
                        </div>
                        <ToggleRow title="Permitir retirada na loja" hint="O cliente pode retirar o pedido na loja sem frete." checked={form.freteLocalRetirada} onChange={(v) => set("freteLocalRetirada", v)} />
                      </div>
                    )}

                    {(form.freteTipo === "fixo" || form.freteTipo === "hibrido") && (
                      <Field label={form.freteTipo === "hibrido" ? "Valor fixo para entrega local (R$)" : "Valor do frete fixo (R$)"} hint="Use 0 para frete grátis." className="max-w-xs">
                        <input type="number" step="0.01" min="0" value={form.freteValorFixo} onChange={(e) => set("freteValorFixo", e.target.value)} className={inputClass} placeholder="0,00" />
                      </Field>
                    )}

                    {usesCep && (
                      <Field
                        label="CEP de origem (da loja)"
                        className="max-w-xs"
                        hint={form.freteTipo === "hibrido" ? "CEPs com o mesmo prefixo (5 dígitos) pagam o frete local; os demais calculam pela transportadora." : "De onde os produtos saem."}
                      >
                        <input value={form.freteCEPOrigem} onChange={(e) => set("freteCEPOrigem", e.target.value)} className={inputClass} placeholder="00000-000" maxLength={9} />
                      </Field>
                    )}

                    <div>
                      <p className={labelClass}>Regiões atendidas</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(BRAZILIAN_REGIONS).map(([key, region]) => {
                          const on = form.freteLocalRegioes.includes(key);
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => set("freteLocalRegioes", on ? form.freteLocalRegioes.filter((r) => r !== key) : [...form.freteLocalRegioes, key])}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium ring-1 transition ${on ? "bg-gray-900 text-white ring-gray-900" : "ring-gray-200 text-gray-600 hover:bg-gray-50"}`}
                            >
                              {on && <Check size={11} className="inline mr-1 -mt-0.5" />}{region.label}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-gray-400 mt-1.5">Nenhuma marcada = vende para todo o Brasil. Clientes fora das regiões marcadas não conseguem finalizar.</p>
                    </div>
                  </>
                )}
              </Card>

              {form.freteAtivo && (form.freteTipo === "melhorenvio" || form.freteTipo === "hibrido") && (
                <IntegrationCard title="Melhor Envio" icon="📦" description="Cotação de Correios, Jadlog e outras, e criação automática de etiquetas." status={st.me}>
                  <Field label="Token de cotação" hint={<>Em <b>melhorenvio.com.br → Integrações → Tokens</b>, permissão <b>Cotações</b>.{form.freteTipo === "hibrido" && " Sem ele, usa Correios."}</>}>
                    <SecretInput value={form.melhorEnvioToken} onChange={(v) => set("melhorEnvioToken", v)} placeholder="eyJ0eXAiOiJKV1Qi…" />
                  </Field>
                  <Field label="Token de etiquetas (API)" hint={<>Cria etiquetas sozinho quando o pagamento é aprovado. Permissão <b>Cotações + Envios</b>.</>}>
                    <SecretInput value={form.melhorEnvioApiToken} onChange={(v) => set("melhorEnvioApiToken", v)} placeholder="Token com permissão de envios" />
                  </Field>
                  <Field label="Secret do aplicativo (webhook de rastreio)" hint="Valida as notificações de rastreio. Sem ele, o rastreio só atualiza pela rotina automática.">
                    <SecretInput value={form.melhorEnvioWebhookSecret} onChange={(v) => set("melhorEnvioWebhookSecret", v)} placeholder="Secret do aplicativo no Melhor Envio" />
                  </Field>
                  {!form.melhorEnvioApiToken && <Hint tone="amber">Sem o token de etiquetas, os pedidos pagos ficam “sem etiqueta” e precisam ser gerados manualmente.</Hint>}
                </IntegrationCard>
              )}

              <Card title="Pacote e prazos" description="Valores padrão usados no cálculo quando o produto não tem os seus.">
                {form.freteAtivo && usesCep && (
                  <div>
                    <p className={labelClass}>Dimensões padrão da embalagem (cm)</p>
                    <div className="grid grid-cols-3 gap-3 max-w-md">
                      {([["pacoteComprimento", "Comprimento", "16"], ["pacoteLargura", "Largura", "11"], ["pacoteAltura", "Altura", "2"]] as const).map(([k, l, min]) => (
                        <div key={k}>
                          <label className="text-xs text-gray-500 mb-1 block">{l}</label>
                          <input type="number" min={min} value={form[k]} onChange={(e) => set(k, e.target.value)} className={inputClass} />
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Mínimo dos Correios: 16 × 11 × 2 cm. Embalagens específicas ficam em Entregas → Embalagens.</p>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Peso padrão por produto (g)" hint="Quando o produto não tem peso cadastrado.">
                    <input type="number" min="1" value={form.fretePesoDefault} onChange={(e) => set("fretePesoDefault", e.target.value)} className={inputClass} placeholder="500" />
                  </Field>
                  <Field label="Dias úteis de produção/separação" hint={`Somado ao prazo do frete. Ex.: ${form.diasUteisProduzao || 0} + 3 dias de frete = ${(parseInt(form.diasUteisProduzao) || 0) + 3} dias úteis.`}>
                    <input type="number" min="0" max="10" value={form.diasUteisProduzao} onChange={(e) => set("diasUteisProduzao", e.target.value)} className={inputClass} placeholder="2" />
                  </Field>
                </div>
              </Card>
            </>
          )}

          {/* ───────── INTEGRAÇÕES ───────── */}
          {section === "integracoes" && (
            <>
              <IntegrationCard title="Bling" icon="🧾" description="Envia os pedidos aprovados para o Bling (nota fiscal e estoque)." status={st.bling} on={form.blingAtivo} onToggle={(v) => set("blingAtivo", v)}>
                <Hint>Crie uma aplicação em <b>Bling → Integrações → Minhas Aplicações</b> e copie o Client ID e o Client Secret.</Hint>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Client ID">
                    <input value={form.blingClientId} onChange={(e) => set("blingClientId", e.target.value)} className={`${inputClass} font-mono`} placeholder="Client ID" />
                  </Field>
                  <Field label="Client Secret" hint="Chave secreta usada no servidor.">
                    <SecretInput value={form.blingClientSecret} onChange={(v) => set("blingClientSecret", v)} placeholder="Client Secret" />
                  </Field>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge status={blingAuthorized ? "active" : "missing"} label={blingAuthorized ? "Conta autorizada" : "Falta autorizar"} />
                  {form.blingClientId && form.blingClientSecret && (
                    <Button
                      variant={blingAuthorized ? "secondary" : "primary"}
                      size="sm"
                      icon={LockOpen}
                      onClick={async () => {
                        if (dirty && !(await confirmDialog({ title: "Há mudanças não salvas", message: "Salve as configurações antes de autorizar, senão as chaves novas não serão usadas.", confirmText: "Autorizar mesmo assim", cancelText: "Voltar e salvar" }))) return;
                        window.location.href = "/api/settings/bling/authorize";
                      }}
                    >
                      {blingAuthorized ? "Autorizar de novo" : "Autorizar com o Bling"}
                    </Button>
                  )}
                </div>
                <ToggleRow
                  title="Emitir nota fiscal automaticamente"
                  hint="Assim que o pedido pago entra no Bling, a NF-e é gerada e enviada à SEFAZ. Aprovada, o cliente recebe a nota por e-mail; rejeitada, o motivo aparece no pedido."
                  checked={form.blingNfeAuto}
                  onChange={(v) => set("blingNfeAuto", v)}
                />
                {form.blingNfeAuto && (
                  <Hint>
                    No Bling, desligue o envio automático de e-mail da nota para o cliente não receber duas vezes. Para avisos instantâneos da SEFAZ, cadastre o webhook de <b>Nota fiscal</b> no aplicativo do Bling apontando para <code className="font-mono">https://SEU-DOMINIO/api/webhooks/bling/nfe</code> (sem ele, o site confere sozinho a cada poucos minutos).
                  </Hint>
                )}
              </IntegrationCard>

              <IntegrationCard title="Meta Ads (Facebook / Instagram)" icon="📣" description="Pixel e API de Conversões para medir anúncios. Só envia eventos de quem aceitou os cookies de marketing." status={st.meta}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="ID do Pixel (conjunto de dados)" hint="Gerenciador de Eventos → Fontes de dados → seu Pixel → ID.">
                    <input value={form.metaPixelId} onChange={(e) => set("metaPixelId", e.target.value.replace(/\D/g, ""))} className={`${inputClass} font-mono`} inputMode="numeric" placeholder="123456789012345" />
                  </Field>
                  <Field label="Código de teste (opcional)" hint="Só durante a validação em “Testar eventos”. Apague depois.">
                    <input value={form.metaTestEventCode} onChange={(e) => set("metaTestEventCode", e.target.value)} className={inputClass} placeholder="TEST12345" />
                  </Field>
                  <Field label="Token da API de Conversões" className="sm:col-span-2" hint="Configurações do Pixel → API de Conversões → Gerar token de acesso.">
                    <SecretInput value={form.metaCapiAccessToken} onChange={(v) => set("metaCapiAccessToken", v)} placeholder="EAAG…" />
                  </Field>
                </div>
                {form.metaTestEventCode && <Hint tone="amber">Código de teste preenchido: lembre de apagar depois de validar os eventos.</Hint>}
              </IntegrationCard>
            </>
          )}

          {/* ───────── IA ───────── */}
          {section === "ia" && (
            <IntegrationCard
              title="Atendimento com IA"
              icon="🤖"
              description={<>Assistente (Claude, da Anthropic) que responde sobre pedidos, rastreio, frete, pagamentos e políticas, sempre com o botão “Falar com atendente no WhatsApp”. Desligado, a loja mostra só o botão do WhatsApp.</>}
              status={st.ai}
              on={form.aiAssistantEnabled}
              onToggle={(v) => set("aiAssistantEnabled", v)}
            >
              {!form.aiApiKey && <Hint tone="amber">O assistente só aparece na loja depois que a chave de API for preenchida.</Hint>}
              <Field label="Chave de API da Anthropic" hint="Crie em console.anthropic.com → API Keys. O uso é cobrado pela Anthropic.">
                <SecretInput value={form.aiApiKey} onChange={(v) => set("aiApiKey", v)} placeholder="sk-ant-…" />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Modelo" hint="Custo estimado por conversa de ~5 mensagens. Vale para conversas novas.">
                  <select value={form.aiModel} onChange={(e) => set("aiModel", e.target.value)} className={inputClass}>
                    {AI_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                </Field>
                <Field label="Limite de mensagens por dia" hint="Ao atingir, o chat indica o WhatsApp até o dia seguinte.">
                  <input type="number" min={1} value={form.aiDailyMessageLimit} onChange={(e) => set("aiDailyMessageLimit", e.target.value)} className={inputClass} />
                </Field>
              </div>
              <Field label="Políticas e perguntas frequentes" hint="O assistente usa este texto junto com as configurações (pagamentos, frete, prazo). Ele não responde o que não estiver aqui — veja em Atendimento IA o que os clientes perguntaram e ele não soube.">
                <textarea
                  value={form.aiPolicies}
                  onChange={(e) => set("aiPolicies", e.target.value)}
                  rows={10}
                  className={inputClass}
                  placeholder={"Ex.:\n- Trocas: aceitamos trocas de tamanho em até 7 dias após o recebimento, com etiqueta.\n- Tabela de medidas: P (busto 96 cm), M (100 cm), G (106 cm).\n- Cuidados: lavar do avesso, não usar alvejante.\n- Horário do atendimento humano: seg a sex, 9h às 18h."}
                />
              </Field>
            </IntegrationCard>
          )}
        </div>
      </div>

      {/* Barra de salvar (fixa no rodapé) */}
      <div className={`fixed bottom-0 inset-x-0 md:left-64 z-30 transition-transform duration-300 ${dirty || loading ? "translate-y-0" : "translate-y-full"}`}>
        <div className="mx-4 md:mx-8 mb-4 rounded-2xl bg-gray-900 text-white shadow-2xl px-4 py-3 flex items-center gap-3">
          <span className="text-sm flex-1 min-w-0 truncate">Você tem mudanças não salvas</span>
          <Button variant="ghost" size="sm" onClick={discard} disabled={loading} className="text-white/70 hover:bg-white/10 hover:text-white focus-visible:ring-offset-gray-900">Descartar</Button>
          <Button type="submit" variant="primary" icon={Save} loading={loading} loadingText="Salvando…" className="focus-visible:ring-offset-gray-900">Salvar alterações</Button>
        </div>
      </div>
    </form>
  );
}
