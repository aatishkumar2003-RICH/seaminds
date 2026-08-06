import { useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";

/** Navigates to "/" then scrolls to a hash target */
const ScrollRedirect = ({ hash }: { hash: string }) => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/", { replace: true });
    setTimeout(() => {
      const el = document.getElementById(hash);
      el?.scrollIntoView({ behavior: "smooth" });
    }, 300);
  }, []);
  return null;
};
import HomePage from "./pages/HomePage";
import ForCompanies from "./pages/ForCompanies";
import Index from "./pages/Index";
import ManagerAuth from "./pages/ManagerAuth";
import ManagerDashboard from "./pages/ManagerDashboard";
import ManagerSearch from "./pages/ManagerSearch";
import NotFound from "./pages/NotFound";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Pricing from "./pages/Pricing";
import Contact from "./pages/Contact";
import CollegePage from "./pages/CollegePage";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import JobFeed from "./pages/JobFeed";
import PostVacancyPage from "./pages/PostVacancyPage";
import AdminDashboard from "./pages/AdminDashboard";
import Verify from "./pages/Verify";
import OAuthConsent from "./pages/OAuthConsent";
import CookieConsent from "./components/CookieConsent";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import { AuthProvider } from "./contexts/AuthContext";
import { initMetaPixel, captureAdSource, trackPixel } from "@/lib/metaPixel";

const queryClient = new QueryClient();
const APP_THEME_COLOR = "#0D1B2A";

/** Loads the Meta Pixel once and tracks SPA page views. */
const MetaPixelManager = () => {
  const location = useLocation();
  const first = useRef(true);

  useEffect(() => {
    captureAdSource();
    initMetaPixel();
  }, []);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    trackPixel("PageView");
  }, [location.pathname]);

  return null;
};

const ThemeColorManager = () => {
  const location = useLocation();

  useEffect(() => {
    document.documentElement.style.backgroundColor = APP_THEME_COLOR;
    document.documentElement.style.colorScheme = "dark";
    document.body.style.backgroundColor = APP_THEME_COLOR;
    document.body.style.colorScheme = "dark";

    const upsertThemeMeta = (selector: string, attributes: Record<string, string>) => {
      let meta = document.head.querySelector(selector) as HTMLMetaElement | null;
      if (!meta) {
        meta = document.createElement("meta");
        document.head.appendChild(meta);
      }
      Object.entries(attributes).forEach(([key, value]) => meta!.setAttribute(key, value));
    };

    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      (meta as HTMLMetaElement).setAttribute("content", APP_THEME_COLOR);
    });

    upsertThemeMeta('meta[name="theme-color"]:not([media])', { name: "theme-color", content: APP_THEME_COLOR });
    upsertThemeMeta('meta[name="theme-color"][media="(prefers-color-scheme: dark)"]', {
      name: "theme-color",
      media: "(prefers-color-scheme: dark)",
      content: APP_THEME_COLOR,
    });
    upsertThemeMeta('meta[name="theme-color"][media="(prefers-color-scheme: light)"]', {
      name: "theme-color",
      media: "(prefers-color-scheme: light)",
      content: APP_THEME_COLOR,
    });
    upsertThemeMeta('meta[name="color-scheme"]', { name: "color-scheme", content: "dark only" });
    upsertThemeMeta('meta[name="apple-mobile-web-app-status-bar-style"]', {
      name: "apple-mobile-web-app-status-bar-style",
      content: "black",
    });
  }, [location.pathname]);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ThemeColorManager />
          <MetaPixelManager />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/app" element={<Index />} />
            <Route path="/feed" element={<JobFeed />} />
            <Route path="/manager" element={<ManagerAuth />} />
            <Route path="/manager/dashboard" element={<ManagerDashboard />} />
           <Route path="/manager-search" element={<ManagerSearch />} />
           <Route path="/post-vacancy" element={<PostVacancyPage />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/colleges" element={<CollegePage />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/for-companies" element={<ForCompanies />} />
            <Route path="/smc-score" element={<ScrollRedirect hash="smc-score" />} />
            <Route path="/jobs" element={<Navigate to="/feed" replace />} />
            <Route path="/for-seafarers" element={<Navigate to="/app" replace />} />
            <Route path="/verify/:id" element={<Verify />} />
            <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <CookieConsent />
          <PWAInstallPrompt />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
