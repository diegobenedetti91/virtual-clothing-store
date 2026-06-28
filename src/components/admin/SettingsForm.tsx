"use client";

import { useState } from "react";
import { Save, MessageCircle, CreditCard, Eye, EyeOff, Truck } from "lucide-react";
import { CompanySettings } from "@/types";
import { formatCurrency } from "@/lib/utils";
import ImageUpload from "./ImageUpload";
import ImageListInput from "./ImageListInput";

interface Props {
  initialSettings: CompanySettings | null;
}

export default function SettingsForm({ initialSettings }: Props) {
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState(initialSettings?.name || "");
  const [logo, setLogo] = useState(initialSettings?.logo || "");
  const [phone, setPhone] = useState(initialSettings?.phone || "");
  const [whatsapp, setWhatsapp] = useState(initialSettings?.whatsapp || "");
  const [instagram, setInstagram] = useState(initialSettings?.instagram || "");
  const [address, setAddress] = useState(initialSettings?.address || "");
  const [description, setDescription] = useState(initialSettings?.description || "");
  const [primaryColor, setPrimaryColor] = useState(initialSettings?.primaryColor || "#ec4899");
  const [buttonColor, setButtonColor] = useState(initialSettings?.buttonColor || initialSettings?.primaryColor || "#ec4899");
  const [menuColor, setMenuColor] = useState(initialSettings?.menuColor || initialSettings?.primaryColor || "#ec4899");
  const [bannerImages, setBannerImages] = useState<string[]>(
    JSON.parse(initialSettings?.bannerImages || "[]")
  );

  const [heroBadge, setHeroBadge] = useState(initialSettings?.heroBadge || "");
  const [heroTitle, setHeroTitle] = useState(initialSettings?.heroTitle || "");
  const [heroButtonText, setHeroButtonText] = useState(initialSettings?.heroButtonText || "");
  const [heroButtonSecondaryText, setHeroButtonSecondaryText] = useState(initialSettings?.heroButtonSecondaryText || "");

  const [checkoutType] = useState(initialSettings?.checkoutType || "whatsapp");
  const [checkoutCollectEmail, setCheckoutCollectEmail] = useState(initialSettings?.checkoutCollectEmail || false);
  const [checkoutCollectAddress, setCheckoutCollectAddress] = useState(initialSettings?.checkoutCollectAddress || false);
  const [checkoutMessage, setCheckoutMessage] = useState(initialSettings?.checkoutMessage || "");
  const [mpPublicKey, setMpPublicKey] = useState(initialSettings?.mercadoPagoPublicKey || "");
  const [mpAccessToken, setMpAccessToken] = useState(initialSettings?.mercadoPagoAccessToken || "");
  const [showToken, setShowToken] = useState(false);
  const [mercadoPagoAtivo, setMercadoPagoAtivo] = useState(
    initialSettings?.mercadoPagoAtivo ?? initialSettings?.checkoutType === "gateway"
  );
  const [nuPayClientId, setNuPayClientId] = useState(initialSettings?.nuPayClientId || "");
  const [nuPayClientSecret, setNuPayClientSecret] = useState(initialSettings?.nuPayClientSecret || "");
  const [showNuPaySecret, setShowNuPaySecret] = useState(false);
  const [nuPayAtivo, setNuPayAtivo] = useState(
    initialSettings?.nuPayAtivo ?? initialSettings?.checkoutType === "nupay"
  );
  const [whatsappAtivo, setWhatsappAtivo] = useState(initialSettings?.whatsappAtivo ?? true);
  const [pixDiscountEnabled, setPixDiscountEnabled] = useState(initialSettings?.pixDiscountEnabled ?? false);
  const [pixDiscountPercent, setPixDiscountPercent] = useState((initialSettings?.pixDiscountPercent ?? 0).toString());

  const [freteAtivo, setFreteAtivo] = useState(initialSettings?.freteAtivo || false);
  const [freteTipo, setFreteTipo] = useState(initialSettings?.freteTipo || "fixo");
  const [freteLocalCidade, setFreteLocalCidade] = useState(initialSettings?.freteLocalCidade || "");
  const [freteLocalUF, setFreteLocalUF] = useState(initialSettings?.freteLocalUF || "");
  const [freteLocalRetirada, setFreteLocalRetirada] = useState(initialSettings?.freteLocalRetirada || false);
  const [freteValorFixo, setFreteValorFixo] = useState(initialSettings?.freteValorFixo?.toString() || "0");
  const [freteCEPOrigem, setFreteCEPOrigem] = useState(initialSettings?.freteCEPOrigem || "");
  const [fretePesoDefault, setFretePesoDefault] = useState(initialSettings?.fretePesoDefaultGramas?.toString() || "500");
  const [melhorEnvioToken, setMelhorEnvioToken] = useState(initialSettings?.melhorEnvioToken || "");
  const [showMEToken, setShowMEToken] = useState(false);
  const [pacoteAltura, setPacoteAltura] = useState(initialSettings?.fretePacoteAltura?.toString() || "5");
  const [pacoteLargura, setPacoteLargura] = useState(initialSettings?.fretePacoteLargura?.toString() || "12");
  const [pacoteComprimento, setPacoteComprimento] = useState(initialSettings?.fretePacoteComprimento?.toString() || "17");

  const inputClass = "w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, logo, phone, whatsapp, instagram, address, description,
          primaryColor, buttonColor, menuColor, bannerImages, checkoutType, checkoutCollectEmail, checkoutCollectAddress,
          checkoutMessage, mercadoPagoPublicKey: mpPublicKey || null, mercadoPagoAccessToken: mpAccessToken || null,
          mercadoPagoAtivo, nuPayClientId: nuPayClientId || null, nuPayClientSecret: nuPayClientSecret || null, nuPayAtivo, whatsappAtivo,
          heroBadge, heroTitle, heroButtonText, heroButtonSecondaryText,
          pixDiscountEnabled, pixDiscountPercent: parseFloat(pixDiscountPercent) || 0,
          freteAtivo, freteTipo, freteLocalCidade: freteLocalCidade || null, freteLocalUF: freteLocalUF || null, freteLocalRetirada,
          freteValorFixo: parseFloat(freteValorFixo) || 0,
          freteCEPOrigem: freteCEPOrigem || null,
          fretePesoDefaultGramas: parseInt(fretePesoDefault) || 500,
          melhorEnvioToken: melhorEnvioToken || null,
          fretePacoteAltura: parseInt(pacoteAltura) || 5,
          fretePacoteLargura: parseInt(pacoteLargura) || 12,
          fretePacoteComprimento: parseInt(pacoteComprimento) || 17,
        }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Erro ao salvar configurações.");
    } finally {
      setLoading(false);
    }
  };

  const whatsappPreview = [
    checkoutMessage ? checkoutMessage + "\n\n" : "",
    `🛍️ *NOVO PEDIDO - ${name || "Minha Loja"}*`,
    ``,
    `📋 *Nº do pedido:* PD2605090001`,
    `👤 *Cliente:* Maria Silva`,
    `📱 *Telefone:* (11) 99999-9999`,
    ...(checkoutCollectEmail ? [`📧 *E-mail:* maria@email.com`] : []),
    ...(checkoutCollectAddress ? [`📍 *Endereço:* Rua das Flores, 123 - São Paulo`] : []),
    ``,
    `*Produtos:*`,
    `• Vestido Floral (Tam: M, Cor: Rosa) - 1× ${formatCurrency(89.9)} = ${formatCurrency(89.9)}`,
    `• Blusa Básica (Tam: P) - 2× ${formatCurrency(45.9)} = ${formatCurrency(91.8)}`,
    ``,
    `💰 *Total:* ${formatCurrency(181.7)}`,
    `🚚 *Frete:* A combinar`,
  ].join("\n");

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Informações da loja</h2>
            <div>
              <label className={labelClass}>Nome da loja *</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Ex: Moda da Mari" />
            </div>
            <div>
              <label className={labelClass}>Descrição</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputClass} placeholder="Uma frase descrevendo sua loja..." />
            </div>
            <div>
              <ImageUpload value={logo} onChange={setLogo} label="Logo da loja" aspect="landscape" />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Contato</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Telefone</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} placeholder="(00) 00000-0000" />
              </div>
              <div>
                <label className={labelClass}>
                  WhatsApp para receber pedidos
                  <span className="ml-1 text-xs text-green-600 font-normal">(com DDD e código do país)</span>
                </label>
                <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={inputClass} placeholder="5511999999999" />
                <p className="text-xs text-gray-400 mt-1">Ex: 5511999999999 (55 = Brasil, 11 = DDD, 9 dígitos)</p>
              </div>
              <div>
                <label className={labelClass}>Instagram</label>
                <input value={instagram} onChange={(e) => setInstagram(e.target.value)} className={inputClass} placeholder="@nomedaLoja" />
              </div>
              <div>
                <label className={labelClass}>Endereço da loja física</label>
                <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} placeholder="Rua, número - Cidade/UF" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
            <div className="flex items-center gap-2 mb-1">
              <MessageCircle size={18} className="text-green-600" />
              <h2 className="font-semibold text-gray-900">Formas de pagamento disponíveis</h2>
            </div>
            <p className="text-xs text-gray-500 -mt-4">O cliente escolhe como quer pagar no momento do checkout. WhatsApp e Dinheiro estão sempre disponíveis.</p>

            {/* WhatsApp — sempre ativo */}
            <div className="border border-gray-100 rounded-xl p-4 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xl">💬</span>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-gray-900">WhatsApp <span className="ml-1 text-xs text-green-600 font-normal bg-green-50 px-2 py-0.5 rounded-full">Sempre ativo</span></p>
                  <p className="text-xs text-gray-500 mt-0.5">Pedido enviado pelo WhatsApp — pagamento e entrega combinados na conversa.</p>
                </div>
              </div>
              <p className="text-xs text-gray-500">Configure o que aparece na mensagem enviada ao WhatsApp da loja.</p>
              <div>
                <label className={labelClass}>Mensagem inicial personalizada (opcional)</label>
                <textarea
                  value={checkoutMessage}
                  onChange={(e) => setCheckoutMessage(e.target.value)}
                  rows={2}
                  className={inputClass}
                  placeholder="Ex: Olá! Gostaria de fazer um pedido:"
                />
              </div>
              <div className="space-y-3">
                <label className="flex items-center justify-between cursor-pointer group">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Solicitar e-mail do cliente</p>
                    <p className="text-xs text-gray-500">Inclui campo de e-mail no checkout</p>
                  </div>
                  <div
                    className={`relative w-11 h-6 rounded-full transition-colors ${checkoutCollectEmail ? "bg-green-500" : "bg-gray-200"}`}
                    onClick={() => setCheckoutCollectEmail(!checkoutCollectEmail)}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checkoutCollectEmail ? "translate-x-5" : ""}`} />
                  </div>
                </label>
                <label className="flex items-center justify-between cursor-pointer group">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Solicitar endereço de entrega</p>
                    <p className="text-xs text-gray-500">Inclui campo de endereço no checkout</p>
                  </div>
                  <div
                    className={`relative w-11 h-6 rounded-full transition-colors ${checkoutCollectAddress ? "bg-green-500" : "bg-gray-200"}`}
                    onClick={() => setCheckoutCollectAddress(!checkoutCollectAddress)}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checkoutCollectAddress ? "translate-x-5" : ""}`} />
                  </div>
                </label>
              </div>
              <div>
                <p className={labelClass}>Preview da mensagem WhatsApp</p>
                <div className="bg-[#e5ddd5] rounded-xl p-4">
                  <div className="bg-white rounded-xl p-3 max-w-xs shadow-sm">
                    <pre className="text-xs text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">{whatsappPreview}</pre>
                  </div>
                </div>
              </div>
            </div>

            {/* Mercado Pago */}
            <div className="border border-gray-100 rounded-xl p-4 space-y-4">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-3">
                  <span className="text-xl">💳</span>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">Mercado Pago</p>
                    <p className="text-xs text-gray-500 mt-0.5">Cartão de crédito, Pix ou boleto. Requer credenciais de produção.</p>
                  </div>
                </div>
                <div
                  className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${mercadoPagoAtivo ? "bg-blue-500" : "bg-gray-200"}`}
                  onClick={() => setMercadoPagoAtivo(!mercadoPagoAtivo)}
                >
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${mercadoPagoAtivo ? "translate-x-5" : ""}`} />
                </div>
              </label>
              {mercadoPagoAtivo && (
                <div className="space-y-4 pt-1">
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
                    <p className="font-semibold mb-1 flex items-center gap-2"><CreditCard size={14} /> Credenciais do Mercado Pago</p>
                    <p className="text-xs">
                      Acesse <strong>mercadopago.com.br → Seu negócio → Configurações → Credenciais</strong> para obter suas chaves.
                      Use as credenciais de <strong>produção</strong> para receber pagamentos reais.
                    </p>
                  </div>
                  <div>
                    <label className={labelClass}>Public Key (chave pública)</label>
                    <input value={mpPublicKey} onChange={(e) => setMpPublicKey(e.target.value)} className={inputClass} placeholder="APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                    <p className="text-xs text-gray-400 mt-1">Usada no frontend para identificar sua conta.</p>
                  </div>
                  <div>
                    <label className={labelClass}>Access Token (chave secreta)</label>
                    <div className="relative">
                      <input type={showToken ? "text" : "password"} value={mpAccessToken} onChange={(e) => setMpAccessToken(e.target.value)} className={`${inputClass} pr-10`} placeholder="APP_USR-xxxxxxxx..." />
                      <button type="button" onClick={() => setShowToken(!showToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Chave secreta usada no servidor. Nunca compartilhe.</p>
                  </div>
                </div>
              )}
            </div>

            {/* NuPay */}
            <div className="border border-gray-100 rounded-xl p-4 space-y-4">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🟣</span>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">NuPay</p>
                    <p className="text-xs text-gray-500 mt-0.5">Débito, crédito Nubank ou Pix em até 24×. Requer credenciais NuPay for Business.</p>
                  </div>
                </div>
                <div
                  className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${nuPayAtivo ? "bg-purple-500" : "bg-gray-200"}`}
                  onClick={() => setNuPayAtivo(!nuPayAtivo)}
                >
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${nuPayAtivo ? "translate-x-5" : ""}`} />
                </div>
              </label>
              {nuPayAtivo && (
                <div className="space-y-4 pt-1">
                  <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-sm text-purple-800">
                    <p className="font-semibold mb-1 flex items-center gap-2"><CreditCard size={14} /> Credenciais do NuPay for Business</p>
                    <p className="text-xs mb-2">Após o credenciamento, acesse o painel <strong>NuPay for Business</strong> para obter seu Client ID e Client Secret.</p>
                    <p className="text-xs">
                      Configure o webhook no painel NuPay apontando para:{" "}
                      <strong className="break-all">{typeof window !== "undefined" ? window.location.origin : ""}/api/checkout/nupay/webhook</strong>
                    </p>
                  </div>
                  <div>
                    <label className={labelClass}>Client ID</label>
                    <input value={nuPayClientId} onChange={(e) => setNuPayClientId(e.target.value)} className={inputClass} placeholder="Seu Client ID do NuPay" />
                  </div>
                  <div>
                    <label className={labelClass}>Client Secret</label>
                    <div className="relative">
                      <input type={showNuPaySecret ? "text" : "password"} value={nuPayClientSecret} onChange={(e) => setNuPayClientSecret(e.target.value)} className={`${inputClass} pr-10`} placeholder="Seu Client Secret do NuPay" />
                      <button type="button" onClick={() => setShowNuPaySecret(!showNuPaySecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showNuPaySecret ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Chave secreta usada no servidor. Nunca compartilhe.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* WhatsApp */}
          <div className="border border-gray-100 rounded-xl p-4 space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                <span className="text-xl">💬</span>
                <div>
                  <p className="font-semibold text-sm text-gray-900">WhatsApp</p>
                  <p className="text-xs text-gray-500 mt-0.5">Oferece WhatsApp como opção de pagamento no checkout</p>
                </div>
              </div>
              <div
                className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${whatsappAtivo ? "bg-green-500" : "bg-gray-200"}`}
                onClick={() => setWhatsappAtivo(!whatsappAtivo)}
              >
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${whatsappAtivo ? "translate-x-5" : ""}`} />
              </div>
            </label>
            {!whatsappAtivo && (
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-gray-600">
                WhatsApp está desativado. Ele não aparecerá como opção de pagamento no checkout.
              </div>
            )}
          </div>

          {/* PIX com Desconto */}
          <div className="border border-gray-100 rounded-xl p-4 space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                <span className="text-xl">🎉</span>
                <div>
                  <p className="font-semibold text-sm text-gray-900">PIX com Desconto</p>
                  <p className="text-xs text-gray-500 mt-0.5">Ofereça desconto para pagamentos exclusivos via PIX</p>
                </div>
              </div>
              <div
                className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${pixDiscountEnabled ? "bg-yellow-500" : "bg-gray-200"}`}
                onClick={() => setPixDiscountEnabled(!pixDiscountEnabled)}
              >
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${pixDiscountEnabled ? "translate-x-5" : ""}`} />
              </div>
            </label>
            {pixDiscountEnabled && (
              <div className="space-y-4 pt-1">
                <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 text-sm text-yellow-800">
                  <p className="font-semibold mb-1">💰 Configuração de Desconto PIX</p>
                  <p className="text-xs">
                    Quando ativado, seus clientes verão a opção "PIX com Desconto" no checkout.
                    O sistema forçará pagamento exclusivo via PIX (sem possibilidade de escolher cartão depois).
                  </p>
                </div>
                <div>
                  <label className={labelClass}>Percentual de desconto (%)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={pixDiscountPercent}
                      onChange={(e) => setPixDiscountPercent(e.target.value)}
                      className={inputClass}
                      placeholder="Ex: 5"
                    />
                    <span className="text-gray-600 font-semibold">%</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Ex: 5 oferecerá 5% de desconto em pagamentos via PIX. Clientes verão "PIX com Desconto (5% off)".
                  </p>
                </div>
              </div>
            )}
            {!pixDiscountEnabled && (
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-gray-600">
                PIX com desconto está desativado. A opção não aparecerá no checkout.
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Truck size={18} className="text-blue-600" />
              <h2 className="font-semibold text-gray-900">Configurações de frete</h2>
            </div>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium text-gray-900">Frete ativo</p>
                <p className="text-xs text-gray-500">Exibe e calcula frete no checkout</p>
              </div>
              <div
                className={`relative w-11 h-6 rounded-full transition-colors ${freteAtivo ? "bg-blue-500" : "bg-gray-200"}`}
                onClick={() => setFreteAtivo(!freteAtivo)}
              >
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${freteAtivo ? "translate-x-5" : ""}`} />
              </div>
            </label>

            {freteAtivo && (
              <>
                <div>
                  <label className={labelClass}>Tipo de cálculo</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { value: "local", label: "Entrega local", desc: "Só dentro da cidade" },
                      { value: "fixo", label: "Fixo", desc: "Valor único para todos" },
                      { value: "correios", label: "Correios", desc: "PAC/SEDEX pelo CEP" },
                      { value: "melhorenvio", label: "Melhor Envio", desc: "Múltiplas transportadoras" },
                      { value: "hibrido", label: "Híbrido", desc: "Fixo local + transportadora" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFreteTipo(opt.value)}
                        className={`flex flex-col gap-1 p-3 rounded-xl border-2 text-left transition-all ${freteTipo === opt.value ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}
                      >
                        <p className="font-semibold text-sm text-gray-900">{opt.label}</p>
                        <p className="text-xs text-gray-500">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {freteTipo === "local" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="sm:col-span-2">
                        <label className={labelClass}>Cidade atendida</label>
                        <input
                          value={freteLocalCidade}
                          onChange={(e) => setFreteLocalCidade(e.target.value)}
                          className={inputClass}
                          placeholder="Ex: São Paulo"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Estado (UF)</label>
                        <select value={freteLocalUF} onChange={(e) => setFreteLocalUF(e.target.value)} className={inputClass}>
                          <option value="">Selecione</option>
                          {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map((uf) => (
                            <option key={uf} value={uf}>{uf}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 -mt-2">Cidade e estado usados para validar o CEP do cliente via ViaCEP. Evita conflito com cidades homônimas em outros estados.</p>
                    <div>
                      <label className={labelClass}>CEP da loja (origem)</label>
                      <input value={freteCEPOrigem} onChange={(e) => setFreteCEPOrigem(e.target.value)} className={inputClass} placeholder="00000-000" maxLength={9} />
                      <p className="text-xs text-gray-400 mt-1">CEP de onde os produtos são enviados.</p>
                    </div>
                    <div>
                      <label className={labelClass}>Valor da entrega local (R$)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                        <input type="number" step="0.01" min="0" value={freteValorFixo} onChange={(e) => setFreteValorFixo(e.target.value)} className={`${inputClass} pl-9`} placeholder="0,00" />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Use 0 para entrega grátis.</p>
                    </div>
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Permitir retirada na loja</p>
                        <p className="text-xs text-gray-500">Cliente pode optar por retirar o pedido na loja (grátis)</p>
                      </div>
                      <div
                        className={`relative w-11 h-6 rounded-full transition-colors ${freteLocalRetirada ? "bg-blue-500" : "bg-gray-200"}`}
                        onClick={() => setFreteLocalRetirada(!freteLocalRetirada)}
                      >
                        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${freteLocalRetirada ? "translate-x-5" : ""}`} />
                      </div>
                    </label>
                  </div>
                )}

                {(freteTipo === "fixo" || freteTipo === "hibrido") && (
                  <div>
                    <label className={labelClass}>
                      {freteTipo === "hibrido" ? "Valor fixo para entrega local (R$)" : "Valor do frete fixo (R$)"}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                      <input type="number" step="0.01" min="0" value={freteValorFixo} onChange={(e) => setFreteValorFixo(e.target.value)} className={`${inputClass} pl-9`} placeholder="0,00" />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Use 0 para frete grátis.</p>
                  </div>
                )}

                {(freteTipo === "melhorenvio" || freteTipo === "hibrido" || freteTipo === "correios") && (
                  <div>
                    <label className={labelClass}>CEP de origem (da loja)</label>
                    <input value={freteCEPOrigem} onChange={(e) => setFreteCEPOrigem(e.target.value)} className={inputClass} placeholder="00000-000" maxLength={9} />
                    <p className="text-xs text-gray-400 mt-1">
                      {freteTipo === "hibrido" ? "CEPs com mesmo prefixo (5 dígitos) recebem frete local; demais calculam pela transportadora." : "CEP de onde os produtos serão enviados."}
                    </p>
                  </div>
                )}

                {(freteTipo === "melhorenvio" || freteTipo === "hibrido") && (
                  <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">📦</span>
                      <div>
                        <p className="text-sm font-semibold text-orange-900">Melhor Envio</p>
                        <p className="text-xs text-orange-700">Retorna preços de Correios, Jadlog, Total Express e outras em uma única consulta.</p>
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Token de acesso</label>
                      <div className="relative">
                        <input
                          type={showMEToken ? "text" : "password"}
                          value={melhorEnvioToken}
                          onChange={(e) => setMelhorEnvioToken(e.target.value)}
                          className={`${inputClass} pr-10`}
                          placeholder="eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9..."
                        />
                        <button type="button" onClick={() => setShowMEToken(!showMEToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showMEToken ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      <p className="text-xs text-orange-700 mt-1">
                        Obtenha em <strong>melhorenvio.com.br → Integrações → Tokens</strong>. Selecione permissão <strong>Cotações</strong>.
                        {freteTipo === "hibrido" && " Se não configurado, usa Correios como fallback."}
                      </p>
                    </div>
                  </div>
                )}

                {(freteTipo === "melhorenvio" || freteTipo === "correios" || freteTipo === "hibrido") && (
                  <div>
                    <label className={labelClass}>Dimensões padrão da embalagem (cm)</label>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Comprimento</label>
                        <input type="number" min="16" value={pacoteComprimento} onChange={(e) => setPacoteComprimento(e.target.value)} className={inputClass} placeholder="17" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Largura</label>
                        <input type="number" min="11" value={pacoteLargura} onChange={(e) => setPacoteLargura(e.target.value)} className={inputClass} placeholder="12" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Altura</label>
                        <input type="number" min="2" value={pacoteAltura} onChange={(e) => setPacoteAltura(e.target.value)} className={inputClass} placeholder="5" />
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Mínimos aceitos pelos Correios: 16 × 11 × 2 cm. Ajuste conforme sua embalagem típica.</p>
                  </div>
                )}

                <div>
                  <label className={labelClass}>Peso padrão por produto (gramas)</label>
                  <input type="number" min="1" value={fretePesoDefault} onChange={(e) => setFretePesoDefault(e.target.value)} className={inputClass} placeholder="500" />
                  <p className="text-xs text-gray-400 mt-1">Usado quando o produto não tem peso cadastrado.</p>
                </div>
              </>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Textos do banner principal</h2>
            <p className="text-xs text-gray-500">Personalize os textos exibidos sobre as imagens do banner da página inicial.</p>
            <div>
              <label className={labelClass}>Etiqueta acima do título</label>
              <input value={heroBadge} onChange={(e) => setHeroBadge(e.target.value)} className={inputClass} placeholder="Ex: NOVA COLEÇÃO" />
              <p className="text-xs text-gray-400 mt-1">Texto pequeno em destaque exibido antes do título.</p>
            </div>
            <div>
              <label className={labelClass}>Título principal do banner</label>
              <input value={heroTitle} onChange={(e) => setHeroTitle(e.target.value)} className={inputClass} placeholder="Ex: Estilo que fala por você" />
              <p className="text-xs text-gray-400 mt-1">Se vazio, usa o nome da loja como título.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Texto do botão principal</label>
                <input value={heroButtonText} onChange={(e) => setHeroButtonText(e.target.value)} className={inputClass} placeholder="Ex: Ver coleção" />
                <p className="text-xs text-gray-400 mt-1">Padrão: "Ver coleção"</p>
              </div>
              <div>
                <label className={labelClass}>Texto do botão secundário</label>
                <input value={heroButtonSecondaryText} onChange={(e) => setHeroButtonSecondaryText(e.target.value)} className={inputClass} placeholder="Ex: Explorar coleção" />
                <p className="text-xs text-gray-400 mt-1">Se vazio, exibe o link do Instagram.</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Banners da página inicial</h2>
            <p className="text-xs text-gray-500">Imagens para o carrossel de banners (formato paisagem recomendado).</p>
            <ImageListInput images={bannerImages} onChange={setBannerImages} aspect="landscape" />
          </div>
        </div>

        <div className="space-y-6 lg:sticky lg:top-6 self-start">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Aparência</h2>
            <div>
              <label className={labelClass}>Cor principal</label>
              <div className="flex items-center gap-3">
                <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-12 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5" />
                <span className="text-sm text-gray-600 font-mono">{primaryColor}</span>
              </div>
            </div>
            <div>
              <label className={labelClass}>Cor dos botões</label>
              <p className="text-xs text-gray-400 mb-2">Aplicada nos botões do site e do admin. Botões de checkout (WhatsApp e Mercado Pago) mantêm suas cores originais.</p>
              <div className="flex items-center gap-3">
                <input type="color" value={buttonColor} onChange={(e) => setButtonColor(e.target.value)} className="w-12 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5" />
                <span className="text-sm text-gray-600 font-mono">{buttonColor}</span>
                <button type="button" onClick={() => setButtonColor(primaryColor)} className="text-xs text-gray-400 hover:text-gray-600 underline">
                  Usar cor principal
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-gray-500">Preview:</span>
                <button type="button" className="px-4 py-1.5 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: buttonColor }}>
                  Adicionar ao carrinho
                </button>
              </div>
            </div>
            <div>
              <label className={labelClass}>Cor dos menus</label>
              <p className="text-xs text-gray-400 mb-2">Usada nos botões de navegação e ícones do cabeçalho ao passar o mouse ou na página ativa.</p>
              <div className="flex items-center gap-3">
                <input type="color" value={menuColor} onChange={(e) => setMenuColor(e.target.value)} className="w-12 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5" />
                <span className="text-sm text-gray-600 font-mono">{menuColor}</span>
                <button type="button" onClick={() => setMenuColor(primaryColor)} className="text-xs text-gray-400 hover:text-gray-600 underline">
                  Usar cor principal
                </button>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <span className="text-xs text-gray-500">Preview:</span>
                <span
                  className="px-4 py-1.5 rounded-xl text-sm font-semibold"
                  style={{ backgroundColor: `color-mix(in srgb, ${menuColor} 22%, white)`, color: menuColor }}
                >
                  Início
                </span>
                <span
                  className="px-4 py-1.5 rounded-xl text-sm font-semibold"
                  style={{ backgroundColor: `color-mix(in srgb, ${menuColor} 12%, white)`, color: menuColor }}
                >
                  Produtos
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <button
              type="submit"
              disabled={loading}
              className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-base text-white shadow-md hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-60`}
              style={{ backgroundColor: saved ? "#22c55e" : "var(--brand)" }}
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              ) : (
                <Save size={18} />
              )}
              {loading ? "Salvando..." : saved ? "✓ Salvo com sucesso!" : "Salvar configurações"}
            </button>
            {saved && (
              <p className="text-center text-xs text-green-600 mt-2 font-medium">Alterações aplicadas na loja</p>
            )}
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-sm text-amber-800">
            <p className="font-semibold mb-1">Dicas para o WhatsApp</p>
            <ul className="space-y-1 text-xs">
              <li>• O número precisa incluir código do país (55 para Brasil) e DDD</li>
              <li>• Exemplo: 5511999999999</li>
              <li>• Sem o número, o WhatsApp abre mas sem destinatário</li>
            </ul>
          </div>
        </div>
      </div>
    </form>
  );
}
