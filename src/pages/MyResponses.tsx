import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import CrewOffers from "@/components/CrewOffers";
import ActionHub from "@/components/ActionHub";

/** One place for every manager response: offers, shortlists, joinings and issue tickets. */
export default function MyResponses() {
  const navigate = useNavigate();
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-background pb-24 text-foreground">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-primary/30 bg-background/95 px-3 py-3 backdrop-blur">
        <button onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/app"))} aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full text-primary hover:bg-secondary"><ChevronLeft /></button>
        <div>
          <h1 className="text-base font-bold text-primary">Manager Responses & Actions</h1>
          <p className="text-xs text-muted-foreground">Offers, shortlists, joinings and issues</p>
        </div>
      </header>
      <div className="pt-4">
        <ActionHub />
        <h2 className="mx-4 mb-2 text-sm font-bold text-primary">📬 Applications & offers</h2>
        <CrewOffers profileId={user?.id} highlightApplicationId={new URLSearchParams(window.location.search).get("offer")} />
      </div>
    </div>
  );
}
