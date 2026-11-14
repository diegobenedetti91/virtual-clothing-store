import {
  LayoutDashboard, Kanban, TicketPercent, ClipboardList, Undo2, ShoppingBag, Package, Tag, Layers, Zap, Star,
  Truck, MapPin, Box, Users, Bell, Bot, BarChart3, Receipt, Navigation, Settings, Eye,
} from "lucide-react";
import type { AdminBadges } from "@/lib/adminAlerts";

export interface NavLink {
  href: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  exact?: boolean;
  badge?: keyof AdminBadges;
  /** critical = vermelho (algo deu errado); neutral = contador informativo */
  badgeTone?: "critical" | "neutral";
  keywords?: string;
}

export interface NavGroup {
  title: string;
  links: NavLink[];
}

export const ADMIN_NAV: NavGroup[] = [
  {
    title: "Início",
    links: [
      { href: "/admin", label: "Visão geral", description: "Indicadores, gráficos e pendências da loja", icon: LayoutDashboard, exact: true, keywords: "dashboard painel inicio home bi" },
    ],
  },
  {
    title: "Vendas",
    links: [
      { href: "/admin/esteira", label: "Esteira de pedidos", description: "Acompanhe cada pedido do pagamento à entrega", icon: Kanban, badge: "esteira", badgeTone: "neutral", keywords: "kanban fluxo separar enviar" },
      { href: "/admin/pedidos", label: "Todos os pedidos", description: "Lista completa, status, Bling e etiquetas", icon: ClipboardList, badge: "pedidos", badgeTone: "critical", keywords: "vendas bling nota" },
      { href: "/admin/devolucoes", label: "Devoluções", description: "Trocas e devoluções solicitadas pelos clientes", icon: Undo2, badge: "devolucoes", badgeTone: "critical", keywords: "troca reembolso estorno" },
      { href: "/admin/cupons", label: "Cupons", description: "Cupons de desconto, frete grátis e primeira compra", icon: TicketPercent, keywords: "desconto promocao codigo voucher" },
      { href: "/admin/carrinhos", label: "Carrinhos abandonados", description: "Clientes que não finalizaram a compra", icon: ShoppingBag, keywords: "recuperar lembrete" },
    ],
  },
  {
    title: "Catálogo",
    links: [
      { href: "/admin/produtos", label: "Produtos", description: "Cadastrar, editar preços, fotos e estoque", icon: Package, badge: "produtos", badgeTone: "neutral", keywords: "estoque roupas itens" },
      { href: "/admin/categorias", label: "Categorias", description: "Organize os produtos da loja", icon: Tag },
      { href: "/admin/variacoes", label: "Variações", description: "Modelos de tamanhos, cores e atributos", icon: Layers, keywords: "tamanho cor grade" },
      { href: "/admin/flash-sales", label: "Promoções relâmpago", description: "Descontos com tempo limitado", icon: Zap, keywords: "flash sale desconto oferta" },
      { href: "/admin/avaliacoes", label: "Avaliações", description: "Aprovar avaliações dos clientes", icon: Star, badge: "avaliacoes", badgeTone: "neutral", keywords: "reviews comentarios" },
    ],
  },
  {
    title: "Entregas",
    links: [
      { href: "/admin/envios", label: "Envios", description: "Gerenciar envios e etiquetas", icon: Truck, keywords: "melhor envio frete" },
      { href: "/admin/rastreamento", label: "Rastreamento", description: "Status das entregas e etiquetas com erro", icon: MapPin, badge: "rastreamento", badgeTone: "critical", keywords: "etiqueta correios" },
      { href: "/admin/embalagens", label: "Embalagens", description: "Tamanhos de caixa para cálculo de frete", icon: Box, keywords: "caixa pacote dimensoes" },
    ],
  },
  {
    title: "Clientes",
    links: [
      { href: "/admin/clientes", label: "Clientes", description: "Cadastro e histórico de compras", icon: Users },
      { href: "/admin/lista-de-espera", label: "Lista de espera", description: "Quem quer ser avisado quando voltar ao estoque", icon: Bell, keywords: "aviseme waitlist" },
      { href: "/admin/atendimento-ia", label: "Atendimento IA", description: "Assistente virtual e conversas", icon: Bot, keywords: "chat claude suporte" },
    ],
  },
  {
    title: "Análises",
    links: [
      { href: "/admin/relatorios", label: "Relatórios", description: "Faturamento, margem, estados, canais e campanhas", icon: BarChart3, exact: true, keywords: "analise lucro margem" },
      { href: "/admin/interesse", label: "Interesse por produto", description: "Mais vistos x vendidos e avisos de promoção", icon: Eye, keywords: "visualizacoes visto clicado promocao remarketing email interessados" },
      { href: "/admin/relatorios/relatorios", label: "Pagamentos e taxas", description: "Taxas cobradas por forma de pagamento", icon: Receipt, keywords: "financeiro gateway mercado pago" },
    ],
  },
  {
    title: "Loja",
    links: [
      { href: "/admin/menu", label: "Menu da loja", description: "Links do menu do site", icon: Navigation },
      { href: "/admin/configuracoes", label: "Configurações", description: "Dados da loja, pagamentos, frete e integrações", icon: Settings, keywords: "bling mercado pago melhor envio cores logo" },
    ],
  },
];

export const ALL_LINKS = ADMIN_NAV.flatMap((g) => g.links.map((l) => ({ ...l, group: g.title })));

/** Link ativo mais específico para a rota atual. */
export function findActive(pathname: string) {
  const candidates = ALL_LINKS.filter((l) => (l.exact ? pathname === l.href : pathname === l.href || pathname.startsWith(l.href + "/")));
  return candidates.sort((a, b) => b.href.length - a.href.length)[0];
}
