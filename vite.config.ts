import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";
import { runtimeCachingRules } from "./src/lib/pwaCacheRules";
import { execSync } from "child_process";
import { writeFileSync } from "fs";
import { buildRss, buildSitemap, type FeedPost } from "./scripts/seoFeeds";

// Each publish regenerates /rss.xml and /sitemap.xml from published articles (public read).
// On any failure the committed public/ copies are kept.
const SB_URL = "https://luomzexqgcjtcmdlbevo.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1b216ZXhxZ2NqdGNtZGxiZXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0OTY4NjEsImV4cCI6MjA4NzA3Mjg2MX0.QJoLu7WC-9h4qoTEXfOMPu1OJTmu8hzBuOGLPOq1IuY";
const seoFeedsPlugin = (): Plugin => {
  let outDir = "dist";
  return {
    name: "sm-seo-feeds",
    apply: "build",
    configResolved(c) { outDir = c.build.outDir; },
    async writeBundle() {
      try {
        const q = (sel: string, lim: number) => fetch(`${SB_URL}/rest/v1/blog_posts?select=${sel}&published=eq.true&slug=not.is.null&order=created_at.desc&limit=${lim}`,
          { headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` }, signal: AbortSignal.timeout(15000) }).then((r) => r.ok ? r.json() : Promise.reject(r.status));
        const [recent, all] = await Promise.all([
          q("slug,title,excerpt,image_url,created_at", 50) as Promise<FeedPost[]>,
          q("slug,created_at,updated_at", 5000) as Promise<FeedPost[]>,
        ]);
        if (recent.length) writeFileSync(path.join(outDir, "rss.xml"), buildRss(recent));
        if (all.length) writeFileSync(path.join(outDir, "sitemap.xml"), buildSitemap(all));
      } catch (e) { console.warn("[sm-seo-feeds] kept static feeds:", e); }
    },
  };
};

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
    } satisfies Plugin,
    mcpPlugin(),
    seoFeedsPlugin(),
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
        // Raw files (sitemap, RSS, robots) must load from the server, never the app screen.
        navigateFallbackDenylist: [/^\/~oauth/, /^\/\.lovable\/oauth/, /\.(xml|txt|json)$/],
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
