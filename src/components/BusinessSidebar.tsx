import { LogOut, Home, Package, Menu, BarChart3, TrendingUp } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate, NavLink } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function BusinessSidebar() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-4">
          <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center font-bold">
            🏪
          </div>
          <span className="font-bold text-sm">Fasty</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink to="/negocio/pedidos" className={({ isActive }) => `flex items-center gap-2 ${isActive ? 'text-primary font-bold bg-primary/10' : ''}`}>
                <Package className="h-4 w-4" />
                <span>Pedidos</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink to="/negocio/menu" className={({ isActive }) => `flex items-center gap-2 ${isActive ? 'text-primary font-bold bg-primary/10' : ''}`}>
                <Menu className="h-4 w-4" />
                <span>Menú</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink to="/negocio/promociones" className={({ isActive }) => `flex items-center gap-2 ${isActive ? 'text-primary font-bold bg-primary/10' : ''}`}>
                <TrendingUp className="h-4 w-4" />
                <span>Promociones</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink to="/negocio/estadisticas" className={({ isActive }) => `flex items-center gap-2 ${isActive ? 'text-primary font-bold bg-primary/10' : ''}`}>
                <BarChart3 className="h-4 w-4" />
                <span>Estadísticas</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink to="/negocio/perfil" className={({ isActive }) => `flex items-center gap-2 ${isActive ? 'text-primary font-bold bg-primary/10' : ''}`}>
                <Home className="h-4 w-4" />
                <span>Perfil</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
      <div className="p-4 border-t border-border/60">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </Sidebar>
  );
}
