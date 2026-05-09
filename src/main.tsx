import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Global fetch interceptor to automatically attach JWT tokens
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  let [resource, config] = args;
  
  if (typeof resource === 'string' && resource.startsWith('/api/')) {
    const savedUser = localStorage.getItem("rapidito_user");
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        if (user && user.token) {
          config = config || {};
          config.headers = {
            ...config.headers,
            'Authorization': `Bearer ${user.token}`
          };
        }
      } catch (e) {
        console.error("Error parsing user token for fetch interceptor");
      }
    }
  }
  
  const response = await originalFetch(resource, config);
  
  // Handle 401 Unauthorized globally
  if (response.status === 401 && typeof window !== 'undefined' && window.location.pathname !== '/login') {
    localStorage.removeItem("rapidito_user");
    window.location.href = '/login';
  }
  
  return response;
};

// PWA initialization is handled by vite-plugin-pwa

createRoot(document.getElementById("root")!).render(<App />);
