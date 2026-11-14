"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, ArrowLeft, ChevronDown, ChevronUp, Check, ImageIcon, Info, Layers, Package, Store, Tag, TrendingUp, Truck, Eye, Star, AlertCircle } from "lucide-react";
import { Button, ButtonLink } from "@/components/admin/ui/Button";
import { Category, PackagePreset, Product, ProductAttribute } from "@/types";
import { NormalizedVariant, generateCombinations, getProductAttributes, normalizeVariantStock } from "@/lib/variantUtils";
import ImageListInput from "./ImageListInput";
import { VariantBlingMapForm } from "./VariantBlingMapForm";
import { formatCurrency } from "@/lib/utils";

interface NavItemOption {
  id: string;
  label: string;
}

interface VariationTemplate {
  id: string;
  name: string;
  values: string;
  active: boolean;
}

interface ProductFormProps {
  productId?: string;
  product?: Product;
  categories: Category[];
  navItems?: NavItemOption[];
  variationTemplates?: VariationTemplate[];
  packages?: PackagePreset[];
}

const CARD_CLASS = "bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 sm:p-6";
type IconType = React.ComponentType<{ size?: number; className?: string }>;

// Fora do formulário de propósito: componentes criados dentro dele seriam recriados a cada tecla e os campos perderiam o foco
function Section({ sectionRef, icon: Icon, title, hint, children, action }: { sectionRef?: (el: HTMLElement | null) => void; icon: IconType; title: string; hint?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section ref={sectionRef} className={CARD_CLASS}>
      <header className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center shrink-0"><Icon size={16} /></span>
          <div>
            <h2 className="text-[15px] font-semibold text-gray-900">{title}</h2>
            {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
          </div>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function FieldError({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1 text-xs text-red-600 flex items-center gap-1"><AlertCircle size={12} /> {msg}</p> : null;
}

function Toggle({ on, onChange, label, hint, icon: Icon }: { on: boolean; onChange: (v: boolean) => void; label: string; hint: string; icon: IconType }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="w-full flex items-center gap-3 text-left">
      <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${on ? "bg-brand-light text-brand" : "bg-gray-100 text-gray-400"}`}><Icon size={15} /></span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-gray-900">{label}</span>
        <span className="block text-xs text-gray-500">{hint}</span>
      </span>
      <span className={`relative w-10 h-6 rounded-full shrink-0 transition-colors ${on ? "bg-brand" : "bg-gray-300"}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${on ? "translate-x-4" : ""}`} />
      </span>
    </button>
  );
}

export default function ProductForm({ productId, product, categories, navItems = [], variationTemplates = [], packages = [] }: ProductFormProps) {
  const router = useRouter();
  const isEditing = !!product;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState(product?.name || "");
  const [description, setDescription] = useState(product?.description || "");
  const [measurements, setMeasurements] = useState(product?.measurements || "");
  const [price, setPrice] = useState(product?.price?.toString() || "");
  const [comparePrice, setComparePrice] = useState(product?.comparePrice?.toString() || "");
  const [costPrice, setCostPrice] = useState(product?.costPrice?.toString() || "");
  const [pesoGramas, setPesoGramas] = useState(product?.pesoGramas?.toString() || "");
  const [embalagemId, setEmbalagemId] = useState(product?.embalagemId || "");
  const [blingProdutoId, setBlingProdutoId] = useState((product as any)?.blingProdutoId || "");
  const [categoryId, setCategoryId] = useState(product?.categoryId || "");
  const [stock, setStock] = useState(product?.stock?.toString() || "0");
  const [active, setActive] = useState(product?.active !== false);
  const [featured, setFeatured] = useState(product?.featured === true);
  const [images, setImages] = useState<string[]>(JSON.parse(product?.images || "[]"));
  const [selectedNavIds, setSelectedNavIds] = useState<string[]>(
    (product as unknown as { navItems?: { id: string }[] })?.navItems?.map((n) => n.id) || []
  );

  // Attributes: array of {name, values}
  const [attributes, setAttributes] = useState<ProductAttribute[]>(() =>
    product ? getProductAttributes({
      attributes: product.attributes || "[]",
      sizes: product.sizes || "[]",
      colors: product.colors || "[]",
    }) : []
  );

  // Variant stock: normalized flat list of combinations
  const [variantStock, setVariantStock] = useState<NormalizedVariant[]>(() => {
    if (!product) return [];
    const raw = JSON.parse(product.variantStock || "[]");
    return normalizeVariantStock(raw);
  });

  const [newAttrValues, setNewAttrValues] = useState<Record<number, string>>({});
  const [collapsedAttrs, setCollapsedAttrs] = useState<Record<number, boolean>>({});

  // Auto-sum stock from variants
  useEffect(() => {
    if (variantStock.length > 0) {
      const total = variantStock.reduce((sum, v) => sum + (v.stock || 0), 0);
      setStock(total.toString());
    }
  }, [variantStock]);

  // Re-generate variant stock when attributes change
  useEffect(() => {
    const combos = generateCombinations(attributes);
    if (combos.length === 0) {
      setVariantStock([]);
      return;
    }
    setVariantStock((prev) =>
      combos.map((combo) => {
        const existing = prev.find((v) =>
          Object.entries(combo).every(([k, val]) => v.attributes[k] === val)
        );
        return { attributes: combo, stock: existing?.stock ?? 0 };
      })
    );
  }, [attributes]);

  const getVariantStockValue = (combo: Record<string, string>) =>
    variantStock.find((v) =>
      Object.entries(combo).every(([k, val]) => v.attributes[k] === val)
    )?.stock ?? 0;

  const setVariantStockValue = (combo: Record<string, string>, value: number) =>
    setVariantStock((prev) =>
      prev.map((v) =>
        Object.entries(combo).every(([k, val]) => v.attributes[k] === val)
          ? { ...v, stock: value }
          : v
      )
    );

  // Apply a variation template as a new attribute (or merge values if name already exists)
  const applyTemplate = (tpl: VariationTemplate) => {
    const values = JSON.parse(tpl.values || "[]") as string[];
    setAttributes((prev) => {
      const existing = prev.find((a) => a.name === tpl.name);
      if (existing) {
        // Merge new values
        return prev.map((a) =>
          a.name === tpl.name
            ? { ...a, values: Array.from(new Set([...a.values, ...values])) }
            : a
        );
      }
      return [...prev, { name: tpl.name, values }];
    });
  };

  const removeAttribute = (idx: number) =>
    setAttributes((prev) => prev.filter((_, i) => i !== idx));

  const addAttrValue = (attrIdx: number) => {
    const val = (newAttrValues[attrIdx] || "").trim();
    if (!val) return;
    setAttributes((prev) =>
      prev.map((a, i) =>
        i === attrIdx && !a.values.includes(val)
          ? { ...a, values: [...a.values, val] }
          : a
      )
    );
    setNewAttrValues((prev) => ({ ...prev, [attrIdx]: "" }));
  };

  const removeAttrValue = (attrIdx: number, val: string) =>
    setAttributes((prev) =>
      prev.map((a, i) =>
        i === attrIdx ? { ...a, values: a.values.filter((v) => v !== val) } : a
      )
    );

  const toggleNav = (id: string) =>
    setSelectedNavIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  // Atributo livre (ex.: "Sabor", "Estampa") além das variações cadastradas
  const [newAttrName, setNewAttrName] = useState("");
  const addCustomAttribute = () => {
    const n = newAttrName.trim();
    if (!n || attributes.some((a) => a.name.toLowerCase() === n.toLowerCase())) return;
    setAttributes((prev) => [...prev, { name: n, values: [] }]);
    setNewAttrName("");
  };

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  /** Validação no navegador, com mensagens claras antes de enviar. */
  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Dê um nome ao produto";
    const priceN = Number(price);
    if (!price || !Number.isFinite(priceN) || priceN <= 0) errs.price = "Informe o preço de venda";
    if (comparePrice && Number(comparePrice) > 0 && Number(comparePrice) <= priceN) errs.comparePrice = "O preço \"de\" precisa ser maior que o preço de venda";
    if (!categoryId) errs.categoryId = "Escolha a categoria";
    const emptyAttr = attributes.find((a) => a.values.length === 0);
    if (emptyAttr) errs.attributes = `A variação "${emptyAttr.name}" está sem opções — adicione valores ou remova`;
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      setError("Revise os campos destacados antes de salvar.");
      const first = ["name", "price", "comparePrice", "attributes", "categoryId"].find((k) => errs[k]);
      const sec = first === "categoryId" ? "category" : first === "attributes" ? "variations" : first === "name" ? "basic" : "price";
      sectionRefs.current[sec]?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setLoading(true);
    try {
      const url = isEditing ? `/api/products/${product!.id}` : "/api/products";
      const method = isEditing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, description, price, comparePrice, costPrice, categoryId,
          stock, variantStock, active, featured, images, attributes,
          pesoGramas: pesoGramas ? parseInt(pesoGramas) : null,
          embalagemId: embalagemId || null,
          measurements,
          blingProdutoId: blingProdutoId || null,
          navItemIds: selectedNavIds,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Erro ao salvar produto");
      }
      router.push("/admin/produtos");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error && err.message !== "Erro ao salvar produto"
        ? err.message
        : "Não foi possível salvar o produto. Verifique os dados e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 bg-white placeholder:text-gray-400 transition";
  const errClass = "border-red-300 ring-2 ring-red-100";
  const labelClass = "block text-xs font-medium text-gray-600 mb-1";
  const cardClass = CARD_CLASS;

  const combos = generateCombinations(attributes);

  // Margem ao vivo (preço − custo)
  const priceN = Number(price) || 0;
  const costN = Number(costPrice) || 0;
  const compareN = Number(comparePrice) || 0;
  const margin = priceN > 0 && costN > 0 ? priceN - costN : null;
  const marginPct = margin != null && priceN > 0 ? (margin / priceN) * 100 : null;
  const promoPct = compareN > priceN && priceN > 0 ? Math.round(((compareN - priceN) / compareN) * 100) : 0;
  const stockN = Number(stock) || 0;
  const categoryName = categories.find((c) => c.id === categoryId)?.name;

  const saveButtons = (
    <>
      <ButtonLink href="/admin/produtos" variant="ghost">
        Cancelar
      </ButtonLink>
      <Button type="submit" variant="primary" icon={Check} loading={loading} loadingText="Salvando…">
        {isEditing ? "Salvar alterações" : "Cadastrar produto"}
      </Button>
    </>
  );

  return (
    <form onSubmit={handleSubmit} noValidate className="pb-24 lg:pb-0">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 mb-6">
        <ButtonLink href="/admin/produtos" variant="ghost" size="icon" icon={ArrowLeft} aria-label="Voltar para produtos" title="Voltar para produtos" className="shrink-0" />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{isEditing ? "Editar produto" : "Novo produto"}</h1>
          <p className="text-sm text-gray-500 mt-0.5 truncate">{isEditing ? product!.name : "Preencha as informações e publique na loja"}</p>
        </div>
        <div className="ml-auto hidden lg:flex items-center gap-2">{saveButtons}</div>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-2 bg-red-50 ring-1 ring-red-200 text-red-800 px-4 py-3 rounded-xl text-sm animate-fade-up [animation-duration:0.25s]">
          <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Coluna principal */}
        <div className="lg:col-span-2 space-y-5">
          <Section sectionRef={(el) => { sectionRefs.current.basic = el; }} icon={Info} title="Informações básicas" hint="Nome e descrição que o cliente vê na página do produto.">
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Nome do produto *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} ${fieldErrors.name ? errClass : ""}`} placeholder="Ex.: Vestido Midi Floral" />
                <FieldError msg={fieldErrors.name} />
              </div>
              <div>
                <label className={labelClass}>Descrição</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={inputClass} placeholder="Tecido, caimento, medidas, como usar…" />
                <p className="mt-1 text-[11px] text-gray-400">{description.length} caracteres · dica: fale do tecido e do caimento</p>
              </div>
              <div>
                <label className={labelClass}>Medidas / tabela de tamanhos</label>
                <textarea
                  value={measurements}
                  onChange={(e) => setMeasurements(e.target.value)}
                  rows={4}
                  className={inputClass}
                  placeholder={"Ex.:\nP — busto 88 cm · comprimento 60 cm\nM — busto 94 cm · comprimento 62 cm\nModelo veste M e tem 1,68 m"}
                />
                <p className="mt-1 text-[11px] text-gray-400">Aparece na página do produto em “Medidas e caimento” e o atendente de IA usa para responder dúvidas de tamanho.</p>
              </div>
            </div>
          </Section>

          <Section sectionRef={(el) => { sectionRefs.current.photos = el; }} icon={ImageIcon} title="Fotos" hint="A primeira foto é a capa. Use fotos verticais (3:4), com boa luz.">
            <ImageListInput images={images} onChange={setImages} aspect="portrait" />
          </Section>

          <Section sectionRef={(el) => { sectionRefs.current.price = el; }} icon={Tag} title="Preço e custo" hint="O custo não aparece na loja — serve para calcular sua margem de lucro.">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Preço de venda *</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                  <input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className={`${inputClass} pl-10 ${fieldErrors.price ? errClass : ""}`} placeholder="0,00" />
                </div>
                <FieldError msg={fieldErrors.price} />
              </div>
              <div>
                <label className={labelClass}>Preço &quot;de&quot; (riscado)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                  <input type="number" step="0.01" min="0" value={comparePrice} onChange={(e) => setComparePrice(e.target.value)} className={`${inputClass} pl-10 ${fieldErrors.comparePrice ? errClass : ""}`} placeholder="Opcional" />
                </div>
                {fieldErrors.comparePrice ? <FieldError msg={fieldErrors.comparePrice} /> : promoPct > 0 && <p className="mt-1 text-xs text-red-600 font-medium">Aparece como -{promoPct}% na loja</p>}
              </div>
              <div>
                <label className={labelClass}>Custo (valor de compra)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                  <input type="number" step="0.01" min="0" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} className={`${inputClass} pl-10`} placeholder="Opcional" />
                </div>
              </div>
            </div>
            <div className={`mt-4 flex items-center gap-3 rounded-xl px-4 py-3 ${margin == null ? "bg-gray-50" : margin < 0 ? "bg-red-50" : (marginPct ?? 0) < 20 ? "bg-amber-50" : "bg-emerald-50"}`}>
              <TrendingUp size={18} className={margin == null ? "text-gray-400" : margin < 0 ? "text-red-600" : (marginPct ?? 0) < 20 ? "text-amber-600" : "text-emerald-600"} />
              {margin == null ? (
                <p className="text-sm text-gray-500">Preencha o preço e o custo para ver a margem de lucro.</p>
              ) : (
                <p className="text-sm text-gray-800">
                  Lucro de <b className="tabular-nums">{formatCurrency(margin)}</b> por peça
                  <span className="text-gray-500"> · margem de <b className="tabular-nums">{marginPct!.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</b></span>
                  {margin < 0 && <span className="text-red-700 font-medium"> — o preço está abaixo do custo</span>}
                </p>
              )}
            </div>
          </Section>

          <Section
            sectionRef={(el) => { sectionRefs.current.variations = el; }}
            icon={Layers}
            title="Variações e estoque"
            hint="Tamanho, cor ou qualquer opção. O estoque é controlado por combinação."
          >
            <div className="space-y-4">
              {/* Variações cadastradas */}
              {variationTemplates.filter((t) => t.active).length > 0 && (
                <div>
                  <p className={labelClass}>Usar variação cadastrada</p>
                  <div className="flex gap-2 flex-wrap">
                    {variationTemplates.filter((t) => t.active).map((tpl) => {
                      const alreadyApplied = attributes.some((a) => a.name === tpl.name);
                      return (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => applyTemplate(tpl)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium ring-1 transition ${
                            alreadyApplied ? "ring-emerald-200 bg-emerald-50 text-emerald-700" : "ring-gray-200 bg-white text-gray-700 hover:ring-[var(--brand)] hover:text-[var(--brand)]"
                          }`}
                        >
                          {alreadyApplied ? <Check size={12} /> : <Plus size={12} />}
                          {tpl.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Nova variação livre */}
              <div>
                <p className={labelClass}>Criar variação</p>
                <div className="flex gap-2">
                  <input
                    value={newAttrName}
                    onChange={(e) => setNewAttrName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomAttribute(); } }}
                    className={inputClass}
                    placeholder="Nome da variação — ex.: Tamanho, Cor, Estampa"
                  />
                  <Button variant="dark" icon={Plus} onClick={addCustomAttribute} disabled={!newAttrName.trim()} className="shrink-0 h-auto">
                    Criar
                  </Button>
                </div>
              </div>

              {attributes.map((attr, attrIdx) => (
                <div key={attrIdx} className={`rounded-xl ring-1 ${attr.values.length === 0 && fieldErrors.attributes ? "ring-red-300" : "ring-gray-200"}`}>
                  <div
                    className="flex items-center justify-between px-4 py-2.5 bg-gray-50 rounded-t-xl cursor-pointer select-none"
                    onClick={() => setCollapsedAttrs((prev) => ({ ...prev, [attrIdx]: !prev[attrIdx] }))}
                  >
                    <div className="flex items-center gap-2">
                      {collapsedAttrs[attrIdx] ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronUp size={14} className="text-gray-400" />}
                      <span className="text-sm font-semibold text-gray-900">{attr.name}</span>
                      <span className="text-xs text-gray-400">{attr.values.length} opç{attr.values.length !== 1 ? "ões" : "ão"}</span>
                    </div>
                    <Button variant="dangerGhost" size="iconSm" icon={X} onClick={(e) => { e.stopPropagation(); removeAttribute(attrIdx); }} aria-label={`Remover ${attr.name}`} />
                  </div>
                  {!collapsedAttrs[attrIdx] && (
                    <div className="p-4 space-y-3">
                      <div className="flex gap-2 flex-wrap">
                        {attr.values.map((val) => (
                          <span key={val} className="inline-flex items-center gap-1 bg-white ring-1 ring-gray-200 text-gray-800 pl-3 pr-1.5 py-1 rounded-full text-[13px]">
                            {val}
                            <button type="button" onClick={() => removeAttrValue(attrIdx, val)} className="p-0.5 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50" aria-label={`Remover ${val}`}>
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                        {attr.values.length === 0 && <span className="text-xs text-gray-400 italic">Nenhuma opção ainda — adicione abaixo</span>}
                      </div>
                      <div className="flex gap-2">
                        <input
                          value={newAttrValues[attrIdx] || ""}
                          onChange={(e) => setNewAttrValues((prev) => ({ ...prev, [attrIdx]: e.target.value }))}
                          className={inputClass}
                          placeholder={`Nova opção de ${attr.name.toLowerCase()} e Enter — ex.: ${/cor/i.test(attr.name) ? "Preto" : /tam/i.test(attr.name) ? "M" : "Opção 1"}`}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAttrValue(attrIdx); } }}
                        />
                        <Button variant="secondary" size="icon" icon={Plus} onClick={() => addAttrValue(attrIdx)} aria-label="Adicionar opção" className="shrink-0 h-auto w-10" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <FieldError msg={fieldErrors.attributes} />

              {/* Estoque */}
              {combos.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-900">Estoque por combinação</p>
                    <p className="text-xs text-gray-500">Total: <b className="text-gray-900 tabular-nums">{stockN} un.</b></p>
                  </div>
                  <div className="rounded-xl ring-1 ring-gray-200 divide-y divide-gray-100 max-h-[420px] overflow-y-auto">
                    {combos.map((combo, i) => {
                      const label = Object.values(combo).join(" · ");
                      const value = getVariantStockValue(combo);
                      return (
                        <div key={i} className="flex items-center gap-3 px-3.5 py-2">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${value <= 0 ? "bg-red-400" : value <= 3 ? "bg-amber-400" : "bg-emerald-400"}`} />
                          <span className="flex-1 text-sm text-gray-700 truncate" title={Object.entries(combo).map(([k, v]) => `${k}: ${v}`).join(" · ")}>{label}</span>
                          <div className="flex items-center rounded-lg ring-1 ring-gray-200">
                            <button type="button" onClick={() => setVariantStockValue(combo, Math.max(0, value - 1))} className="w-7 h-8 text-gray-500 hover:text-gray-900" aria-label="Diminuir">−</button>
                            <input
                              type="number"
                              min="0"
                              value={value}
                              onChange={(e) => setVariantStockValue(combo, parseInt(e.target.value) || 0)}
                              className="w-14 h-8 text-center text-sm tabular-nums bg-transparent outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                              aria-label={`Estoque de ${label}`}
                            />
                            <button type="button" onClick={() => setVariantStockValue(combo, value + 1)} className="w-7 h-8 text-gray-500 hover:text-gray-900" aria-label="Aumentar">+</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="max-w-[220px]">
                  <label className={labelClass}>Estoque (unidades)</label>
                  <input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} className={inputClass} />
                  <p className="mt-1 text-[11px] text-gray-400">Sem variações, o estoque é único.</p>
                </div>
              )}

              {combos.length > 0 && productId && (
                <VariantBlingMapForm
                  productId={productId}
                  sizes={[...new Set(combos.map((c: Record<string, string>) => c.Tamanho || c.Size || "").filter(Boolean))]}
                  defaultBlingId={blingProdutoId}
                />
              )}
            </div>
          </Section>

          <Section sectionRef={(el) => { sectionRefs.current.shipping = el; }} icon={Truck} title="Envio e integrações" hint="Usado no cálculo do frete e na sincronização com o Bling.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Peso (gramas)</label>
                <input type="number" min="1" value={pesoGramas} onChange={(e) => setPesoGramas(e.target.value)} className={inputClass} placeholder="Ex.: 300" />
                <p className="mt-1 text-[11px] text-gray-400">Para o cálculo do frete</p>
              </div>
              <div>
                <label className={labelClass}>ID do produto no Bling</label>
                <input type="text" value={blingProdutoId} onChange={(e) => setBlingProdutoId(e.target.value)} className={inputClass} placeholder="Opcional — ex.: 123456" />
              </div>
              {packages.length > 0 && (
                <div className="sm:col-span-2">
                  <label className={labelClass}>Embalagem padrão</label>
                  <select value={embalagemId} onChange={(e) => setEmbalagemId(e.target.value)} className={inputClass}>
                    <option value="">Nenhuma (usar padrão das configurações)</option>
                    {packages.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>{pkg.name} — {pkg.comprimento}×{pkg.largura}×{pkg.altura} cm</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </Section>
        </div>

        {/* Lateral */}
        <div className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <section className={cardClass}>
            <h2 className="text-[15px] font-semibold text-gray-900 mb-4">Publicação</h2>
            <div className="space-y-4">
              <Toggle on={active} onChange={setActive} icon={Eye} label="Visível na loja" hint={active ? "Clientes podem ver e comprar" : "Oculto — só você vê"} />
              <Toggle on={featured} onChange={setFeatured} icon={Star} label="Destaque" hint="Aparece em “Peças em destaque”" />
            </div>
          </section>

          <section ref={(el) => { sectionRefs.current.category = el; }} className={cardClass}>
            <h2 className="text-[15px] font-semibold text-gray-900 mb-3">Categoria *</h2>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={`${inputClass} ${fieldErrors.categoryId ? errClass : ""}`}>
              <option value="">Selecione…</option>
              {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
            <FieldError msg={fieldErrors.categoryId} />
          </section>

          {navItems.length > 0 && (
            <section className={cardClass}>
              <h2 className="text-[15px] font-semibold text-gray-900">Menus da loja</h2>
              <p className="text-xs text-gray-500 mt-0.5 mb-3">Em quais menus este produto aparece</p>
              <div className="flex flex-wrap gap-1.5">
                {navItems.map((item) => {
                  const checked = selectedNavIds.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleNav(item.id)}
                      aria-pressed={checked}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[13px] font-medium ring-1 transition ${checked ? "bg-brand text-on-button ring-transparent" : "ring-gray-200 text-gray-700 hover:bg-gray-50"}`}
                    >
                      {checked && <Check size={12} />} {item.label}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Prévia do card */}
          <section className={cardClass}>
            <h2 className="text-[15px] font-semibold text-gray-900 mb-3 flex items-center gap-1.5"><Store size={15} className="text-gray-400" /> Como aparece na loja</h2>
            <div className="max-w-[220px] mx-auto">
              <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-gray-100">
                {images[0] ? (
                  <img src={images[0]} alt="Prévia" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-product.svg"; }} />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300"><Package size={28} /><span className="text-xs mt-1">Sem foto</span></div>
                )}
                <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
                  {featured && <span className="bg-brand text-on-button text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Destaque</span>}
                  {promoPct > 0 && <span className="bg-white/90 text-red-600 text-[10px] font-black px-2 py-0.5 rounded-full">-{promoPct}%</span>}
                </div>
                {!active && <div className="absolute inset-0 bg-white/60 flex items-center justify-center"><span className="text-xs font-semibold text-gray-700 bg-white rounded-full px-2.5 py-1 ring-1 ring-gray-200">Oculto</span></div>}
              </div>
              <p className="mt-2.5 text-[11px] font-semibold text-brand uppercase tracking-wider">{categoryName || "Categoria"}</p>
              <p className="text-sm font-semibold text-gray-900 line-clamp-2">{name || "Nome do produto"}</p>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="font-black text-gray-900">{priceN > 0 ? formatCurrency(priceN) : "R$ 0,00"}</span>
                {promoPct > 0 && <span className="text-xs text-gray-400 line-through">{formatCurrency(compareN)}</span>}
              </p>
              <p className={`mt-1 text-[11px] ${stockN <= 0 ? "text-red-600" : stockN <= 3 ? "text-amber-700" : "text-gray-500"}`}>
                {stockN <= 0 ? "Sem estoque — aparece como esgotado" : `${stockN} em estoque`}
              </p>
            </div>
          </section>
        </div>
      </div>

      {/* Ações fixas no celular */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-30 bg-white/95 backdrop-blur border-t border-gray-200 px-4 py-3 flex items-center justify-end gap-2">
        {saveButtons}
      </div>
    </form>
  );
}
