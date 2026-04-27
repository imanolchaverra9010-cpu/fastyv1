import {
  Bike,
  ChevronUp,
  History,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  Settings,
  User,
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
import logo from "@/assets/logo.png";

const courierNav = [
  { icon: LayoutDashboard, label: "Panel Principal", to: "/domiciliario" },
  { icon: Package, label: "Pedidos Disponibles", to: "/domiciliario?tab=available" },
  { icon: History, label: "Historial Entregas", to: "/domiciliario?tab=history" },
  { icon: User, label: "Mi Perfil", to: "/domiciliario/profile" },
  { icon: Settings, label: "Ajustes", to: "/domiciliario/settings" },
];

interface CourierSidebarProps {
  activeTab?: "dashboard" | "available" | "history" | "profile";
  setActiveTab?: (tab: "dashboard" | "available" | "history" | "profile") => void;
  profileImage?: string | null;
}

export function CourierSidebar({ activeTab = "dashboard", setActiveTab, profileImage }: CourierSidebarProps) {
  const { pathname, search } = useLocation();
  const { user, logout } = useAuth();
  const currentPath = pathname + search;

  const handleTabClick = (tab: "dashboard" | "available" | "history" | "profile") => {
    if (setActiveTab) {
      setActiveTab(tab);
    }
  };

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
            Operación
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === "dashboard"}
                  tooltip="Panel Principal"
                  className={activeTab === "dashboard" ? "bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary" : ""}
                  onClick={() => handleTabClick("dashboard")}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="font-medium">Panel Principal</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === "available"}
                  tooltip="Pedidos Disponibles"
                  className={activeTab === "available" ? "bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary" : ""}
                  onClick={() => handleTabClick("available")}
                >
                  <Package className="h-4 w-4" />
                  <span className="font-medium">Pedidos Disponibles</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === "history"}
                  tooltip="Historial Entregas"
                  className={activeTab === "history" ? "bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary" : ""}
                  onClick={() => handleTabClick("history")}
                >
                  <History className="h-4 w-4" />
                  <span className="font-medium">Historial Entregas</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === "profile"}
                  tooltip="Mi Perfil"
                  className={activeTab === "profile" ? "bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary" : ""}
                  onClick={() => handleTabClick("profile")}
                >
                  <User className="h-4 w-4" />
                  <span className="font-medium">Mi Perfil</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
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
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0 overflow-hidden">
                      {profileImage ? (
                        <img src={profileImage.startsWith("http") ? profileImage : (profileImage.startsWith("/api") ? profileImage : `/api${profileImage}`)} alt="Profile" className="h-full w-full object-cover" />
                      ) : (
                        user?.username?.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex flex-col text-left group-data-[collapsible=icon]:hidden overflow-hidden">
                      <span className="text-sm font-semibold truncate">
                        {user?.username}
                      </span>
                      <span className="text-xs text-muted-foreground capitalize">
                        {user?.role === 'courier' ? 'Domiciliario' : 
                         user?.role === 'admin' ? 'Administrador' : 
                         user?.role === 'business' ? 'Negocio' : user?.role}
                      </span>
                    </div>
                    <ChevronUp className="h-4 w-4 ml-auto group-data-[collapsible=icon]:hidden" />
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56 mb-2">
                <DropdownMenuItem asChild>
                  <Link to="/domiciliario/profile" className="flex items-center">
                    <User className="mr-2 h-4 w-4" /> Perfil
                  </Link>
                </DropdownMenuItem>
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
