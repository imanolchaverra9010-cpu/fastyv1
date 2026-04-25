import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const InstallPWA = () => {
  const [supportsPWA, setSupportsPWA] = useState(false);
  const [promptInstall, setPromptInstall] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setSupportsPWA(true);
      setPromptInstall(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Detect if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const onClick = async () => {
    if (!promptInstall) {
      return;
    }
    promptInstall.prompt();
    const { outcome } = await promptInstall.userChoice;
    if (outcome === "accepted") {
      setIsVisible(false);
    }
  };

  if (!supportsPWA || isInstalled || !isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:bottom-8 md:left-auto md:right-8 md:w-96">
      <div className="bg-primary text-primary-foreground p-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-5">
        <div className="bg-white/20 p-2 rounded-xl">
          <Download className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h4 className="font-bold">Instalar Rapidito</h4>
          <p className="text-sm opacity-90">Instala la app para una experiencia más rápida.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" className="font-bold text-primary" onClick={onClick}>
            Instalar
          </Button>
          <button onClick={() => setIsVisible(false)} className="p-1 opacity-70 hover:opacity-100 transition-opacity">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
