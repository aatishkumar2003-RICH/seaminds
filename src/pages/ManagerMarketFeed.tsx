import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RANK_HUBS } from "@/lib/jobSlug";
import { CAMPAIGNS, promotionCost, type Campaign } from "@/lib/vacancyPromotion";
import SponsoredStrip from "@/components/opportunities/SponsoredStrip";

type Posting = { id: string; rank_required: string | null; vessel_type: string | null; created_at: string };
type Promo = { posting_id: string; campaign: Campaign; ends_at: string };

const ManagerMarketFeed = () => {
  const [stats, setStats] = useState<any>(null);
  const [postings, setPostings] = useState<Posting[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [previewRank, setPreviewRank] = useState(RANK_HUBS[0]?.slug || "");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      const [s, p, pr] = await Promise.all([
        supabase.rpc("vacancy_market_stats" as any),
        uid ? supabase.from("job_postings").select("id, rank_required, vessel_type, created_at").eq("manager_id", uid).eq("status", "active").order("created_at", { ascending: false }).limit(300) : Promise.resolve({ data: [] }),
        supabase.from("vacancy_promotions" as any).select("posting_id, campaign, ends_at").gt("ends_at", new Date().toISOString()),
      ]);
      setStats(s.data);
      setPostings(((p as any).data || []) as Posting[]);
      setPromos(((pr as any).data || []) as Promo[]);
    })();
  }, [reload]);

  const promoOf = useMemo(() => new Map(promos.map((x) => [x.posting_id, x])), [promos]);
  const eligible = postings.filter((p) => !promoOf.has(p.id));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const promote = async (campaign: Campaign) => {
    if (!sel.size) return toast.error("Select vacancies first");
    setBusy(true);
    const { data, error } = await supabase.rpc("promote_vacancies" as any, { p_ids: [...sel], p_campaign: campaign });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${(data as any).promoted} vacancies promoted · ${(data as any).credits} credits used`);
    setSel(new Set());
    setReload((r) => r + 1);
  };

  const hub = RANK_HUBS.find((h) => h.slug === previewRank) || null;
  const stat = (label: string, v: any) => (
    <div className="rounded-xl border border-border bg-card p-3"><p className="text-2xl font-bold text-primary">{v ?? "—"}</p><p className="text-xs text-muted-foreground">{label}</p></div>
  );

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-2">
        <Link to="/manager/dashboard" aria-label="Back" className="p-2 rounded-lg hover:bg-secondary"><ChevronLeft className="h-5 w-5" /></Link>
        <h1 className="text-xl font-bold text-foreground">Live Vacancy Feed</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {stat("Active vacancies", stats?.active)}
        {stat("Hiring companies", stats?.companies)}
        {stat("New in 24h", stats?.new24h)}
        {stat("My live vacancies", postings.length)}
        {stat("My promoted", promos.length)}
      </div>

      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h2 className="font-semibold text-foreground">Promote your vacancies</h2>
        <p className="text-xs text-muted-foreground">One credit wallet. Tick the vacancies, then choose how to promote them. Promoted vacancies appear on top only for crew of the same rank, rotating fairly every 3 hours with one slot per recruiter.</p>
        <div className="grid md:grid-cols-2 gap-3">
          {(Object.keys(CAMPAIGNS) as Campaign[]).map((c) => (
            <div key={c} className="rounded-xl border border-primary/30 p-3 space-y-2">
              <p className="font-bold text-foreground">{CAMPAIGNS[c].label}</p>
              <p className="text-xs text-muted-foreground">{CAMPAIGNS[c].blurb} · {CAMPAIGNS[c].credits} credits per {CAMPAIGNS[c].perBlock} vacancies</p>
              <button disabled={busy || !sel.size} onClick={() => promote(c)} className="w-full rounded-xl bg-primary text-primary-foreground font-bold py-2 disabled:opacity-50">
                {sel.size ? `Promote ${sel.size} · ${promotionCost(c, sel.size)} credits` : "Select vacancies below"}
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-3 text-xs">
          <button className="text-primary underline" onClick={() => setSel(new Set(eligible.map((p) => p.id)))}>Select all ({eligible.length})</button>
          <button className="text-muted-foreground underline" onClick={() => setSel(new Set())}>Clear</button>
        </div>
        <div className="max-h-96 overflow-y-auto divide-y divide-border">
          {postings.length === 0 && <p className="text-sm text-muted-foreground py-3">No live vacancies yet. <Link to="/post-vacancy" className="text-primary underline">Post a vacancy</Link></p>}
          {postings.map((p) => {
            const pr = promoOf.get(p.id);
            return (
              <label key={p.id} className="flex items-center gap-3 py-2 text-sm">
                <input type="checkbox" disabled={!!pr} checked={sel.has(p.id)} onChange={() => toggle(p.id)} />
                <span className="flex-1 text-foreground">{p.rank_required || "Seafarer"}{p.vessel_type ? ` · ${p.vessel_type}` : ""}</span>
                {pr && <span className="text-[11px] text-primary">{CAMPAIGNS[pr.campaign].label} until {new Date(pr.ends_at).toLocaleString()}</span>}
              </label>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 space-y-2">
        <h2 className="font-semibold text-foreground">What crew see right now</h2>
        <select value={previewRank} onChange={(e) => setPreviewRank(e.target.value)} className="rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground">
          {RANK_HUBS.map((r) => <option key={r.slug} value={r.slug}>{r.name}</option>)}
        </select>
        <SponsoredStrip key={`${previewRank}-${reload}`} hub={hub} preview />
        <Link to={`/feed?rank=${previewRank}`} className="inline-block text-xs text-primary underline">Open the full crew feed for this rank →</Link>
      </section>
    </div>
  );
};

export default ManagerMarketFeed;
