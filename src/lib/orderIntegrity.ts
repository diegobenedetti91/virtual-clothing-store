/**
 * Conferências depois do pagamento confirmado — só ALERTAM (nunca bloqueiam nem alteram o pedido).
 *
 * O checkout valida cashback e cupom na hora do pedido, mas duas compras do mesmo cliente no
 * mesmo instante (duas abas) podem passar juntas pela validação. Aqui, com o pedido já pago,
 * confere se o crédito usado passou do saldo ou se o cupom passou do limite, e avisa o dono.
 */
import { prisma } from "@/lib/prisma";
import { getCustomerCredit } from "@/lib/cashback";
import { couponOveruse } from "@/lib/coupons";

export async function checkOrderBenefits(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, orderNumber: true, customerId: true, customerEmail: true, cpfCnpj: true, couponCode: true, creditUsed: true, createdAt: true, opsAlert: true },
  });
  if (!order) return;
  const issues: string[] = [];

  if ((order.creditUsed || 0) > 0 && order.customerId) {
    // Saldo do cliente sem contar este pedido: o crédito usado aqui cabia nele?
    const credit = await getCustomerCredit(order.customerId, { excludeOrderId: order.id });
    const over = Math.round(((order.creditUsed || 0) - credit.available) * 100) / 100;
    if (over > 0.01) {
      issues.push(`Cashback usado além do saldo: R$ ${over.toFixed(2)} a mais (provável compra simultânea em outra aba). O desconto já foi concedido neste pedido.`);
    }
  }
  if (order.couponCode) {
    const coupon = await couponOveruse(order);
    if (coupon) issues.push(`${coupon} Provável compra simultânea — o desconto já foi concedido neste pedido.`);
  }
  if (!issues.length) return;

  const msg = issues.join(" ");
  await prisma.order
    .update({
      where: { id: order.id },
      // Mantém uma ocorrência que já exista (ex.: falha de estoque)
      data: { opsAlert: (order.opsAlert ? `${order.opsAlert}\n${msg}` : msg).slice(0, 2000), opsAlertAt: new Date() },
    })
    .catch(() => {});
}
