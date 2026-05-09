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
  
  return originalFetch(resource, config);
};

// PWA initialization is handled by vite-plugin-pwa

createRoot(document.getElementById("root")!).render(<App />);
