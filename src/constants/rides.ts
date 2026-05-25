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
