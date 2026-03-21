import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TickerStats {
  totalCrew: number;
  totalVacancies: number;
  availableCrew: number;
  byNationality: { flag: string; name: string; count: number }[];
  recentVacancies: { rank: string; vessel: string; salary: string; location: string }[];
}

const FLAGS: Record<string, string> = {
  Filipino: '🇵🇭', Indian: '🇮🇳', Indonesian: '🇮🇩', Ukrainian: '🇺🇦',
  Russian: '🇷🇺', Chinese: '🇨🇳', Vietnamese: '🇻🇳', Myanmar: '🇲🇲',
  Bangladeshi: '🇧🇩', Greek: '🇬🇷', Croatian: '🇭🇷', Turkish: '🇹🇷',
};

export default function LiveTicker() {
  const [stats, setStats] = useState<TickerStats>({
    totalCrew: 0, totalVacancies: 0, availableCrew: 0,
    byNationality: [], recentVacancies: [],
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [crewRes, vacRes, availRes, natRes, recentRes] = await Promise.all([
          supabase.from('crew_profiles').select('*', { count: 'exact', head: true }),
          supabase.from('job_vacancies').select('*', { count: 'exact', head: true }),
          supabase.from('crew_profiles').select('*', { count: 'exact', head: true }).eq('is_available', true),
          supabase.from('crew_profiles').select('nationality').not('nationality', 'is', null),
          supabase.from('job_vacancies').select('rank_required, vessel_type, salary_min, salary_max, joining_port').order('created_at', { ascending: false }).limit(8),
        ]);

        const natMap: Record<string, number> = {};
        (natRes.data || []).forEach((r: any) => {
          const n = r.nationality?.trim();
          if (n) natMap[n] = (natMap[n] || 0) + 1;
        });
        const byNationality = Object.entries(natMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([name, count]) => ({ flag: FLAGS[name] || '🌍', name, count }));

        const recentVacancies = (recentRes.data || []).map((v: any) => ({
          rank: v.rank_required || 'Officer',
          vessel: v.vessel_type || 'Various',
          salary: v.salary_max ? `$${Number(v.salary_max).toLocaleString()}` : 'Competitive',
          location: v.joining_port || 'Worldwide',
        }));

        setStats({
          totalCrew: crewRes.count || 0,
          totalVacancies: vacRes.count || 0,
          availableCrew: availRes.count || 0,
          byNationality,
          recentVacancies,
        });
      } catch (e) { console.error('Ticker fetch error', e); }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let pos = 0;
    const scroll = () => {
      pos += 0.5;
      if (pos >= el.scrollWidth / 2) pos = 0;
      el.scrollLeft = pos;
    };
    const id = setInterval(scroll, 16);
    return () => clearInterval(id);
  }, [stats]);

  const tickerItems = [
    ...stats.byNationality.map(n => `${n.flag} ${n.name}: ${n.count.toLocaleString()} crew`),
    ...stats.recentVacancies.map(v => `🆕 ${v.rank} · ${v.vessel} · ${v.salary} · ${v.location}`),
  ];
  const doubled = [...tickerItems, ...tickerItems];

  return (
    <div className="w-full bg-[#0a1628] border-b border-primary/20">
      {/* Stats row */}
      <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold tracking-widest text-primary uppercase">⚓ LIVE MARKET</span>
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        </div>

        <div className="flex items-center gap-4">
          {[
            { label: 'Crew Registered', value: stats.totalCrew.toLocaleString(), icon: '👥' },
            { label: 'Available Now', value: stats.availableCrew.toLocaleString(), icon: '✅' },
            { label: 'Open Vacancies', value: stats.totalVacancies.toLocaleString(), icon: '💼' },
          ].map(stat => (
            <div key={stat.label} className="flex items-center gap-1.5 text-xs">
              <span>{stat.icon}</span>
              <span className="font-bold text-foreground">{stat.value}</span>
              <span className="text-muted-foreground hidden sm:inline">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Scrolling ticker */}
      <div ref={scrollRef} className="overflow-hidden whitespace-nowrap py-1.5 bg-[#060f1d] border-t border-primary/10">
        {doubled.map((item, i) => (
          <span key={i} className="inline-block text-[11px] text-muted-foreground mx-4">
            <span className="text-primary/60 mr-1.5">◆</span>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
