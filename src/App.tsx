import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { UserProvider } from "@/contexts/UserContext";
import HomePage from "./pages/HomePage";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ProfileCompletion from "./pages/ProfileCompletion";
import ManagerAuth from "./pages/ManagerAuth";
import ManagerDashboard from "./pages/ManagerDashboard";
import NotFound from "./pages/NotFound";
import TermsOfService from "./pages/TermsOfService";
import Pricing from "./pages/Pricing";
import Companies from "./pages/Companies";
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <UserProvider>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/complete-profile" element={<ProfileCompletion />} />
            <Route path="/app" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/manager" element={<ManagerAuth />} />
            <Route path="/manager/dashboard" element={<ManagerDashboard />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/companies" element={<Companies />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </UserProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
