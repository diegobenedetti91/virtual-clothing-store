import { NextResponse } from "next/server";
import { getCustomerFromCookie } from "@/lib/customerAuth";
import { getCashbackSettings, getCustomerCredit } from "@/lib/cashback";

/** Saldo de cashback, valores a liberar, vencimentos e extrato do cliente logado. */
export async function GET() {
  const payload = await getCustomerFromCookie();
  if (!payload) return NextResponse.json({ error: "Faça login" }, { status: 401 });
  const settings = await getCashbackSettings();
  const credit = await getCustomerCredit(payload.id, { settings });
  return NextResponse.json(
    {
      program: settings.enabled
        ? { percent: settings.percent, releaseDays: settings.releaseDays, validityDays: settings.validityDays, maxUsePercent: settings.maxUsePercent, minOrder: settings.minOrder }
        : null,
      ...credit,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
