import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet's default icon path issues with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface Props {
  pickup?: { lat: number; lng: number; label?: string; emoji?: string };
  dropoff: { lat: number; lng: number; label?: string; emoji?: string };
  courier?: { lat: number; lng: number; label?: string; emoji?: string };
}

// Component to handle map bounds automatically
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

const DeliveryMap = ({ pickup, dropoff, courier }: Props) => {
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);

  // Fetch route from OSRM
  useEffect(() => {
    let isMounted = true;
    
    const fetchRoute = async () => {
      try {
        // Start from courier if available, otherwise from pickup
        const start = courier || pickup;
          if (!start) {
            setRouteCoords([]);
            return;
          }
        
        if (!response.ok) {
          throw new Error(`OSRM returned ${response.status}`);
        }
        
        const data = await response.json();
        
        if (isMounted && data.routes && data.routes[0]) {
          // OSRM returns [lng, lat], Leaflet expects [lat, lng]
          const coords = data.routes[0].geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
          setRouteCoords(coords);
        } else if (isMounted) {
          setRouteCoords([[start.lat, start.lng], [dropoff.lat, dropoff.lng]]);
        }
      } catch (error) {
        // Silently fallback to straight line if OSRM is down or times out
        if (isMounted) {
          const start = courier || pickup;
          setRouteCoords([[start.lat, start.lng], [dropoff.lat, dropoff.lng]]);
        }
      }
    };

    fetchRoute();
    
    return () => {
      isMounted = false;
    };
  }, [pickup, dropoff, courier]);

  const origin = courier || pickup;
  const mapsUrl = origin
    ? `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${dropoff.lat},${dropoff.lng}&travelmode=driving`
    : `https://www.google.com/maps/search/?api=1&query=${dropoff.lat},${dropoff.lng}`;

  // Create custom icons
  const createEmojiIcon = (emoji: string) => L.divIcon({
    html: `<div style="font-size: 24px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); background: white; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border: 2px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">${emoji}</div>`,
    className: "custom-emoji-icon",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });

  const pickupIcon = pickup ? createEmojiIcon(pickup.emoji || "🏪") : undefined;
  const dropoffIcon = createEmojiIcon(dropoff.emoji || "📍");
  const courierIcon = courier ? createEmojiIcon(courier.emoji || "🛵") : undefined;

  const validPoints = [pickup, dropoff, ...(courier ? [courier] : [])].filter(p => p && !isNaN(p.lat) && !isNaN(p.lng));

  if (validPoints.length === 0) {
    return <div className="h-full w-full bg-muted flex items-center justify-center text-muted-foreground">Ubicaciones no disponibles</div>;
  }

  return (
    <div className="relative h-full w-full rounded-2xl overflow-hidden bg-muted flex flex-col border border-border">
      center={pickup ? [pickup.lat, pickup.lng] : [dropoff.lat, dropoff.lng]}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        <MapBounds points={validPoints} />

        {pickup && (
          <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon!}>
            <Popup>{pickup.label || "Punto de recogida"}</Popup>
          </Marker>
        )}

        <Marker position={[dropoff.lat, dropoff.lng]} icon={dropoffIcon}>
          <Popup>{dropoff.label || "Destino"}</Popup>
        </Marker>

        {courier && (
          <Marker position={[courier.lat, courier.lng]} icon={courierIcon!}>
            <Popup>{courier.label || "Domiciliario"}</Popup>
          </Marker>
        )}

        {routeCoords.length > 0 && (
          <Polyline 
            positions={routeCoords} 
            color="#f97316" // primary orange
            weight={5}
            opacity={0.8}
            dashArray={courier ? "1, 10" : undefined} // solid if no courier, dotted if courier (simulating tracking)
          />
        )}
      </MapContainer>

      {/* Floating Action Button */}
      <div className="absolute bottom-4 right-4 z-10">
        <Button 
          size="sm"
          className="shadow-lg bg-white text-black hover:bg-gray-100 font-bold gap-2"
          onClick={() => window.open(mapsUrl, '_blank')}
        >
          <MapPin className="h-4 w-4 text-primary" />
          Abrir en Maps
        </Button>
      </div>

      {/* Courier Status Overlay */}
      {courier && (
        <div className="absolute top-4 left-4 z-10 bg-white/95 backdrop-blur-sm px-4 py-2 rounded-full shadow-md border border-border flex items-center gap-3">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-success"></span>
          </div>
          <span className="text-xs font-bold text-foreground">
            {courier.label || "Domiciliario en camino"}
          </span>
        </div>
      )}
    </div>
  );
};

export default DeliveryMap;
