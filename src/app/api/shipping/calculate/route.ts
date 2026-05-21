import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface ShippingOption {
  servico: string;
  codigo: string;
  valor: number;
  prazo: number;
  erro: string;
}

interface MelhorEnvioResult {
  id: number;
  name: string;
  price: string;
  delivery_time: number;
  company: { id: number; name: string };
  error: string | null;
}

async function calcularMelhorEnvio(
  token: string,
  cepOrigem: string,
  cepDestino: string,
  pesoKg: number,
  altura: number,
  largura: number,
  comprimento: number,
  valorProdutos: number
): Promise<ShippingOption[]> {
  const body = {
    from: { postal_code: cepOrigem },
    to: { postal_code: cepDestino },
    package: {
      height: Math.max(altura, 2),
      width: Math.max(largura, 11),
      length: Math.max(comprimento, 16),
      weight: Math.max(pesoKg, 0.1),
    },
    options: {
      insurance_value: valorProdutos,
      receipt: false,
      own_hand: false,
    },
  };

  try {
    const res = await fetch("https://melhorenvio.com.br/api/v2/me/shipment/calculate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "VirtualClothingStore (suporte@loja.com)",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return [];

    const data: MelhorEnvioResult[] = await res.json();

    return data
      .filter((item) => !item.error && item.price && parseFloat(item.price) > 0)
      .map((item) => ({
        servico: `${item.company.name} ${item.name}`,
        codigo: String(item.id),
        valor: parseFloat(item.price),
        prazo: item.delivery_time,
        erro: "0",
      }))
      .sort((a, b) => a.valor - b.valor);
  } catch {
    return [];
  }
}

async function calcularCorreios(
  cepOrigem: string,
  cepDestino: string,
  pesoKg: number,
  altura: number,
  largura: number,
  comprimento: number
): Promise<ShippingOption[]> {
  const servicos = [
    { codigo: "04669", nome: "PAC" },
    { codigo: "04162", nome: "SEDEX" },
  ];

  const results: ShippingOption[] = [];

  for (const servico of servicos) {
    const url =
      `http://ws.correios.com.br/calculador/CalcPrecoPrazo.aspx` +
      `?nCdEmpresa=&sDsSenha=&nCdServico=${servico.codigo}` +
      `&sCepOrigem=${cepOrigem}&sCepDestino=${cepDestino}` +
      `&nVlPeso=${pesoKg.toFixed(3)}` +
      `&nCdFormato=1&nVlComprimento=${comprimento}&nVlAltura=${altura}&nVlLargura=${largura}` +
      `&nVlDiametro=0&sCdMaoPropria=N&nVlValorDeclarado=0&sCdAvisoRecebimento=N&StrRetorno=xml`;

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const xml = await res.text();
      const erro = xml.match(/<Erro>(.*?)<\/Erro>/)?.[1] || "0";
      const valorStr = xml.match(/<Valor>(.*?)<\/Valor>/)?.[1]?.replace(",", ".") || "0";
      const prazo = parseInt(xml.match(/<PrazoEntrega>(.*?)<\/PrazoEntrega>/)?.[1] || "0", 10);
      const valor = parseFloat(valorStr);
      results.push({ servico: servico.nome, codigo: servico.codigo, valor: erro === "0" ? valor : 0, prazo: erro === "0" ? prazo : 0, erro });
    } catch {
      results.push({ servico: servico.nome, codigo: servico.codigo, valor: 0, prazo: 0, erro: "timeout" });
    }
  }

  return results;
}

function normalizeCity(str: string) {
  return str.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export async function POST(req: NextRequest) {
  const { cepDestino, items } = await req.json();

  if (!cepDestino || cepDestino.replace(/\D/g, "").length !== 8) {
    return NextResponse.json({ error: "CEP inválido" }, { status: 400 });
  }

  const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" } });

  if (!settings?.freteAtivo) {
    return NextResponse.json({ error: "Frete não configurado" }, { status: 400 });
  }

  const freteTipo = settings.freteTipo || "fixo";
  const cepOrigem = settings.freteCEPOrigem?.replace(/\D/g, "") || "";
  const cepDestinoClean = cepDestino.replace(/\D/g, "");
  const pesoDefault = settings.fretePesoDefaultGramas || 500;
  let altura = settings.fretePacoteAltura || 5;
  let largura = settings.fretePacoteLargura || 12;
  let comprimento = settings.fretePacoteComprimento || 17;

  // Modo entrega local: valida cidade e UF pelo CEP via ViaCEP
  if (freteTipo === "local") {
    const s = settings as Record<string, unknown>;
    const cidadeConfigurada = s.freteLocalCidade as string | null;
    const ufConfigurada = s.freteLocalUF as string | null;
    if (cidadeConfigurada) {
      try {
        const viacepRes = await fetch(`https://viacep.com.br/ws/${cepDestinoClean}/json/`, { signal: AbortSignal.timeout(5000) });
        if (viacepRes.ok) {
          const viacep = await viacepRes.json();
          if (!viacep.erro) {
            const cidadeOk = normalizeCity(viacep.localidade) === normalizeCity(cidadeConfigurada);
            const ufOk = !ufConfigurada || viacep.uf?.toUpperCase() === ufConfigurada.toUpperCase();
            if (!cidadeOk || !ufOk) {
              return NextResponse.json(
                { error: "fora_da_area", cidade: viacep.localidade, uf: viacep.uf },
                { status: 422 }
              );
            }
          }
        }
      } catch {
        // Se ViaCEP falhar, permite continuar sem bloquear
      }
    }
    return NextResponse.json({
      tipo: "local",
      opcoes: [{ servico: "Entrega local", codigo: "local", valor: settings.freteValorFixo, prazo: 0, erro: "0" }],
    });
  }

  // Modo fixo
  if (freteTipo === "fixo") {
    return NextResponse.json({
      tipo: "fixo",
      opcoes: [{ servico: "Frete fixo", codigo: "fixo", valor: settings.freteValorFixo, prazo: 0, erro: "0" }],
    });
  }

  // Modo híbrido: CEP local → frete fixo
  if (freteTipo === "hibrido" && cepOrigem && cepDestinoClean.slice(0, 5) === cepOrigem.slice(0, 5)) {
    return NextResponse.json({
      tipo: "fixo",
      opcoes: [{ servico: "Entrega local", codigo: "local", valor: settings.freteValorFixo, prazo: 0, erro: "0" }],
    });
  }

  if (!cepOrigem) {
    return NextResponse.json({ error: "CEP de origem não configurado" }, { status: 400 });
  }

  // Calcular peso, volume e valor total dos itens
  let pesoTotalGramas = 0;
  let volumeTotalCm3 = 0;
  let valorProdutos = 0;
  const volDefault = altura * largura * comprimento;

  if (Array.isArray(items) && items.length > 0) {
    const productIds: string[] = items.map((i: { productId: string }) => i.productId);
    const [products, presets] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, pesoGramas: true, price: true, embalagem: true },
      }),
      prisma.packagePreset.findMany({ where: { active: true } }),
    ]);
    const prodMap = new Map(products.map((p) => [p.id, p]));

    for (const item of items as { productId: string; quantity: number }[]) {
      const prod = prodMap.get(item.productId);
      const peso = prod?.pesoGramas ?? pesoDefault;
      const volItem = prod?.embalagem
        ? prod.embalagem.comprimento * prod.embalagem.largura * prod.embalagem.altura
        : volDefault;
      pesoTotalGramas += peso * item.quantity;
      volumeTotalCm3 += volItem * item.quantity;
      valorProdutos += (prod?.price ?? 0) * item.quantity;
    }

    // Determine box dimensions from presets if available
    if (presets.length > 0) {
      const sorted = [...presets].sort(
        (a, b) => a.comprimento * a.largura * a.altura - b.comprimento * b.largura * b.altura
      );
      const FILL = 0.75;
      const best = sorted.find((p) => volumeTotalCm3 <= p.comprimento * p.largura * p.altura * FILL)
        ?? sorted[sorted.length - 1];
      altura = best.altura;
      largura = best.largura;
      comprimento = best.comprimento;
    }
  } else {
    pesoTotalGramas = pesoDefault;
  }

  const pesoKg = Math.max(pesoTotalGramas / 1000, 0.1);

  // Usar Melhor Envio se token configurado e tipo for melhorenvio ou hibrido
  const usarMelhorEnvio = (freteTipo === "melhorenvio" || freteTipo === "hibrido") && !!settings.melhorEnvioToken;

  let opcoes: ShippingOption[];

  if (usarMelhorEnvio) {
    opcoes = await calcularMelhorEnvio(settings.melhorEnvioToken!, cepOrigem, cepDestinoClean, pesoKg, altura, largura, comprimento, valorProdutos);
    // fallback para Correios se Melhor Envio não retornar nada
    if (opcoes.length === 0) {
      opcoes = await calcularCorreios(cepOrigem, cepDestinoClean, pesoKg, altura, largura, comprimento);
    }
  } else {
    opcoes = await calcularCorreios(cepOrigem, cepDestinoClean, pesoKg, altura, largura, comprimento);
  }

  return NextResponse.json({ tipo: usarMelhorEnvio ? "melhorenvio" : "correios", opcoes });
}
