import { useEffect, useState } from "react";
import { MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet's default icon path issues
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface Point {
  lat: number;
  lng: number;
  label: string;
  emoji?: string;
  id?: string;
}

interface Props {
  courier: { lat: number; lng: number };
  dropoffs: Point[];
}

const MapBounds = ({ points }: { points: {lat: number, lng: number}[] }) => {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, points]);
  return null;
};

const MultiStopMap = ({ courier, dropoffs }: Props) => {
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);

  useEffect(() => {
    let isMounted = true;
    
    const fetchTrip = async () => {
      try {
        // Valid dropoffs
        const validDropoffs = dropoffs.filter(d => !isNaN(d.lat) && !isNaN(d.lng));
        if (validDropoffs.length === 0) return;

        // Build coordinates string: courier first, then dropoffs
        const coordsStr = [
          `${courier.lng},${courier.lat}`,
          ...validDropoffs.map(d => `${d.lng},${d.lat}`)
        ].join(';');

        // Use OSRM Trip API (roundtrip=false, source=first solves TSP starting from courier)
        const response = await fetch(
          `https://router.project-osrm.org/trip/v1/driving/${coordsStr}?roundtrip=false&source=first&overview=full&geometries=geojson`,
          { signal: AbortSignal.timeout(5000) }
        );

        if (!response.ok) {
          throw new Error(`OSRM returned ${response.status}`);
        }

        const data = await response.json();

        if (isMounted && data.trips && data.trips[0]) {
          const coords = data.trips[0].geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
          setRouteCoords(coords);
        } else if (isMounted) {
          // Fallback straight lines
          const fallbackCoords: [number, number][] = [[courier.lat, courier.lng], ...validDropoffs.map(d => [d.lat, d.lng] as [number, number])];
          setRouteCoords(fallbackCoords);
        }
      } catch (error) {
        if (isMounted) {
          const validDropoffs = dropoffs.filter(d => !isNaN(d.lat) && !isNaN(d.lng));
          const fallbackCoords: [number, number][] = [[courier.lat, courier.lng], ...validDropoffs.map(d => [d.lat, d.lng] as [number, number])];
          setRouteCoords(fallbackCoords);
        }
      }
    };

    fetchTrip();

    return () => {
      isMounted = false;
    };
  }, [courier, dropoffs]);

  const createEmojiIcon = (emoji: string) => L.divIcon({
    html: `<div style="font-size: 20px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); background: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: 2px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">${emoji}</div>`,
    className: "custom-emoji-icon",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

  const validPoints = [courier, ...dropoffs].filter(p => !isNaN(p.lat) && !isNaN(p.lng));

  if (validPoints.length < 2) return null;

  return (
    <div className="relative h-[300px] w-full rounded-2xl overflow-hidden shadow-card border border-border mb-6">
      <MapContainer 
        center={[courier.lat, courier.lng]} 
        zoom={13} 
        style={{ height: '100%', width: '100%', zIndex: 0 }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap contributors'
        />
        
        <MapBounds points={validPoints} />

        {/* Courier Marker */}
        <Marker position={[courier.lat, courier.lng]} icon={createEmojiIcon("🛵")}>
          <Popup>Mi ubicación actual</Popup>
        </Marker>

        {/* Dropoffs Markers */}
        {dropoffs.filter(d => !isNaN(d.lat) && !isNaN(d.lng)).map((dropoff, idx) => (
          <Marker key={idx} position={[dropoff.lat, dropoff.lng]} icon={createEmojiIcon(dropoff.emoji || "📍")}>
            <Popup>{dropoff.label}</Popup>
          </Marker>
        ))}

        {routeCoords.length > 0 && (
          <Polyline 
            positions={routeCoords} 
            color="#8b5cf6" // purple for multi-stop
            weight={5}
            opacity={0.8}
            dashArray="1, 10"
          />
        )}
      </MapContainer>

      {/* Overlay Title */}
      <div className="absolute top-4 left-4 z-10 bg-white/95 backdrop-blur-sm px-4 py-2 rounded-full shadow-md border border-border flex items-center gap-2">
        <Navigation className="h-4 w-4 text-purple-500" />
        <span className="text-xs font-bold text-foreground">
          Ruta Óptima Multi-Parada ({dropoffs.length} destinos)
        </span>
      </div>
    </div>
  );
};

export default MultiStopMap;
