export interface Business {
  id: string;
  name: string;
  description?: string;
  address?: string;
  phone?: string;
  eta?: string;
  emoji?: string;
  category?: string;
  image_url?: string;
}

export interface MenuItem {
  id: number;
  name: string;
  description?: string;
  price: number;
  emoji?: string;
  is_active: boolean;
  category?: string;
}

export interface Promotion {
  id: number;
  title: string;
  description?: string;
  discount_percent?: number;
  promo_code?: string;
  emoji?: string;
  is_active: boolean;
  expires_at?: string;
}

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  emoji?: string;
}

export interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  total: number;
  status: "pending" | "preparing" | "shipped" | "in_transit" | "delivered" | "cancelled";
  created_at: string;
  items: OrderItem[];
  payment_method: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  courier_lat?: number;
  courier_lng?: number;
}

export interface BusinessStats {
  revenue_today: number;
  orders_today: number;
  top_products: Array<{ name: string; total_sold: number }>;
}

export interface NewOrderNotification {
  type: "new_order";
  order_id: string;
  customer_name: string;
  delivery_address: string;
  total: number;
  items: OrderItem[];
}

export interface BusinessContextType {
  business: Business | null;
  fetchBusinessData: () => void;
  orders: Order[];
  menuItems: MenuItem[];
  promotions: Promotion[];
  stats: BusinessStats | null;
  expandedOrder: string | null;
  setExpandedOrder: (id: string | null) => void;
  handleUpdateOrderStatus: (orderId: string, newStatus: string) => void;
  showMenuForm: boolean;
  setShowMenuForm: (show: boolean) => void;
  newItemForm: any;
  setNewItemForm: (form: any) => void;
  editingItem: MenuItem | null;
  setEditingItem: (item: MenuItem | null) => void;
  handleAddMenuItem: () => void;
  handleToggleMenuItem: (id: number, isActive: boolean) => void;
  handleDeleteMenuItem: (id: number) => void;
  showPromoForm: boolean;
  setShowPromoForm: (show: boolean) => void;
  newPromoForm: any;
  setNewPromoForm: (form: any) => void;
  editingPromo: Promotion | null;
  setEditingPromo: (promo: Promotion | null) => void;
  handleAddPromotion: () => void;
  handleTogglePromotion: (id: number, isActive: boolean) => void;
  handleDeletePromotion: (id: number) => void;
}
