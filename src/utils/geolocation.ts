export type PrecisePosition = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

type PreciseLocationOptions = {
  desiredAccuracy?: number;
  fallbackAccuracy?: number;
  timeout?: number;
  maximumAge?: number;
};

const DEFAULT_OPTIONS = {
  desiredAccuracy: 5, // Precisión máxima de 5 metros
  fallbackAccuracy: 5, // Aceptar solo si llega a 5 metros en el tiempo límite
  timeout: 20000, // Más tiempo para estabilizar
  maximumAge: 0,
};

export const getPositionErrorMessage = (error: GeolocationPositionError | Error) => {
  if ("code" in error) {
    if (error.code === error.PERMISSION_DENIED) return "Debes permitir el acceso a tu ubicacion para continuar.";
    if (error.code === error.POSITION_UNAVAILABLE) return "No se pudo detectar tu ubicacion. Activa el GPS e intentalo de nuevo.";
    if (error.code === error.TIMEOUT) return "La ubicacion tardo demasiado. Intentalo otra vez en un lugar con mejor senal.";
  }
  return error.message || "No se pudo obtener tu ubicacion actual.";
};

export const getPreciseCurrentPosition = (options: PreciseLocationOptions = {}): Promise<PrecisePosition> => {
  const config = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Tu navegador no soporta la geolocalizacion."));
      return;
    }

    let bestPosition: GeolocationPosition | null = null;
    let settled = false;
    let watchId: number | null = null;

    const cleanup = () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
    };

    const resolveWith = (position: GeolocationPosition) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
      });
    };

    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      if (bestPosition) {
        const accuracy = bestPosition.coords.accuracy || Infinity;
        if (accuracy <= config.fallbackAccuracy) {
          resolveWith(bestPosition);
          return;
        }
      }
      settled = true;
      cleanup();
      reject(new Error("No se logro una lectura GPS precisa. Acercate a una ventana o activa el GPS."));
    }, config.timeout);

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (settled) return;

        const accuracy = position.coords.accuracy || Infinity;
        const bestAccuracy = bestPosition?.coords.accuracy || Infinity;
        if (!bestPosition || accuracy < bestAccuracy) {
          bestPosition = position;
        }

        if (accuracy <= config.desiredAccuracy) {
          window.clearTimeout(timeoutId);
          resolveWith(position);
        }
      },
      (error) => {
        if (settled) return;
        if (bestPosition) return;
        settled = true;
        window.clearTimeout(timeoutId);
        cleanup();
        reject(error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: config.maximumAge,
        timeout: config.timeout,
      }
    );
  });
};

export const isUsablePosition = (position: GeolocationPosition, maxAccuracy = 100) => {
  const accuracy = position.coords.accuracy;
  return !Number.isFinite(accuracy) || accuracy <= maxAccuracy;
};
