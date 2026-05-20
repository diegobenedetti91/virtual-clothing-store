import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VOL_PADRAO_CM3 = 2250; // ~30×25×3 cm, garment folded
const PESO_PADRAO_G = 500;
const FILL_RATIO = 0.75;

interface PackagePresetRaw {
  id: string;
  name: string;
  comprimento: number;
  largura: number;
  altura: number;
  pesoGramas: number;
  active: boolean;
}

interface ItemInfo {
  productId: string;
  nome: string;
  quantidade: number;
  variante: string;
  volumeCm3: number;
  pesoGramas: number;
  embalagemNome: string | null;
}

function sugerirEmpacotamento(itens: ItemInfo[], embalagens: PackagePresetRaw[]) {
  const ativas = embalagens.filter((e) => e.active).sort(
    (a, b) => a.comprimento * a.largura * a.altura - b.comprimento * b.largura * b.altura
  );

  const volumeTotal = itens.reduce((s, i) => s + i.volumeCm3 * i.quantidade, 0);
  const pesoItens = itens.reduce((s, i) => s + i.pesoGramas * i.quantidade, 0);

  if (ativas.length === 0) {
    return {
      embalagens: [] as PackagePresetRaw[],
      pesoTotalGramas: pesoItens,
      volumeTotalCm3: volumeTotal,
      observacao: "Nenhuma embalagem cadastrada",
      cabe: false,
    };
  }

  // Try smallest single box
  for (const emb of ativas) {
    const volEmb = emb.comprimento * emb.largura * emb.altura;
    if (volumeTotal <= volEmb * FILL_RATIO) {
      return {
        embalagens: [emb],
        pesoTotalGramas: pesoItens + emb.pesoGramas,
        volumeTotalCm3: volumeTotal,
        observacao: `Cabe em 1 embalagem (${((volumeTotal / volEmb) * 100).toFixed(0)}% cheio)`,
        cabe: true,
      };
    }
  }

  // Use largest box — calculate how many needed
  const maior = ativas[ativas.length - 1];
  const volMaior = maior.comprimento * maior.largura * maior.altura;
  const qtdCaixas = Math.ceil(volumeTotal / (volMaior * FILL_RATIO));

  return {
    embalagens: Array(qtdCaixas).fill(maior) as PackagePresetRaw[],
    pesoTotalGramas: pesoItens + maior.pesoGramas * qtdCaixas,
    volumeTotalCm3: volumeTotal,
    observacao: `Requer ${qtdCaixas} caixa${qtdCaixas > 1 ? "s" : ""} "${maior.name}"`,
    cabe: true,
  };
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [orders, embalagens, settings] = await Promise.all([
    prisma.order.findMany({
      where: { status: "CONFIRMED" },
      include: {
        items: {
          include: {
            product: {
              include: { embalagem: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.packagePreset.findMany({ orderBy: { name: "asc" } }),
    prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" } }),
  ]);

  const pesoDefault = settings?.fretePesoDefaultGramas ?? PESO_PADRAO_G;
  const altDefault = settings?.fretePacoteAltura ?? 5;
  const largDefault = settings?.fretePacoteLargura ?? 12;
  const compDefault = settings?.fretePacoteComprimento ?? 17;
  const volDefault = altDefault * largDefault * compDefault;

  const result = orders.map((order) => {
    const itens: ItemInfo[] = order.items.map((item) => {
      const emb = item.product.embalagem;
      const volumeItem = emb
        ? emb.comprimento * emb.largura * emb.altura
        : volDefault || VOL_PADRAO_CM3;

      const variante = (() => {
        if (item.selectedAttributes) {
          try {
            const attrs = JSON.parse(item.selectedAttributes) as Record<string, string>;
            return Object.entries(attrs).map(([k, v]) => `${k}: ${v}`).join(", ");
          } catch { return ""; }
        }
        return [item.size && `Tam: ${item.size}`, item.color && `Cor: ${item.color}`].filter(Boolean).join(", ");
      })();

      return {
        productId: item.productId,
        nome: item.product.name,
        quantidade: item.quantity,
        variante,
        volumeCm3: volumeItem,
        pesoGramas: item.product.pesoGramas ?? pesoDefault,
        embalagemNome: emb?.name ?? null,
      };
    });

    const sugestao = sugerirEmpacotamento(itens, embalagens as PackagePresetRaw[]);

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerEmail: order.customerEmail,
      city: order.city,
      state: order.state,
      zipCode: order.zipCode,
      createdAt: order.createdAt,
      itens,
      sugestao,
    };
  });

  return NextResponse.json({ orders: result, embalagens });
}
