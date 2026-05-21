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
  desiredAccuracy: 40, // Permisivo para exteriores
  fallbackAccuracy: 300, // Permisivo para interiores/Wi-Fi
  timeout: 12000, // Tiempo razonable de espera
  maximumAge: 5000, // Permitir caché reciente para mayor rapidez
};

export const getPositionErrorMessage = (error: GeolocationPositionError | Error) => {
  if ("code" in error) {
    if (error.code === error.PERMISSION_DENIED) return "Debes permitir el acceso a tu ubicación en el navegador para continuar.";
    if (error.code === error.POSITION_UNAVAILABLE) return "El GPS parece estar desactivado o no disponible en este momento.";
    if (error.code === error.TIMEOUT) return "La señal es muy débil. Intenta moverte a un lugar más abierto.";
  }
  return error.message || "No se pudo obtener tu ubicación actual.";
};

export const getPreciseCurrentPosition = (options: PreciseLocationOptions = {}): Promise<PrecisePosition> => {
  const config = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Tu navegador no soporta geolocalización."));
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
        accuracy: position.coords.accuracy,
      });
    };

    // Fallback final: Si falla el modo preciso, intentar el modo básico una última vez
    const finalFallback = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolveWith(pos),
        (err) => {
          if (bestPosition) {
            resolveWith(bestPosition);
          } else {
            reject(new Error("No se pudo obtener una ubicación. Verifica que el GPS esté activo."));
          }
        },
        { enableHighAccuracy: false, timeout: 5000 }
      );
    };

    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      
      if (bestPosition && bestPosition.coords.accuracy <= config.fallbackAccuracy) {
        resolveWith(bestPosition);
      } else {
        // Antes de rendirnos, intentamos el fallback básico
        cleanup();
        finalFallback();
      }
    }, config.timeout);

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (settled) return;

        const accuracy = position.coords.accuracy;
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
        // Si hay error pero tenemos una posición previa aceptable, la usamos
        if (bestPosition && bestPosition.coords.accuracy <= config.fallbackAccuracy) {
          window.clearTimeout(timeoutId);
          resolveWith(bestPosition);
        } else {
          // Si falla inmediatamente (ej. permiso denegado), no esperar al timeout
          settled = true;
          window.clearTimeout(timeoutId);
          cleanup();
          reject(error);
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: config.maximumAge,
        timeout: config.timeout
      }
    );
  });
};

export const isUsablePosition = (position: GeolocationPosition, maxAccuracy = 100) => {
  const accuracy = position.coords.accuracy;
  return !Number.isFinite(accuracy) || accuracy <= maxAccuracy;
};
