import { NextRequest, NextResponse } from "next/server";
import { validateCheckout } from "@/lib/checkoutValidation";

// Server-side total for the cart, shipping option and Pix choice. The in-site
// payment form is initialised with this amount, the same one the payment is
// charged with (see /api/checkout/mercadopago/transparent).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { items, zipCode, shippingMethod, pixOnly, couponCode, customerEmail, cpfCnpj } = body;
  const checked = await validateCheckout(req, {
    items, zipCode, shippingMethod, pixOnly: pixOnly === true, couponCode, useCredit: body?.useCredit === true, customerEmail, cpfCnpj, mode: "quote",
  });
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });

  const total = Math.round((checked.subtotal + checked.shippingCost - checked.discountAmount) * 100) / 100;
  return NextResponse.json({
    subtotal: checked.subtotal,
    shippingCost: checked.shippingCost,
    discountAmount: checked.discountAmount,
    pixDiscount: checked.pixDiscount,
    couponDiscount: checked.couponDiscount,
    coupon: checked.coupon,
    couponMessage: checked.couponMessage,
    couponError: checked.couponError,
    creditDiscount: checked.creditDiscount,
    creditBalance: checked.creditBalance,
    creditNote: checked.creditNote,
    cashbackEarn: checked.cashbackEarn,
    cashbackPercent: checked.cashbackPercent,
    total,
  });
}
