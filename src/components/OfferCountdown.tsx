import { useEffect, useState } from "react";
import { Timer } from "lucide-react";

function msRemaining(expiresAt: string): number {
  return Math.max(0, new Date(expiresAt).getTime() - Date.now());
}

function formatRemaining(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

interface OfferCountdownProps {
  expiresAt: string;
  onExpired?: () => void;
  className?: string;
}

export function OfferCountdown({ expiresAt, onExpired, className = "" }: OfferCountdownProps) {
  const [remaining, setRemaining] = useState(() => msRemaining(expiresAt));

  useEffect(() => {
    setRemaining(msRemaining(expiresAt));
    const timer = setInterval(() => {
      const next = msRemaining(expiresAt);
      setRemaining(next);
      if (next <= 0) {
        onExpired?.();
        clearInterval(timer);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, onExpired]);

  if (remaining <= 0) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-bold text-destructive ${className}`}>
        Expirada
      </span>
    );
  }

  const urgent = remaining < 2 * 60 * 1000;

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-bold font-mono ${
        urgent ? "text-destructive animate-pulse" : "text-amber-600"
      } ${className}`}
    >
      <Timer className="h-3 w-3" />
      {formatRemaining(remaining)}
    </span>
  );
}

export function isOfferActive(offer: { status: string; expires_at?: string | null }): boolean {
  if (offer.status !== "pending") return false;
  if (!offer.expires_at) return true;
  return msRemaining(offer.expires_at) > 0;
}
