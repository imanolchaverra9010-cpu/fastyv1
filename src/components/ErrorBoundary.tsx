import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type ErrorBoundaryState = {
  hasError: boolean;
  message?: string;
};

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Frontend error boundary:", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-gradient-warm flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-3xl border bg-card p-8 text-center shadow-glow">
          <div className="mx-auto mb-5 h-16 w-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-display font-bold">Algo salió mal</h1>
          <p className="text-muted-foreground mt-2">La aplicación tuvo un error inesperado. Puedes recargar o volver al inicio.</p>
          {this.state.message && <p className="mt-4 rounded-2xl bg-muted p-3 text-xs text-muted-foreground break-words">{this.state.message}</p>}
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => window.location.reload()} className="rounded-xl gap-2"><RefreshCw className="h-4 w-4" /> Recargar</Button>
            <Button variant="outline" onClick={() => { window.location.href = "/"; }} className="rounded-xl">Ir al inicio</Button>
          </div>
        </div>
      </div>
    );
  }
}
