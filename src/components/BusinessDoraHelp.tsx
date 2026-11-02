import { lazy, Suspense, useState } from "react";
import { useLocation } from "react-router-dom";
import { LifeBuoy, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { businessHelpAudience } from "@/lib/businessHelp";

const SupportCenter = lazy(() => import("@/components/SupportCenter"));

export default function BusinessDoraHelp() {
  const location = useLocation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const audience = businessHelpAudience(location.pathname);
  if (!audience) return null;

  return <>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button aria-label="Open DORA help" onClick={() => setOpen(true)} variant="outline" size="icon"
          className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-40 h-14 w-14 rounded-full border-2 border-primary bg-card text-primary shadow-lg motion-safe:animate-in motion-safe:fade-in md:bottom-6 md:right-6">
          <LifeBuoy className="h-7 w-7" /><Sparkles className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-card p-0.5 text-primary" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">Ask DORA · Help & reports</TooltipContent>
    </Tooltip>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85dvh] w-[calc(100%-1.5rem)] max-w-xl overflow-y-auto p-4 [&>*]:min-w-0">
        <DialogTitle className="pr-8 text-primary">DORA · Help & Support</DialogTitle>
        <DialogDescription>{audience === "marketplace" ? "Marketplace support" : "Company support"}</DialogDescription>
        <Suspense fallback={<p className="py-4 text-sm text-muted-foreground">Loading help…</p>}>
          <SupportCenter sourceScreen={audience} routePathname={location.pathname} audience={audience} onBack={() => setOpen(false)} />
        </Suspense>
        {!user && <p className="text-xs text-muted-foreground">Sign in to ask DORA and track requests. You can still send a problem report.</p>}
      </DialogContent>
    </Dialog>
  </>;
}