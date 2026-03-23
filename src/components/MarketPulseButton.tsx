import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const FLAGS: Record<string, string> = {
  Filipino:'🇵🇭',Indian:'🇮🇳',Indonesian:'🇮🇩',Ukrainian:'🇺🇦',
  Russian:'🇷🇺',Chinese:'🇨🇳',Vietnamese:'🇻🇳',Myanmar:'🇲🇲',
  Bangladeshi:'🇧🇩',Greek:'🇬🇷',Croatian:'🇭🇷',Turkish:'🇹🇷',
  Pakistani:'🇵🇰',Nepali:'🇳🇵',Nigerian:'🇳🇬',
};

const VESSEL_ICONS: Record<string, string> = {
  'LNG':'⛽','FPSO':'🛢️','Bulk Carrier':'⚓','Container':'📦',
  'Tanker':'🛢️','Offshore':'🔧','General Cargo':'🚢','PSV':'🚤',
  'Chemical Tanker':'⚗️','Car Carrier':'🚗','Cruise':'🛳️','Other':'🚢',
};

function AnimatedNumber({ value, duration = 1000 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const start = prev.current;
    const diff = value - start;
    if (diff === 0) return;
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + diff * ease));
      if (progress < 1) requestAnimationFrame(tick);
      else prev.current = value;
    };
    requestAnimationFrame(tick);
  }, [value, duration]);
  return <span>{display.toLocaleString()}</span>;
}

function HeatBar({ value, max, color }: { value: number; max: number; color: string }) {
  const [width, setWidth] = useState(0);
  useEffect(() => { setTimeout(() => setWidth(max > 0 ? (value / max) * 100 : 0), 100); }, [value, max]);
  return (
    <div style={{ width: '100%', height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
      <div style={{
        width: `${width}%`, height: '100%', borderRadius: 4,
        background: color, transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
      }} />
    </div>
  );
}

interface MarketData {
  totalCrew: number;
  availableCrew: number;
  newToday: number;
  byNationality: { flag: string; name: string; count: number; pct: number }[];
  byVessel: { vessel: string; icon: string; count: number; avgSalary: number; trend: string }[];
  myVacancies: number;
  myAvgSalary: number;
  myMaxSalary: number;
  myMinSalary: number;
  myCompetition: number;
  myCompetitionLevel: 'Low' | 'Medium' | 'High';
  topPorts: { port: string; count: number }[];
  topJobs: { rank: string; vessel: string; salary: number; company: string; port: string; website: string | null }[];
  salaryTrend: number;
  totalVacancies: number;
  newVacancies24h: number;
}

export default function MarketPulseButton({
  onNavigateJobs,
  userRank,
  userVessel,
  userNationality,
}: {
  onNavigateJobs?: () => void;
  userRank?: string;
  userVessel?: string;
  userNationality?: string;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(false);
  const [pulse, setPulse] = useState(false);

  // Pulse every 30s to signal live data
  useEffect(() => {
    const id = setInterval(() => { setPulse(true); setTimeout(() => setPulse(false), 600); }, 30000);
    return () => clearInterval(id);
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [crewRes, availRes, natRes, newTodayRes,
             allVacRes, extVacRes, new24hRes, myVacRes,
             myCompRes, topJobsRes, lastMonthVacRes] = await Promise.all([
        supabase.from('crew_profiles').select('*', { count: 'exact', head: true }),
        supabase.from('crew_profiles').select('*', { count: 'exact', head: true }).eq('is_available', true),
        supabase.from('crew_profiles').select('nationality').not('nationality', 'is', null),
        supabase.from('crew_profiles').select('*', { count: 'exact', head: true }).gte('created_at', yesterday),
        supabase.from('job_vacancies').select('rank_required, vessel_type, salary_min, salary_max, joining_port, company_name'),
        supabase.from('external_vacancies').select('rank_required, vessel_type, salary_min, salary_max, joining_port, company_name').gte('quality_score', 40),
        supabase.from('external_vacancies').select('*', { count: 'exact', head: true }).gte('fetched_at', yesterday),
        // My rank vacancies
        userRank ? supabase.from('job_vacancies').select('salary_max, joining_port').ilike('rank_required', `%${userRank.split(' ')[0]}%`)
          : supabase.from('job_vacancies').select('salary_max, joining_port').limit(0),
        // My competition (same rank crew)
        userRank ? supabase.from('crew_profiles').select('*', { count: 'exact', head: true }).ilike('role', `%${userRank.split(' ')[0]}%`)
          : supabase.from('crew_profiles').select('*', { count: 'exact', head: true }).limit(0),
        // Top paying jobs
        supabase.from('external_vacancies').select('rank_required, vessel_type, salary_max, company_name, joining_port, company_website').not('salary_max', 'is', null).order('salary_max', { ascending: false }).limit(5),
        // Last month vacancies for trend
        supabase.from('external_vacancies').select('*', { count: 'exact', head: true }).gte('fetched_at', lastMonth).lt('fetched_at', yesterday),
      ]);

      const totalCrew = crewRes.count || 0;

      // Nationality breakdown
      const natMap: Record<string, number> = {};
      (natRes.data || []).forEach((r: any) => {
        const k = r.nationality?.trim();
        if (k) natMap[k] = (natMap[k] || 0) + 1;
      });
      const byNationality = Object.entries(natMap)
        .sort((a, b) => b[1] - a[1]).slice(0, 7)
        .map(([name, count]) => ({ flag: FLAGS[name] || '🌍', name, count, pct: totalCrew ? Math.round(count / totalCrew * 100) : 0 }));

      // All vacancies merged
      const allVac = [...(allVacRes.data || []), ...(extVacRes.data || [])];
      const totalVacancies = allVac.length;

      // By vessel
      const vesselMap: Record<string, { count: number; salaries: number[] }> = {};
      allVac.forEach((v: any) => {
        const k = v.vessel_type || 'Other';
        if (!vesselMap[k]) vesselMap[k] = { count: 0, salaries: [] };
        vesselMap[k].count++;
        if (v.salary_max) vesselMap[k].salaries.push(Number(v.salary_max));
      });
      const byVessel = Object.entries(vesselMap)
        .sort((a, b) => b[1].count - a[1].count).slice(0, 7)
        .map(([vessel, { count, salaries }]) => ({
          vessel, icon: VESSEL_ICONS[vessel] || '🚢', count,
          avgSalary: salaries.length ? Math.round(salaries.reduce((a, b) => a + b, 0) / salaries.length / 100) * 100 : 0,
          trend: count > 5 ? '🔥' : count > 2 ? '📈' : '➡️',
        }));

      // My personal market
      const myVacs = myVacRes.data || [];
      const mySalaries = myVacs.map((v: any) => Number(v.salary_max)).filter(Boolean);
      const myAvgSalary = mySalaries.length ? Math.round(mySalaries.reduce((a, b) => a + b, 0) / mySalaries.length / 100) * 100 : 0;
      const myMaxSalary = mySalaries.length ? Math.max(...mySalaries) : 0;
      const myMinSalary = mySalaries.length ? Math.min(...mySalaries) : 0;
      const myCompetition = myCompRes.count || 0;
      const ratio = myVacs.length > 0 ? myCompetition / myVacs.length : 99;
      const myCompetitionLevel = ratio < 3 ? 'Low' : ratio < 8 ? 'Medium' : 'High';

      // Top joining ports
      const portMap: Record<string, number> = {};
      allVac.forEach((v: any) => { if (v.joining_port) portMap[v.joining_port] = (portMap[v.joining_port] || 0) + 1; });
      const topPorts = Object.entries(portMap).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([port, count]) => ({ port, count }));

      // Top jobs
      const topJobs = (topJobsRes.data || []).map((v: any) => ({
        rank: v.rank_required || 'Officer', vessel: v.vessel_type || 'Various',
        salary: Number(v.salary_max), company: v.company_name || 'Confidential', port: v.joining_port || 'Worldwide',
      }));

      // Salary trend vs last month
      const prevCount = lastMonthVacRes.count || 1;
      const currCount = new24hRes.count || 0;
      const salaryTrend = prevCount > 0 ? Math.round(((currCount - prevCount) / prevCount) * 100) : 0;

      setData({
        totalCrew, availableCrew: availRes.count || 0,
        newToday: newTodayRes.count || 0,
        byNationality, byVessel, totalVacancies,
        myVacancies: myVacs.length,
        myAvgSalary, myMaxSalary, myMinSalary,
        myCompetition, myCompetitionLevel,
        topPorts, topJobs, salaryTrend,
        newVacancies24h: new24hRes.count || 0,
      });
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { if (open) load(); }, [open]);

  const competitionColor = { Low: '#22c55e', Medium: '#f59e0b', High: '#ef4444' };
  const competitionEmoji = { Low: '🟢', Medium: '🟡', High: '🔴' };

  return (
    <>
      {/* Floating button */}
      <button onClick={() => setOpen(true)} style={{
        position: 'fixed', bottom: 72, right: 16, zIndex: 50,
        background: 'linear-gradient(135deg,#0a1628,#1a2e47)',
        border: `1px solid ${pulse ? '#D4AF37' : 'rgba(212,175,55,0.4)'}`,
        borderRadius: 12, padding: '7px 12px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 6,
        boxShadow: `0 4px 20px rgba(212,175,55,${pulse ? '0.4' : '0.15'})`,
        transition: 'all 0.3s ease',
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }} />
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: '#D4AF37' }}>MARKET</span>
      </button>

      {/* Panel */}
      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={() => setOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} />
          <div onClick={e => e.stopPropagation()} style={{
            position: 'relative', width: '100%', maxWidth: 440, maxHeight: '90vh',
            background: '#0d1526', borderTop: '1px solid rgba(212,175,55,0.3)',
            borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column',
            animation: 'slideUp 0.3s ease-out',
          }}>

            {/* Header */}
            <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }} />
                    <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: 2, color: '#D4AF37' }}>⚓ SeaMarkets</span>
                    <span style={{ fontSize: 9, fontWeight: 700, background: 'rgba(34,197,94,0.15)', color: '#22c55e', padding: '2px 6px', borderRadius: 4 }}>LIVE</span>
                  </div>
                  {userRank && (
                    <p style={{ fontSize: 11, color: '#8896a8', marginTop: 4 }}>
                      Your market: <span style={{ color: '#D4AF37' }}>{userRank}</span>
                      {userVessel && <span> · {userVessel}</span>}
                    </p>
                  )}
                </div>
                <button onClick={() => setOpen(false)} style={{ background: 'transparent', border: 'none', color: '#444', fontSize: 22, cursor: 'pointer' }}>✕</button>
              </div>

              {/* Platform stats strip */}
              {data && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 12 }}>
                  {[
                    { v: data.totalCrew, l: 'Crew', icon: '👥', c: '#D4AF37' },
                    { v: data.availableCrew, l: 'Available', icon: '✅', c: '#22c55e' },
                    { v: data.totalVacancies, l: 'Vacancies', icon: '💼', c: '#60a5fa' },
                    { v: data.newVacancies24h, l: 'New 24h', icon: '🆕', c: '#a78bfa' },
                  ].map(s => (
                    <div key={s.l} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '8px 4px' }}>
                      <p style={{ fontSize: 14, margin: 0 }}>{s.icon}</p>
                      <p style={{ fontSize: 16, fontWeight: 800, color: s.c, margin: '2px 0' }}><AnimatedNumber value={s.v} /></p>
                      <p style={{ fontSize: 9, color: '#6b7a8d', margin: 0 }}>{s.l}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Scrollable content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', minHeight: 0 }}>
              {loading && (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <p style={{ fontSize: 32, animation: 'spin 2s linear infinite' }}>⚓</p>
                  <p style={{ fontSize: 12, color: '#6b7a8d' }}>Loading market intelligence...</p>
                </div>
              )}

              {!loading && data && (
                <>
                  {/* MY PERSONAL MARKET — only if rank known */}
                  {userRank && (
                    <div style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 14, padding: 14, marginBottom: 16 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: '#D4AF37', marginBottom: 10, letterSpacing: 0.5 }}>
                        🎯 Your Market — {userRank}
                      </p>

                      {/* Competition indicator */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: 10 }}>
                          <p style={{ fontSize: 9, color: '#6b7a8d', margin: '0 0 4px' }}>Competition Level</p>
                          <p style={{ fontSize: 16, fontWeight: 800, color: competitionColor[data.myCompetitionLevel], margin: 0 }}>
                            {competitionEmoji[data.myCompetitionLevel]} {data.myCompetitionLevel}
                          </p>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: 10 }}>
                          <p style={{ fontSize: 9, color: '#6b7a8d', margin: '0 0 4px' }}>Supply vs Demand</p>
                          <p style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
                            {data.myCompetition} crew : {data.myVacancies} jobs
                          </p>
                        </div>
                      </div>

                      {/* Salary range bar */}
                      {data.myMaxSalary > 0 && (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 10, color: '#8896a8' }}>Salary Range Today</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#22c55e' }}>
                              avg ${data.myAvgSalary.toLocaleString()}/mo
                            </span>
                          </div>
                          <div style={{ position: 'relative', height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)' }}>
                            <div style={{ position: 'absolute', left: '10%', right: '10%', top: 0, bottom: 0, borderRadius: 4, background: 'linear-gradient(90deg,#22c55e,#D4AF37)' }} />
                            <span style={{ position: 'absolute', left: 0, top: 12, fontSize: 9, color: '#6b7a8d' }}>${(data.myMinSalary / 1000).toFixed(0)}k</span>
                            <span style={{ position: 'absolute', right: 0, top: 12, fontSize: 9, color: '#6b7a8d' }}>${(data.myMaxSalary / 1000).toFixed(0)}k</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* VESSEL HEAT MAP */}
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#8896a8', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>
                      🚢 Vessel Demand Heat
                    </p>
                    {data.byVessel.map(v => (
                      <div key={v.vessel} style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, marginBottom: 3 }}>
                          <span>{v.icon}</span>
                          <span style={{ color: '#e2e8f0', flex: 1 }}>{v.vessel}</span>
                          <span>{v.trend}</span>
                          <span style={{ color: '#60a5fa', fontWeight: 700, width: 24, textAlign: 'right' }}>{v.count}</span>
                          {v.avgSalary > 0 && <span style={{ color: '#6b7a8d', fontSize: 9 }}>${(v.avgSalary / 1000).toFixed(0)}k avg</span>}
                        </div>
                        <HeatBar value={v.count} max={Math.max(...data.byVessel.map(x => x.count))} color="linear-gradient(90deg,#1d4ed8,#60a5fa)" />
                      </div>
                    ))}
                    {!data.byVessel.length && <p style={{ fontSize: 11, color: '#6b7a8d' }}>Agent collecting data...</p>}
                  </div>

                  {/* TOP PAYING JOBS */}
                  {data.topJobs.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: '#8896a8', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>
                        💰 Highest Paying Right Now
                      </p>
                      {data.topJobs.map((j, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 12px', marginBottom: 6 }}>
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>{j.rank}</p>
                            <p style={{ fontSize: 10, color: '#6b7a8d', margin: 0 }}>{j.vessel} · {j.port}</p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: 14, fontWeight: 800, color: '#22c55e', margin: 0 }}>${j.salary.toLocaleString()}</p>
                            <p style={{ fontSize: 9, color: '#6b7a8d', margin: 0 }}>per month</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* CREW NATIONALITY MAP */}
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#8896a8', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>
                      🌍 Crew Nationalities
                    </p>
                    {data.byNationality.map(n => (
                      <div key={n.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 11 }}>
                        <span>{n.flag}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                            <span style={{ color: '#e2e8f0' }}>{n.name}</span>
                            <span style={{ display: 'flex', gap: 8 }}>
                              <span style={{ color: '#6b7a8d' }}>{n.pct}%</span>
                              <span style={{ color: '#D4AF37', fontWeight: 700 }}>{n.count}</span>
                            </span>
                          </div>
                          <HeatBar value={n.pct} max={100} color="#D4AF37" />
                        </div>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#6b7a8d', marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <span>Available for joining</span>
                      <span style={{ color: '#22c55e', fontWeight: 700 }}>{data.availableCrew} crew</span>
                    </div>
                  </div>

                  {/* TOP JOINING PORTS */}
                  {data.topPorts.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: '#8896a8', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>
                        🗺️ Top Joining Ports
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        {data.topPorts.map(p => (
                          <div key={p.port} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 10px', display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                            <span style={{ color: '#e2e8f0' }}>📍 {p.port}</span>
                            <span style={{ color: '#60a5fa', fontWeight: 700 }}>{p.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* NEW CREW TODAY */}
                  {data.newToday > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7a8d', padding: '8px 0' }}>
                      <span>🆕 Crew joined today</span>
                      <span style={{ color: '#22c55e', fontWeight: 700 }}>+{data.newToday}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Fixed CTA */}
            <div style={{ padding: '12px 20px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button onClick={() => { setOpen(false); onNavigateJobs?.(); }} style={{
                width: '100%', background: 'linear-gradient(90deg,#D4AF37,#f0d080)',
                color: '#070f1c', border: 'none', borderRadius: 12,
                padding: 13, fontWeight: 800, fontSize: 14, cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(212,175,55,0.3)',
              }}>
                {data?.myVacancies ? `Browse My ${data.myVacancies} Vacancies →` : 'Browse All Vacancies →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
