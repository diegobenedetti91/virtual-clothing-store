import { prisma } from "@/lib/prisma";
import { normalizeVariantStock, matchesSelection } from "@/lib/variantUtils";

interface OrderItemLike {
  productId: string;
  quantity: number;
  // Legacy
  size?: string | null;
  color?: string | null;
  // New
  selectedAttributes?: string | null;
}

function parseSelected(item: OrderItemLike): Record<string, string> | null {
  if (item.selectedAttributes) {
    try { return JSON.parse(item.selectedAttributes); } catch { /* fall through */ }
  }
  // Legacy
  if (item.size || item.color) {
    const attrs: Record<string, string> = {};
    if (item.size) attrs["Tamanho"] = item.size;
    if (item.color) attrs["Cor"] = item.color;
    return attrs;
  }
  return null;
}

/**
 * Aplica uma variação de estoque (−quantidade na venda, +quantidade na devolução/cancelamento).
 * A linha do produto é travada (SELECT … FOR UPDATE) até o fim da transação: duas compras
 * simultâneas do mesmo produto não leem o mesmo estoque e uma sobrescreve a outra
 * (variantStock é um JSON reescrito inteiro). Retorna avisos quando a peça não pôde ser
 * localizada, para virar alerta no pedido em vez de passar em silêncio.
 */
async function applyStockDelta(items: OrderItemLike[], sign: 1 | -1): Promise<string[]> {
  const warnings: string[] = [];
  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      const rows = await tx.$queryRaw<{ name: string; stock: number; variantStock: string | null }[]>`
        SELECT name, stock, variantStock FROM Product WHERE id = ${item.productId} FOR UPDATE`;
      const product = rows[0];
      if (!product) {
        warnings.push(`produto ${item.productId} não existe mais (${item.quantity} un.)`);
        continue;
      }

      let raw: unknown[] = [];
      try { const p = JSON.parse(product.variantStock || "[]"); raw = Array.isArray(p) ? p : []; } catch { raw = []; }
      const variants = normalizeVariantStock(raw);
      const selected = parseSelected(item);

      if (variants.length > 0) {
        const hit = selected ? variants.findIndex((v) => matchesSelection(v.attributes, selected)) : -1;
        if (hit < 0) {
          const label = selected ? Object.values(selected).join(" / ") : "sem variação escolhida";
          warnings.push(`"${product.name}" (${label}): variação não encontrada no cadastro — ${item.quantity} un. não ${sign < 0 ? "baixada(s)" : "reposta(s)"}`);
          continue;
        }
        if (sign < 0 && variants[hit].stock < item.quantity) {
          warnings.push(`"${product.name}" (${Object.values(selected!).join(" / ")}): VENDIDO SEM ESTOQUE — havia ${variants[hit].stock}, pedido de ${item.quantity}. Fale com o cliente (prazo maior ou estorno)`);
        }
        const updated = variants.map((v, i) =>
          i === hit ? { ...v, stock: Math.max(0, v.stock + sign * item.quantity) } : v
        );
        const newTotal = updated.reduce((sum, v) => sum + (v.stock || 0), 0);
        await tx.product.update({
          where: { id: item.productId },
          data: { variantStock: JSON.stringify(updated), stock: newTotal },
        });
      } else {
        if (sign < 0 && Number(product.stock) < item.quantity) {
          warnings.push(`"${product.name}": VENDIDO SEM ESTOQUE — havia ${Number(product.stock)}, pedido de ${item.quantity}. Fale com o cliente (prazo maior ou estorno)`);
        }
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: Math.max(0, Number(product.stock) + sign * item.quantity) },
        });
      }
    }
  });
  return warnings;
}

export async function decrementOrderStock(items: OrderItemLike[]): Promise<string[]> {
  return applyStockDelta(items, -1);
}

export async function restoreOrderStock(items: OrderItemLike[]): Promise<string[]> {
  return applyStockDelta(items, 1);
}

async function flagStockWarnings(orderId: string, action: string, warnings: string[]) {
  if (warnings.length === 0) return;
  console.warn(`[STOCK] ${action} incompleta no pedido ${orderId}:`, warnings);
  await prisma.order
    .update({
      where: { id: orderId },
      data: { opsAlert: `${action} de estoque incompleta — ajuste à mão: ${warnings.join("; ")}`.slice(0, 2000), opsAlertAt: new Date() },
    })
    .catch(() => {});
}

/**
 * Stock lifecycle of an order. Stock is taken once, when the payment is confirmed
 * (gateway webhook or admin confirming a WhatsApp order), and given back only if
 * it was taken. `Order.stockDecrementedAt` is the flag, claimed atomically, so
 * webhook retries, double clicks and cancel + refund paths can never apply twice.
 */
export async function commitOrderStock(orderId: string): Promise<void> {
  const claimed = await prisma.order.updateMany({
    where: { id: orderId, stockDecrementedAt: null },
    data: { stockDecrementedAt: new Date() },
  });
  if (claimed.count === 0) return;

  const items = await prisma.orderItem.findMany({ where: { orderId } });
  try {
    const warnings = await decrementOrderStock(items);
    await flagStockWarnings(orderId, "Baixa", warnings);
  } catch (err) {
    await prisma.order.update({ where: { id: orderId }, data: { stockDecrementedAt: null } }).catch(() => {});
    throw err;
  }
}

export async function releaseOrderStock(orderId: string): Promise<void> {
  const claimed = await prisma.order.updateMany({
    where: { id: orderId, stockDecrementedAt: { not: null } },
    data: { stockDecrementedAt: null },
  });
  if (claimed.count === 0) return;

  const [items, approvedReturns] = await Promise.all([
    prisma.orderItem.findMany({ where: { orderId } }),
    prisma.return.findMany({ where: { orderId, status: "APPROVED" }, select: { returnedItems: true } }),
  ]);

  // Items already put back by an approved return must not be restocked again
  // (e.g. a gateway refund/chargeback webhook cancelling the order afterwards).
  const alreadyReturned = new Map<string, number>();
  for (const r of approvedReturns) {
    let list: unknown = r.returnedItems;
    if (typeof list === "string") {
      try { list = JSON.parse(list); } catch { list = []; }
    }
    if (!Array.isArray(list)) continue;
    for (const ri of list as { itemId?: unknown; quantity?: unknown }[]) {
      if (typeof ri?.itemId === "string" && typeof ri.quantity === "number") {
        alreadyReturned.set(ri.itemId, (alreadyReturned.get(ri.itemId) ?? 0) + ri.quantity);
      }
    }
  }
  const toRestore = items
    .map((i) => ({ ...i, quantity: i.quantity - (alreadyReturned.get(i.id) ?? 0) }))
    .filter((i) => i.quantity > 0);

  try {
    if (toRestore.length > 0) await flagStockWarnings(orderId, "Reposição", await restoreOrderStock(toRestore));
  } catch (err) {
    await prisma.order.update({ where: { id: orderId }, data: { stockDecrementedAt: new Date() } }).catch(() => {});
    throw err;
  }
}

/**
 * Confere, antes de criar o pedido, se há estoque para cada peça (somando a mesma variação
 * pedida em mais de uma linha). Retorna a mensagem para o cliente, ou null se está tudo disponível.
 * A conferência final (com trava) acontece na baixa, quando o pagamento é confirmado.
 */
export function checkStockAvailability(
  items: OrderItemLike[],
  products: Map<string, { name: string; stock: number; variantStock: string | null }>
): string | null {
  const wanted = new Map<string, { product: { name: string; stock: number; variantStock: string | null }; productId: string; variantIndex: number; label: string; quantity: number }>();
  for (const item of items) {
    const product = products.get(item.productId);
    if (!product) return "Produto indisponível";
    let raw: unknown[] = [];
    try { const p = JSON.parse(product.variantStock || "[]"); raw = Array.isArray(p) ? p : []; } catch { raw = []; }
    const variants = normalizeVariantStock(raw);
    const selected = parseSelected(item);
    let variantIndex = -1;
    let label = "";
    if (variants.length > 0) {
      if (!selected) return `Escolha as opções de "${product.name}" antes de finalizar.`;
      variantIndex = variants.findIndex((v) => matchesSelection(v.attributes, selected));
      label = Object.values(selected).filter(Boolean).join(" / ");
      if (variantIndex < 0) return `A opção ${label} de "${product.name}" não está mais disponível. Remova do carrinho e escolha de novo.`;
    }
    const key = `${item.productId}#${variantIndex}`;
    const cur = wanted.get(key) ?? { product, productId: item.productId, variantIndex, label, quantity: 0 };
    cur.quantity += item.quantity;
    wanted.set(key, cur);
  }
  for (const w of wanted.values()) {
    let raw: unknown[] = [];
    try { const p = JSON.parse(w.product.variantStock || "[]"); raw = Array.isArray(p) ? p : []; } catch { raw = []; }
    const available = w.variantIndex >= 0 ? normalizeVariantStock(raw)[w.variantIndex].stock : w.product.stock;
    if (available < w.quantity) {
      const name = `"${w.product.name}"${w.label ? ` (${w.label})` : ""}`;
      return available <= 0
        ? `${name} esgotou. Remova do carrinho para continuar.`
        : `Só ${available === 1 ? "resta 1 unidade" : `restam ${available} unidades`} de ${name}. Ajuste a quantidade no carrinho.`;
    }
  }
  return null;
}
