/**
 * Cashback: parte de cada compra vira crédito na conta do cliente para as próximas compras.
 *
 * O saldo NÃO fica guardado num campo: é calculado a partir dos pedidos (que guardam quanto
 * geraram de cashback e quanto usaram de crédito) e dos ajustes manuais. Assim, cancelamentos,
 * Pix não pago e devoluções corrigem o saldo sozinhos, por qualquer caminho que aconteçam.
 *
 * Regras (configuráveis em Configurações → Cashback):
 *  - ganha `percent`% dos produtos pagos (após cupom, Pix e crédito usado; sem frete)
 *  - libera `releaseDays` dias após a entrega (fim do prazo de devolução), sem devolução em aberto
 *  - vale `validityDays` dias a partir da liberação
 *  - o uso consome primeiro o crédito que vence antes
 *  - devolução aprovada reduz o cashback do pedido na mesma proporção; pedido cancelado não gera nada
 */
import { prisma } from "@/lib/prisma";

const DAY = 86_400_000;
const r2 = (n: number) => Math.round(n * 100) / 100;

export interface CashbackSettings {
  enabled: boolean;
  percent: number;
  releaseDays: number;
  validityDays: number;
  maxUsePercent: number;
  minOrder: number;
  stackCoupon: boolean;
  stackPix: boolean;
}

export const CASHBACK_SETTINGS_SELECT = {
  cashbackEnabled: true, cashbackPercent: true, cashbackReleaseDays: true, cashbackValidityDays: true,
  cashbackMaxUsePercent: true, cashbackMinOrder: true, cashbackStackCoupon: true, cashbackStackPix: true,
} as const;

export function toCashbackSettings(s: Partial<Record<keyof typeof CASHBACK_SETTINGS_SELECT, unknown>> | null | undefined): CashbackSettings {
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  return {
    enabled: s?.cashbackEnabled === true,
    percent: Math.min(100, Math.max(0, num(s?.cashbackPercent, 5))),
    releaseDays: Math.max(0, Math.round(num(s?.cashbackReleaseDays, 7))),
    validityDays: Math.max(1, Math.round(num(s?.cashbackValidityDays, 90))),
    maxUsePercent: Math.min(100, Math.max(0, num(s?.cashbackMaxUsePercent, 50))),
    minOrder: Math.max(0, num(s?.cashbackMinOrder, 0)),
    stackCoupon: s?.cashbackStackCoupon === true,
    stackPix: s?.cashbackStackPix !== false,
  };
}

export async function getCashbackSettings(): Promise<CashbackSettings> {
  const s = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" }, select: CASHBACK_SETTINGS_SELECT }).catch(() => null);
  return toCashbackSettings(s);
}

/** Cashback que um pedido gera: % sobre os produtos efetivamente pagos (sem frete). */
export function cashbackFor(productsPaid: number, settings: CashbackSettings): number {
  if (!settings.enabled || settings.percent <= 0 || productsPaid <= 0) return 0;
  return r2((productsPaid * settings.percent) / 100);
}

// ───────────────────────── Cálculo do saldo ─────────────────────────

export interface LedgerOrder {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: Date;
  deliveredAt: Date | null;
  updatedAt: Date;
  total: number;
  cashbackEarned: number;
  creditUsed: number;
  returns: { status: string; refundAmount: number }[];
}

export interface LedgerAdjustment {
  id: string;
  amount: number;
  reason: string;
  createdAt: Date;
  expiresAt: Date | null;
}

export type EntryStatus = "pending" | "available" | "used" | "partial" | "expired" | "cancelled";

export interface LedgerEntry {
  id: string;
  kind: "earn" | "redeem" | "adjust";
  date: string;
  label: string;
  amount: number;
  /** Para créditos: quanto ainda pode ser usado */
  remaining?: number;
  status: EntryStatus;
  availableAt?: string | null;
  expiresAt?: string | null;
  orderId?: string;
}

export interface CreditSummary {
  available: number;
  pending: number;
  usedTotal: number;
  expiredTotal: number;
  nextExpiry: { amount: number; date: string } | null;
  nextRelease: { amount: number; date: string | null } | null;
  entries: LedgerEntry[];
}

const PAID = new Set(["CONFIRMED", "SHIPPED", "PRONTO_PARA_RETIRADA", "DELIVERED", "RETIRADO"]);
const DONE = new Set(["DELIVERED", "RETIRADO"]);
const OPEN_RETURN = new Set(["PENDING", "AWAITING_RETURN"]);
/** Pedido aguardando pagamento há mais que isso não reserva mais o crédito (Pix/boleto vencido). */
const STALE_PENDING_MS = DAY;

interface Chunk {
  key: string;
  amount: number;
  remaining: number;
  availableAt: number | null;
  expiresAt: number | null;
  entry: LedgerEntry;
}

/**
 * Calcula saldo e extrato. Função pura (recebe os dados já carregados) — fácil de testar.
 * `excludeOrderId`: ignora o uso de crédito de um pedido (ex.: recalcular o próprio pedido).
 */
export function computeCredit(
  orders: LedgerOrder[],
  adjustments: LedgerAdjustment[],
  settings: Pick<CashbackSettings, "releaseDays" | "validityDays">,
  now = Date.now(),
  excludeOrderId?: string
): CreditSummary {
  const chunks: Chunk[] = [];
  const spends: { at: number; amount: number; entry: LedgerEntry }[] = [];
  const entries: LedgerEntry[] = [];

  for (const o of orders) {
    const cancelled = o.status === "CANCELLED";
    const stale = o.status === "PENDING" && now - o.createdAt.getTime() > STALE_PENDING_MS;

    // Crédito ganho
    if (o.cashbackEarned > 0) {
      const refunded = o.returns.filter((r) => r.status === "APPROVED").reduce((s, r) => s + (r.refundAmount || 0), 0);
      const factor = o.total > 0 ? Math.max(0, 1 - refunded / o.total) : 0;
      const amount = r2(o.cashbackEarned * factor);
      const entry: LedgerEntry = {
        id: `earn-${o.id}`, kind: "earn", date: o.createdAt.toISOString(), orderId: o.id,
        label: `Cashback do pedido ${o.orderNumber}`, amount, status: "pending",
      };
      if (cancelled || stale || (!PAID.has(o.status) && o.status !== "PENDING")) {
        // Pedido não concluído: não gera crédito
        entry.status = "cancelled";
        entry.amount = r2(o.cashbackEarned);
        entries.push(entry);
      } else if (amount <= 0) {
        // Devolvido por inteiro
        entry.status = "cancelled";
        entry.label = `Cashback do pedido ${o.orderNumber} (devolvido)`;
        entries.push(entry);
      } else if (o.status === "PENDING") {
        // Ainda não pago: aparece como "a liberar" sem data
        entries.push(entry);
        chunks.push({ key: entry.id, amount, remaining: amount, availableAt: null, expiresAt: null, entry });
      } else {
        const hasOpenReturn = o.returns.some((r) => OPEN_RETURN.has(r.status));
        const deliveredAt = DONE.has(o.status) ? (o.deliveredAt ?? o.updatedAt).getTime() : null;
        const availableAt = deliveredAt != null && !hasOpenReturn ? deliveredAt + settings.releaseDays * DAY : null;
        const expiresAt = availableAt != null ? availableAt + settings.validityDays * DAY : null;
        entry.availableAt = availableAt ? new Date(availableAt).toISOString() : null;
        entry.expiresAt = expiresAt ? new Date(expiresAt).toISOString() : null;
        entries.push(entry);
        chunks.push({ key: entry.id, amount, remaining: amount, availableAt, expiresAt, entry });
      }
    }

    // Crédito usado
    if (o.creditUsed > 0 && o.id !== excludeOrderId) {
      const entry: LedgerEntry = {
        id: `redeem-${o.id}`, kind: "redeem", date: o.createdAt.toISOString(), orderId: o.id,
        label: `Usado no pedido ${o.orderNumber}`, amount: -r2(o.creditUsed),
        status: cancelled || stale ? "cancelled" : "used",
      };
      if (cancelled || stale) entry.label = `Devolvido: pedido ${o.orderNumber} não concluído`;
      entries.push(entry);
      if (!cancelled && !stale) spends.push({ at: o.createdAt.getTime(), amount: o.creditUsed, entry });
    }
  }

  for (const a of adjustments) {
    const at = a.createdAt.getTime();
    if (a.amount > 0) {
      const expiresAt = a.expiresAt ? a.expiresAt.getTime() : at + settings.validityDays * DAY;
      const entry: LedgerEntry = {
        id: `adj-${a.id}`, kind: "adjust", date: a.createdAt.toISOString(), label: a.reason || "Crédito da loja",
        amount: r2(a.amount), status: "available", availableAt: a.createdAt.toISOString(), expiresAt: new Date(expiresAt).toISOString(),
      };
      entries.push(entry);
      chunks.push({ key: entry.id, amount: a.amount, remaining: a.amount, availableAt: at, expiresAt, entry });
    } else if (a.amount < 0) {
      const entry: LedgerEntry = { id: `adj-${a.id}`, kind: "adjust", date: a.createdAt.toISOString(), label: a.reason || "Ajuste da loja", amount: r2(a.amount), status: "used" };
      entries.push(entry);
      spends.push({ at, amount: -a.amount, entry });
    }
  }

  // Consome em ordem cronológica, sempre do crédito que vence primeiro
  spends.sort((a, b) => a.at - b.at);
  for (const sp of spends) {
    let need = sp.amount;
    const usable = chunks
      .filter((c) => c.remaining > 0 && c.availableAt != null && c.availableAt <= sp.at && (c.expiresAt == null || c.expiresAt > sp.at))
      .sort((a, b) => (a.expiresAt ?? Infinity) - (b.expiresAt ?? Infinity));
    for (const c of usable) {
      if (need <= 0) break;
      const take = Math.min(c.remaining, need);
      c.remaining = r2(c.remaining - take);
      need = r2(need - take);
    }
  }

  let available = 0, pending = 0, expiredTotal = 0;
  let nextExpiry: CreditSummary["nextExpiry"] = null;
  let nextRelease: CreditSummary["nextRelease"] = null;
  for (const c of chunks) {
    const e = c.entry;
    e.remaining = c.remaining;
    if (c.availableAt == null || c.availableAt > now) {
      pending += c.remaining;
      e.status = "pending";
      const when = c.availableAt;
      if (!nextRelease || (when != null && (nextRelease.date == null || when < new Date(nextRelease.date).getTime()))) {
        nextRelease = { amount: r2(c.remaining), date: when != null ? new Date(when).toISOString() : null };
      }
    } else if (c.expiresAt != null && c.expiresAt <= now) {
      expiredTotal += c.remaining;
      e.status = c.remaining <= 0 ? "used" : "expired";
    } else {
      available += c.remaining;
      e.status = c.remaining <= 0 ? "used" : c.remaining < c.amount ? "partial" : "available";
      if (c.remaining > 0 && c.expiresAt != null && (!nextExpiry || c.expiresAt < new Date(nextExpiry.date).getTime())) {
        nextExpiry = { amount: r2(c.remaining), date: new Date(c.expiresAt).toISOString() };
      }
    }
  }
  const usedTotal = spends.reduce((s, x) => s + x.amount, 0);

  entries.sort((a, b) => b.date.localeCompare(a.date));
  return {
    available: r2(Math.max(0, available)),
    pending: r2(pending),
    usedTotal: r2(usedTotal),
    expiredTotal: r2(expiredTotal),
    nextExpiry,
    nextRelease,
    entries,
  };
}

const LEDGER_ORDER_SELECT = {
  id: true, orderNumber: true, status: true, createdAt: true, deliveredAt: true, updatedAt: true, total: true,
  cashbackEarned: true, creditUsed: true, returns: { select: { status: true, refundAmount: true } },
} as const;

/** Saldo e extrato de um cliente. */
export async function getCustomerCredit(customerId: string, opts: { excludeOrderId?: string; settings?: CashbackSettings } = {}): Promise<CreditSummary> {
  const settings = opts.settings ?? (await getCashbackSettings());
  const [orders, adjustments] = await Promise.all([
    prisma.order.findMany({
      where: { customerId, OR: [{ cashbackEarned: { gt: 0 } }, { creditUsed: { gt: 0 } }] },
      select: LEDGER_ORDER_SELECT,
      orderBy: { createdAt: "asc" },
      take: 500,
    }),
    prisma.creditAdjustment.findMany({ where: { customerId }, orderBy: { createdAt: "asc" }, take: 500 }),
  ]);
  return computeCredit(orders, adjustments, settings, Date.now(), opts.excludeOrderId);
}

// ───────────────────────── Uso no checkout ─────────────────────────

export interface CreditUse {
  amount: number;
  /** Por que não usou tudo / nada (para mostrar no checkout) */
  note: string | null;
  balance: number;
}

/**
 * Quanto do crédito pode ser usado neste pedido.
 * `productsAfterDiscounts` = produtos − cupom (parte de produtos) − desconto Pix. Frete nunca é pago com crédito.
 */
export function creditUsable(
  balance: number,
  productsAfterDiscounts: number,
  subtotal: number,
  settings: CashbackSettings,
  ctx: { hasCoupon: boolean; hasPix: boolean }
): CreditUse {
  if (balance <= 0) return { amount: 0, note: null, balance };
  if (ctx.hasCoupon && !settings.stackCoupon) return { amount: 0, note: "O crédito não pode ser usado junto com cupom.", balance };
  if (ctx.hasPix && !settings.stackPix) return { amount: 0, note: "O crédito não pode ser usado junto com o desconto do Pix.", balance };
  if (settings.minOrder > 0 && subtotal < settings.minOrder) {
    return { amount: 0, note: `O crédito vale em compras a partir de R$ ${settings.minOrder.toFixed(2).replace(".", ",")} em produtos.`, balance };
  }
  const cap = r2((Math.max(0, productsAfterDiscounts) * settings.maxUsePercent) / 100);
  const amount = r2(Math.min(balance, cap));
  const note = amount < balance && settings.maxUsePercent < 100 ? `O crédito paga até ${settings.maxUsePercent.toLocaleString("pt-BR")}% dos produtos deste pedido.` : null;
  return { amount, note, balance };
}

// ───────────────────────── Avisos por e-mail (rotina) ─────────────────────────

/**
 * Rotina: avisa quem teve cashback liberado e quem tem crédito vencendo em até 7 dias.
 * Cada pedido avisa uma vez de cada tipo (marcado no próprio pedido).
 */
export async function processCashbackNotifications(): Promise<{ released: number; expiring: number }> {
  const settings = await getCashbackSettings();
  if (!settings.enabled) return { released: 0, expiring: 0 };
  const { sendCashbackReleasedEmail, sendCashbackExpiringEmail } = await import("@/lib/email");
  const { siteUrl } = await import("@/lib/site");
  const store = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" }, select: { name: true } });
  const storeName = store?.name || "Loja";
  const horizon = new Date(Date.now() - (settings.releaseDays + settings.validityDays + 60) * DAY);

  const candidates = await prisma.order.findMany({
    where: {
      customerId: { not: null },
      cashbackEarned: { gt: 0 },
      status: { in: ["DELIVERED", "RETIRADO"] },
      createdAt: { gte: horizon },
      OR: [{ cashbackReleaseEmailAt: null }, { cashbackExpiryEmailAt: null }],
    },
    select: { customerId: true },
    distinct: ["customerId"],
    take: 200,
  });

  let released = 0, expiring = 0;
  const now = Date.now();
  for (const { customerId } of candidates) {
    if (!customerId) continue;
    const customer = await prisma.customerUser.findUnique({ where: { id: customerId }, select: { email: true, name: true } });
    if (!customer?.email) continue;
    const credit = await getCustomerCredit(customerId, { settings });
    const flags = await prisma.order.findMany({
      where: { customerId, cashbackEarned: { gt: 0 } },
      select: { id: true, cashbackReleaseEmailAt: true, cashbackExpiryEmailAt: true },
    });
    const flagOf = new Map(flags.map((f) => [f.id, f]));
    const earns = credit.entries.filter((e) => e.kind === "earn" && e.orderId);

    // Liberados que ainda não foram avisados (só os recentes, para não avisar créditos antigos ao ligar o programa)
    const newlyReleased = earns.filter((e) => {
      const f = flagOf.get(e.orderId!);
      return (e.status === "available" || e.status === "partial") && f && !f.cashbackReleaseEmailAt && e.availableAt && now - Date.parse(e.availableAt) < 3 * DAY;
    });
    if (newlyReleased.length && credit.available > 0) {
      const sum = r2(newlyReleased.reduce((s, e) => s + (e.remaining ?? e.amount), 0));
      try {
        await sendCashbackReleasedEmail({
          to: customer.email, customerName: customer.name, storeName, released: sum, available: credit.available,
          expiresAt: credit.nextExpiry?.date ?? null, shopUrl: `${siteUrl()}/produtos`,
        });
        released++;
      } catch (e) { console.error("[CASHBACK] e-mail de liberação falhou:", e); }
    }
    // Marca todos os já liberados (avisados agora ou antigos demais para avisar)
    const releasedIds = earns.filter((e) => e.status !== "pending" && !flagOf.get(e.orderId!)?.cashbackReleaseEmailAt).map((e) => e.orderId!);
    if (releasedIds.length) await prisma.order.updateMany({ where: { id: { in: releasedIds } }, data: { cashbackReleaseEmailAt: new Date() } });

    // Vencendo em até 7 dias
    const soon = earns.filter((e) => {
      const f = flagOf.get(e.orderId!);
      return (e.status === "available" || e.status === "partial") && (e.remaining ?? 0) > 0 && f && !f.cashbackExpiryEmailAt && e.expiresAt && Date.parse(e.expiresAt) - now < 7 * DAY;
    });
    if (soon.length) {
      const amount = r2(soon.reduce((s, e) => s + (e.remaining ?? 0), 0));
      const first = soon.map((e) => e.expiresAt!).sort()[0];
      try {
        await sendCashbackExpiringEmail({ to: customer.email, customerName: customer.name, storeName, amount, expiresAt: first, shopUrl: `${siteUrl()}/produtos` });
        expiring++;
      } catch (e) { console.error("[CASHBACK] e-mail de vencimento falhou:", e); }
      await prisma.order.updateMany({ where: { id: { in: soon.map((e) => e.orderId!) } }, data: { cashbackExpiryEmailAt: new Date() } });
    }
  }
  return { released, expiring };
}

// ───────────────────────── Visão geral (BI) ─────────────────────────

export interface CashbackOverview {
  enabled: boolean;
  percent: number;
  /** Cashback gerado por pedidos pagos no período */
  earned: number;
  /** Crédito usado como desconto em pedidos pagos no período */
  used: number;
  /** Saldo disponível hoje somando todos os clientes (a loja "deve" isso em descontos futuros) */
  available: number;
  /** A liberar (pedidos ainda no prazo de entrega/devolução) */
  pending: number;
  customersWithBalance: number;
  /** Dos clientes que ganharam cashback, quantos já voltaram e usaram */
  customersEarned: number;
  customersRedeemed: number;
}

/** Totais do programa de cashback (período para ganho/uso; saldo em aberto é de hoje). */
export async function getCashbackOverview(start: Date, end: Date): Promise<CashbackOverview> {
  const settings = await getCashbackSettings();
  const paidIn = { status: { in: [...PAID] }, createdAt: { gte: start, lte: end } };
  const [agg, orders, adjustments] = await Promise.all([
    prisma.order.aggregate({ where: paidIn, _sum: { cashbackEarned: true, creditUsed: true } }),
    prisma.order.findMany({
      where: { customerId: { not: null }, OR: [{ cashbackEarned: { gt: 0 } }, { creditUsed: { gt: 0 } }] },
      select: { ...LEDGER_ORDER_SELECT, customerId: true },
      orderBy: { createdAt: "asc" },
      take: 20000,
    }),
    prisma.creditAdjustment.findMany({ orderBy: { createdAt: "asc" }, take: 20000 }),
  ]);
  const byCustomer = new Map<string, { orders: LedgerOrder[]; adj: LedgerAdjustment[] }>();
  for (const o of orders) {
    const g = byCustomer.get(o.customerId!) ?? { orders: [], adj: [] };
    g.orders.push(o);
    byCustomer.set(o.customerId!, g);
  }
  for (const a of adjustments) {
    const g = byCustomer.get(a.customerId) ?? { orders: [], adj: [] };
    g.adj.push(a);
    byCustomer.set(a.customerId, g);
  }
  let available = 0, pending = 0, withBalance = 0, earnedCustomers = 0, redeemedCustomers = 0;
  for (const g of byCustomer.values()) {
    const c = computeCredit(g.orders, g.adj, settings);
    available += c.available;
    pending += c.pending;
    if (c.available > 0) withBalance++;
    if (g.orders.some((o) => o.cashbackEarned > 0 && PAID.has(o.status))) earnedCustomers++;
    if (g.orders.some((o) => o.creditUsed > 0 && PAID.has(o.status))) redeemedCustomers++;
  }
  return {
    enabled: settings.enabled,
    percent: settings.percent,
    earned: r2(agg._sum.cashbackEarned ?? 0),
    used: r2(agg._sum.creditUsed ?? 0),
    available: r2(available),
    pending: r2(pending),
    customersWithBalance: withBalance,
    customersEarned: earnedCustomers,
    customersRedeemed: redeemedCustomers,
  };
}
