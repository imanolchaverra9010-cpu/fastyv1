import {
  Car,
  ChevronUp,
  Image,
  LayoutDashboard,
  LogOut,
  Package,
  Palette,
  PiggyBank,
  Send,
  Shield,
  Store,
  Users,
  Utensils,
  X,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

const adminNav = [
  { icon: LayoutDashboard, label: "Panel Principal", to: "/admin" },
  { icon: PiggyBank, label: "Operación", to: "/admin/operacion" },
  { icon: Utensils, label: "Solicitudes", to: "/admin/solicitudes" },
  { icon: Package, label: "Pedidos", to: "/admin/pedidos" },
  { icon: Store, label: "Negocios", to: "/admin/negocios" },
  { icon: Users, label: "Domiciliarios", to: "/admin/domiciliarios" },
  { icon: Car, label: "Viajes", to: "/admin/viajes" },
  { icon: Palette, label: "Personalización", to: "/admin/colores" },
  { icon: Image, label: "Banners", to: "/admin/banners" },
  { icon: Send, label: "Notificaciones", to: "/admin/notificaciones" },
];

export function AdminSidebar() {
  const { pathname, search } = useLocation();
  const { user, logout } = useAuth();
  const { isMobile, setOpenMobile } = useSidebar();
  const currentPath = pathname + search;

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border/60">
      <SidebarHeader className="border-b border-border/60 bg-gradient-to-br from-primary/10 via-background to-background px-4 py-4">
        <div className="flex items-center gap-2">
          <Link to="/" className="flex min-w-0 flex-1 items-center gap-3 group" onClick={handleNavClick}>
            <img src={logo} alt="Fasty Logo" className="h-8 shrink-0" />
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-bold">Fasty Admin</p>
              <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                <Shield className="h-3 w-3 text-primary" />
                Panel de control
              </p>
            </div>
          </Link>
          {isMobile && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-xl md:hidden"
              onClick={() => setOpenMobile(false)}
              aria-label="Cerrar menú"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="px-1 py-2">
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 group-data-[collapsible=icon]:hidden">
            Gestión
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {adminNav.map((item) => {
                const isActive =
                  currentPath === item.to || (item.to === "/admin" && currentPath === "/admin");
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                      className={`min-h-11 rounded-xl px-3 transition-all active:scale-[0.98] ${
                        isActive
                          ? "border-l-[3px] border-primary bg-primary/12 font-semibold text-primary shadow-sm hover:bg-primary/16 hover:text-primary"
                          : "border-l-[3px] border-transparent hover:bg-muted/60"
                      }`}
                    >
                      <Link to={item.to} className="flex items-center gap-3" onClick={handleNavClick}>
                        <item.icon className="h-[1.125rem] w-[1.125rem] shrink-0" />
                        <span className="font-medium">{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-border/60 bg-muted/20 p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="min-h-12 rounded-xl hover:bg-muted/60 active:scale-[0.98] transition-all"
                >
                  <div className="flex w-full items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                      {user?.username?.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1 overflow-hidden text-left group-data-[collapsible=icon]:hidden">
                      <span className="block truncate text-sm font-semibold">{user?.username}</span>
                      <span className="block truncate text-xs capitalize text-muted-foreground">
                        {user?.role === "admin"
                          ? "Administrador"
                          : user?.role === "courier"
                            ? "Domiciliario"
                            : user?.role === "business"
                              ? "Negocio"
                              : user?.role}
                      </span>
                    </div>
                    <ChevronUp className="ml-auto h-4 w-4 shrink-0 group-data-[collapsible=icon]:hidden" />
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="mb-2 w-[calc(100vw-2rem)] max-w-56 rounded-xl sm:w-56">
                <DropdownMenuItem onClick={logout} className="rounded-lg text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
