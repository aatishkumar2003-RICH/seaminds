import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import LineupTickets from "@/components/LineupTickets";

const NAVY = "#0D1B2A";

interface Props {
  profileId?: string;
  highlightApplicationId?: string | null;
  onCountChange?: (n: number) => void;
}

interface Offer {
  id: string;
  application_id?: string;
  company_name: string | null;
  rank_applied: string | null;
  outcome?: string | null;
  offered_joining_date: string | null;
  offer_details: any | null;
}

const CrewOffers = ({ profileId, highlightApplicationId, onCountChange }: Props) => {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [placed, setPlaced] = useState<{ id: string; company: string | null }[]>([]);
  const [joinings, setJoinings] = useState<{ id: string; company_name: string | null; rank_applied: string | null; outcome: string }[]>([]);
  const highlightRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    // get_my_offers() resolves the crew from auth.uid(), so a session is all we need
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user?.id || profileId;
    if (!uid) return;

    // Active joinings (placed, or with an open issue) — lets crew raise/answer issues
    const { data: j } = await supabase.from("job_applications")
      .select("id, company_name, rank_applied, outcome")
      .eq("crew_id", uid).in("outcome", ["shortlisted", "placed"])
      .order("created_at", { ascending: false }).limit(5);
    setJoinings((j as any[]) || []);

    const rpc = await supabase.rpc("get_my_offers" as any);
    if (!rpc.error && Array.isArray(rpc.data)) {
      const rows = (rpc.data as any[]).map((o) => ({ ...o, id: o.id || o.application_id })) as Offer[];
      setOffers(rows.filter((o) => o.outcome === "offered"));
      return;
    }
    const { data, error } = await supabase
      .from("job_applications")
      .select("id, company_name, rank_applied, offered_joining_date, outcome, offer_details")
      .eq("crew_id", uid)
      .eq("outcome", "offered")
      .order("offered_at", { ascending: false });
    if (!error) setOffers(((data as any[]) || []) as Offer[]);
  }, [profileId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!highlightApplicationId || !highlightRef.current) return;
    highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightApplicationId, offers]);

  useEffect(() => { onCountChange?.(offers.length); }, [offers.length, onCountChange]);

  const respond = async (offer: Offer, accept: boolean) => {
    if (!accept && !window.confirm("Decline this offer? The company will be notified.")) return;
    const { data, error } = await supabase.rpc("crew_respond_offer" as any, {
      p_application_id: offer.id,
      p_accept: accept,
    });
    if (error) { toast.error(error.message); return; }
    const result = data as { ok?: boolean; error?: string } | null;
    if (!result?.ok) { toast.error(result?.error || "Failed to respond"); return; }

    // remove immediately so ACTION REQUIRED clears without a reload
    setOffers((prev) => prev.filter((o) => o.id !== offer.id));
    if (accept) {
      setPlaced((prev) => [...prev, { id: offer.id, company: offer.company_name }]);
      toast.success("Placement confirmed ⚓");
    }

    // Email + manager notification. Delivery failure never reverses the recorded response.
    let notified: { sent?: boolean; manager_notified?: boolean } | null = null;
    try {
      const { data: nd } = await supabase.functions.invoke("notify-application", {
        body: { application_id: offer.id, kind: accept ? "accepted" : "offer_declined" },
      });
      notified = nd as any;
    } catch { /* ignore — the response is already recorded */ }

    if (!accept) {
      if (notified?.manager_notified) toast.success("Offer declined — the company was notified");
      else toast("Offer declined. We could not notify the company automatically.");
    }
    load();
  };


  if (!offers.length && !placed.length && !joinings.length) return null;

  return (
    <>
      {placed.map((p) => (
        <div
          key={`placed-${p.id}`}
          className="mx-4 mb-3 rounded-2xl p-4 shadow-lg"
          style={{ background: "linear-gradient(135deg, #D4AF37 0%, #C5941F 100%)", color: NAVY }}
        >
          <div className="space-y-2 text-center">
            <p className="text-xl font-black tracking-wide">⚓ CONGRATULATIONS, SAILOR!</p>
            <p className="text-sm font-bold">
              You are officially placed with {p.company || "the company"}. Your CV is now protected from other companies until your contract ends. Fair winds! 🌊
            </p>
          </div>
        </div>
      ))}

      {offers.map((o) => {
        const d = o.offer_details;
        const isHighlight = !!highlightApplicationId && highlightApplicationId === o.id;
        return (
          <div
            key={o.id}
            ref={isHighlight ? highlightRef : undefined}
            className={`mx-4 mb-3 rounded-2xl p-4 shadow-lg ${isHighlight ? "ring-4 ring-offset-2" : ""}`}
            style={{
              background: "linear-gradient(135deg, #D4AF37 0%, #C5941F 100%)",
              color: NAVY,
              ...(isHighlight ? { boxShadow: "0 0 0 4px rgba(212,175,55,0.6)" } : {}),
            }}
          >
            <div className="space-y-3">
              <p className="text-xl font-black tracking-wide">🎉 JOB OFFER</p>
              <p className="text-base font-bold">{o.company_name} wants you as {o.rank_applied}</p>
              {o.offered_joining_date && !d && (
                <p className="text-sm font-bold opacity-90">Joining {new Date(o.offered_joining_date).toLocaleDateString()}</p>
              )}
              {d && (
                <div className="space-y-1">
                  <p className="text-sm font-bold opacity-90">
                    🚢 {d.vessel_name || "Vessel to be advised"}
                    {d.joining_date ? ` · Joining ${d.joining_date}` : ""}
                    {d.joining_port ? ` at ${d.joining_port}` : ""}
                  </p>
                  {d.interview_required && (
                    <p className="text-sm font-bold opacity-90">🎤 Interview: {d.interview_date || "to be advised"}</p>
                  )}
                  {d.documents_required && (
                    <p className="text-sm font-bold opacity-90">📄 Upload your documents for verification</p>
                  )}
                  {d.salary && <p className="text-sm font-bold opacity-90">💰 {d.salary}</p>}
                  {d.message && <p className="text-xs italic leading-relaxed opacity-80">{d.message}</p>}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => respond(o, true)}
                  className="flex-1 rounded-xl py-2.5 font-bold text-[13px] flex items-center justify-center gap-2"
                  style={{ background: NAVY, color: "#D4AF37", border: "none", cursor: "pointer" }}
                >
                  ⚓ Accept & Get Placed
                </button>
                <button
                  onClick={() => respond(o, false)}
                  className="flex-1 rounded-xl py-2.5 font-bold text-[13px] flex items-center justify-center gap-2"
                  style={{ background: "transparent", color: NAVY, border: `2px solid ${NAVY}`, cursor: "pointer" }}
                >
                  Decline
                </button>
              </div>
              <a
                href="/app?tab=cv"
                className="block text-center text-[12px] font-bold underline"
                style={{ color: NAVY }}
              >
                Upload documents
              </a>
              <div className="rounded-xl p-2" style={{ background: NAVY }}>
                <LineupTickets applicationId={o.id} role="crew" compact />
              </div>
            </div>
          </div>
        );
      })}
      {joinings.map((j) => (
        <div key={`join-${j.id}`} className="mx-4 mb-3 rounded-2xl border border-[#D4AF37]/30 bg-[#112240] p-3">
          <p className="text-xs font-bold text-[#D4AF37]">
            {j.outcome === "placed" ? "⚓ Your joining" : "⭐ Shortlisted"} · {j.company_name || "Company"}{j.rank_applied ? ` · ${j.rank_applied}` : ""}
          </p>
          <LineupTickets applicationId={j.id} role="crew" />
        </div>
      ))}
    </>
  );
};

export default CrewOffers;
