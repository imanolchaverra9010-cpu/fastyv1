// Mock data for the delivery platform demo.

export type Business = {
  id: string;
  name: string;
  category: string;
  rating: number;
  eta: string;
  image: string;
  emoji: string;
  deliveryFee: number;
  status: "active" | "pending" | "paused";
};

export type MenuItem = {
  id: string;
  businessId: string;
  name: string;
  description: string;
  price: number;
  emoji: string;
  category: string;
};

export type Courier = {
  id: string;
  name: string;
  vehicle: "Moto" | "Bici" | "Auto";
  rating: number;
  deliveries: number;
  status: "online" | "offline" | "busy";
  earnings: number;
};

export type OrderStatus =
  | "pending"
  | "preparing"
  | "shipped"
  | "in_transit"
  | "ready"
  | "on_route"
  | "delivered"
  | "cancelled";

export type Order = {
  id: string;
  businessId: string;
  businessName: string;
  customer: string;
  address: string;
  distanceKm: number;
  items: { name: string; qty: number; price: number }[];
  total: number;
  fee: number;
  status: OrderStatus;
  createdAt: string;
  courierId?: string;
};

export const businesses: Business[] = [
  { id: "1", name: "La Brasa Dorada", category: "Pollo asado", rating: 4.8, eta: "25-35 min", image: "", emoji: "🍗", deliveryFee: 4500, status: "active" },
  { id: "3", name: "Sushi Nori", category: "Japonés", rating: 4.7, eta: "30-40 min", image: "", emoji: "🍣", deliveryFee: 5000, status: "active" },
  { id: "2", name: "Burger House", category: "Hamburguesas", rating: 4.6, eta: "20-30 min", image: "", emoji: "🍔", deliveryFee: 3500, status: "active" },
  { id: "4", name: "Pizza Forno", category: "Italiana", rating: 4.9, eta: "30-45 min", image: "", emoji: "🍕", deliveryFee: 4000, status: "active" },
  { id: "5", name: "Tacos El Patrón", category: "Mexicana", rating: 4.5, eta: "20-30 min", image: "", emoji: "🌮", deliveryFee: 3000, status: "pending" },
  { id: "6", name: "Verde Bowl", category: "Saludable", rating: 4.4, eta: "15-25 min", image: "", emoji: "🥗", deliveryFee: 4500, status: "active" },
  { id: "7", name: "Café Aurora", category: "Cafetería", rating: 4.8, eta: "10-20 min", image: "", emoji: "☕", deliveryFee: 2500, status: "paused" },
  { id: "8", name: "Dulce Antojo", category: "Postres", rating: 4.9, eta: "20-30 min", image: "", emoji: "🍰", deliveryFee: 3500, status: "active" },
];

export const menuItems: MenuItem[] = [
  { id: "m1", businessId: "1", name: "1/4 Pollo asado", description: "Con papas y ensalada", price: 18900, emoji: "🍗", category: "Principales" },
  { id: "m2", businessId: "1", name: "1/2 Pollo asado", description: "Con dos acompañamientos", price: 28900, emoji: "🍗", category: "Principales" },
  { id: "m3", businessId: "2", name: "Classic Burger", description: "Carne 150g, queso cheddar, lechuga, tomate", price: 21500, emoji: "🍔", category: "Hamburguesas" },
  { id: "m4", businessId: "2", name: "Doble BBQ", description: "Doble carne, tocineta, salsa BBQ", price: 28900, emoji: "🍔", category: "Hamburguesas" },
  { id: "m5", businessId: "4", name: "Pizza Margherita", description: "Tomate, mozzarella, albahaca", price: 32000, emoji: "🍕", category: "Pizzas" },
  { id: "m6", businessId: "4", name: "Pizza Pepperoni", description: "Generosa porción de pepperoni", price: 36000, emoji: "🍕", category: "Pizzas" },
  { id: "m7", businessId: "3", name: "Roll California", description: "8 piezas con cangrejo y aguacate", price: 24500, emoji: "🍣", category: "Rolls" },
  { id: "m8", businessId: "6", name: "Bowl Mediterráneo", description: "Quinoa, garbanzos, aguacate, hummus", price: 22500, emoji: "🥗", category: "Bowls" },
];

export const couriers: Courier[] = [
  { id: "c1", name: "Carlos Méndez", vehicle: "Moto", rating: 4.9, deliveries: 842, status: "online", earnings: 1250000 },
  { id: "c2", name: "Laura Pérez", vehicle: "Bici", rating: 4.8, deliveries: 421, status: "busy", earnings: 680000 },
  { id: "c3", name: "Andrés Gómez", vehicle: "Moto", rating: 4.7, deliveries: 1203, status: "online", earnings: 1820000 },
  { id: "c4", name: "Sofía Ríos", vehicle: "Auto", rating: 4.9, deliveries: 256, status: "offline", earnings: 540000 },
  { id: "c5", name: "Mateo López", vehicle: "Moto", rating: 4.6, deliveries: 980, status: "online", earnings: 1420000 },
];

export const orders: Order[] = [
  {
    id: "ORD-1042", businessId: "1", businessName: "La Brasa Dorada",
    customer: "María González", address: "Cra 15 #93-22, Apto 502", distanceKm: 2.3,
    items: [{ name: "1/2 Pollo asado", qty: 1, price: 28900 }],
    total: 33400, fee: 4500, status: "ready", createdAt: "hace 4 min",
  },
  {
    id: "ORD-1043", businessId: "2", businessName: "Burger House",
    customer: "Juan Rodríguez", address: "Calle 72 #11-45", distanceKm: 1.8,
    items: [{ name: "Doble BBQ", qty: 2, price: 28900 }],
    total: 61300, fee: 3500, status: "preparing", createdAt: "hace 8 min",
  },
  {
    id: "ORD-1044", businessId: "4", businessName: "Pizza Forno",
    customer: "Camila Vargas", address: "Av Caracas #45-12", distanceKm: 3.1,
    items: [{ name: "Pizza Pepperoni", qty: 1, price: 36000 }],
    total: 40000, fee: 4000, status: "on_route", createdAt: "hace 18 min", courierId: "c2",
  },
  {
    id: "ORD-1045", businessId: "3", businessName: "Sushi Nori",
    customer: "Diego Sanín", address: "Cl 116 #9-15", distanceKm: 4.2,
    items: [{ name: "Roll California", qty: 2, price: 24500 }],
    total: 54000, fee: 5000, status: "ready", createdAt: "hace 2 min",
  },
  {
    id: "ORD-1046", businessId: "6", businessName: "Verde Bowl",
    customer: "Paula Toro", address: "Cra 7 #80-22", distanceKm: 1.2,
    items: [{ name: "Bowl Mediterráneo", qty: 1, price: 22500 }],
    total: 27000, fee: 4500, status: "delivered", createdAt: "hace 1 h", courierId: "c1",
  },
  {
    id: "ORD-1047", businessId: "8", businessName: "Dulce Antojo",
    customer: "Felipe Ruiz", address: "Cl 53 #24-10", distanceKm: 2.7,
    items: [{ name: "Cheesecake", qty: 1, price: 14500 }],
    total: 18000, fee: 3500, status: "delivered", createdAt: "hace 2 h", courierId: "c3",
  },
];

export const formatCOP = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

export const statusLabel: Record<OrderStatus, string> = {
  pending: "Pendiente",
  preparing: "Preparando",
  shipped: "En camino",
  in_transit: "Cerca de ti",
  ready: "Listo para recoger",
  on_route: "En camino",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

export const statusTone: Record<OrderStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  preparing: "bg-warning/15 text-warning-foreground border border-warning/30",
  shipped: "bg-accent/10 text-accent border border-accent/20",
  in_transit: "bg-primary/10 text-primary border border-primary/20",
  ready: "bg-primary/10 text-primary border border-primary/20",
  on_route: "bg-accent/10 text-accent border border-accent/20",
  delivered: "bg-success/10 text-success border border-success/20",
  cancelled: "bg-destructive/10 text-destructive border border-destructive/20",
};
