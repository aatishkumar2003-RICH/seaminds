import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { installGlobalAuthErrorHandler } from "./lib/authErrorHandler";

// Catch infinite auth token refresh loops before they freeze the app
installGlobalAuthErrorHandler();

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
