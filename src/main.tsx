import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Unregister any existing service workers from other projects on the same port
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
      console.log("Service Worker unregistered:", registration);
    }
  }).catch((err) => {
    console.error("Error unregistering service workers:", err);
  });
}

createRoot(document.getElementById("root")!).render(<App />);
