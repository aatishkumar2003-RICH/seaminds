import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const FLAGS: Record<string, string> = {
  Filipino:'🇵🇭',Indian:'🇮🇳',Indonesian:'🇮🇩',Ukrainian:'🇺🇦',
  Russian:'🇷🇺',Chinese:'🇨🇳',Vietnamese:'🇻🇳',Myanmar:'🇲🇲',
  Bangladeshi:'🇧🇩',Greek:'🇬🇷',Croatian:'🇭🇷',
};

export default function MarketPulseButton({ onNavigateJobs }: { onNavigateJobs?: () => void }) {
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState({ crew:0, available:0, vacancies:0 });
  const [nats, setNats] = useState<{flag:string;name:string;count:number;pct:number}[]>([]);
  const [jobs, setJobs] = useState<{rank:string;vessel:string;salary:string;port:string}[]>([]);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      const [c,a,v,n,j] = await Promise.all([
        supabase.from('crew_profiles').select('*',{count:'exact',head:true}),
        supabase.from('crew_profiles').select('*',{count:'exact',head:true}).eq('is_available',true),
        supabase.from('job_vacancies').select('*',{count:'exact',head:true}),
        supabase.from('crew_profiles').select('nationality').not('nationality','is',null),
        supabase.from('job_vacancies').select('rank_required,vessel_type,salary_max,joining_port').order('created_at',{ascending:false}).limit(5),
      ]);
      const total = c.count||0;
      const map:Record<string, number> = {};
      (n.data||[]).forEach((r:any)=>{ const k=r.nationality?.trim(); if(k) map[k]=(map[k]||0)+1; });
      const sorted = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,6);
      setStats({crew:total,available:a.count||0,vacancies:v.count||0});
      setNats(sorted.map(([name,count])=>({flag:FLAGS[name]||'🌍',name,count,pct:total?Math.round(count/total*100):0})));
      setJobs((j.data||[]).map((v:any)=>({rank:v.rank_required||'Officer',vessel:v.vessel_type||'Various',salary:v.salary_max?`$${Number(v.salary_max).toLocaleString()}`:'TBD',port:v.joining_port||'Worldwide'})));
    };
    load();
  }, [open]);

  return (
    <>
      {/* Floating pulse button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed z-50 flex items-center gap-1.5 rounded-xl border border-primary/50 bg-gradient-to-br from-[#0a1628] to-[#1a2e47] px-2.5 py-1.5 shadow-lg"
        style={{ bottom: 72, right: 16 }}
      >
        <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-[10px] font-bold tracking-wider text-primary">LIVE</span>
        <span>📊</span>
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md animate-in slide-in-from-bottom-4 rounded-t-2xl border-t border-border bg-card p-5 max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-bold tracking-widest text-primary">⚓ LIVE MARKET</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground text-lg">✕</button>
            </div>

            {/* Stats */}
            <div className="mb-4 grid grid-cols-3 gap-2">
              {[
                {icon:'👥',val:stats.crew,label:'Crew',color:'hsl(var(--primary))'},
                {icon:'✅',val:stats.available,label:'Available',color:'#22c55e'},
                {icon:'💼',val:stats.vacancies,label:'Vacancies',color:'#60a5fa'},
              ].map(s=>(
                <div key={s.label} className="rounded-xl bg-secondary p-3 text-center">
                  <p className="text-lg">{s.icon}</p>
                  <p className="text-lg font-bold" style={{color:s.color}}>{s.val.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Nationality breakdown */}
            <div className="mb-4">
              <p className="mb-2 text-xs font-bold tracking-wide text-muted-foreground">Crew by Nationality</p>
              {nats.map(n=>(
                <div key={n.name} className="mb-1.5 flex items-center gap-2 text-xs">
                  <span>{n.flag}</span>
                  <span className="w-20 truncate text-foreground">{n.name}</span>
                  <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full bg-primary/60" style={{width:`${n.pct}%`}} />
                  </div>
                  <span className="text-muted-foreground w-8 text-right">{n.count}</span>
                </div>
              ))}
            </div>

            {/* Recent vacancies */}
            {jobs.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-xs font-bold tracking-wide text-muted-foreground">Latest Vacancies</p>
                {jobs.map((j,i)=>(
                  <div key={i} className="mb-2 flex items-center justify-between rounded-lg bg-secondary p-2.5">
                    <div>
                      <p className="text-xs font-semibold text-foreground">{j.rank}</p>
                      <p className="text-[10px] text-muted-foreground">{j.vessel} · {j.port}</p>
                    </div>
                    <p className="text-xs font-bold text-primary">{j.salary}</p>
                  </div>
                ))}
              </div>
            )}

            {/* CTA */}
            <button
              onClick={() => { setOpen(false); onNavigateJobs?.(); }}
              className="w-full rounded-xl bg-gradient-to-r from-primary to-primary/80 py-3 text-sm font-extrabold tracking-wide text-primary-foreground"
            >
              Browse All Vacancies →
            </button>
          </div>
        </div>
      )}
    </>
  );
}
