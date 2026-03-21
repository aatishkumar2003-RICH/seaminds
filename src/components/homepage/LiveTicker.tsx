import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const FLAGS: Record<string, string> = {
  Filipino:'🇵🇭', Indian:'🇮🇳', Indonesian:'🇮🇩', Ukrainian:'🇺🇦',
  Russian:'🇷🇺', Chinese:'🇨🇳', Vietnamese:'🇻🇳', Myanmar:'🇲🇲',
  Bangladeshi:'🇧🇩', Greek:'🇬🇷', Croatian:'🇭🇷', Turkish:'🇹🇷',
  Nigerian:'🇳🇬', Pakistani:'🇵🇰', Nepali:'🇳🇵',
};

function useCountUp(target: number, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setVal(target); clearInterval(timer); }
      else setVal(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target]);
  return val;
}

export default function LiveTicker() {
  const [stats, setStats] = useState({ totalCrew: 0, availableCrew: 0, totalVacancies: 0 });
  const [nationalities, setNationalities] = useState<{flag:string;name:string;count:number}[]>([]);
  const [jobs, setJobs] = useState<{rank:string;vessel:string;salary:string;port:string}[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const crew = useCountUp(stats.totalCrew);
  const avail = useCountUp(stats.availableCrew);
  const vac = useCountUp(stats.totalVacancies);

  useEffect(() => {
    const load = async () => {
      try {
        const [c, a, v, n, j] = await Promise.all([
          supabase.from('crew_profiles').select('*',{count:'exact',head:true}),
          supabase.from('crew_profiles').select('*',{count:'exact',head:true}).eq('is_available',true),
          supabase.from('job_vacancies').select('*',{count:'exact',head:true}),
          supabase.from('crew_profiles').select('nationality').not('nationality','is',null),
          supabase.from('job_vacancies').select('rank_required,vessel_type,salary_max,joining_port').order('created_at',{ascending:false}).limit(10),
        ]);
        setStats({ totalCrew: c.count||0, availableCrew: a.count||0, totalVacancies: v.count||0 });
        const map: Record<string, number> = {};
        (n.data||[]).forEach((r:any) => { const k=r.nationality?.trim(); if(k) map[k]=(map[k]||0)+1; });
        setNationalities(Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([name,count])=>({flag:FLAGS[name]||'🌍',name,count})));
        setJobs((j.data||[]).map((v:any)=>({rank:v.rank_required||'Officer',vessel:v.vessel_type||'Various',salary:v.salary_max?`$${Number(v.salary_max).toLocaleString()}`:'Competitive',port:v.joining_port||'Worldwide'})));
      } catch(e) { console.error(e); }
    };
    load();
    const t = setInterval(load, 5*60*1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let pos = 0;
    const id = setInterval(() => {
      pos += 0.6;
      if (pos >= el.scrollWidth / 2) pos = 0;
      el.scrollLeft = pos;
    }, 16);
    return () => clearInterval(id);
  }, [jobs, nationalities]);

  const tickerItems = [
    ...nationalities.map(n=>`${n.flag} ${n.name} ${n.count.toLocaleString()}`),
    ...jobs.map(j=>`🆕 ${j.rank} · ${j.vessel} · ${j.salary} · ${j.port}`),
  ];
  const doubled = [...tickerItems, ...tickerItems];

  return (
    <div className="w-full fixed top-0 left-0 z-50">
      {/* Stats bar */}
      <div className="bg-[#0a1628]/95 backdrop-blur-md border-b border-primary/20 px-4 py-2">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          {/* Live badge */}
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-bold tracking-widest text-primary uppercase">Live Market</span>
            <span className="text-[10px] text-muted-foreground">⚓ SeaMinds</span>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4">
            {[
              {icon:'👥',val:crew,label:'Crew',color:'#D4AF37'},
              {icon:'✅',val:avail,label:'Available',color:'#22c55e'},
              {icon:'💼',val:vac,label:'Vacancies',color:'#60a5fa'},
            ].map(s=>(
              <div key={s.label} className="flex items-center gap-1.5 text-xs">
                <span>{s.icon}</span>
                <span className="font-bold" style={{color:s.color}}>{s.val.toLocaleString()}</span>
                <span className="text-muted-foreground hidden sm:inline">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scrolling ticker */}
      <div ref={scrollRef} className="overflow-hidden whitespace-nowrap py-1.5 bg-[#060f1d]/95 backdrop-blur-sm border-b border-primary/10">
        {doubled.map((item,i)=>(
          <span key={i} className="inline-block text-[11px] text-muted-foreground mx-4">
            <span className="text-primary/60 mr-1.5">◆</span>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
