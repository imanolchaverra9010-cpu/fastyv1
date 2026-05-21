import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

// Access token - Se debe configurar en el archivo .env como VITE_MAPBOX_ACCESS_TOKEN
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || ""; 

interface Props {
  pickup?: { lat: number; lng: number; label?: string; emoji?: string };
  dropoff: { lat: number; lng: number; label?: string; emoji?: string };
  courier?: { lat: number; lng: number; label?: string; emoji?: string };
}

const MapboxDeliveryMap = ({ pickup, dropoff, courier }: Props) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [lng, setLng] = useState(dropoff.lng);
  const [lat, setLat] = useState(dropoff.lat);
  const [zoom, setZoom] = useState(13);

  const markers = useRef<{ [key: string]: mapboxgl.Marker }>({});

  useEffect(() => {
    if (map.current) return; // initialize map only once
    if (!mapContainer.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [lng, lat],
      zoom: zoom,
      pitch: 45, // Inclinación para efecto 3D
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.current.on("load", () => {
      if (!map.current) return;

      // Añadir capa para la ruta
      map.current.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [],
          },
        },
      });

      map.current.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#0ea5e9", // primary color
          "line-width": 5,
          "line-opacity": 0.75,
        },
      });
    });
  }, []);

  // Actualizar Marcadores
  useEffect(() => {
    if (!map.current) return;

    const updateMarker = (id: string, coords: { lat: number; lng: number } | undefined, color: string, emoji?: string) => {
      if (!coords) {
        if (markers.current[id]) {
          markers.current[id].remove();
          delete markers.current[id];
        }
        return;
      }

      if (!markers.current[id]) {
        const el = document.createElement("div");
        el.className = "flex items-center justify-center w-10 h-10 rounded-full shadow-lg border-2 border-white text-xl bg-white";
        el.innerHTML = emoji || (id === "courier" ? "🛵" : "📍");
        if (id === "courier") el.classList.add("animate-bounce");

        markers.current[id] = new mapboxgl.Marker(el)
          .setLngLat([coords.lng, coords.lat])
          .addTo(map.current!);
      } else {
        markers.current[id].setLngLat([coords.lng, coords.lat]);
      }
    };

    updateMarker("pickup", pickup, "#f59e0b", pickup?.emoji);
    updateMarker("dropoff", dropoff, "#ef4444", dropoff.emoji);
    updateMarker("courier", courier, "#0ea5e9", "🛵");

    // Ajustar vista para mostrar todos los puntos
    const points: [number, number][] = [];
    if (pickup) points.push([pickup.lng, pickup.lat]);
    if (dropoff) points.push([dropoff.lng, dropoff.lat]);
    if (courier) points.push([courier.lng, courier.lat]);

    if (points.length > 1) {
      const bounds = new mapboxgl.LngLatBounds(points[0], points[0]);
      points.forEach(p => bounds.extend(p));
      map.current.fitBounds(bounds, { padding: 50, duration: 2000 });
    }
  }, [pickup, dropoff, courier]);

  // Actualizar Ruta (OSRM como fallback o Mapbox Directions si tienes el token completo)
  useEffect(() => {
    if (!map.current) return;

    const start = courier || pickup;
    if (!start || !dropoff) return;

    const fetchRoute = async () => {
      try {
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${dropoff.lng},${dropoff.lat}?overview=full&geometries=geojson`
        );
        const data = await response.json();
        
        if (data.routes && data.routes[0] && map.current?.getSource("route")) {
          (map.current.getSource("route") as mapboxgl.GeoJSONSource).setData(data.routes[0].geometry);
        }
      } catch (e) {
        console.error("Error fetching route:", e);
      }
    };

    fetchRoute();
  }, [pickup, dropoff, courier]);

  return (
    <div className="relative w-full h-full min-h-[300px] rounded-[2rem] overflow-hidden shadow-inner">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Overlay de información si el token es inválido o falta */}
      {!MAPBOX_TOKEN && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 text-center z-50">
          <div className="bg-card p-6 rounded-2xl max-w-xs space-y-4">
            <p className="text-sm font-bold">Configuración de Mapbox</p>
            <p className="text-xs text-muted-foreground">
              Por favor, añade tu token de Mapbox en el archivo <code>.env</code> como <code>VITE_MAPBOX_ACCESS_TOKEN</code>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapboxDeliveryMap;
