import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || "";

interface Props {
  pickup?: { lat: number; lng: number; label?: string; emoji?: string };
  dropoff: { lat: number; lng: number; label?: string; emoji?: string };
  courier?: { lat: number; lng: number; label?: string; emoji?: string };
  /** Fit map bounds when points change (default: only on first load) */
  autoFit?: boolean;
  /** Smoothly animate courier marker between updates */
  animateCourier?: boolean;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const MapboxDeliveryMap = ({ pickup, dropoff, courier, autoFit = false, animateCourier = true }: Props) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [lng, setLng] = useState(dropoff.lng);
  const [lat, setLat] = useState(dropoff.lat);
  const [zoom, setZoom] = useState(13);
  const markers = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const hasFittedRef = useRef(false);
  const courierAnimRef = useRef<number | null>(null);
  const courierPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastRouteKeyRef = useRef<string>("");
  const lastRouteFetchRef = useRef(0);

  useEffect(() => {
    if (map.current) return;
    if (!mapContainer.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/navigation-night-v1",
      center: [lng, lat],
      zoom: zoom,
      pitch: 55,
      bearing: -12,
      antialias: true,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.current.on("load", () => {
      if (!map.current) return;

      map.current.setFog({ range: [0.5, 10], color: "#242b4b", "horizon-blend": 0.3 });

      const layers = map.current.getStyle().layers;
      const labelLayerId = layers?.find((layer) => layer.type === "symbol" && layer.layout?.["text-field"])?.id;

      map.current.addLayer(
        {
          id: "add-3d-buildings",
          source: "composite",
          "source-layer": "building",
          filter: ["==", "extrude", "true"],
          type: "fill-extrusion",
          minzoom: 15,
          paint: {
            "fill-extrusion-color": "#334155",
            "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 15, 0, 15.05, ["get", "height"]],
            "fill-extrusion-base": ["interpolate", ["linear"], ["zoom"], 15, 0, 15.05, ["get", "min_height"]],
            "fill-extrusion-opacity": 0.6,
          },
        },
        labelLayerId,
      );

      map.current.addSource("route", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } },
      });

      map.current.addLayer({
        id: "route-glow",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#38bdf8", "line-width": 12, "line-opacity": 0.2, "line-blur": 8 },
      });

      map.current.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#38bdf8", "line-width": 6, "line-opacity": 0.85, "line-blur": 1 },
      });
    });
  }, []);

  const setMarkerPosition = (id: string, coords: { lat: number; lng: number }) => {
    if (markers.current[id]) {
      markers.current[id].setLngLat([coords.lng, coords.lat]);
    }
  };

  const animateCourierTo = (target: { lat: number; lng: number }) => {
    if (!markers.current.courier) return;
    if (courierAnimRef.current) cancelAnimationFrame(courierAnimRef.current);

    const start = courierPosRef.current || target;
    const startTime = performance.now();
    const duration = 1200;

    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = t * (2 - t);
      const lat = lerp(start.lat, target.lat, eased);
      const lng = lerp(start.lng, target.lng, eased);
      setMarkerPosition("courier", { lat, lng });
      if (t < 1) {
        courierAnimRef.current = requestAnimationFrame(step);
      } else {
        courierPosRef.current = target;
        courierAnimRef.current = null;
      }
    };
    courierAnimRef.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    if (!map.current) return;

    const updateMarker = (id: string, coords: { lat: number; lng: number } | undefined, emoji?: string) => {
      if (!coords) {
        if (markers.current[id]) {
          markers.current[id].remove();
          delete markers.current[id];
        }
        return;
      }

      if (!markers.current[id]) {
        const el = document.createElement("div");
        el.className = `flex items-center justify-center w-11 h-11 rounded-2xl shadow-2xl border-2 border-white/20 text-xl backdrop-blur-md ${
          id === "courier" ? "bg-primary/90 text-white z-50" : "bg-card/90"
        }`;

        if (id === "courier") {
          el.innerHTML = `<div class="relative"><span class="relative z-10">🛵</span><div class="absolute inset-0 bg-primary blur-md opacity-40"></div></div>`;
        } else {
          el.innerHTML = emoji || "📍";
        }

        markers.current[id] = new mapboxgl.Marker(el).setLngLat([coords.lng, coords.lat]).addTo(map.current!);
        if (id === "courier") courierPosRef.current = coords;
      } else if (id === "courier" && animateCourier && courierPosRef.current) {
        const dist = Math.abs(coords.lat - courierPosRef.current.lat) + Math.abs(coords.lng - courierPosRef.current.lng);
        if (dist > 0.00005) animateCourierTo(coords);
      } else {
        setMarkerPosition(id, coords);
        if (id === "courier") courierPosRef.current = coords;
      }
    };

    updateMarker("pickup", pickup, pickup?.emoji);
    updateMarker("dropoff", dropoff, dropoff.emoji);

    if (courier) {
      updateMarker("courier", courier, "🛵");
    } else if (markers.current.courier) {
      markers.current.courier.remove();
      delete markers.current.courier;
      courierPosRef.current = null;
    }

    const points: [number, number][] = [];
    if (pickup) points.push([pickup.lng, pickup.lat]);
    points.push([dropoff.lng, dropoff.lat]);
    if (courier) points.push([courier.lng, courier.lat]);

    const shouldFit = autoFit || !hasFittedRef.current;
    if (shouldFit && points.length > 0 && map.current) {
      const bounds = new mapboxgl.LngLatBounds(points[0], points[0]);
      points.forEach((p) => bounds.extend(p));
      map.current.fitBounds(bounds, { padding: 60, duration: 1200, maxZoom: 15 });
      hasFittedRef.current = true;
    }
  }, [pickup, dropoff, courier, autoFit, animateCourier]);

  useEffect(() => {
    if (!map.current) return;
    const start = courier || pickup;
    if (!start || !dropoff) return;

    const routeKey = `${start.lat.toFixed(4)},${start.lng.toFixed(4)};${dropoff.lat.toFixed(4)},${dropoff.lng.toFixed(4)}`;
    const now = Date.now();
    if (routeKey === lastRouteKeyRef.current && now - lastRouteFetchRef.current < 25000) return;

    lastRouteKeyRef.current = routeKey;
    lastRouteFetchRef.current = now;

    const fetchRoute = async () => {
      try {
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${dropoff.lng},${dropoff.lat}?overview=full&geometries=geojson`,
        );
        const data = await response.json();
        if (data.routes?.[0] && map.current?.getSource("route")) {
          (map.current.getSource("route") as mapboxgl.GeoJSONSource).setData(data.routes[0].geometry);
        }
      } catch (e) {
        console.error("Error fetching route:", e);
      }
    };

    fetchRoute();
  }, [pickup, dropoff, courier]);

  useEffect(() => () => {
    if (courierAnimRef.current) cancelAnimationFrame(courierAnimRef.current);
  }, []);

  return (
    <div className="relative w-full h-full min-h-[300px] rounded-[2rem] overflow-hidden shadow-inner">
      <div ref={mapContainer} className="absolute inset-0" />
      {!MAPBOX_TOKEN && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 text-center z-50">
          <div className="bg-card p-6 rounded-2xl max-w-xs space-y-4">
            <p className="text-sm font-bold">Configuración de Mapbox</p>
            <p className="text-xs text-muted-foreground">
              Añade tu token en <code>.env</code> como <code>VITE_MAPBOX_ACCESS_TOKEN</code>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapboxDeliveryMap;
