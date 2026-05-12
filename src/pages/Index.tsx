import { Hammer, Sparkles } from "lucide-react";

const Index = () => {
    return (
        <div className="min-h-screen bg-gradient-warm flex items-center justify-center p-4">
            {/* Elementos decorativos de fondo */}
            <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-primary/20 blur-3xl" aria-hidden />
            <div className="absolute top-40 -left-32 h-[400px] w-[400px] rounded-full bg-accent/15 blur-3xl" aria-hidden />

            <div className="relative z-10 max-w-2xl w-full text-center animate-fade-up">
                <div className="mb-8 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-100 text-primary text-sm font-bold shadow-sm">
                    <Sparkles className="h-4 w-4" />
                    Estamos mejorando para ti
                </div>

                <div className="bg-card/80 backdrop-blur-xl border border-border/60 rounded-[3rem] p-8 md:p-16 shadow-glow">
                    <div className="flex justify-center mb-8">
                        <div className="h-24 w-24 rounded-3xl bg-gradient-hero grid place-items-center text-white shadow-lg animate-bounce">
                            <Hammer className="h-12 w-12" />
                        </div>
                    </div>

                    <h1 className="text-4xl md:text-6xl font-display font-bold tracking-tight text-balance leading-tight mb-6">
                        Pausa técnica, <br />
                        <span className="text-primary">manit@</span>.
                    </h1>

                    <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                        En este momento el **parche** está bajo mantenimiento. Estamos ajustando los motores para que tus domicilios vuelvan a volar en un click.
                    </p>

                    <div className="space-y-4 pt-6 border-t border-border">
                        <p className="text-sm font-medium text-muted-foreground">
                            Volveremos a estar disponibles muy pronto.
                        </p>
                        <div className="flex justify-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                            <div className="h-2 w-2 rounded-full bg-primary animate-pulse [animation-delay:200ms]" />
                            <div className="h-2 w-2 rounded-full bg-primary animate-pulse [animation-delay:400ms]" />
                        </div>
                    </div>
                </div>

                <footer className="mt-12 text-muted-foreground/60 text-sm">
                    <p>© {new Date().getFullYear()} Fasty · Domicilios en mantenimiento</p>
                </footer>
            </div>
        </div>
    );
};

export default Index;