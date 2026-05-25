export const RIDE_STATUS_LABELS: Record<string, string> = {
  published: "Disponible",
  full: "Cupos llenos",
  driver_arriving: "Conductor en camino",
  in_progress: "En viaje",
  completed: "Completado",
  cancelled: "Cancelado",
};

export const RIDE_PAYMENT_LABELS: Record<string, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
};

export const PENALTY_LABELS: Record<string, string> = {
  ride_cancelled_with_bookings: "Canceló viaje con pasajeros",
  ride_cancelled_late: "Canceló viaje en curso",
  low_rating: "Calificación muy baja (≤2)",
  report_unsafe_driving: "Reporte: conducción insegura",
  report_harassment: "Reporte: acoso",
  report_wrong_vehicle: "Reporte: vehículo incorrecto",
  report_no_show: "Reporte: no se presentó",
  report_overcharge: "Reporte: cobro indebido",
  report_route_issue: "Reporte: problema de ruta",
  report_other: "Reporte: otro",
  sos_on_ride: "Alerta SOS en viaje",
  admin_manual: "Penalización manual (admin)",
};

export const RIDE_REPORT_LABELS: Record<string, string> = {
  unsafe_driving: "Conducción insegura",
  wrong_vehicle: "Vehículo incorrecto",
  harassment: "Acoso o comportamiento inapropiado",
  no_show: "No se presentó",
  overcharge: "Cobro indebido",
  route_issue: "Problema con la ruta",
  other: "Otro",
};

export const formatVehicleInfo = (ride: {
  driver_vehicle_model?: string | null;
  driver_vehicle_color?: string | null;
  driver_vehicle_plate?: string | null;
  driver_vehicle?: string | null;
}) => {
  const parts = [
    ride.driver_vehicle_model,
    ride.driver_vehicle_color,
    ride.driver_vehicle_plate ? `Placa ${ride.driver_vehicle_plate}` : null,
    ride.driver_vehicle,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Vehículo no registrado";
};

export const formatDeparture = (value?: string | null) => {
  if (!value) return "Salida por confirmar";
  try {
    return new Date(value).toLocaleString("es-CO", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
};
