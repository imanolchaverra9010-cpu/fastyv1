import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "./ui/button";
import { Check, MapPin } from "lucide-react";

// Fix Leaflet icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface LocationPickerProps {
  initialPos: { lat: number; lng: number };
  onConfirm: (pos: { lat: number; lng: number }) => void;
  onCancel: () => void;
}

const LocationMarker = ({ pos, setPos }: { pos: { lat: number; lng: number }, setPos: (p: { lat: number; lng: number }) => void }) => {
  const map = useMapEvents({
    drag() {
      const center = map.getCenter();
      setPos({ lat: center.lat, lng: center.lng });
    },
    move() {
      const center = map.getCenter();
      setPos({ lat: center.lat, lng: center.lng });
    }
  });

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-[1000] pointer-events-none mb-4">
      <div className="relative">
        <div className="h-10 w-10 bg-primary rounded-full flex items-center justify-center shadow-glow animate-bounce">
          <MapPin className="h-6 w-6 text-white" />
        </div>
        <div className="h-2 w-2 bg-black/20 rounded-full blur-[2px] mx-auto mt-1" />
      </div>
    </div>
  );
};

export default function LocationPicker({ initialPos, onConfirm, onCancel }: LocationPickerProps) {
  const [pos, setPos] = useState(initialPos);

  return (
    <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-2xl rounded-[2rem] overflow-hidden shadow-2xl border border-border animate-in zoom-in-95 duration-300">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-xl font-display font-bold">Ajusta tu ubicación</h3>
            <p className="text-sm text-muted-foreground">Mueve el mapa para centrar el pin en tu puerta</p>
          </div>
        </div>
        
        <div className="h-[400px] relative">
          <MapContainer 
            center={[initialPos.lat, initialPos.lng]} 
            zoom={18} 
            style={{ height: "100%", width: "100%" }}
            zoomControl={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              attribution='&copy; OpenStreetMap'
            />
            <LocationMarker pos={pos} setPos={setPos} />
          </MapContainer>
          
          <div className="absolute top-4 right-4 z-[1000] space-y-2">
            <div className="bg-white/90 backdrop-blur-sm p-3 rounded-2xl shadow-md border border-border text-[10px] font-bold uppercase tracking-wider text-primary">
              Modo Ajuste Fino
            </div>
          </div>
        </div>

        <div className="p-6 bg-muted/30 grid grid-cols-2 gap-4">
          <Button variant="outline" onClick={onCancel} className="h-14 rounded-2xl font-bold">
            Cancelar
          </Button>
          <Button onClick={() => onConfirm(pos)} className="h-14 rounded-2xl font-bold gap-2 shadow-glow-primary" variant="hero">
            <Check className="h-5 w-5" /> Confirmar Ubicación
          </Button>
        </div>
      </div>
    </div>
  );
}
