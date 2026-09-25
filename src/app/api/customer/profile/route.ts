import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerFromCookie } from "@/lib/customerAuth";
import { sincronizarClienteComBling } from "@/lib/blingSync";

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
  const body = await req.json();
  const { name, phone, cpfCnpj, street, number, neighborhood, city, state, zipCode } = body;

  const customer = await prisma.customerUser.update({
    where: { id: payload.id },
    data: {
      name: name || undefined,
      phone: phone || null,
      cpfCnpj: cpfCnpj || null,
      street: street || null,
      number: number || null,
      neighborhood: neighborhood || null,
      city: city || null,
      state: state || null,
      zipCode: zipCode || null,
    },
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