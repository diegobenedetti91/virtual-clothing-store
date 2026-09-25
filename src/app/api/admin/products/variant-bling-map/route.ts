import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  listBlingVariantMappings,
  getOrCreateBlingVariantMapping,
  deleteBlingVariantMapping,
} from "@/lib/blingVariantUtils";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");

    if (!productId) {
      return NextResponse.json(
        { error: "productId é obrigatório" },
        { status: 400 }
      );
    }

    const mappings = await listBlingVariantMappings(productId);
    return NextResponse.json(mappings);
  } catch (error) {
    console.error("[VARIANT-BLING-MAP] GET Error:", error);
    return NextResponse.json(
      { error: "Erro ao buscar mapeamentos" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    const { productId, size, blingProdutoId } = await req.json();

    if (!productId || !size || !blingProdutoId) {
      return NextResponse.json(
        { error: "productId, size e blingProdutoId são obrigatórios" },
        { status: 400 }
      );
    }

    const mapping = await getOrCreateBlingVariantMapping(
      productId,
      size,
      blingProdutoId
    );

    return NextResponse.json({
      success: true,
      message: `Mapeamento ${size} → Bling ID ${blingProdutoId} salvo com sucesso`,
      mapping,
    });
  } catch (error) {
    console.error("[VARIANT-BLING-MAP] POST Error:", error);
    return NextResponse.json(
      { error: "Erro ao salvar mapeamento" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");
    const size = searchParams.get("size");

    if (!productId || !size) {
      return NextResponse.json(
        { error: "productId e size são obrigatórios" },
        { status: 400 }
      );
    }

    await deleteBlingVariantMapping(productId, size);

    return NextResponse.json({
      success: true,
      message: `Mapeamento ${size} removido com sucesso`,
    });
  } catch (error) {
    console.error("[VARIANT-BLING-MAP] DELETE Error:", error);
    return NextResponse.json(
      { error: "Erro ao remover mapeamento" },
      { status: 500 }
    );
  }
}
