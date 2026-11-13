import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerFromCookie } from "@/lib/customerAuth";
import { sincronizarClienteComBling } from "@/lib/blingSync";
import { fieldFormatError, missingProfileFields, type ProfileField } from "@/lib/customerProfile";

export async function GET() {
  const payload = await getCustomerFromCookie();
  if (!payload) return NextResponse.json(null);

  const customer = await prisma.customerUser.findUnique({
    where: { id: payload.id },
    select: {
      id: true, email: true, name: true,
      phone: true, cpfCnpj: true, street: true, number: true,
      neighborhood: true, city: true, state: true, zipCode: true,
    },
  });
  return NextResponse.json(customer);
}

export async function PATCH(req: NextRequest) {
  console.log("[profile] ========== PATCH CHAMADO ==========");
  const payload = await getCustomerFromCookie();
  if (!payload) {
    console.warn("[profile] Usuário não autenticado");
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  console.log("[profile] Atualizando perfil do cliente:", payload.id);
  const body = await req.json().catch(() => ({}));
  const FIELDS = ["name", "phone", "cpfCnpj", "street", "number", "neighborhood", "city", "state", "zipCode"] as const;

  // Só atualiza o que veio no corpo: antes, campos ausentes (ex.: CPF, que a tela
  // "Minha conta" não envia) eram gravados como vazio e o dado se perdia.
  const incoming: Record<string, string | null> = {};
  for (const k of FIELDS) {
    if (body[k] === undefined) continue;
    const v = typeof body[k] === "string" ? body[k].trim() : "";
    incoming[k] = k === "state" ? v.toUpperCase() || null : v || null;
  }

  // Formato: valida o que mudou (dados antigos fora do padrão não travam outras edições).
  // Com requireComplete (tela "Completar cadastro"), valida tudo e exige todos os obrigatórios.
  const current = await prisma.customerUser.findUnique({ where: { id: payload.id } });
  const strict = body.requireComplete === true;
  const fieldErrors: Record<string, string> = {};
  for (const k of ["phone", "cpfCnpj", "zipCode", "state"] as ProfileField[]) {
    if (incoming[k] === undefined) continue;
    const changed = (incoming[k] ?? "") !== ((current as Record<string, unknown> | null)?.[k] ?? "");
    if (!strict && !changed) continue;
    const e = fieldFormatError(k, incoming[k] ?? null);
    if (e) fieldErrors[k] = e;
  }
  if (strict) {
    const merged = { ...current, ...incoming };
    for (const k of missingProfileFields(merged)) fieldErrors[k] = fieldErrors[k] || "Campo obrigatório";
  }
  if (incoming.name === null) fieldErrors.name = "Informe seu nome";
  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json({ error: "Confira os campos destacados", fields: fieldErrors }, { status: 400 });
  }

  const customer = await prisma.customerUser.update({
    where: { id: payload.id },
    data: incoming,
    select: {
      id: true, email: true, name: true,
      phone: true, cpfCnpj: true, street: true, number: true,
      neighborhood: true, city: true, state: true, zipCode: true,
    },
  });

  console.log("[profile] ✓ Perfil atualizado. Sincronizando com Bling...");
  console.log("[profile] Chamando sincronizarClienteComBling para ID:", payload.id);

  const syncPromise = sincronizarClienteComBling(payload.id);

  syncPromise
    .then((success) => {
      if (success) {
        console.log("[profile] ✓ Cliente sincronizado com Bling com sucesso!");
      } else {
        console.warn("[profile] ⚠ Falha ao sincronizar cliente com Bling (retornou false)");
      }
    })
    .catch((err) => {
      console.error("[profile] ❌ Erro ao sincronizar com Bling:", err);
    });

  console.log("[profile] Retornando resposta ao cliente (sync roda em background)");
  return NextResponse.json(customer);
}