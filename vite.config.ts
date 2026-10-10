import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";
import { runtimeCachingRules } from "./src/lib/pwaCacheRules";
import { execSync } from "child_process";

// Release metadata generated automatically per build (never hand-edited).
const BUILD_TIME = new Date().toISOString();
let BUILD_COMMIT = "";
try { BUILD_COMMIT = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { /* no git */ }
const BUILD_ID = `SM-${BUILD_COMMIT || "nogit"}-${Date.parse(BUILD_TIME).toString(36)}`;
const RELEASE = { buildId: BUILD_ID, commit: BUILD_COMMIT, buildTime: BUILD_TIME };

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __SM_BUILD_ID__: JSON.stringify(BUILD_ID),
    __SM_BUILD_COMMIT__: JSON.stringify(BUILD_COMMIT),
    __SM_BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    {
      name: "sm-release-metadata",
      generateBundle() {
        this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify(RELEASE) });
      },
    },
    mcpPlugin(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "favicon.svg", "icon-192.png", "icon-512.png", "seaminds-logo.png"],
      manifest: false, // use existing public/manifest.json
      workbox: {
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MB
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,jpg,jpeg,woff,woff2}"],
        globIgnores: ["**/version.json"],
        cleanupOutdatedCaches: true,
        navigateFallbackDenylist: [/^\/~oauth/, /^\/\.lovable\/oauth/],
        // Personal data (auth, profiles, applications, takeover) is never cached; see src/lib/pwaCacheRules.ts
        runtimeCaching: runtimeCachingRules,
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
}));
