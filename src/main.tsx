import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installGlobalAuthErrorHandler } from "./lib/authErrorHandler";

// Catch infinite auth token refresh loops before they freeze the app
installGlobalAuthErrorHandler();

createRoot(document.getElementById("root")!).render(<App />);
