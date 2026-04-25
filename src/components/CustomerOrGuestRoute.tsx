import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

/**
 * Protects customer-facing routes.
 * - Guests and `customer` role → allowed through.
 * - `admin`    → redirected to /admin
 * - `courier`  → redirected to /domiciliario
 * - `business` → redirected to /negocio
 */
const CustomerOrGuestRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user || user.role === "customer") {
    return <>{children}</>;
  }

  // Logged-in non-customer users get redirected to their panel
  const panelByRole: Record<string, string> = {
    admin: "/admin",
    courier: "/domiciliario",
    business: "/negocio",
  };

  return <Navigate to={panelByRole[user.role] ?? "/"} replace />;
};

export default CustomerOrGuestRoute;
