import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// PWA initialization is handled by vite-plugin-pwa

createRoot(document.getElementById("root")!).render(<App />);
