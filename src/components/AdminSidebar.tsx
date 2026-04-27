import {
  Bike,
  ChevronUp,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  Store,
  Users,
  Utensils,
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
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";
import logo from "@/assets/logo.png"; // Importar el logo

const adminNav = [
  { icon: LayoutDashboard, label: "Panel Principal", to: "/admin" },
  { icon: Utensils, label: "Solicitudes", to: "/admin/solicitudes" },
  { icon: Package, label: "Pedidos", to: "/admin/pedidos" },
  { icon: Store, label: "Negocios", to: "/admin/negocios" },
  { icon: Users, label: "Domiciliarios", to: "/admin/domiciliarios" },
];

export function AdminSidebar() {
  const { pathname, search } = useLocation();
  const { user, logout } = useAuth();
  const currentPath = pathname + search;

  return (
    <Sidebar collapsible="icon" className="border-r border-border/60">
      <SidebarHeader className="h-16 flex items-center px-4 border-b border-border/60">
        <Link to="/" className="flex items-center gap-2 group">
          <img src={logo} alt="Fasty Logo" className="h-8" />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
            Gestión
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminNav.map((item) => {
                const isActive = currentPath === item.to || (item.to === "/admin" && currentPath === "/admin");
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                      className={isActive ? "bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary" : ""}
                    >
                      <Link to={item.to} className="flex items-center gap-3">
                        <item.icon className="h-4 w-4" />
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
      <SidebarFooter className="p-4 border-t border-border/60">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3 w-full">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                      {user?.username?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col text-left group-data-[collapsible=icon]:hidden overflow-hidden">
                      <span className="text-sm font-semibold truncate">
                        {user?.username}
                      </span>
                      <span className="text-xs text-muted-foreground capitalize">
                        {user?.role === 'admin' ? 'Administrador' : 
                         user?.role === 'courier' ? 'Domiciliario' : 
                         user?.role === 'business' ? 'Negocio' : user?.role}
                      </span>
                    </div>
                    <ChevronUp className="h-4 w-4 ml-auto group-data-[collapsible=icon]:hidden" />
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56 mb-2">
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
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
