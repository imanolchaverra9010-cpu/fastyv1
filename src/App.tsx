import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { applyTheme } from "@/utils/theme";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import { CartProvider, useCart } from "@/context/CartContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Businesses from "./pages/Businesses.tsx";
import BusinessDetail from "./pages/BusinessDetail.tsx";
import BusinessRegister from "./pages/BusinessRegister.tsx";
import CourierPanel from "./pages/CourierPanel.tsx";
import BusinessPanel from "./pages/BusinessPanel.tsx";
import { OrdersTab } from "@/components/business/OrdersTab";
import { ExternalOrdersTab } from "@/components/business/ExternalOrdersTab";
import { MenuTab } from "@/components/business/MenuTab";
import { PromotionsTab } from "@/components/business/PromotionsTab";
import { StatsTab } from "@/components/business/StatsTab";
import { ProfileTab } from "@/components/business/ProfileTab";
import { CouriersTab } from "@/components/business/CouriersTab";
import OrderTracking from "./pages/OrderTracking.tsx";
import AdminPanel from "./pages/AdminPanel.tsx";
import AdminColors from "./pages/AdminColors.tsx";
import AdminBanners from "./pages/AdminBanners.tsx";
import AdminNotifications from "./pages/AdminNotifications.tsx";
import AdminOperations from "./pages/AdminOperations.tsx";
import Pedidos from "./pages/Pedidos.tsx";
import AdminBusinesses from "./pages/AdminBusinesses.tsx";
import AdminRequests from "./pages/AdminRequests.tsx";
import Checkout from "./pages/Checkout.tsx";
import OpenOrder from "./pages/OpenOrder.tsx";
import UserProfile from "./pages/UserProfile.tsx";
import Login from "./pages/Login.tsx";
import PrivacyPolicy from "./pages/PrivacyPolicy.tsx";
import Terms from "./pages/Terms.tsx";
import Support from "./pages/Support.tsx";
import MaintenancePage from "./pages/Maintenance.tsx";
import PaymentSuccess from "./pages/PaymentSuccess.tsx";
import ProtectedRoute from "./components/ProtectedRoute.tsx";
import CustomerOrGuestRoute from "./components/CustomerOrGuestRoute.tsx";

import SiteHeader from "@/components/SiteHeader";

import AdminCouriers from "@/pages/AdminCouriers";
import Rides from "./pages/Rides.tsx";
import RideDetail from "./pages/RideDetail.tsx";
import ConductorRides from "./pages/ConductorRides.tsx";
import DriverRegister from "./pages/DriverRegister.tsx";
import RideTrack from "./pages/RideTrack.tsx";
import AdminRides from "./pages/AdminRides.tsx";
import { InstallPWA } from "./components/InstallPWA";
import { NotificationPrompt } from "./components/NotificationPrompt";

// Component to scroll to top on route change
const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 segundos de gracia antes de revalidar
      refetchOnWindowFocus: false, // Evita peticiones masivas al cambiar de pestaña
      retry: 1,
    },
  },
});

const AppContent = () => {
  const { pathname } = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [checkingMaint, setCheckingMaint] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchMaintenance = async () => {
      try {
        const res = await fetch("/api/maintenance");
        if (!cancelled && res.ok) {
          const data = await res.json();
          setIsMaintenance(Boolean(data.maintenance_mode));
        } else if (!cancelled) {
          setIsMaintenance(false);
        }
      } catch {
        if (!cancelled) setIsMaintenance(false);
      } finally {
        if (!cancelled) setCheckingMaint(false);
      }
    };

    fetchMaintenance();
    const interval = setInterval(fetchMaintenance, 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Cargar y aplicar el color de tema personalizado desde el backend al iniciar la app
  useEffect(() => {
    const fetchThemeColor = async () => {
      try {
        const res = await fetch("/api/theme-color");
        if (res.ok) {
          const data = await res.json();
          if (data.theme_color) {
            applyTheme(data.theme_color);
          }
        }
      } catch (err) {
        console.error("Error al cargar el color del tema dinámico:", err);
      }
    };
    fetchThemeColor();
  }, []);

  const isAdmin = user?.role === 'admin';
  const isMaintenanceActive = isMaintenance && !isAdmin;
  const isLoginPage = pathname === "/login";
  const isAdminPath = pathname.startsWith("/admin");

  if ((checkingMaint || authLoading) && !isLoginPage) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-warm">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (isMaintenanceActive && !isAdminPath && !isLoginPage) {
    return <MaintenancePage />;
  }

  const hideHeader = ["/login", "/register"].includes(pathname) ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/domiciliario") ||
    pathname.startsWith("/conductor/viajes");

  return (
    <>
      {!hideHeader && <SiteHeader />}
      <InstallPWA />
      <NotificationPrompt />
      <Toaster />
      <Sonner />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<CustomerOrGuestRoute><Index /></CustomerOrGuestRoute>} />
        <Route path="/negocios" element={<CustomerOrGuestRoute><Businesses /></CustomerOrGuestRoute>} />
        <Route path="/negocios/registro" element={<BusinessRegister />} />
        <Route path="/negocios/:id" element={<CustomerOrGuestRoute><BusinessDetail /></CustomerOrGuestRoute>} />
        <Route path="/checkout" element={<CustomerOrGuestRoute><Checkout /></CustomerOrGuestRoute>} />
        <Route path="/payment/success" element={<PaymentSuccess />} />
        <Route path="/pedido-abierto" element={<CustomerOrGuestRoute><OpenOrder /></CustomerOrGuestRoute>} />
        <Route path="/perfil" element={<ProtectedRoute allowedRoles={['customer']}><UserProfile /></ProtectedRoute>} />
        <Route path="/rastreo" element={<CustomerOrGuestRoute><OrderTracking /></CustomerOrGuestRoute>} />
        <Route path="/rastreo/seguir/:trackToken" element={<CustomerOrGuestRoute><OrderTracking /></CustomerOrGuestRoute>} />
        <Route path="/rastreo/:orderId" element={<CustomerOrGuestRoute><OrderTracking /></CustomerOrGuestRoute>} />
        <Route path="/politica-de-privacidad" element={<PrivacyPolicy />} />
        <Route path="/terminos-y-condiciones" element={<Terms />} />
        <Route path="/soporte" element={<Support />} />

        {/* Viajes — módulo separado */}
        <Route path="/viajes" element={<CustomerOrGuestRoute><Rides /></CustomerOrGuestRoute>} />
        <Route path="/viajes/seguir/:token" element={<RideTrack />} />
        <Route path="/conductor/registro" element={<DriverRegister />} />
        <Route path="/viajes/:rideId" element={<ProtectedRoute allowedRoles={['customer', 'admin', 'courier']}><RideDetail /></ProtectedRoute>} />
        <Route
          path="/conductor/viajes"
          element={
            <ProtectedRoute allowedRoles={['courier', 'admin']}>
              <ConductorRides />
            </ProtectedRoute>
          }
        />

        {/* Protected Routes */}
        <Route
          path="/domiciliario"
          element={
            <ProtectedRoute allowedRoles={['courier', 'admin']}>
              <CourierPanel />
            </ProtectedRoute>
          }
        />
        <Route
          path="/negocio"
          element={
            <ProtectedRoute allowedRoles={['business', 'admin']}>
              <BusinessPanel />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="pedidos" replace />} />
          <Route path="pedidos" element={<OrdersTab />} />
          <Route path="pedidos-externos" element={<ExternalOrdersTab />} />
          <Route path="menu" element={<MenuTab />} />
          <Route path="repartidores" element={<CouriersTab />} />
          <Route path="estadisticas" element={<StatsTab />} />
          <Route path="perfil" element={<ProfileTab />} />
        </Route>
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminPanel />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/pedidos"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Pedidos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/solicitudes"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminRequests />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/negocios"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminBusinesses />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/domiciliarios"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminCouriers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/colores"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminColors />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/banners"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminBanners />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/notificaciones"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminNotifications />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/operacion"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminOperations />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/viajes"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminRides />
            </ProtectedRoute>
          }
        />

        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};



const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

if (!googleClientId) {
  console.warn("Advertencia: VITE_GOOGLE_CLIENT_ID no está configurado. El inicio de sesión con Google no estará disponible.");
}

const App = () => (
  <GoogleOAuthProvider clientId={googleClientId}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <ScrollToTop />
          <AuthProvider>
            <CartProvider>
              <AppContent />
            </CartProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </GoogleOAuthProvider>
);
export default App;
