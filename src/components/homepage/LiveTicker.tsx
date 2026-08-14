import { useState, useEffect } from 'react';
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
  const crew = useCountUp(stats.totalCrew);
  const avail = useCountUp(stats.availableCrew);
  const vac = useCountUp(stats.totalVacancies);

  useEffect(() => {
    const load = async () => {
      try {
        const [{ data }, j] = await Promise.all([
          supabase.rpc('get_public_ticker_stats'),
          supabase.from('external_vacancies').select('rank_required,vessel_type,salary_max,joining_port').gt('expires_at', new Date().toISOString()).order('created_at',{ascending:false}).limit(10),
        ]);
        const tickerData = data as { total_crew?: number; available_crew?: number; total_vacancies?: number; nationalities?: { name: string; count: number }[] } | null;
        if (tickerData) {
          setStats({
            totalCrew: tickerData.total_crew || 0,
            availableCrew: tickerData.available_crew || 0,
            totalVacancies: tickerData.total_vacancies || 0,
          });
          setNationalities((tickerData.nationalities || []).map((n) => ({
            flag: FLAGS[n.name] || '🌍',
            name: n.name,
            count: n.count || 0,
          })));
        }
        setJobs((j.data||[]).map((v:any)=>({rank:v.rank_required||'Officer',vessel:v.vessel_type||'Various',salary:v.salary_max?`$${Number(v.salary_max).toLocaleString()}`:'Competitive',port:v.joining_port||'Worldwide'})));
      } catch(e) { console.error(e); }
    };
    load();
    const t = setInterval(load, 5*60*1000);
    return () => clearInterval(t);
  }, []);

  const tickerItems = [
    ...nationalities.map(n=>`${n.flag} ${n.name} ${n.count.toLocaleString()}`),
    ...jobs.map(j=>`🆕 ${j.rank} · ${j.vessel} · ${j.salary} · ${j.port}`),
  ];
  const displayItems = tickerItems.length > 0 ? tickerItems : ['⚓ SeaMinds — AI wellness, jobs & competency for seafarers'];
  const doubled = [...displayItems, ...displayItems];
  const duration = Math.max(20, displayItems.length * 4);

  return (
    <div className="w-full fixed top-0 left-0 z-50">
      <style>{`
        @keyframes seaminds-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .seaminds-marquee-track {
          display: inline-block;
          white-space: nowrap;
          animation: seaminds-marquee ${duration}s linear infinite;
        }
        .seaminds-marquee-track:hover {
          animation-play-state: paused;
        }
      `}</style>

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
      <div className="overflow-hidden whitespace-nowrap py-1.5 bg-[#060f1d]/95 backdrop-blur-sm border-b border-primary/10">
        <div className="seaminds-marquee-track">
          {doubled.map((item,i)=>(
            <span key={i} className="inline-block text-[11px] text-muted-foreground mx-4">
              <span className="text-primary/60 mr-1.5">◆</span>
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
