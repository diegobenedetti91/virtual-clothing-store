"use client";

import { useState } from "react";
import { Save, MessageCircle, CreditCard, Eye, EyeOff } from "lucide-react";
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
  const [bannerImages, setBannerImages] = useState<string[]>(
    JSON.parse(initialSettings?.bannerImages || "[]")
  );

  const [checkoutType, setCheckoutType] = useState(initialSettings?.checkoutType || "whatsapp");
  const [checkoutCollectEmail, setCheckoutCollectEmail] = useState(initialSettings?.checkoutCollectEmail || false);
  const [checkoutCollectAddress, setCheckoutCollectAddress] = useState(initialSettings?.checkoutCollectAddress || false);
  const [checkoutMessage, setCheckoutMessage] = useState(initialSettings?.checkoutMessage || "");
  const [mpPublicKey, setMpPublicKey] = useState(initialSettings?.mercadoPagoPublicKey || "");
  const [mpAccessToken, setMpAccessToken] = useState(initialSettings?.mercadoPagoAccessToken || "");
  const [showToken, setShowToken] = useState(false);

  const inputClass = "w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition";
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
          primaryColor, bannerImages, checkoutType, checkoutCollectEmail, checkoutCollectAddress,
          checkoutMessage, mercadoPagoPublicKey: mpPublicKey || null, mercadoPagoAccessToken: mpAccessToken || null,
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

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <MessageCircle size={18} className="text-green-600" />
              <h2 className="font-semibold text-gray-900">Configurações do checkout</h2>
            </div>

            <div>
              <label className={labelClass}>Tipo de checkout</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCheckoutType("whatsapp")}
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${checkoutType === "whatsapp" ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-gray-300"}`}
                >
                  <span className="text-2xl mt-0.5">💬</span>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">Via WhatsApp</p>
                    <p className="text-xs text-gray-500 mt-0.5">Cliente monta o pedido e envia pelo WhatsApp. Pagamento e frete combinados na conversa.</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setCheckoutType("gateway")}
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${checkoutType === "gateway" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}
                >
                  <span className="text-2xl mt-0.5">💳</span>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">Gateway de pagamento</p>
                    <p className="text-xs text-gray-500 mt-0.5">Checkout completo com cartão, PIX e boleto via Mercado Pago.</p>
                  </div>
                </button>
              </div>
            </div>

            {checkoutType === "whatsapp" && (
              <>
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
              </>
            )}

            {checkoutType === "whatsapp" && (
              <>
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
              </>
            )}

            {checkoutType === "gateway" && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
                  <p className="font-semibold mb-1 flex items-center gap-2"><CreditCard size={14} /> Credenciais do Mercado Pago</p>
                  <p className="text-xs mb-3">
                    Acesse <strong>mercadopago.com.br → Seu negócio → Configurações → Credenciais</strong> para obter suas chaves.
                    Use as credenciais de <strong>produção</strong> para receber pagamentos reais.
                  </p>
                </div>
                <div>
                  <label className={labelClass}>Public Key (chave pública)</label>
                  <input
                    value={mpPublicKey}
                    onChange={(e) => setMpPublicKey(e.target.value)}
                    className={inputClass}
                    placeholder="APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  />
                  <p className="text-xs text-gray-400 mt-1">Usada no frontend para identificar sua conta.</p>
                </div>
                <div>
                  <label className={labelClass}>Access Token (chave secreta)</label>
                  <div className="relative">
                    <input
                      type={showToken ? "text" : "password"}
                      value={mpAccessToken}
                      onChange={(e) => setMpAccessToken(e.target.value)}
                      className={`${inputClass} pr-10`}
                      placeholder="APP_USR-xxxxxxxx..."
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Chave secreta usada no servidor. Nunca compartilhe.</p>
                </div>
              </div>
            )}
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
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <button
              type="submit"
              disabled={loading}
              className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-base shadow-md hover:shadow-lg active:scale-[0.98] transition-all ${saved ? "bg-green-500 text-white" : "bg-pink-600 text-white hover:bg-pink-700"} disabled:opacity-60`}
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
