import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bike, ShieldCheck, Store, Utensils, User as UserIcon, LogOut, Menu, Search, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import CartButton from "@/components/CartButton";
import SearchInput from "@/components/SearchInput";
import { useAuth } from "@/context/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import logo from "@/assets/logo.png"; // Importar el logo

const nav = [
  { to: "/negocios", label: "Negocios", icon: Store },
  { to: "/pedido-abierto", label: "Pedido Abierto", icon: ShoppingBag },
  { to: "/rastreo", label: "Rastrear", icon: Bike },
];

const SiteHeader = () => {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const isInternalRole = user && ["admin", "business", "courier"].includes(user.role);

  const handleProfileClick = () => {
    if (user?.role === "customer") navigate("/perfil");
    else if (user?.role === "business") navigate("/admin-negocio"); // Asumiendo que existe o se creará
    else if (user?.role === "courier") navigate("/domiciliario");
    else if (user?.role === "admin") navigate("/admin");
  };

  const closeMenu = () => setIsOpen(false);

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/80 border-b border-border/50 shadow-sm">
      <div className="container flex h-20 items-center justify-between gap-8">
        <div className="flex items-center gap-8 flex-1">
          <Link to="/" className="flex items-center gap-2 group shrink-0">
            <img src={logo} alt="Rapidito Logo" className="h-11 w-auto transition-transform group-hover:scale-105" />
          </Link>

          {!isInternalRole && (
            <div className="hidden lg:flex flex-1 max-w-md">
              <SearchInput variant="compact" placeholder="Buscar comida, locales..." />
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {!isInternalRole && (
            <nav className="hidden md:flex items-center gap-1 mr-2">
              {nav.map((n) => {
                const active = pathname.startsWith(n.to);
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                      active
                        ? "bg-primary text-primary-foreground shadow-soft"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <n.icon className="h-4 w-4" />
                    {n.label}
                  </Link>
                );
              })}
            </nav>
          )}

          <div className="h-8 w-px bg-border/60 mx-1 hidden sm:block" />

          {/* Desktop Actions */}
          <div className="hidden sm:flex items-center gap-3">
            {!isInternalRole && <CartButton />}
            
            {user ? (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="rounded-full h-11 w-11 hover:bg-primary/5 hover:text-primary transition-colors" onClick={handleProfileClick}>
                  <div className="h-9 w-9 rounded-full bg-gradient-hero flex items-center justify-center text-white font-bold text-sm">
                    {user.username[0].toUpperCase()}
                  </div>
                </Button>
                <Button variant="ghost" size="icon" className="rounded-full h-11 w-11 text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors" onClick={logout}>
                  <LogOut className="h-5 w-5" />
                </Button>
              </div>
            ) : (
              <Button asChild variant="hero" size="lg" className="rounded-2xl px-6 h-12 shadow-glow">
                <Link to="/login">Iniciar Sesión</Link>
              </Button>
            )}

            {!isInternalRole && (
              <Button asChild variant="hero" size="sm" className="hidden sm:inline-flex rounded-xl font-bold shadow-soft px-5">
                <Link to="/negocios/registro">Registra tu negocio</Link>
              </Button>
            )}
          </div>

          {/* Mobile Menu Trigger */}
          <div className="flex sm:hidden items-center gap-2">
            {!isInternalRole && <CartButton />}
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-xl">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px] p-0">
                <SheetHeader className="p-6 border-b text-left">
                  <SheetTitle className="flex items-center gap-2">
                    <img src={logo} alt="Rapidito Logo" className="h-8 w-auto" />
                    <span className="font-bold text-xl bg-gradient-hero bg-clip-text text-transparent">Rapidito</span>
                  </SheetTitle>
                </SheetHeader>
                
                <div className="p-4 space-y-6">
                  {!isInternalRole && (
                    <>
                      <div className="space-y-4">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-2">Explorar</p>
                        <nav className="flex flex-col gap-1">
                          {nav.map((n) => (
                            <Link
                              key={n.to}
                              to={n.to}
                              onClick={closeMenu}
                              className="flex items-center gap-3 px-4 py-3 rounded-xl text-base font-semibold hover:bg-primary/5 transition-colors"
                            >
                              <n.icon className="h-5 w-5 text-primary" />
                              {n.label}
                            </Link>
                          ))}
                        </nav>
                      </div>

                      <div className="space-y-4">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-2">Búsqueda</p>
                        <div className="px-2">
                          <SearchInput variant="compact" placeholder="¿Qué quieres pedir?" />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="pt-6 border-t space-y-3">
                    {user ? (
                      <>
                        <div className="px-4 py-3 bg-muted rounded-xl mb-4">
                          <p className="font-bold text-sm">{user.username}</p>
                          <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
                        </div>
                        {!isInternalRole && (
                          <Button asChild variant="outline" className="w-full justify-start gap-3 rounded-xl" onClick={closeMenu}>
                            <Link to="/rastreo">
                              <Search className="h-4 w-4" />
                              Rastrear pedido
                            </Link>
                          </Button>
                        )}
                        <Button asChild variant="outline" className="w-full justify-start gap-3 rounded-xl" onClick={closeMenu}>
                          <Link to={
                            user.role === 'admin' ? '/admin' : 
                            user.role === 'courier' ? '/domiciliario' : 
                            user.role === 'business' ? '/negocio' : 
                            '/perfil'
                          }>
                            <UserIcon className="h-4 w-4" />
                            {user.role === 'customer' ? 'Mi Perfil' : 'Panel de control'}
                          </Link>
                        </Button>
                        <Button variant="destructive" className="w-full justify-start gap-3 rounded-xl" onClick={() => { logout(); closeMenu(); }}>
                          <LogOut className="h-4 w-4" />
                          Cerrar sesión
                        </Button>
                      </>
                    ) : (
                      <>
                        {!isInternalRole && (
                          <Button asChild className="w-full rounded-xl font-bold py-6" variant="hero">
                            <Link to="/negocios/registro" onClick={closeMenu}>Registra tu negocio</Link>
                          </Button>
                        )}
                        <Button asChild variant="soft" className="w-full rounded-xl font-semibold py-6">
                          <Link to="/login" onClick={closeMenu}>Iniciar sesión</Link>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
};

export default SiteHeader;
