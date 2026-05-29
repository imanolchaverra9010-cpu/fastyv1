import { Hammer } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface AdminMaintenanceToggleProps {
  enabled: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

export function AdminMaintenanceToggle({ enabled, disabled, onToggle }: AdminMaintenanceToggleProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2 py-1 sm:gap-2 sm:px-3 sm:py-1.5 transition-colors",
        enabled ? "border-orange-500/30 bg-orange-500/10" : "border-border/40 bg-muted/50",
      )}
    >
      <Hammer
        className={cn(
          "h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4",
          enabled ? "animate-pulse text-orange-500" : "text-muted-foreground",
        )}
      />
      <span className="hidden text-xs font-medium sm:inline">Mantenimiento</span>
      <Switch
        checked={enabled}
        onCheckedChange={onToggle}
        disabled={disabled}
        className="scale-[0.85] sm:scale-100"
        aria-label="Modo mantenimiento"
      />
    </div>
  );
}
