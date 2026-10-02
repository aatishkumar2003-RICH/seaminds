import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";

export default function SignInSheet({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const go = (p: string) => { onClose(); navigate(p); };
  const tile = "w-full text-left rounded-2xl bg-[#112240] border border-[rgba(212,175,55,0.3)] p-4 mb-3 min-h-[72px]";
  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-[#0D1B2A] border border-[rgba(212,175,55,0.3)] p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-[#D4AF37]">Sign in as</h2>
          <button onClick={onClose} aria-label="Close" className="text-[#94A3B8] p-1"><X size={20} /></button>
        </div>
        <button className={tile} onClick={() => go("/app")}>
          <p className="font-bold text-slate-100">👤 Seafarer / Crew</p>
          <p className="text-xs text-[#94A3B8]">Sea Profile, Score, jobs</p>
        </button>
        <button className={tile} onClick={() => go("/fleet/login")}>
          <p className="font-bold text-slate-100">🚢 Ship Management Staff</p>
          <p className="text-xs text-[#94A3B8]">Superintendents, office, Master, owners</p>
        </button>
        <button className={tile} onClick={() => go("/manager")}>
          <p className="font-bold text-slate-100">👔 Recruiting Company</p>
          <p className="text-xs text-[#94A3B8]">Search crew, interviews, vacancies</p>
        </button>
      </div>
    </div>
  );
}
