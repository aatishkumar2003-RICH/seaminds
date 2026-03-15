import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { installGlobalAuthErrorHandler } from "./lib/authErrorHandler";
import { initAnalytics } from "./lib/analytics";

// Catch infinite auth token refresh loops before they freeze the app
installGlobalAuthErrorHandler();

// Load GA4 only if user previously accepted cookies
initAnalytics();

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
