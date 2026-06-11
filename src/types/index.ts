export interface ProductAttribute {
  name: string;
  values: string[];
}

export interface VariantStock {
  // New format
  attributes?: Record<string, string>;
  // Legacy format (backward compat)
  size?: string;
  color?: string;
  stock: number;
}

export interface PackagePreset {
  id: string;
  name: string;
  comprimento: number;
  largura: number;
  altura: number;
  pesoGramas: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  comparePrice?: number | null;
  costPrice?: number | null;
  images: string;
  categoryId: string;
  category?: Category;
  // Legacy fields (kept for backward compat with existing data)
  sizes: string;
  colors: string;
  // New dynamic attributes
  attributes: string;
  stock: number;
  variantStock: string;
  pesoGramas?: number | null;
  embalagemId?: string | null;
  embalagem?: PackagePreset | null;
  active: boolean;
  featured: boolean;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  image?: string | null;
  active: boolean;
  createdAt: string;
  _count?: { products: number };
}

export interface OrderItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  price: number;
  // Legacy
  size?: string | null;
  color?: string | null;
  // New: JSON of Record<string,string>
  selectedAttributes?: string | null;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  items: OrderItem[];
  subtotal: number;
  shippingCost: number;
  shippingMethod?: string | null;
  total: number;
  status: string;
  notes?: string | null;
  paymentGateway?: string | null;
  paymentId?: string | null;
  paymentMethod?: string | null;
  paymentFee?: number;
  refundedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompanySettings {
  id: string;
  name: string;
  logo?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  instagram?: string | null;
  address?: string | null;
  description?: string | null;
  primaryColor: string;
  buttonColor: string;
  menuColor?: string | null;
  bannerImages: string;
  checkoutType: string;
  checkoutCollectEmail: boolean;
  checkoutCollectAddress: boolean;
  checkoutMessage?: string | null;
  mercadoPagoPublicKey?: string | null;
  mercadoPagoAccessToken?: string | null;
  nuPayClientId?: string | null;
  nuPayClientSecret?: string | null;
  heroBadge?: string | null;
  heroTitle?: string | null;
  heroButtonText?: string | null;
  heroButtonSecondaryText?: string | null;
  freteAtivo: boolean;
  freteTipo: string;
  freteValorFixo: number;
  freteCEPOrigem?: string | null;
  fretePesoDefaultGramas: number;
  melhorEnvioToken?: string | null;
  fretePacoteAltura: number;
  fretePacoteLargura: number;
  fretePacoteComprimento: number;
  freteLocalCidade?: string | null;
  freteLocalUF?: string | null;
  freteLocalRetirada?: boolean;
  mercadoPagoAtivo?: boolean;
  nuPayAtivo?: boolean;
  whatsappAtivo?: boolean;
}

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  image: string;
  // Legacy (for carts already in localStorage)
  size?: string;
  color?: string;
  // New: dynamic attributes
  selectedAttributes?: Record<string, string>;
  quantity: number;
  slug: string;
}
