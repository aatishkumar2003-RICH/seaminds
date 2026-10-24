import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronLeft, FileDown, Lock, Users, FileText, ScrollText, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { buildResumePdf } from "@/lib/resumePdf";
import { buildPrincipalPdf, missingForPrincipal, PRESETS, type MasterRecord, type PrincipalPreset } from "@/lib/principalCvPdf";

type RosterRow = { application_id: string; outcome: string; crew_name: string; rank: string; nationality: string; vessel: string; joining_date: string | null; crew_confirmed: boolean; crew_unique_id: string };
type Format = "master" | PrincipalPreset;

const TABS = [
  { id: "roster", label: "Roster", icon: Users },
  { id: "cv", label: "Principal CV Studio", icon: FileText },
  { id: "contracts", label: "SEA Contracts", icon: ScrollText, soon: true },
  { id: "portage", label: "Portage Bill", icon: Wallet, soon: true },
];
const STATUS: Record<string, string> = { shortlisted: "Shortlisted", offered: "Offer sent", placed: "Joining / Onboard" };

export default function CrewDesk() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "roster";
  const [rows, setRows] = useState<RosterRow[] | null>(null);
  const [company, setCompany] = useState("");
  const [selected, setSelected] = useState<string>("");
  const [format, setFormat] = useState<Format>("master");
  const [record, setRecord] = useState<MasterRecord | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (auth?.user) {
        const { data: mp } = await supabase.from("manager_profiles").select("company_name").eq("user_id", auth.user.id).maybeSingle();
        setCompany(mp?.company_name || "");
      }
      const { data, error } = await supabase.rpc("crew_desk_roster" as any);
      if (error) { toast.error("Could not load your crew roster. Please retry."); setRows([]); return; }
      setRows((data as any) || []);
    })();
  }, []);

  useEffect(() => {
    setRecord(null);
    if (!selected) return;
    (async () => {
      const { data, error } = await supabase.rpc("crew_desk_master_record" as any, { _application_id: selected });
      const d = data as any;
      if (error || d?.error) { toast.error(d?.error === "crew_not_confirmed" ? "The crew member must confirm joining before you can open their full record." : "Could not open this crew record."); return; }
      setRecord(d);
    })();
  }, [selected]);

  const openCv = (id: string) => { setSelected(id); setParams({ tab: "cv" }); };

  const exportPdf = async () => {
    if (!record) return;
    setBusy(true);
    try {
      const name = [record.personal?.firstName || record.profile?.first_name, record.personal?.lastName || record.profile?.last_name].filter(Boolean).join("_") || "crew";
      const pdf = format === "master"
        ? await buildResumePdf({ personal: { ...record.profile, ...record.personal, firstName: record.personal?.firstName || record.profile?.first_name, lastName: record.personal?.lastName || record.profile?.last_name, rank: record.personal?.rank || record.profile?.rank }, sea: record.sea || [], certs: record.certs || [], edu: record.edu || [], training: (record as any).training || [], skills: record.skills || {}, photo: record.photo || null, cvUid: record.cv_uid || "", declaration: record.declaration as any })
        : await buildPrincipalPdf(record, format, company);
      pdf.save(`${name}_${format}_CV.pdf`);
      toast.success("CV downloaded");
    } catch { toast.error("PDF could not be created. Please try again."); }
    setBusy(false);
  };

  const confirmed = (rows || []).filter(r => r.crew_confirmed);
  const missing = record ? missingForPrincipal(record) : [];

  return (
    <div className="max-w-5xl mx-auto p-4 pb-24 space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/manager/dashboard?tab=crew" aria-label="Back" className="w-10 h-10 flex items-center justify-center rounded-xl text-primary hover:bg-secondary"><ChevronLeft size={20} /></Link>
        <div>
          <h1 className="text-lg font-bold text-primary">Crew Management Tools</h1>
          <p className="text-xs text-muted-foreground">Your private crew desk — free during launch.</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setParams({ tab: t.id })}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 min-h-[40px] text-sm border ${tab === t.id ? "bg-primary text-primary-foreground border-primary font-semibold" : "border-border text-muted-foreground"}`}>
            <t.icon size={14} /> {t.label}{t.soon && <span className="text-[9px] uppercase opacity-70">soon</span>}
          </button>
        ))}
      </div>

      {tab === "roster" && (
        <div className="space-y-2">
          {rows === null && <p className="text-sm text-muted-foreground">Loading roster…</p>}
          {rows?.length === 0 && <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">No crew in your pipeline yet. Shortlist applicants in Recruitment & Applicants and they appear here.</div>}
          {rows?.map(r => (
            <div key={r.application_id} className="rounded-xl border border-border bg-card p-3 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[180px]">
                <p className="font-semibold text-foreground">{r.crew_name || "Crew"}</p>
                <p className="text-xs text-muted-foreground">{[r.rank, r.nationality, r.vessel].filter(Boolean).join(" • ")}</p>
                {r.joining_date && <p className="text-xs text-muted-foreground">Joining: {r.joining_date}</p>}
              </div>
              <span className="text-[11px] rounded-full border border-primary/40 text-primary px-2 py-0.5">{STATUS[r.outcome] || r.outcome}</span>
              {r.crew_confirmed
                ? <button onClick={() => openCv(r.application_id)} className="rounded-xl bg-primary text-primary-foreground font-bold px-3 min-h-[40px] text-sm">Open CV Studio</button>
                : <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><Lock size={12} /> Full record opens after crew confirms joining</span>}
            </div>
          ))}
        </div>
      )}

      {tab === "cv" && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground">Crew member (confirmed joiners)</label>
            <select value={selected} onChange={e => setSelected(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 min-h-[44px] text-sm text-foreground">
              <option value="">Select crew…</option>
              {confirmed.map(r => <option key={r.application_id} value={r.application_id}>{r.crew_name} — {r.rank}</option>)}
            </select>
            {rows && confirmed.length === 0 && <p className="text-xs text-muted-foreground mt-1">No crew has confirmed joining yet.</p>}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {([["master", "SeaMinds Master", "Portrait A4 with photo, full history and crew declaration."], ["anglo", PRESETS.anglo.title, PRESETS.anglo.note], ["synergy", PRESETS.synergy.title, PRESETS.synergy.note]] as [Format, string, string][]).map(([id, t, n]) => (
              <button key={id} onClick={() => setFormat(id)} className={`text-left rounded-xl border p-3 ${format === id ? "border-primary bg-primary/10" : "border-border"}`}>
                <p className="text-sm font-semibold text-foreground">{t}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{n}</p>
              </button>
            ))}
          </div>
          {record && missing.length > 0 && <p className="text-xs text-amber-400">Still missing in the crew's CV: {missing.join(", ")}. Ask the crew to update their CV in the SeaMinds app.</p>}
          <button disabled={!record || busy} onClick={exportPdf} className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground font-bold min-h-[48px] disabled:opacity-50">
            <FileDown size={16} /> {busy ? "Creating PDF…" : "Download CV"}
          </button>
          <p className="text-[11px] text-muted-foreground">Principal layouts are SeaMinds "style" formats, not official company forms. Send us a principal's blank form to match it exactly.</p>
        </div>
      )}

      {(tab === "contracts" || tab === "portage") && (
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          {tab === "contracts" ? "SEA contract drafting with salary breakdown is the next step." : "Portage bill, cash advances and allotments come after SEA contracts."}
        </div>
      )}
    </div>
  );
}
