import {
  ShoppingBag,
  BarChart3,
  Package,
  Users,
  Star,
  Bell,
  ShoppingCart,
  Settings,
  Smartphone,
  CreditCard,
  MessageCircle,
  TrendingUp,
  CheckCircle,
  Percent,
  MapPin,
  Tag,
  Truck,
  ClipboardList,
  Eye,
  Palette,
  Globe,
  Mail,
  Layers,
  Search,
  Heart,
} from "lucide-react";

const features = [
  {
    icon: Package,
    title: "Gestão de Produtos",
    description: "Cadastre produtos com variações de tamanho e cor, estoque individual por variação, múltiplas imagens, categoria, preço de destaque e controle de visibilidade.",
    color: "bg-pink-50 text-pink-600",
    items: ["Variações tamanho × cor", "Estoque por variação", "Preço original riscado", "Produtos em destaque"],
  },
  {
    icon: ClipboardList,
    title: "Gestão de Pedidos",
    description: "Acompanhe cada pedido do recebimento à entrega com fluxo de status completo, código de rastreio e comprovante de envio.",
    color: "bg-blue-50 text-blue-600",
    items: ["Fluxo de status completo", "Código de rastreio", "Comprovante de envio", "Cancelamento com motivo"],
  },
  {
    icon: BarChart3,
    title: "Relatórios & Analytics",
    description: "Tome decisões baseadas em dados com relatórios de faturamento, vendas por estado, por categoria e margem de lucro por produto e pedido.",
    color: "bg-purple-50 text-purple-600",
    items: ["Faturamento mensal", "Vendas por estado", "Por categoria", "Margem de lucro"],
  },
  {
    icon: Percent,
    title: "Margem de Lucro",
    description: "Cadastre o valor de custo de cada produto e acompanhe a margem de lucro real por produto vendido e por pedido, com badge colorido por performance.",
    color: "bg-emerald-50 text-emerald-600",
    items: ["Custo por produto", "Lucro por pedido", "% de margem", "Alertas de margem negativa"],
  },
  {
    icon: Users,
    title: "Gestão de Clientes",
    description: "Visualize todos os seus clientes, histórico de pedidos e informações de contato e endereço em um painel centralizado.",
    color: "bg-orange-50 text-orange-600",
    items: ["Cadastro automático", "Histórico de pedidos", "Dados de contato", "Endereço salvo"],
  },
  {
    icon: Star,
    title: "Avaliações",
    description: "Sistema de reviews com moderação manual. Aprove ou reprove avaliações antes de exibi-las na vitrine da loja.",
    color: "bg-yellow-50 text-yellow-600",
    items: ["Avaliação por estrelas", "Comentários", "Aprovação manual", "Exibição na vitrine"],
  },
  {
    icon: Bell,
    title: "Lista de Espera",
    description: "Capture o interesse de clientes em produtos esgotados. Notifique automaticamente quando o estoque for reposto.",
    color: "bg-indigo-50 text-indigo-600",
    items: ["Fila por variação", "Notificação por e-mail", "Controle de notificados", "Recuperação de vendas"],
  },
  {
    icon: ShoppingCart,
    title: "Carrinhos Abandonados",
    description: "Visualize e recupere vendas perdidas identificando clientes que adicionaram produtos ao carrinho mas não finalizaram a compra.",
    color: "bg-red-50 text-red-600",
    items: ["Identificação automática", "Lista de itens", "Dados do cliente", "Ação de recuperação"],
  },
  {
    icon: Settings,
    title: "Configurações da Loja",
    description: "Personalize sua loja com logo, cor da marca, informações de contato, mensagem de checkout e integrações de pagamento.",
    color: "bg-gray-100 text-gray-600",
    items: ["Logo e identidade", "Cor da marca", "WhatsApp e Instagram", "Mensagem personalizada"],
  },
  {
    icon: Layers,
    title: "Menu de Navegação",
    description: "Crie e organize o menu da loja associando produtos e categorias a itens de navegação de forma totalmente customizável.",
    color: "bg-teal-50 text-teal-600",
    items: ["Itens personalizados", "Associação de produtos", "Ordem customizável", "Ativo/inativo"],
  },
  {
    icon: CreditCard,
    title: "Mercado Pago",
    description: "Ofereça pagamento online com Mercado Pago integrado. Configure suas chaves e comece a receber cartão, Pix e boleto.",
    color: "bg-cyan-50 text-cyan-600",
    items: ["Cartão de crédito", "Pix", "Boleto", "Checkout nativo"],
  },
  {
    icon: MessageCircle,
    title: "Checkout via WhatsApp",
    description: "Receba pedidos diretamente no WhatsApp com mensagem estruturada contendo todos os dados do cliente e itens do carrinho.",
    color: "bg-green-50 text-green-600",
    items: ["Mensagem formatada", "Itens e valores", "Dados do cliente", "Configuração simples"],
  },
];

const storeFeatures = [
  { icon: Globe, label: "Vitrine responsiva" },
  { icon: Search, label: "Busca de produtos" },
  { icon: Heart, label: "Lista de favoritos" },
  { icon: ShoppingCart, label: "Carrinho persistente" },
  { icon: Smartphone, label: "Mobile-first" },
  { icon: Palette, label: "Cores personalizáveis" },
  { icon: MapPin, label: "Vendas por estado" },
  { icon: Tag, label: "Categorias e filtros" },
  { icon: Truck, label: "Rastreio de entrega" },
  { icon: Mail, label: "Notificações por e-mail" },
  { icon: Eye, label: "Preview em destaque" },
  { icon: TrendingUp, label: "Dashboard de vendas" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Nav */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-pink-500 flex items-center justify-center">
              <ShoppingBag size={16} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg">VirtualStore</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-gray-600">
            <a href="#funcionalidades" className="hover:text-gray-900 transition-colors">Funcionalidades</a>
            <a href="#loja" className="hover:text-gray-900 transition-colors">Loja virtual</a>
            <a href="#relatorios" className="hover:text-gray-900 transition-colors">Relatórios</a>
            <a href="#integracoes" className="hover:text-gray-900 transition-colors">Integrações</a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-fuchsia-500/15 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-36 text-center">
          <div className="inline-flex items-center gap-2 bg-pink-500/10 border border-pink-500/20 text-pink-300 text-xs font-medium px-4 py-1.5 rounded-full mb-8">
            <span className="w-1.5 h-1.5 bg-pink-400 rounded-full animate-pulse" />
            Plataforma completa de moda
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight mb-6 leading-tight">
            Sua loja virtual,{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-fuchsia-400">
              do zero ao lucro
            </span>
          </h1>
          <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            Plataforma completa com gestão de produtos, pedidos, clientes, relatórios de margem de lucro, integração com WhatsApp e Mercado Pago — tudo em um só lugar.
          </p>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y border-gray-100 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: "12+", label: "Módulos integrados" },
            { value: "100%", label: "Responsivo mobile" },
            { value: "2", label: "Formas de checkout" },
            { value: "∞", label: "Produtos e pedidos" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-3xl font-black text-gray-900 mb-1">{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features grid */}
      <section id="funcionalidades" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">
            Tudo que você precisa para vender
          </h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            Cada módulo foi pensado para simplificar a operação da sua loja e maximizar suas vendas.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-white border border-gray-100 rounded-2xl p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group"
            >
              <div className={`inline-flex p-3 rounded-xl ${f.color} mb-4`}>
                <f.icon size={22} />
              </div>
              <h3 className="font-bold text-gray-900 text-lg mb-2">{f.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-4">{f.description}</p>
              <ul className="space-y-1.5">
                {f.items.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-xs text-gray-600">
                    <CheckCircle size={13} className="text-pink-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Admin panel highlight */}
      <section className="bg-gray-950 text-white py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-pink-500/10 border border-pink-500/20 text-pink-300 text-xs font-medium px-4 py-1.5 rounded-full mb-6">
                Painel administrativo
              </div>
              <h2 className="text-3xl md:text-4xl font-black mb-6 leading-tight">
                Controle total da sua operação
              </h2>
              <p className="text-gray-400 leading-relaxed mb-8">
                O painel admin reúne todos os módulos em uma interface limpa e intuitiva. Gerencie produtos, pedidos, clientes e configurações sem precisar de conhecimento técnico.
              </p>
              <div className="space-y-4">
                {[
                  { title: "Produtos com variações", desc: "Cadastre tamanhos, cores e estoque individual por combinação" },
                  { title: "Fluxo completo de pedidos", desc: "De pendente a entregue, com rastreio e comprovante de envio" },
                  { title: "Relatórios em tempo real", desc: "Faturamento, ticket médio, cancelamentos e margem de lucro" },
                  { title: "Configuração sem código", desc: "Personalize cores, logo e integrações pelo próprio painel" },
                ].map((item) => (
                  <div key={item.title} className="flex gap-3">
                    <div className="mt-1 w-5 h-5 rounded-full bg-pink-500/20 flex items-center justify-center shrink-0">
                      <CheckCircle size={12} className="text-pink-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-white">{item.title}</p>
                      <p className="text-gray-400 text-xs mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-gray-500 text-xs ml-2">Painel Admin</span>
              </div>
              {[
                { label: "Produtos ativos", value: "48", color: "text-pink-400" },
                { label: "Pedidos hoje", value: "12", color: "text-blue-400" },
                { label: "Faturamento mês", value: "R$ 8.420", color: "text-emerald-400" },
                { label: "Margem média", value: "34,2%", color: "text-purple-400" },
                { label: "Avaliações pendentes", value: "3", color: "text-yellow-400" },
                { label: "Carrinhos abandonados", value: "7", color: "text-orange-400" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between bg-gray-800/50 rounded-xl px-4 py-3">
                  <span className="text-gray-400 text-sm">{row.label}</span>
                  <span className={`font-bold text-sm ${row.color}`}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Reports section */}
      <section id="relatorios" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">
              Relatórios que geram decisões
            </h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              Dados claros sobre faturamento, performance por região e margem de lucro real de cada produto.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: TrendingUp,
                title: "Faturamento mensal",
                desc: "Gráfico de barras com receita mês a mês para o ano selecionado. Filtre por mês específico para análise detalhada.",
                color: "text-blue-600 bg-blue-50",
              },
              {
                icon: MapPin,
                title: "Vendas por estado",
                desc: "Ranking de estados por faturamento com pedidos, receita e ticket médio. Identifique seus mercados mais fortes.",
                color: "text-pink-600 bg-pink-50",
              },
              {
                icon: Tag,
                title: "Vendas por categoria",
                desc: "Descubra quais categorias vendem mais e direcione seu estoque e marketing para os produtos certos.",
                color: "text-purple-600 bg-purple-50",
              },
              {
                icon: Percent,
                title: "Margem por produto",
                desc: "Com o valor de custo cadastrado, veja lucro e margem % de cada produto vendido no período. Badge verde/amarelo/vermelho por performance.",
                color: "text-emerald-600 bg-emerald-50",
              },
              {
                icon: ClipboardList,
                title: "Margem por pedido",
                desc: "Analise a lucratividade de cada pedido individualmente. Identifique pedidos de alto e baixo retorno.",
                color: "text-indigo-600 bg-indigo-50",
              },
              {
                icon: ShoppingCart,
                title: "Cancelamentos",
                desc: "Veja os motivos de cancelamento mais frequentes e o volume de vendas perdidas para reduzir a taxa de cancelamento.",
                color: "text-red-600 bg-red-50",
              },
            ].map((card) => (
              <div key={card.title} className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-md transition-shadow">
                <div className={`inline-flex p-2.5 rounded-xl ${card.color} mb-4`}>
                  <card.icon size={20} />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{card.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Store front section */}
      <section id="loja" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-pink-50 border border-pink-100 text-pink-600 text-xs font-medium px-4 py-1.5 rounded-full mb-6">
              Loja virtual
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-6 leading-tight">
              Vitrine bonita e responsiva para seus clientes
            </h2>
            <p className="text-gray-500 leading-relaxed mb-8">
              Seus clientes têm acesso a uma loja moderna com catálogo de produtos, carrinho, lista de favoritos, avaliações e checkout — tudo otimizado para mobile.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {storeFeatures.map((feat) => (
                <div key={feat.label} className="flex items-center gap-2 text-sm text-gray-700">
                  <div className="w-7 h-7 rounded-lg bg-pink-50 flex items-center justify-center shrink-0">
                    <feat.icon size={14} className="text-pink-500" />
                  </div>
                  {feat.label}
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { bg: "bg-pink-50", icon: ShoppingBag, title: "Vitrine", desc: "Catálogo com filtro por categoria e busca" },
              { bg: "bg-blue-50", icon: ShoppingCart, title: "Carrinho", desc: "Persistente com variações de produto" },
              { bg: "bg-purple-50", icon: Heart, title: "Favoritos", desc: "Lista de desejos sincronizada" },
              { bg: "bg-emerald-50", icon: ClipboardList, title: "Pedidos", desc: "Histórico e rastreio na conta" },
            ].map((card) => (
              <div key={card.title} className={`${card.bg} rounded-2xl p-5`}>
                <card.icon size={22} className="text-gray-700 mb-3" />
                <p className="font-bold text-gray-900 text-sm mb-1">{card.title}</p>
                <p className="text-gray-500 text-xs leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section id="integracoes" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">
              Integrações prontas para usar
            </h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              Configure uma vez e receba pedidos e pagamentos automaticamente.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center hover:shadow-md transition-shadow">
              <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <MessageCircle size={28} className="text-green-600" />
              </div>
              <h3 className="font-bold text-gray-900 text-lg mb-2">WhatsApp</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Checkout direto pelo WhatsApp com mensagem automática contendo todos os dados do pedido formatados.
              </p>
              <div className="mt-4 space-y-1.5">
                {["Mensagem estruturada", "Dados do cliente", "Itens e valores", "Endereço de entrega"].map((i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-600 justify-center">
                    <CheckCircle size={12} className="text-green-500" />
                    {i}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center hover:shadow-md transition-shadow">
              <div className="w-14 h-14 bg-cyan-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CreditCard size={28} className="text-cyan-600" />
              </div>
              <h3 className="font-bold text-gray-900 text-lg mb-2">Mercado Pago</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Pagamento online com checkout nativo do Mercado Pago. Aceite cartão, Pix e boleto sem sair da loja.
              </p>
              <div className="mt-4 space-y-1.5">
                {["Cartão de crédito/débito", "Pix instantâneo", "Boleto bancário", "Checkout seguro"].map((i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-600 justify-center">
                    <CheckCircle size={12} className="text-cyan-500" />
                    {i}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center hover:shadow-md transition-shadow">
              <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Mail size={28} className="text-orange-600" />
              </div>
              <h3 className="font-bold text-gray-900 text-lg mb-2">E-mail</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Notificações automáticas por e-mail para confirmação de pedido, atualização de status e reposição de estoque.
              </p>
              <div className="mt-4 space-y-1.5">
                {["Confirmação de pedido", "Atualização de status", "Lista de espera", "SMTP configurável"].map((i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-600 justify-center">
                    <CheckCircle size={12} className="text-orange-500" />
                    {i}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
