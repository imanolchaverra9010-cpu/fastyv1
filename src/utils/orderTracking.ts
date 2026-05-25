const COURIER_TO_PICKUP_SPEED_KMH = 25;
const DELIVERY_SPEED_KMH = 22;
const PICKUP_HANDOFF_MINUTES = 4;
const PREPARING_BUFFER_MINUTES = 12;

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateMinutes(distanceKm: number, speedKmh: number): number {
  if (distanceKm <= 0) return 0;
  return Math.max(1, Math.ceil((distanceKm / speedKmh) * 60));
}

export interface OrderEtaInput {
  status: string;
  latitude?: number | null;
  longitude?: number | null;
  business_lat?: number | null;
  business_lng?: number | null;
  courier_lat?: number | null;
  courier_lng?: number | null;
}

export function estimateOrderEta(order: OrderEtaInput): { estimated_delivery_minutes: number | null; eta_text: string | null } {
  const customerLat = order.latitude ?? null;
  const customerLng = order.longitude ?? null;
  const courierLat = order.courier_lat ?? null;
  const courierLng = order.courier_lng ?? null;
  const businessLat = order.business_lat ?? null;
  const businessLng = order.business_lng ?? null;

  if (order.status === "delivered") return { estimated_delivery_minutes: 0, eta_text: "Entregado" };
  if (order.status === "cancelled") return { estimated_delivery_minutes: null, eta_text: "Cancelado" };
  if (customerLat == null || customerLng == null) return { estimated_delivery_minutes: null, eta_text: null };

  let minutes = 0;
  if (["pending", "confirmed", "preparing", "pending_payment"].includes(order.status)) {
    minutes += PREPARING_BUFFER_MINUTES;
  }

  if (order.status === "in_transit") {
    if (courierLat != null && courierLng != null) {
      minutes += estimateMinutes(haversineKm(courierLat, courierLng, customerLat, customerLng), DELIVERY_SPEED_KMH);
    } else if (businessLat != null && businessLng != null) {
      minutes += estimateMinutes(haversineKm(businessLat, businessLng, customerLat, customerLng), DELIVERY_SPEED_KMH);
    }
  } else {
    if (courierLat != null && courierLng != null && businessLat != null && businessLng != null) {
      minutes += estimateMinutes(haversineKm(courierLat, courierLng, businessLat, businessLng), COURIER_TO_PICKUP_SPEED_KMH);
      minutes += PICKUP_HANDOFF_MINUTES;
    }
    if (businessLat != null && businessLng != null) {
      minutes += estimateMinutes(haversineKm(businessLat, businessLng, customerLat, customerLng), DELIVERY_SPEED_KMH);
    }
  }

  if (minutes <= 0) return { estimated_delivery_minutes: null, eta_text: null };
  return { estimated_delivery_minutes: minutes, eta_text: `${minutes}-${minutes + 5} min` };
}

export function getPollingIntervalMs(status: string): number {
  if (status === "in_transit") return 3000;
  if (status === "shipped") return 5000;
  if (["preparing", "pending", "confirmed"].includes(status)) return 12000;
  return 20000;
}

export function shouldShowLiveMap(status: string): boolean {
  return ["preparing", "shipped", "in_transit"].includes(status);
}
