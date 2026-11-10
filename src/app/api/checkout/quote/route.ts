import { NextRequest, NextResponse } from "next/server";
import { validateCheckout } from "@/lib/checkoutValidation";

// Server-side total for the cart, shipping option and Pix choice. The in-site
// payment form is initialised with this amount, the same one the payment is
// charged with (see /api/checkout/mercadopago/transparent).
export async function POST(req: NextRequest) {
  const { items, zipCode, shippingMethod, pixOnly } = await req.json().catch(() => ({}));
  const checked = await validateCheckout(req, { items, zipCode, shippingMethod, pixOnly: pixOnly === true });
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });

  const total = Math.round((checked.subtotal + checked.shippingCost - checked.discountAmount) * 100) / 100;
  return NextResponse.json({
    subtotal: checked.subtotal,
    shippingCost: checked.shippingCost,
    discountAmount: checked.discountAmount,
    total,
  });
}
