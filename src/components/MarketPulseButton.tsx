import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
  byVessel: { vessel: string; icon: string; count: number; avgSalary: number; trend: string }[];
  myVacancies: number;
  myAvgSalary: number;
  myMaxSalary: number;
  myMinSalary: number;
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
      // Single source of truth shared with the manager Live Vacancy Feed.
      const { data: m, error } = await (supabase.rpc as any)('market_pulse', { p_rank: userRank || null });
      if (error) throw error;
      const d: any = m || {};
      const my = d.my || {};
      setData({
        byVessel: (d.byVessel || []).map((v: any) => ({
          vessel: v.vessel, icon: VESSEL_ICONS[v.vessel] || '🚢', count: Number(v.count),
          avgSalary: Number(v.avgSalary) || 0,
          trend: v.count > 500 ? '🔥' : v.count > 100 ? '📈' : '➡️',
        })),
        totalVacancies: Number(d.active) || 0,
        myVacancies: Number(my.count) || 0,
        myAvgSalary: Number(my.avg) || 0, myMaxSalary: Number(my.max) || 0, myMinSalary: Number(my.min) || 0,
        topPorts: (d.topPorts || []).map((p: any) => ({ port: p.port, count: Number(p.count) })),
        topJobs: (d.topJobs || []).map((j: any) => ({ ...j, salary: Number(j.salary), website: null })),
        salaryTrend: 0,
        newVacancies24h: Number(d.new24h) || 0,
      });
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { if (open) load(); }, [open]);

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open SeaMarkets"
        style={{
          position: 'fixed', top: '50%', right: 0, transform: 'translateY(-50%)', zIndex: 50,
          background: 'linear-gradient(135deg,#0a1628,#1a2e47)',
          border: `1px solid ${pulse ? '#D4AF37' : 'rgba(212,175,55,0.4)'}`,
          borderRight: 'none',
          borderRadius: '12px 0 0 12px',
          padding: '12px 5px', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
          boxShadow: `-3px 0 16px rgba(212,175,55,${pulse ? '0.35' : '0.12'})`,
          transition: 'all 0.3s ease',
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }} />
        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: 1.5, color: '#D4AF37',
          writingMode: 'vertical-rl', textOrientation: 'mixed',
        }}>MARKET</span>
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
                  <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '8px 4px' }}>
                    <p style={{ fontSize: 14, margin: 0 }}>👥</p>
                    <p style={{ fontSize: 13, fontWeight: 800, color: '#D4AF37', margin: '2px 0', letterSpacing: -1 }}>★★★★★</p>
                    <p style={{ fontSize: 9, color: '#6b7a8d', margin: 0 }}>Crew network</p>
                  </div>
                  <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '8px 4px' }}>
                    <p style={{ fontSize: 14, margin: 0 }}>✅</p>
                    <p style={{ fontSize: 13, fontWeight: 800, color: '#22c55e', margin: '2px 0', letterSpacing: -1 }}>★★★★★</p>
                    <p style={{ fontSize: 9, color: '#6b7a8d', margin: 0 }}>Availability</p>
                  </div>
                  {[
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

                      {/* Crew supply remains private; only company subscribers can search it. */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: 10 }}>
                          <p style={{ fontSize: 9, color: '#6b7a8d', margin: '0 0 4px' }}>Crew Supply</p>
                          <p style={{ fontSize: 14, fontWeight: 800, color: '#D4AF37', margin: 0, letterSpacing: -1 }}>
                            ★★★★★
                          </p>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: 10 }}>
                          <p style={{ fontSize: 9, color: '#6b7a8d', margin: '0 0 4px' }}>Supply vs Demand</p>
                          <p style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
                            Private company insight
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
                            <p style={{ fontSize: 10, color: '#6b7a8d', margin: 0 }}>
                              {j.vessel} · {j.port}
                              {j.website && (
                                <> · <a href={j.website.startsWith('http') ? j.website : `https://${j.website}`} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', textDecoration: 'none' }}>🌐 Website</a></>
                              )}
                            </p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: 14, fontWeight: 800, color: '#22c55e', margin: 0 }}>${j.salary.toLocaleString()}</p>
                            <p style={{ fontSize: 9, color: '#6b7a8d', margin: 0 }}>per month</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Crew totals and nationality distribution are subscription-protected. */}
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#8896a8', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>
                      🌍 Crew Nationalities
                    </p>
                    <button
                      type="button"
                      onClick={() => { window.location.href = '/pricing#company'; }}
                      style={{ width: '100%', background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.25)', borderRadius: 12, padding: 14, cursor: 'pointer', textAlign: 'left' }}
                    >
                      <span style={{ display: 'block', color: '#D4AF37', fontSize: 14, fontWeight: 800, letterSpacing: -1 }}>★★★★★</span>
                      <span style={{ display: 'block', color: '#e2e8f0', fontSize: 12, fontWeight: 700, marginTop: 4 }}>Company subscription required</span>
                      <span style={{ display: 'block', color: '#6b7a8d', fontSize: 10, marginTop: 3 }}>Unlock crew search by nationality and availability →</span>
                    </button>
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
