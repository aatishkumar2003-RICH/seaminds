import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { installGlobalAuthErrorHandler } from "./lib/authErrorHandler";
import { initAnalytics } from "./lib/analytics";
import { I18nProvider } from "./i18n";
import { purgeLegacyCaches } from "./lib/pwaCacheRules";

// Catch infinite auth token refresh loops before they freeze the app
installGlobalAuthErrorHandler();

// Load GA4 only if user previously accepted cookies
initAnalytics();

// Drop the old service-worker cache that could hold personal backend responses.
purgeLegacyCaches().catch(() => {});

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <I18nProvider>
      <App />
    </I18nProvider>
  </HelmetProvider>
);
