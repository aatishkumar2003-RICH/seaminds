import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Job = { rank: string; vessel: string; port: string; when: string };

const rel = (iso?: string | null) => {
  if (!iso) return "recently";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function CountPill({ value, label, active }: { value: number; label: string; active: boolean }) {
  const [n, setN] = useState(prefersReduced() ? value : 0);
  useEffect(() => {
    if (!active || prefersReduced()) { setN(value); return; }
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 1500);
      setN(Math.round(value * p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, value]);

  return (
    <div
      className="rounded-2xl px-4 py-3 text-center"
      style={{
        border: "1px solid rgba(212,175,55,0.3)",
        background: "rgba(17,34,64,0.6)",
      }}
    >
      <div className="text-xl font-bold text-primary font-mono-score">{n.toLocaleString()}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

const HiringNow = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState({ fresh: 0, countries: 0, profiles: 0 });
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setVisible(true)),
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const load = async () => {
      const nowIso = new Date().toISOString();
      const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      try {
        const [list, fresh, nats, profiles] = await Promise.all([
          supabase
            .from("external_vacancies")
            .select("rank_required,vessel_type,joining_port,fetched_at")
            .gt("expires_at", nowIso)
            .order("fetched_at", { ascending: false })
            .limit(3),
          supabase
            .from("external_vacancies")
            .select("id", { count: "exact", head: true })
            .gt("expires_at", nowIso)
            .gt("fetched_at", dayAgo),
          supabase.from("crew_profiles").select("nationality").not("nationality", "is", null).limit(2000),
          supabase
            .from("crew_profiles")
            .select("id", { count: "exact", head: true })
            .not("quick_profile_completed_at", "is", null),
        ]);

        setJobs(
          (list.data || []).map((v: any) => ({
            rank: v.rank_required || "Officer",
            vessel: v.vessel_type || "Various",
            port: v.joining_port || "Worldwide",
            when: rel(v.fetched_at),
          }))
        );
        const countries = new Set(
          (nats.data || []).map((r: any) => (r.nationality || "").trim()).filter(Boolean)
        ).size;
        setStats({
          fresh: fresh.count || 0,
          countries,
          profiles: profiles.count || 0,
        });
      } catch (e) {
        console.error(e);
      }
    };
    load();
  }, []);

  return (
    <section ref={ref} className="relative py-12 sm:py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-center gap-2 mb-6">
          <span className="w-2 h-2 rounded-full bg-green-500 sm-pulse-dot" />
          <h2 className="text-sm font-bold tracking-[0.25em] uppercase text-primary font-mono-score">
            Hiring Now
          </h2>
        </div>

        {jobs.length > 0 && (
          <div className="flex flex-col gap-2.5 mb-6">
            {jobs.map((j, i) => (
              <div
                key={i}
                className="rounded-2xl px-4 py-3 flex flex-col gap-0.5"
                style={{
                  border: "1px solid rgba(212,175,55,0.25)",
                  background: "rgba(17,34,64,0.6)",
                }}
              >
                <span className="text-sm font-semibold text-foreground">
                  🟢 {j.rank} — {j.vessel}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {j.port} · {j.when}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {stats.fresh > 0 && (
            <CountPill value={stats.fresh} label="Fresh vacancies today" active={visible} />
          )}
          {stats.countries > 0 && (
            <CountPill value={stats.countries} label="Countries" active={visible} />
          )}
          {stats.profiles > 0 && (
            <CountPill value={stats.profiles} label="Sea Profiles completed" active={visible} />
          )}
        </div>

        <div className="flex justify-center">
          <Button size="lg" className="h-12 px-6 text-sm font-bold rounded-xl" onClick={() => navigate("/feed")}>
            See Fresh Maritime Vacancies <ChevronRight className="ml-1 w-4 h-4" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default HiringNow;
