import * as fs from "fs";
import * as path from "path";

// Load .env.local if DATABASE_URL not already set (Prisma only reads .env by default)
if (!process.env.DATABASE_URL) {
  const envLocal = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envLocal)) {
    for (const line of fs.readFileSync(envLocal, "utf8").split("\n")) {
      const m = line.match(/^([A-Z_]+)="?([^"]+)"?/);
      if (m) process.env[m[1]] = m[2];
    }
  }
}

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const IMGS = [
  "/uploads/1778357037125-8hdo42.jpeg",
  "/uploads/1778357046994-4hc6yv.jpeg",
  "/uploads/1778357064916-fgw8w2.jpeg",
  "/uploads/1778357618113-fxuwtq.jpeg",
  "/uploads/1778357633415-ieilji.jpeg",
  "/uploads/1778357635813-4zulgc.jpeg",
  "/uploads/1778357638595-vyt80x.jpeg",
  "/uploads/1778359344383-pfpdpn.jpeg",
  "/uploads/1778371535317-teznmy.jpeg",
  "/uploads/1778373912988-odeb3x.jpeg",
  "/uploads/1778377822398-hulofd.jpeg",
  "/uploads/1778377828659-ocewf2.jpeg",
  "/uploads/1778377973993-det959.jpeg",
];

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function variants(
  attrDefs: Array<{ name: string; values: string[] }>,
  defaultStock = 10
): string {
  const combos: Array<{ attributes: Record<string, string>; stock: number }> = [];
  const recurse = (idx: number, current: Record<string, string>) => {
    if (idx === attrDefs.length) {
      combos.push({ attributes: { ...current }, stock: defaultStock });
      return;
    }
    for (const val of attrDefs[idx].values) {
      recurse(idx + 1, { ...current, [attrDefs[idx].name]: val });
    }
  };
  recurse(0, {});
  return JSON.stringify(combos);
}

function totalStock(attrDefs: Array<{ name: string; values: string[] }>, defaultStock = 10) {
  return attrDefs.reduce((acc, a) => acc * a.values.length, 1) * defaultStock;
}

async function main() {
  console.log("🌱 Populando dados de demonstração...");

  // ── Admin ──────────────────────────────────────────────────────────────────
  const existing = await prisma.adminUser.findFirst();
  if (!existing) {
    const hashed = await bcrypt.hash("demo1234", 10);
    await prisma.adminUser.create({
      data: { email: "admin@demo.com", password: hashed, name: "Ariane" },
    });
  }

  // ── Company settings ───────────────────────────────────────────────────────
  await prisma.companySettings.deleteMany();
  await prisma.companySettings.create({
    data: {
      name: "Ariane Modas",
      primaryColor: "#ec4899",
      buttonColor: "#ec4899",
      menuColor: "#ec4899",
      whatsapp: "(11) 99987-6543",
      instagram: "@arianemodas",
      description: "Moda feminina com estilo, qualidade e preço justo.",
      heroBadge: "Nova Coleção Inverno 2025",
      heroTitle: "Moda que combina com você",
      heroButtonText: "Ver Coleção",
      heroButtonSecondaryText: "Ver Novidades",
      checkoutType: "whatsapp",
      checkoutCollectAddress: true,
      checkoutMessage: "Olá! Gostaria de finalizar meu pedido. Segue abaixo os itens escolhidos:",
      bannerImages: "[]",
    },
  });

  // ── Categories ─────────────────────────────────────────────────────────────
  await prisma.category.deleteMany();
  const categoryData = [
    { name: "Vestidos", slug: "vestidos" },
    { name: "Blusas", slug: "blusas" },
    { name: "Calças", slug: "calcas" },
    { name: "Saias", slug: "saias" },
    { name: "Conjuntos", slug: "conjuntos" },
  ];
  const categories: Record<string, string> = {};
  for (const c of categoryData) {
    const created = await prisma.category.create({ data: { ...c, active: true } });
    categories[c.slug] = created.id;
  }

  // ── Products ───────────────────────────────────────────────────────────────
  await prisma.product.deleteMany();

  const tamanhosPMG = [{ name: "Tamanho", values: ["P", "M", "G"] }];
  const tamanhosPMGGG = [{ name: "Tamanho", values: ["P", "M", "G", "GG"] }];
  const tamanhos3638 = [{ name: "Tamanho", values: ["36", "38", "40", "42"] }];
  const tamanhosPMG3 = [{ name: "Tamanho", values: ["P", "M", "G"] }];

  const tamanhosCores = (sizes: string[], colors: string[]) => [
    { name: "Tamanho", values: sizes },
    { name: "Cor", values: colors },
  ];

  const productsData = [
    {
      name: "Vestido Floral Midi",
      slug: "vestido-floral-midi",
      description:
        "Vestido midi com estampa floral delicada, tecido leve e fluído ideal para o dia a dia. Cós elástico e decote em V.",
      price: 189.9,
      comparePrice: 249.9,
      costPrice: 85,
      categoryId: categories["vestidos"],
      images: JSON.stringify([IMGS[0], IMGS[1]]),
      attributes: JSON.stringify(tamanhosCores(["P", "M", "G"], ["Rosa", "Azul Floral"])),
      variantStock: variants(tamanhosCores(["P", "M", "G"], ["Rosa", "Azul Floral"]), 8),
      stock: totalStock(tamanhosCores(["P", "M", "G"], ["Rosa", "Azul Floral"]), 8),
      sizes: "[]",
      colors: "[]",
      featured: true,
    },
    {
      name: "Vestido Envelope Crepe",
      slug: "vestido-envelope-crepe",
      description:
        "Vestido envelope em crepe de malha. Elegante e versátil, ideal para eventos e ocasiões especiais.",
      price: 219.9,
      comparePrice: null,
      costPrice: 95,
      categoryId: categories["vestidos"],
      images: JSON.stringify([IMGS[2]]),
      attributes: JSON.stringify(tamanhosCores(["P", "M", "G", "GG"], ["Preto", "Vinho"])),
      variantStock: variants(tamanhosCores(["P", "M", "G", "GG"], ["Preto", "Vinho"]), 6),
      stock: totalStock(tamanhosCores(["P", "M", "G", "GG"], ["Preto", "Vinho"]), 6),
      sizes: "[]",
      colors: "[]",
      featured: true,
    },
    {
      name: "Blusa Cropped Tricô",
      slug: "blusa-cropped-trico",
      description:
        "Blusa cropped em tricô leve, modelagem moderna. Combina perfeitamente com calças e saias.",
      price: 79.9,
      comparePrice: 99.9,
      costPrice: 32,
      categoryId: categories["blusas"],
      images: JSON.stringify([IMGS[3]]),
      attributes: JSON.stringify(tamanhosCores(["P", "M", "G"], ["Off White", "Bege", "Rosa"])),
      variantStock: variants(tamanhosCores(["P", "M", "G"], ["Off White", "Bege", "Rosa"]), 12),
      stock: totalStock(tamanhosCores(["P", "M", "G"], ["Off White", "Bege", "Rosa"]), 12),
      sizes: "[]",
      colors: "[]",
      featured: false,
    },
    {
      name: "Blusa Linho Premium",
      slug: "blusa-linho-premium",
      description:
        "Blusa em linho de alta qualidade, caimento impecável. Tecido respirável perfeito para o calor.",
      price: 89.9,
      comparePrice: null,
      costPrice: 38,
      categoryId: categories["blusas"],
      images: JSON.stringify([IMGS[4]]),
      attributes: JSON.stringify(tamanhosCores(["P", "M", "G", "GG"], ["Branco", "Azul Marinho"])),
      variantStock: variants(tamanhosCores(["P", "M", "G", "GG"], ["Branco", "Azul Marinho"]), 10),
      stock: totalStock(tamanhosCores(["P", "M", "G", "GG"], ["Branco", "Azul Marinho"]), 10),
      sizes: "[]",
      colors: "[]",
      featured: true,
    },
    {
      name: "Calça Wide Leg Jeans",
      slug: "calca-wide-leg-jeans",
      description:
        "Calça wide leg em jeans premium com leve elastano. Modelagem moderna e confortável para o dia a dia.",
      price: 159.9,
      comparePrice: 199.9,
      costPrice: 70,
      categoryId: categories["calcas"],
      images: JSON.stringify([IMGS[5]]),
      attributes: JSON.stringify(tamanhosCores(["36", "38", "40", "42"], ["Azul Claro", "Azul Escuro"])),
      variantStock: variants(tamanhosCores(["36", "38", "40", "42"], ["Azul Claro", "Azul Escuro"]), 7),
      stock: totalStock(tamanhosCores(["36", "38", "40", "42"], ["Azul Claro", "Azul Escuro"]), 7),
      sizes: "[]",
      colors: "[]",
      featured: false,
    },
    {
      name: "Calça Alfaiataria Cintura Alta",
      slug: "calca-alfaiataria-cintura-alta",
      description:
        "Calça alfaiataria de cintura alta com caimento elegante. Perfeita para o trabalho ou ocasiões mais formais.",
      price: 179.9,
      comparePrice: null,
      costPrice: 78,
      categoryId: categories["calcas"],
      images: JSON.stringify([IMGS[6]]),
      attributes: JSON.stringify(tamanhosCores(["36", "38", "40", "42"], ["Preto", "Caramelo"])),
      variantStock: variants(tamanhosCores(["36", "38", "40", "42"], ["Preto", "Caramelo"]), 8),
      stock: totalStock(tamanhosCores(["36", "38", "40", "42"], ["Preto", "Caramelo"]), 8),
      sizes: "[]",
      colors: "[]",
      featured: true,
    },
    {
      name: "Saia Midi Plissada",
      slug: "saia-midi-plissada",
      description:
        "Saia midi plissada em tecido fluído com elástico na cintura. Elegante e confortável para qualquer ocasião.",
      price: 119.9,
      comparePrice: 149.9,
      costPrice: 48,
      categoryId: categories["saias"],
      images: JSON.stringify([IMGS[7]]),
      attributes: JSON.stringify(tamanhosCores(["P", "M", "G"], ["Rosa", "Verde Sage", "Preto"])),
      variantStock: variants(tamanhosCores(["P", "M", "G"], ["Rosa", "Verde Sage", "Preto"]), 10),
      stock: totalStock(tamanhosCores(["P", "M", "G"], ["Rosa", "Verde Sage", "Preto"]), 10),
      sizes: "[]",
      colors: "[]",
      featured: false,
    },
    {
      name: "Saia Mini Jeans Destroyed",
      slug: "saia-mini-jeans-destroyed",
      description:
        "Saia mini em jeans com detalhes destroyed na barra. Estilo descolado e moderno para o dia a dia.",
      price: 99.9,
      comparePrice: null,
      costPrice: 38,
      categoryId: categories["saias"],
      images: JSON.stringify([IMGS[8]]),
      attributes: JSON.stringify([{ name: "Tamanho", values: ["36", "38", "40"] }]),
      variantStock: variants([{ name: "Tamanho", values: ["36", "38", "40"] }], 9),
      stock: totalStock([{ name: "Tamanho", values: ["36", "38", "40"] }], 9),
      sizes: "[]",
      colors: "[]",
      featured: false,
    },
    {
      name: "Conjunto Linho Coordenado",
      slug: "conjunto-linho-coordenado",
      description:
        "Conjunto coordenado em linho premium com blusa de alças e calça pantalona. Sofisticado e leve para dias quentes.",
      price: 249.9,
      comparePrice: 299.9,
      costPrice: 110,
      categoryId: categories["conjuntos"],
      images: JSON.stringify([IMGS[9], IMGS[10]]),
      attributes: JSON.stringify(tamanhosCores(["P", "M", "G"], ["Off White", "Terracota"])),
      variantStock: variants(tamanhosCores(["P", "M", "G"], ["Off White", "Terracota"]), 8),
      stock: totalStock(tamanhosCores(["P", "M", "G"], ["Off White", "Terracota"]), 8),
      sizes: "[]",
      colors: "[]",
      featured: true,
    },
    {
      name: "Vestido Ombro a Ombro",
      slug: "vestido-ombro-a-ombro",
      description:
        "Vestido ombro a ombro com amarração frontal. Tecido macio e caimento impecável para passeios e encontros.",
      price: 169.9,
      comparePrice: null,
      costPrice: 72,
      categoryId: categories["vestidos"],
      images: JSON.stringify([IMGS[11]]),
      attributes: JSON.stringify(tamanhosCores(["P", "M", "G"], ["Preto", "Branco"])),
      variantStock: variants(tamanhosCores(["P", "M", "G"], ["Preto", "Branco"]), 7),
      stock: totalStock(tamanhosCores(["P", "M", "G"], ["Preto", "Branco"]), 7),
      sizes: "[]",
      colors: "[]",
      featured: false,
    },
    {
      name: "Blusa Modal Decote V",
      slug: "blusa-modal-decote-v",
      description:
        "Blusa em modal macio com decote V. Super confortável e versátil, combina com qualquer look.",
      price: 69.9,
      comparePrice: 89.9,
      costPrice: 28,
      categoryId: categories["blusas"],
      images: JSON.stringify([IMGS[12]]),
      attributes: JSON.stringify(tamanhosCores(["P", "M", "G", "GG"], ["Preto", "Branco", "Cinza", "Rosa"])),
      variantStock: variants(tamanhosCores(["P", "M", "G", "GG"], ["Preto", "Branco", "Cinza", "Rosa"]), 15),
      stock: totalStock(tamanhosCores(["P", "M", "G", "GG"], ["Preto", "Branco", "Cinza", "Rosa"]), 15),
      sizes: "[]",
      colors: "[]",
      featured: false,
    },
    {
      name: "Calça Jogger Moletom",
      slug: "calca-jogger-moletom",
      description:
        "Calça jogger em moletom premium com elástico na cintura e punhos. Conforto máximo sem abrir mão do estilo.",
      price: 139.9,
      comparePrice: null,
      costPrice: 58,
      categoryId: categories["calcas"],
      images: JSON.stringify([IMGS[0]]),
      attributes: JSON.stringify(tamanhosCores(["P", "M", "G"], ["Cinza Mescla", "Preto"])),
      variantStock: variants(tamanhosCores(["P", "M", "G"], ["Cinza Mescla", "Preto"]), 12),
      stock: totalStock(tamanhosCores(["P", "M", "G"], ["Cinza Mescla", "Preto"]), 12),
      sizes: "[]",
      colors: "[]",
      featured: false,
    },
    {
      name: "Saia Longa Estampada",
      slug: "saia-longa-estampada",
      description:
        "Saia longa com estampa exclusiva e fenda lateral. Elástico na cintura e caimento leve e fluído.",
      price: 129.9,
      comparePrice: 159.9,
      costPrice: 55,
      categoryId: categories["saias"],
      images: JSON.stringify([IMGS[1]]),
      attributes: JSON.stringify(tamanhosPMG),
      variantStock: variants(tamanhosPMG, 8),
      stock: totalStock(tamanhosPMG, 8),
      sizes: "[]",
      colors: "[]",
      featured: false,
    },
  ];

  const products: Record<string, string> = {};
  for (const p of productsData) {
    const created = await prisma.product.create({ data: { ...p, active: true } });
    products[p.slug] = created.id;
  }

  // ── Customers ──────────────────────────────────────────────────────────────
  await prisma.customerUser.deleteMany();
  const hashedPw = await bcrypt.hash("senha123", 10);
  const customersData = [
    {
      name: "Ana Paula Ferreira",
      email: "ana@email.com",
      city: "São Paulo",
      state: "SP",
      street: "Rua das Flores",
      number: "123",
      neighborhood: "Jardim Primavera",
      zipCode: "01310-100",
    },
    {
      name: "Beatriz Oliveira",
      email: "bia@email.com",
      city: "Rio de Janeiro",
      state: "RJ",
      street: "Av. Atlântica",
      number: "500",
      neighborhood: "Copacabana",
      zipCode: "22021-001",
    },
    {
      name: "Camila Santos",
      email: "camila@email.com",
      city: "Belo Horizonte",
      state: "MG",
      street: "Rua da Bahia",
      number: "1148",
      neighborhood: "Centro",
      zipCode: "30160-011",
    },
    {
      name: "Daniela Costa",
      email: "dani@email.com",
      city: "São Paulo",
      state: "SP",
      street: "Al. Santos",
      number: "200",
      neighborhood: "Cerqueira César",
      zipCode: "01419-000",
    },
    {
      name: "Fernanda Lima",
      email: "fern@email.com",
      city: "Curitiba",
      state: "PR",
      street: "Rua XV de Novembro",
      number: "822",
      neighborhood: "Centro",
      zipCode: "80020-310",
    },
  ];
  const customers: Record<string, { id: string; name: string; email: string; city: string; state: string; street: string; number: string; neighborhood: string; zipCode: string }> = {};
  for (const c of customersData) {
    const created = await prisma.customerUser.create({
      data: { ...c, password: hashedPw },
    });
    customers[c.email] = { ...c, id: created.id };
  }

  // ── Orders ─────────────────────────────────────────────────────────────────
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();

  const ordersData = [
    // DELIVERED
    {
      orderNumber: "#0001",
      customer: customers["ana@email.com"],
      status: "DELIVERED",
      createdAt: daysAgo(45),
      items: [{ slug: "vestido-floral-midi", qty: 1, size: "P", color: "Rosa", price: 189.9 }],
      trackingCode: "BR123456789BR",
    },
    {
      orderNumber: "#0002",
      customer: customers["bia@email.com"],
      status: "DELIVERED",
      createdAt: daysAgo(42),
      items: [{ slug: "vestido-envelope-crepe", qty: 1, size: "G", color: "Preto", price: 219.9 }],
      trackingCode: "BR234567890BR",
    },
    {
      orderNumber: "#0003",
      customer: customers["camila@email.com"],
      status: "DELIVERED",
      createdAt: daysAgo(38),
      items: [
        { slug: "blusa-linho-premium", qty: 1, size: "P", color: "Branco", price: 89.9 },
        { slug: "saia-midi-plissada", qty: 1, size: "P", color: "Rosa", price: 119.9 },
      ],
      trackingCode: "BR345678901BR",
    },
    {
      orderNumber: "#0004",
      customer: customers["dani@email.com"],
      status: "DELIVERED",
      createdAt: daysAgo(35),
      items: [{ slug: "conjunto-linho-coordenado", qty: 1, size: "M", color: "Off White", price: 249.9 }],
      trackingCode: "BR456789012BR",
    },
    {
      orderNumber: "#0005",
      customer: customers["fern@email.com"],
      status: "DELIVERED",
      createdAt: daysAgo(30),
      items: [
        { slug: "calca-wide-leg-jeans", qty: 1, size: "38", color: "Azul Escuro", price: 159.9 },
        { slug: "blusa-cropped-trico", qty: 1, size: "M", color: "Bege", price: 79.9 },
      ],
      trackingCode: "BR567890123BR",
    },
    {
      orderNumber: "#0006",
      customer: customers["ana@email.com"],
      status: "DELIVERED",
      createdAt: daysAgo(25),
      items: [
        { slug: "vestido-ombro-a-ombro", qty: 1, size: "P", color: "Preto", price: 169.9 },
        { slug: "blusa-modal-decote-v", qty: 2, size: "P", color: "Rosa", price: 69.9 },
      ],
      trackingCode: "BR678901234BR",
    },
    // SHIPPED
    {
      orderNumber: "#0007",
      customer: customers["bia@email.com"],
      status: "SHIPPED",
      createdAt: daysAgo(12),
      items: [{ slug: "calca-alfaiataria-cintura-alta", qty: 1, size: "38", color: "Preto", price: 179.9 }],
      trackingCode: "BR789012345BR",
    },
    {
      orderNumber: "#0008",
      customer: customers["camila@email.com"],
      status: "SHIPPED",
      createdAt: daysAgo(10),
      items: [
        { slug: "vestido-floral-midi", qty: 1, size: "M", color: "Azul Floral", price: 189.9 },
        { slug: "saia-mini-jeans-destroyed", qty: 1, size: "38", color: undefined, price: 99.9 },
      ],
      trackingCode: "BR890123456BR",
    },
    // CONFIRMED
    {
      orderNumber: "#0009",
      customer: customers["dani@email.com"],
      status: "CONFIRMED",
      createdAt: daysAgo(7),
      items: [{ slug: "vestido-envelope-crepe", qty: 1, size: "M", color: "Vinho", price: 219.9 }],
      trackingCode: null,
    },
    {
      orderNumber: "#0010",
      customer: customers["fern@email.com"],
      status: "CONFIRMED",
      createdAt: daysAgo(5),
      items: [
        { slug: "calca-jogger-moletom", qty: 1, size: "G", color: "Preto", price: 139.9 },
        { slug: "saia-longa-estampada", qty: 1, size: "M", color: undefined, price: 129.9 },
      ],
      trackingCode: null,
    },
    // PENDING
    {
      orderNumber: "#0011",
      customer: customers["ana@email.com"],
      status: "PENDING",
      createdAt: daysAgo(3),
      items: [
        { slug: "conjunto-linho-coordenado", qty: 1, size: "P", color: "Terracota", price: 249.9 },
        { slug: "blusa-linho-premium", qty: 1, size: "P", color: "Azul Marinho", price: 89.9 },
      ],
      trackingCode: null,
    },
    {
      orderNumber: "#0012",
      customer: customers["bia@email.com"],
      status: "PENDING",
      createdAt: daysAgo(1),
      items: [
        { slug: "calca-alfaiataria-cintura-alta", qty: 1, size: "40", color: "Caramelo", price: 179.9 },
        { slug: "blusa-cropped-trico", qty: 1, size: "M", color: "Off White", price: 79.9 },
        { slug: "saia-midi-plissada", qty: 1, size: "M", color: "Verde Sage", price: 119.9 },
      ],
      trackingCode: null,
    },
  ];

  for (const o of ordersData) {
    const subtotal = o.items.reduce((s, i) => s + i.price * i.qty, 0);
    const order = await prisma.order.create({
      data: {
        orderNumber: o.orderNumber,
        customerName: o.customer.name,
        customerEmail: o.customer.email,
        customerPhone: "(11) 9" + Math.floor(10000000 + Math.random() * 89999999),
        address: `${o.customer.street}, ${o.customer.number}`,
        city: o.customer.city,
        state: o.customer.state,
        zipCode: o.customer.zipCode,
        subtotal,
        total: subtotal,
        status: o.status,
        trackingCode: o.trackingCode ?? undefined,
        customerId: o.customer.id,
        createdAt: o.createdAt,
        updatedAt: o.createdAt,
        items: {
          create: o.items.map((i) => ({
            productId: products[i.slug],
            quantity: i.qty,
            price: i.price,
            size: i.size ?? undefined,
            color: i.color ?? undefined,
          })),
        },
      },
    });
    void order;
  }

  // ── Reviews ────────────────────────────────────────────────────────────────
  await prisma.productReview.deleteMany();
  const reviewsData = [
    {
      productSlug: "vestido-floral-midi",
      authorName: "Ana Paula F.",
      rating: 5,
      comment:
        "Perfeito! O tecido é super leve e o caimento é lindo. Recebi em casa e amei, exatamente como nas fotos.",
      customerId: customers["ana@email.com"].id,
    },
    {
      productSlug: "conjunto-linho-coordenado",
      authorName: "Daniela C.",
      rating: 5,
      comment:
        "Comprei o conjunto Off White e fiquei apaixonada. Qualidade incrível e o linho é muito fresquinho.",
      customerId: customers["dani@email.com"].id,
    },
    {
      productSlug: "calca-alfaiataria-cintura-alta",
      authorName: "Beatriz O.",
      rating: 5,
      comment: "Calça linda e de excelente qualidade. O caimento é impecável, parece ter sido feita sob medida.",
      customerId: customers["bia@email.com"].id,
    },
    {
      productSlug: "vestido-envelope-crepe",
      authorName: "Camila S.",
      rating: 4,
      comment: "Muito bonito e elegante. Atendimento da loja foi ótimo, chegou bem embalado e no prazo.",
      customerId: customers["camila@email.com"].id,
    },
    {
      productSlug: "vestido-floral-midi",
      authorName: "Fernanda L.",
      rating: 5,
      comment: "Segunda vez que compro esse vestido, desta vez em outra cor. Qualidade consistente, recomendo!",
      customerId: customers["fern@email.com"].id,
    },
  ];

  for (const r of reviewsData) {
    await prisma.productReview.create({
      data: {
        productId: products[r.productSlug],
        authorName: r.authorName,
        rating: r.rating,
        comment: r.comment,
        customerId: r.customerId,
        approved: true,
      },
    });
  }

  // ── Nav items ──────────────────────────────────────────────────────────────
  await prisma.navItem.deleteMany();
  const navData = [
    { label: "Vestidos", href: "/produtos?categoria=vestidos", position: 1 },
    { label: "Blusas", href: "/produtos?categoria=blusas", position: 2 },
    { label: "Calças", href: "/produtos?categoria=calcas", position: 3 },
    { label: "Saias", href: "/produtos?categoria=saias", position: 4 },
    { label: "Conjuntos", href: "/produtos?categoria=conjuntos", position: 5 },
  ];
  for (const n of navData) {
    await prisma.navItem.create({ data: { ...n, active: true } });
  }

  console.log("✅ Dados de demo criados com sucesso!");
  console.log("   Admin: admin@demo.com / demo1234");
  console.log("   Clientes: ana@email.com, bia@email.com, camila@email.com, dani@email.com, fern@email.com (senha123)");
  console.log("   13 produtos · 5 categorias · 12 pedidos · 5 avaliações");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
