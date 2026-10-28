import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronLeft, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RANK_HUBS, rankMatches } from "@/lib/jobSlug";
import { CAMPAIGNS, promotionCost, type Campaign } from "@/lib/vacancyPromotion";
import { loadMyPostings, loadVacancyPage, START_CURSOR, type UnifiedVacancy, type VacancyCursor } from "@/lib/vacancyFeed";
import JobCard from "@/components/JobCard";
import SponsoredStrip from "@/components/opportunities/SponsoredStrip";

type Promo = { posting_id: string; campaign: Campaign; ends_at: string };
type Tab = "mine" | "industry" | "crew";
const TABS: { key: Tab; label: string }[] = [
  { key: "mine", label: "🏢 My posts" },
  { key: "industry", label: "🌐 Industry feed" },
  { key: "crew", label: "👁️ View as crew" },
];
const PAGE = 20;
const previewApply = () => toast.info("Preview only — crew apply from this button and the application reaches you.");

/** Manager feed: own adverts as crew see them, the whole market, and a rank-by-rank crew preview. */
const ManagerMarketFeed = () => {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.key === params.get("tab"))?.key || "mine") as Tab;
  const setTab = (t: Tab) => setParams((p) => { p.set("tab", t); return p; }, { replace: true });

  const [stats, setStats] = useState<any>(null);
  const [mine, setMine] = useState<UnifiedVacancy[]>([]);
  const [mineShown, setMineShown] = useState(PAGE);
  const [appCounts, setAppCounts] = useState<Record<string, number>>({});
  const [promos, setPromos] = useState<Promo[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);

  const [feed, setFeed] = useState<UnifiedVacancy[]>([]);
  const [cursor, setCursor] = useState<VacancyCursor>(START_CURSOR);
  const [feedDone, setFeedDone] = useState(false);
  const [feedBusy, setFeedBusy] = useState(false);
  const [previewRank, setPreviewRank] = useState(RANK_HUBS[0]?.slug || "");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      const [s, p, pr] = await Promise.all([
        supabase.rpc("market_pulse" as any, { p_rank: null }),
        uid ? loadMyPostings(uid).catch(() => []) : Promise.resolve([] as UnifiedVacancy[]),
        supabase.from("vacancy_promotions" as any).select("posting_id, campaign, ends_at").gt("ends_at", new Date().toISOString()),
      ]);
      if (!alive) return;
      setStats(s.data);
      setMine(p);
      setPromos(((pr as any).data || []) as Promo[]);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [reload]);

  // Application counts only for cards on screen (keeps requests small on poor connections).
  useEffect(() => {
    const ids = mine.slice(0, mineShown).map((v) => v.id).filter((id) => !(id in appCounts));
    if (!ids.length) return;
    supabase.from("job_applications").select("job_posting_id").in("job_posting_id", ids).then(({ data }) => {
      const next: Record<string, number> = {};
      ids.forEach((id) => { next[id] = 0; });
      ((data as any[]) || []).forEach((r) => { next[r.job_posting_id] = (next[r.job_posting_id] || 0) + 1; });
      setAppCounts((c) => ({ ...c, ...next }));
    });
  }, [mine, mineShown, appCounts]);

  const loadMore = useCallback(async () => {
    if (feedBusy || feedDone) return;
    setFeedBusy(true);
    try {
      const page = await loadVacancyPage(cursor, { pageSize: PAGE });
      setFeed((f) => { const seen = new Set(f.map((v) => v.id)); return [...f, ...page.items.filter((v) => !seen.has(v.id))]; });
      setCursor(page.cursor);
      setFeedDone(page.done);
    } catch { toast.error("Could not load more vacancies. Try again."); }
    setFeedBusy(false);
  }, [cursor, feedBusy, feedDone]);

  useEffect(() => { if (tab !== "mine" && !feed.length && !feedDone) loadMore(); }, [tab, feed.length, feedDone]); // eslint-disable-line react-hooks/exhaustive-deps

  const promoOf = useMemo(() => new Map(promos.map((x) => [x.posting_id, x])), [promos]);
  const myIds = useMemo(() => new Set(mine.map((v) => v.id)), [mine]);
  const myPromoted = mine.filter((v) => promoOf.has(v.id)).length;
  const eligible = mine.filter((v) => !promoOf.has(v.id));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const promote = async (campaign: Campaign) => {
    if (!sel.size) return toast.error("Tick the vacancies to promote first");
    setBusy(true);
    const { data, error } = await supabase.rpc("promote_vacancies" as any, { p_ids: [...sel], p_campaign: campaign });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${(data as any).promoted} vacancies promoted · ${(data as any).credits} credits used`);
    setSel(new Set());
    setReload((r) => r + 1);
  };

  const hub = RANK_HUBS.find((h) => h.slug === previewRank) || null;
  const crewFeed = hub ? feed.filter((v) => rankMatches(hub, v.rank)) : feed;
  const myRankCount = hub ? mine.filter((v) => rankMatches(hub, v.rank)).length : 0;

  const stat = (label: string, v: any) => (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-xl md:text-2xl font-bold text-primary">{v ?? "—"}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );

  const ownBadge = (v: UnifiedVacancy) => {
    const pr = promoOf.get(v.id);
    return (
      <div className="flex flex-wrap items-center gap-2 px-1 pb-1 text-[11px]">
        <span className="rounded-full border border-primary/40 px-2 py-0.5 font-bold text-primary">YOUR ADVERT</span>
        {pr
          ? <span className="font-bold text-primary">{CAMPAIGNS[pr.campaign].label} until {new Date(pr.ends_at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
          : <span className="text-muted-foreground">🟢 Live, sorted by date</span>}
        <span className="ml-auto text-muted-foreground">👥 {appCounts[v.id] ?? "…"} applications</span>
      </div>
    );
  };

  const card = (v: UnifiedVacancy) => (
    <div key={v.id} className={myIds.has(v.id) ? "rounded-2xl ring-1 ring-primary/50 p-1" : ""}>
      {myIds.has(v.id) && ownBadge(v)}
      <JobCard vacancy={v} variant="card" onApply={previewApply} />
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4 pb-40">
      <div className="flex items-center gap-2">
        <Link to="/manager/dashboard" aria-label="Back" className="p-2 rounded-lg hover:bg-secondary"><ChevronLeft className="h-5 w-5" /></Link>
        <h1 className="text-xl font-bold text-foreground flex-1">Live Vacancy Feed</h1>
        <button aria-label="Refresh" onClick={() => { setFeed([]); setCursor(START_CURSOR); setFeedDone(false); setAppCounts({}); setReload((r) => r + 1); }}
          className="p-2 rounded-lg border border-primary/30 text-primary"><RefreshCw className="h-4 w-4" /></button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {stat("Live vacancies", stats?.active?.toLocaleString())}
        {stat("Hiring companies", stats?.companies)}
        {stat("New in 24h", stats?.new24h)}
        {stat("My live adverts", loading ? "…" : mine.length)}
        {stat("My promoted", loading ? "…" : myPromoted)}
      </div>

      <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-background/95 backdrop-blur flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold border ${tab === t.key ? "bg-primary text-primary-foreground border-primary" : "border-primary/40 text-primary"}`}>
            {t.label}{t.key === "mine" && mine.length ? ` (${mine.length})` : ""}
          </button>
        ))}
      </div>

      {tab === "mine" && (
        <section className="space-y-3">
          <p className="text-xs text-muted-foreground">These are your adverts exactly as crew see them. Tick any to promote — promoted adverts go to the top for crew of the same rank, rotating fairly every 3 hours.</p>
          {loading && [0, 1].map((i) => <div key={i} className="h-48 rounded-2xl bg-card animate-pulse" />)}
          {!loading && mine.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              No live adverts yet. <Link to="/post-vacancy" className="text-primary underline">Post a vacancy</Link>
            </div>
          )}
          {!loading && eligible.length > 0 && (
            <div className="flex gap-3 text-xs">
              <button className="text-primary underline" onClick={() => setSel(new Set(eligible.map((v) => v.id)))}>Select all ({eligible.length})</button>
              <button className="text-muted-foreground underline" onClick={() => setSel(new Set())}>Clear</button>
            </div>
          )}
          {mine.slice(0, mineShown).map((v) => (
            <div key={v.id} className="space-y-1">
              {!promoOf.has(v.id) && (
                <label className="flex items-center gap-2 px-1 text-xs text-foreground">
                  <input type="checkbox" checked={sel.has(v.id)} onChange={() => toggle(v.id)} /> Select to promote
                </label>
              )}
              {card(v)}
            </div>
          ))}
          {mineShown < mine.length && (
            <button onClick={() => setMineShown((n) => n + PAGE)} className="w-full rounded-xl border border-primary text-primary font-bold py-2">
              Show more ({mine.length - mineShown} left)
            </button>
          )}
        </section>
      )}

      {tab === "industry" && (
        <section className="space-y-3">
          <p className="text-xs text-muted-foreground">Every live vacancy on SeaMinds, newest first — the same feed crew scroll. Your own adverts are outlined in gold.</p>
          {feed.map(card)}
          {!feedDone && (
            <button disabled={feedBusy} onClick={loadMore} className="w-full rounded-xl border border-primary text-primary font-bold py-2 disabled:opacity-50">
              {feedBusy ? "Loading…" : "Load more"}
            </button>
          )}
        </section>
      )}

      {tab === "crew" && (
        <section className="space-y-3">
          <div className="rounded-xl border border-border bg-card p-3 space-y-2">
            <label className="text-xs text-muted-foreground block">Show the feed a seafarer of this rank sees</label>
            <select value={previewRank} onChange={(e) => setPreviewRank(e.target.value)}
              className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground">
              {RANK_HUBS.map((r) => <option key={r.slug} value={r.slug}>{r.name}</option>)}
            </select>
            <p className="text-[11px] text-muted-foreground">You have {myRankCount} live advert{myRankCount === 1 ? "" : "s"} for this rank.</p>
          </div>
          <p className="text-xs font-bold text-primary">Sponsored spotlight (top of their feed)</p>
          <SponsoredStrip key={`${previewRank}-${reload}`} hub={hub} preview />
          <p className="text-xs font-bold text-primary pt-2">Then their feed, newest first</p>
          {crewFeed.map(card)}
          {!feedBusy && crewFeed.length === 0 && <p className="text-xs text-muted-foreground">No vacancies for this rank in the loaded pages yet.</p>}
          {!feedDone && (
            <button disabled={feedBusy} onClick={loadMore} className="w-full rounded-xl border border-primary text-primary font-bold py-2 disabled:opacity-50">
              {feedBusy ? "Loading…" : "Load more"}
            </button>
          )}
        </section>
      )}

      {tab === "mine" && sel.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-primary/40 bg-card p-3">
          <div className="max-w-3xl mx-auto space-y-2">
            <p className="text-xs text-foreground font-bold">{sel.size} selected — choose how to promote (from your credit wallet)</p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(CAMPAIGNS) as Campaign[]).map((c) => (
                <button key={c} disabled={busy} onClick={() => promote(c)}
                  className="rounded-xl bg-primary text-primary-foreground font-bold py-2 px-2 text-xs disabled:opacity-50">
                  {CAMPAIGNS[c].label} · {promotionCost(c, sel.size)} cr
                  <span className="block font-normal opacity-80">{CAMPAIGNS[c].blurb}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerMarketFeed;
