export interface Product {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  comparePrice?: number | null;
  images: string;
  categoryId: string;
  category?: Category;
  sizes: string;
  colors: string;
  stock: number;
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
  size?: string | null;
  color?: string | null;
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
  total: number;
  status: string;
  notes?: string | null;
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
  bannerImages: string;
  checkoutType: string;
  checkoutCollectEmail: boolean;
  checkoutCollectAddress: boolean;
  checkoutMessage?: string | null;
  mercadoPagoPublicKey?: string | null;
  mercadoPagoAccessToken?: string | null;
}

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  image: string;
  size?: string;
  color?: string;
  quantity: number;
  slug: string;
}
