import React, { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface User {
  id: number;
  username: string;
  email?: string;
  role: "admin" | "business" | "courier" | "customer";
  token: string;
  avatar_url?: string;
}

interface AuthContextType {
  user: User | null;
  login: (userData: User) => void;
  updateUser: (userData: Partial<User>) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const savedUser = localStorage.getItem("rapidito_user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error("Error parsing saved user", e);
        localStorage.removeItem("rapidito_user");
      }
    }
    setIsLoading(false);
  }, []);

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem("rapidito_user", JSON.stringify(userData));
    
    // Redirect based on role
    switch (userData.role) {
      case "admin":
        navigate("/admin");
        break;
      case "business":
        navigate("/negocio");
        break;
      case "courier":
        navigate("/domiciliario");
        break;
      case "customer":
        navigate("/");
        break;
      default:
        navigate("/");
    }
  };

  const updateUser = (userData: Partial<User>) => {
    setUser(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...userData };
      localStorage.setItem("rapidito_user", JSON.stringify(updated));
      return updated;
    });
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("rapidito_user");
    navigate("/login");
  };

  return (
    <AuthContext.Provider value={{ user, login, updateUser, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
