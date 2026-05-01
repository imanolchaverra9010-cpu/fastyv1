import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
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
import { MenuTab } from "@/components/business/MenuTab";
import { PromotionsTab } from "@/components/business/PromotionsTab";
import { StatsTab } from "@/components/business/StatsTab";
import { ProfileTab } from "@/components/business/ProfileTab";
import { CouriersTab } from "@/components/business/CouriersTab";
import OrderTracking from "./pages/OrderTracking.tsx";
import AdminPanel from "./pages/AdminPanel.tsx";
import Pedidos from "./pages/Pedidos.tsx";
import AdminBusinesses from "./pages/AdminBusinesses.tsx";
import AdminRequests from "./pages/AdminRequests.tsx";
import Checkout from "./pages/Checkout.tsx";
import OpenOrder from "./pages/OpenOrder.tsx";
import UserProfile from "./pages/UserProfile.tsx";
import Login from "./pages/Login.tsx";
import PrivacyPolicy from "./pages/PrivacyPolicy.tsx";
import MaintenancePage from "./pages/Maintenance.tsx";
import ProtectedRoute from "./components/ProtectedRoute.tsx";
import CustomerOrGuestRoute from "./components/CustomerOrGuestRoute.tsx";

import SiteHeader from "@/components/SiteHeader";

import AdminCouriers from "@/pages/AdminCouriers";
import { InstallPWA } from "./components/InstallPWA";
import { NotificationPrompt } from "./components/NotificationPrompt";

const queryClient = new QueryClient();

const AppContent = () => {
  const { pathname } = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [checkingMaint, setCheckingMaint] = useState(true);

  useEffect(() => {
    const checkMaint = async () => {
      try {
        const res = await fetch("/api/maintenance", { 
          cache: 'no-store',
          headers: { 'Accept': 'application/json' }
        });
        
        if (res.ok) {
          const data = await res.json();
          setIsMaintenance(!!data.maintenance_mode);
        } else {
          // Si falla el endpoint /api, intentar /maintenance como fallback
          const fallbackRes = await fetch("/maintenance", { cache: 'no-store' });
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            setIsMaintenance(!!fallbackData.maintenance_mode);
          }
        }
      } catch (e) {
        // No loguear error si es un fallo de conexión común (para no saturar la consola)
        if (e instanceof TypeError && e.message === 'Failed to fetch') {
          // Silencioso o log reducido
        } else {
          console.error("Error checking maintenance:", e);
        }
      } finally {
        setCheckingMaint(false);
      }
    };
    
    checkMaint();
    
    // Check when window gets focus
    window.addEventListener('focus', checkMaint);
    
    // Periodic check every 30 seconds
    const interval = setInterval(checkMaint, 30000);
    
    return () => {
      window.removeEventListener('focus', checkMaint);
      clearInterval(interval);
    };
  }, [pathname]);

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
    pathname.startsWith("/domiciliario");

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
        <Route path="/pedido-abierto" element={<CustomerOrGuestRoute><OpenOrder /></CustomerOrGuestRoute>} />
        <Route path="/perfil" element={<ProtectedRoute allowedRoles={['customer']}><UserProfile /></ProtectedRoute>} />
        <Route path="/rastreo" element={<CustomerOrGuestRoute><OrderTracking /></CustomerOrGuestRoute>} />
        <Route path="/rastreo/:orderId" element={<CustomerOrGuestRoute><OrderTracking /></CustomerOrGuestRoute>} />
        <Route path="/politica-de-privacidad" element={<PrivacyPolicy />} />

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

        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};



const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

if (!googleClientId) {
  throw new Error("Falta VITE_GOOGLE_CLIENT_ID en entorno");
}

const App = () => (
  <GoogleOAuthProvider clientId={googleClientId}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
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
