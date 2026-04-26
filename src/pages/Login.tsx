import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Utensils, ArrowRight, Loader2, Mail, Facebook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useGoogleLogin } from '@react-oauth/google';
import FacebookLogin from "@greatsumini/react-facebook-login";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Error al iniciar sesión");
      }

      const data = await response.json();
      login({
        id: data.id,
        username: data.username,
        role: data.role,
        token: data.access_token,
        avatar_url: data.avatar_url,
      });

      toast({
        title: "¡Bienvenido de nuevo!",
        description: `Has iniciado sesión como ${data.username}`,
      });
    } catch (error: any) {
      toast({
        title: "Error de inicio de sesión",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRealSocialLogin = async (provider: 'google' | 'facebook', token: string) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/social-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, token }),
      });

      if (!response.ok) {
        throw new Error("Error en la autenticación social");
      }

      const data = await response.json();
      login({
        id: data.id,
        username: data.username,
        role: data.role,
        token: data.access_token,
        avatar_url: data.avatar_url,
      });

      toast({
        title: `¡Bienvenido con ${provider}!`,
        description: `Has iniciado sesión como ${data.username}`,
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const loginGoogle = useGoogleLogin({
    onSuccess: (tokenResponse) => handleRealSocialLogin('google', tokenResponse.access_token),
    onError: () => toast({ title: "Error", description: "El login de Google falló", variant: "destructive" }),
  });

  const handleFacebookResponse = (response: any) => {
    if (response.accessToken) {
      handleRealSocialLogin('facebook', response.accessToken);
    } else {
      toast({ title: "Error", description: "El login de Facebook fue cancelado", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-warm flex flex-col items-center justify-center p-4">
      <Link to="/" className="flex items-center gap-2 group mb-8">
        <span className="grid place-items-center h-10 w-10 rounded-xl bg-gradient-hero shadow-soft group-hover:scale-105 transition-transform">
          <Utensils className="h-6 w-6 text-primary-foreground" />
        </span>
        <span className="font-display font-bold text-2xl tracking-tight">
          Rapidito<span className="text-primary">.</span>
        </span>
      </Link>

      <Card className="w-full max-w-md shadow-glow border-border/60">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-display font-bold">Iniciar sesión</CardTitle>
          <CardDescription>
            Ingresa tus credenciales para acceder a tu panel.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Contraseña</Label>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="rounded-xl"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full h-12 rounded-xl bg-gradient-hero font-bold text-lg" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                <>
                  Entrar <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>

            <div className="relative w-full py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">O continuar con</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl h-11 font-semibold"
                onClick={() => loginGoogle()}
                disabled={isLoading}
              >
                <Mail className="mr-2 h-4 w-4 text-red-500" />
                Google
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl h-11 font-semibold"
                onClick={() => toast({
                  title: "Próximamente",
                  description: "Estamos trabajando en la funcionalidad de inicio de sesión con Facebook.",
                })}
                disabled={isLoading}
              >
                <Facebook className="mr-2 h-4 w-4 text-blue-600" />
                Facebook
              </Button>
            </div>

            <div className="text-sm text-center text-muted-foreground mt-4 space-y-2">
              <p>
                ¿No tienes una cuenta?{" "}
                <Link to="/negocios/registro" className="text-primary font-semibold hover:underline">
                  Regístrate aquí
                </Link>
              </p>
              <p>
                Al iniciar sesión, aceptas nuestra{" "}
                <Link to="/politica-de-privacidad" className="text-muted-foreground underline hover:text-foreground">
                  Política de Privacidad
                </Link>
              </p>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default Login;
