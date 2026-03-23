import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

interface VacancyStats {
  total: number;
  bySource: { source: string; count: number }[];
  byRank: { rank: string; count: number }[];
  byVessel: { vessel: string; count: number }[];
  todayCount: number;
  avgQuality: number;
  scamFlagged: number;
  recentRuns: { metadata: any; created_at: string }[];
  recentVacancies: { title: string; rank_required: string | null; vessel_type: string | null; company_name: string | null; salary_max: number | null; source: string; quality_score: number | null; fetched_at: string | null }[];
  crewByNationality: { nationality: string; count: number; available: number }[];
  totalCrew: number;
  availableCrew: number;
  contactCoverage: { withApply: number; withEmail: number; withWhatsapp: number; withWebsite: number; withAny: number; noContact: number; total: number };
}

export default function VacancyIntelTab() {
  const [stats, setStats] = useState<VacancyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [noContactJobs, setNoContactJobs] = useState<any[] | null>(null);
  const [loadingNoContact, setLoadingNoContact] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const today = new Date(); today.setHours(0, 0, 0, 0);

      const [total, bySource, byRank, byVessel, todayRes, avgRes, scamRes, runs, recent, crewNat, contactData] = await Promise.all([
        supabase.from('external_vacancies').select('*', { count: 'exact', head: true }),
        supabase.from('external_vacancies').select('source'),
        supabase.from('external_vacancies').select('rank_required').not('rank_required', 'is', null),
        supabase.from('external_vacancies').select('vessel_type').not('vessel_type', 'is', null),
        supabase.from('external_vacancies').select('*', { count: 'exact', head: true }).gte('fetched_at', today.toISOString()),
        supabase.from('external_vacancies').select('quality_score'),
        supabase.from('external_vacancies').select('*', { count: 'exact', head: true }).eq('is_scam_flagged', true),
        supabase.from('app_events').select('metadata, created_at').eq('event_type', 'vacancy_agent_run').order('created_at', { ascending: false }).limit(5),
        supabase.from('external_vacancies').select('title, rank_required, vessel_type, company_name, salary_max, source, quality_score, fetched_at').order('fetched_at', { ascending: false }).limit(10),
        supabase.from('crew_profiles').select('nationality, is_available'),
        supabase.from('external_vacancies').select('apply_url, contact_email, contact_whatsapp, company_website'),
      ]);

      const srcMap: Record<string, number> = {};
      (bySource.data || []).forEach((r: any) => { srcMap[r.source] = (srcMap[r.source] || 0) + 1; });
      const bySourceArr = Object.entries(srcMap).map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count);

      const rankMap: Record<string, number> = {};
      (byRank.data || []).forEach((r: any) => { rankMap[r.rank_required] = (rankMap[r.rank_required] || 0) + 1; });
      const byRankArr = Object.entries(rankMap).map(([rank, count]) => ({ rank, count })).sort((a, b) => b.count - a.count).slice(0, 8);

      const vesselMap: Record<string, number> = {};
      (byVessel.data || []).forEach((r: any) => { vesselMap[r.vessel_type] = (vesselMap[r.vessel_type] || 0) + 1; });
      const byVesselArr = Object.entries(vesselMap).map(([vessel, count]) => ({ vessel, count })).sort((a, b) => b.count - a.count).slice(0, 6);

      const scores = (avgRes.data || []).map((r: any) => r.quality_score).filter(Boolean) as number[];
      const avgQuality = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

      // Crew nationality distribution
      const crewData = crewNat.data || [];
      const natMap: Record<string, { total: number; available: number }> = {};
      crewData.forEach((c: any) => {
        const nat = c.nationality || 'Unknown';
        if (!natMap[nat]) natMap[nat] = { total: 0, available: 0 };
        natMap[nat].total++;
        if (c.is_available) natMap[nat].available++;
      });
      const crewByNationality = Object.entries(natMap)
        .map(([nationality, d]) => ({ nationality, count: d.total, available: d.available }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 12);

      const contacts = contactData.data || [];
      const withApply = contacts.filter((c: any) => c.apply_url).length;
      const withEmail = contacts.filter((c: any) => c.contact_email).length;
      const withWhatsapp = contacts.filter((c: any) => c.contact_whatsapp).length;
      const withWebsite = contacts.filter((c: any) => c.company_website).length;
      const withAny = contacts.filter((c: any) => c.apply_url || c.contact_email || c.contact_whatsapp || c.company_website).length;
      const noContact = contacts.length - withAny;

      setStats({
        total: total.count || 0,
        bySource: bySourceArr,
        byRank: byRankArr,
        byVessel: byVesselArr,
        todayCount: todayRes.count || 0,
        avgQuality,
        scamFlagged: scamRes.count || 0,
        recentRuns: (runs.data || []) as any[],
        recentVacancies: (recent.data || []) as any[],
        crewByNationality,
        totalCrew: crewData.length,
        availableCrew: crewData.filter((c: any) => c.is_available).length,
        contactCoverage: { withApply, withEmail, withWhatsapp, withWebsite, withAny, noContact, total: contacts.length },
      });
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const runAgent = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('vacancy-agent');
      if (error) { setRunResult(`❌ Error: ${error.message}`); }
      else { setRunResult(`✅ Done — ${data?.stats?.saved || 0} new vacancies saved (Google: ${data?.stats?.google || 0}, RSS: ${data?.stats?.rss || 0}, Telegram: ${data?.stats?.telegram || 0})`); }
      await load();
    } catch (e: any) { setRunResult(`❌ ${e.message}`); }
    setRunning(false);
  };

  useEffect(() => { load(); }, []);

  const sourceLabel = (s: string) => ({ google_jobs: '🔍 Google Jobs', rss_feed: '📰 RSS Feeds', telegram: '📱 Telegram', internal: '🏢 Internal' }[s] || s);
  const qualityColor = (q: number) => q >= 70 ? '#22c55e' : q >= 40 ? '#f59e0b' : '#ef4444';

  if (loading) return <p className="text-muted-foreground text-center py-10">Loading vacancy intelligence...</p>;
  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">📊 Vacancy Intelligence</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}>🔄 Refresh</Button>
          <Button size="sm" onClick={runAgent} disabled={running}>
            {running ? '⏳ Running...' : '▶ Run Agent Now'}
          </Button>
        </div>
      </div>

      {runResult && (
        <div className="rounded-lg bg-card border border-border p-3 text-sm text-foreground">{runResult}</div>
      )}

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: '💼', label: 'Total Vacancies', val: stats.total, color: 'hsl(var(--primary))' },
          { icon: '📅', label: 'Added Today', val: stats.todayCount, color: '#22c55e' },
          { icon: '⭐', label: 'Avg Quality', val: `${stats.avgQuality}/100`, color: '#60a5fa' },
          { icon: '🚫', label: 'Scam Flagged', val: stats.scamFlagged, color: '#ef4444' },
        ].map(s => (
          <div key={s.label} className="rounded-xl bg-card border border-border p-4 text-center">
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-xl font-bold" style={{ color: s.color }}>{s.val}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Contact Coverage */}
      {stats.contactCoverage && (
        <div className="rounded-xl bg-card border border-border p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">📞 Contact Coverage</h3>
          <div className="flex h-6 rounded-full overflow-hidden bg-muted">
            {[
              { val: stats.contactCoverage.withApply, color: '#22c55e', label: 'Apply Link' },
              { val: stats.contactCoverage.withEmail - (stats.contactCoverage.withApply > 0 ? Math.min(stats.contactCoverage.withEmail, stats.contactCoverage.withApply) : 0), color: '#60a5fa', label: 'Email Only' },
              { val: stats.contactCoverage.withWhatsapp, color: '#a78bfa', label: 'WhatsApp' },
              { val: stats.contactCoverage.noContact, color: '#ef4444', label: 'No Contact' },
            ].filter(s => s.val > 0).map(s => (
              <div key={s.label} title={`${s.label}: ${s.val}`} style={{ width: `${(s.val / stats.contactCoverage.total) * 100}%`, background: s.color }} />
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            {[
              { icon: '🔗', label: 'Apply Link', val: stats.contactCoverage.withApply, color: '#22c55e' },
              { icon: '📧', label: 'Email', val: stats.contactCoverage.withEmail, color: '#60a5fa' },
              { icon: '📱', label: 'WhatsApp', val: stats.contactCoverage.withWhatsapp, color: '#a78bfa' },
              { icon: '🌐', label: 'Website', val: stats.contactCoverage.withWebsite, color: 'hsl(var(--primary))' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-1.5">
                <span>{s.icon}</span>
                <span className="text-muted-foreground">{s.label}:</span>
                <span className="font-semibold" style={{ color: s.color }}>{s.val}</span>
                <span className="text-muted-foreground/60">({stats.contactCoverage.total > 0 ? Math.round(s.val / stats.contactCoverage.total * 100) : 0}%)</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-border">
            <span className="text-muted-foreground">✅ Has any contact: <strong className="text-foreground">{stats.contactCoverage.withAny}</strong> ({stats.contactCoverage.total > 0 ? Math.round(stats.contactCoverage.withAny / stats.contactCoverage.total * 100) : 0}%)</span>
            <span className="text-destructive">❌ No contact: <strong>{stats.contactCoverage.noContact}</strong> ({stats.contactCoverage.total > 0 ? Math.round(stats.contactCoverage.noContact / stats.contactCoverage.total * 100) : 0}%)</span>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* By Source */}
        <div className="rounded-xl bg-card border border-border p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">By Source</h3>
          {stats.bySource.map(s => (
            <div key={s.source} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{sourceLabel(s.source)}</span>
              <span className="font-semibold text-foreground">{s.count}</span>
            </div>
          ))}
          {!stats.bySource.length && <p className="text-xs text-muted-foreground">No data yet</p>}
        </div>

        {/* By Vessel */}
        <div className="rounded-xl bg-card border border-border p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">By Vessel Type</h3>
          {stats.byVessel.map(v => (
            <div key={v.vessel} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{v.vessel}</span>
              <span className="font-semibold text-foreground">{v.count}</span>
            </div>
          ))}
          {!stats.byVessel.length && <p className="text-xs text-muted-foreground">No data yet</p>}
        </div>
      </div>

      {/* By Rank */}
      <div className="rounded-xl bg-card border border-border p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Top Ranks in Demand</h3>
        <div className="flex flex-wrap gap-2">
          {stats.byRank.map(r => (
            <div key={r.rank} className="rounded-lg bg-secondary px-3 py-2 text-center">
              <div className="text-lg font-bold text-foreground">{r.count}</div>
              <div className="text-[11px] text-muted-foreground">{r.rank}</div>
            </div>
          ))}
          {!stats.byRank.length && <p className="text-xs text-muted-foreground">No data yet</p>}
        </div>
      </div>


      {/* Crew Nationality Distribution */}
      <div className="rounded-xl bg-card border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">🌍 Crew Nationality Distribution</h3>
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span>👥 Total: <strong className="text-foreground">{stats.totalCrew}</strong></span>
            <span>✅ Available: <strong className="text-primary">{stats.availableCrew}</strong></span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {stats.crewByNationality.map(n => {
            const pct = stats.totalCrew ? Math.round((n.count / stats.totalCrew) * 100) : 0;
            return (
              <div key={n.nationality} className="rounded-lg bg-secondary p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground truncate">{n.nationality}</span>
                  <span className="text-xs font-bold text-primary">{n.count}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{pct}% of crew</span>
                  <span className="text-primary">{n.available} available</span>
                </div>
              </div>
            );
          })}
        </div>
        {!stats.crewByNationality.length && <p className="text-xs text-muted-foreground">No crew data yet</p>}
      </div>

      {/* Recent Vacancies */}
      <div className="rounded-xl bg-card border border-border p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Latest Collected Vacancies</h3>
        {stats.recentVacancies.map((v, i) => (
          <div key={i} className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{v.title || `${v.rank_required} — ${v.vessel_type || 'Various'}`}</p>
              <p className="text-[11px] text-muted-foreground">{v.company_name || 'Unknown'} · {sourceLabel(v.source)} · {v.fetched_at ? new Date(v.fetched_at).toLocaleDateString() : '—'}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0 text-xs">
              {v.salary_max && <span className="text-primary font-semibold">${v.salary_max.toLocaleString()}</span>}
              <span style={{ color: qualityColor(v.quality_score || 0) }}>Q:{v.quality_score}</span>
            </div>
          </div>
        ))}
        {!stats.recentVacancies.length && <p className="text-xs text-muted-foreground">No vacancies collected yet — click "Run Agent Now" above</p>}
      </div>

      {/* Agent Run History */}
      <div className="rounded-xl bg-card border border-border p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Agent Run History (Last 5)</h3>
        {stats.recentRuns.map((r, i) => (
          <div key={i} className="flex items-center justify-between text-xs border-b border-border pb-2 last:border-0 last:pb-0">
            <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString('en-GB', { timeZone: 'Asia/Jakarta' })} WIB</span>
            <span className="text-foreground">✅ Saved: {(r.metadata as any)?.saved || (r.metadata as any)?.total || 0} · Google: {(r.metadata as any)?.google || 0} · RSS: {(r.metadata as any)?.rss || 0} · 📧 Emails: {(r.metadata as any)?.emailsSent || 0}</span>
          </div>
        ))}
        {!stats.recentRuns.length && <p className="text-xs text-muted-foreground">No runs yet</p>}
      </div>
    </div>
  );
}