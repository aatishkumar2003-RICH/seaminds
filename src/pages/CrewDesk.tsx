import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronLeft, FileDown, Lock, Users, FileText, ScrollText, Wallet, LayoutDashboard, Star, ShieldAlert, GraduationCap } from "lucide-react";
import PromotionTab from "@/components/crew-desk/PromotionTab";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { buildResumePdf } from "@/lib/resumePdf";
import { missingForPrincipal, type MasterRecord } from "@/lib/principalCvPdf";
import PrincipalTemplateStudio from "@/components/crew-desk/PrincipalTemplateStudio";
import SeaContractsTab from "@/components/crew-desk/SeaContractsTab";
import FleetCockpit from "@/components/crew-desk/FleetCockpit";
import PortageBillTab from "@/components/crew-desk/PortageBillTab";
import AppraisalsTab from "@/components/crew-desk/AppraisalsTab";
import CertificateRadarTab from "@/components/crew-desk/CertificateRadarTab";
import OperatingModelPicker from "@/components/crew-desk/OperatingModelPicker";
import type { OperatingModel } from "@/lib/fleetCockpit";
import { Button } from "@/components/ui/button";

type RosterRow = { application_id: string; outcome: string; crew_name: string; rank: string; nationality: string; vessel: string; joining_date: string | null; crew_confirmed: boolean; crew_unique_id: string; crew_remark?: string | null };

const TABS = [
  { id: "fleet", label: "Fleet Overview", icon: LayoutDashboard },
  { id: "roster", label: "Roster", icon: Users },
  { id: "cv", label: "Principal CV Studio", icon: FileText },
  { id: "radar", label: "Cert Radar", icon: ShieldAlert },
  { id: "contracts", label: "SEA Contracts", icon: ScrollText },
  { id: "portage", label: "Portage Bill", icon: Wallet, soon: false },
  { id: "appraisals", label: "Appraisals", icon: Star },
  { id: "promotion", label: "Promotion", icon: GraduationCap },
];
const STATUS: Record<string, string> = { shortlisted: "Shortlisted", offered: "Offer sent", accepted: "Processing — awaiting SEA", placed: "Onboard (SEA signed)" };

export default function CrewDesk() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "fleet";
  const [rows, setRows] = useState<RosterRow[] | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [record, setRecord] = useState<MasterRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState<OperatingModel | null | undefined>(undefined);
  const [choosing, setChoosing] = useState(false);

  useEffect(() => {
    (supabase as any).from("crew_workspace_settings").select("operating_model").maybeSingle()
      .then(({ data }: any) => setModel(data?.operating_model ?? null));
  }, []);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("crew_desk_roster" as any);
      if (error) { toast.error("Could not load your crew roster. Please retry."); setRows([]); return; }
      setRows((data as any) || []);
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setRecord(null);
    if (!selected) return;
    (async () => {
      const { data, error } = await supabase.rpc("crew_desk_master_record" as any, { _application_id: selected });
      const d = data as any;
      if (cancelled) return;
      if (error || d?.error) { toast.error(d?.error === "crew_not_confirmed" ? "The crew member must confirm joining before you can open their full record." : "Could not open this crew record."); return; }
      setRecord(d);
    })();
    return () => { cancelled = true; };
  }, [selected]);

  const openCv = (id: string) => { setSelected(id); setParams({ tab: "cv" }); };

  const exportPdf = async () => {
    if (!record) return;
    setBusy(true);
    try {
      const name = [record.personal?.firstName || record.profile?.first_name, record.personal?.lastName || record.profile?.last_name].filter(Boolean).join("_") || "crew";
      if (!record.declaration?.acceptedAt) throw new Error("declaration_required");
      const pdf = await buildResumePdf({ personal: { ...record.profile, ...record.personal, firstName: record.personal?.firstName || record.profile?.first_name, lastName: record.personal?.lastName || record.profile?.last_name, rank: record.personal?.rank || record.profile?.rank }, sea: record.sea || [], certs: record.certs || [], edu: record.edu || [], training: (record as any).training || [], skills: record.skills || {}, photo: record.photo || null, cvUid: record.cv_uid || "", declaration: record.declaration as any });
      pdf.save(`${name}_SeaMinds_CV.pdf`);
      toast.success("CV downloaded");
    } catch { toast.error("PDF could not be created. Please try again."); }
    setBusy(false);
  };

  const confirmed = (rows || []).filter(r => r.crew_confirmed);
  const missing = record ? missingForPrincipal(record) : [];

  return (
    <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto p-4 lg:px-8 pb-24 space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/manager/dashboard?tab=crew" aria-label="Back" className="w-10 h-10 flex items-center justify-center rounded-xl text-primary hover:bg-secondary"><ChevronLeft size={20} /></Link>
        <div>
          <h1 className="text-lg font-bold text-primary">Crew Management Tools</h1>
          <p className="text-xs text-muted-foreground">Your private crew desk — free during launch.</p>
        </div>
        {model && !choosing && (
          <button onClick={() => setChoosing(true)} className="ml-auto text-xs rounded-xl border border-primary/40 text-primary px-3 min-h-[36px]">
            {model === "ship_manager" ? "Full Ship Manager" : "Crewing Agency"} · Change
          </button>
        )}
      </div>

      {model === undefined && <p className="text-sm text-muted-foreground">Loading…</p>}
      {(model === null || choosing) && <OperatingModelPicker current={model ?? null} onCancel={model ? () => setChoosing(false) : undefined} onSaved={m => { setModel(m); setChoosing(false); }} />}
      {model && !choosing && <>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setParams({ tab: t.id })}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 min-h-[40px] text-sm border ${tab === t.id ? "bg-primary text-primary-foreground border-primary font-semibold" : "border-border text-muted-foreground"}`}>
            <t.icon size={14} /> {t.label}{t.soon && <span className="text-[9px] uppercase opacity-70">soon</span>}
          </button>
        ))}
      </div>

      {tab === "fleet" && <FleetCockpit rows={rows} mode={model || "crewing_agency"} onOpen={(t, id) => { setSelected(id); setParams(t === "contracts" ? { tab: t, crew: id } : { tab: t }); }} />}
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
                {r.crew_remark && <p className="text-xs italic text-primary/80">💬 “{r.crew_remark}”</p>}
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
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground">Crew member (confirmed joiners)</label>
            <select value={selected} onChange={e => setSelected(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 min-h-[44px] text-sm text-foreground">
              <option value="">Select crew…</option>
              {confirmed.map(r => <option key={r.application_id} value={r.application_id}>{r.crew_name} — {r.rank}</option>)}
            </select>
            {rows && confirmed.length === 0 && <p className="text-xs text-muted-foreground mt-1">No crew has confirmed joining yet.</p>}
          </div>
          {record && missing.length > 0 && <p className="text-xs text-amber-400">Still missing in the crew's CV: {missing.join(", ")}. Ask the crew to update their CV in the SeaMinds app.</p>}
          <Button disabled={!record || busy || !record.declaration?.acceptedAt} onClick={exportPdf} className="w-full min-h-12">
            <FileDown size={16} /> {busy ? "Creating PDF…" : "Download SeaMinds CV (PDF)"}
          </Button>
          <PrincipalTemplateStudio record={record} />
        </div>
      )}

      {tab === "contracts" && <SeaContractsTab rows={rows} focusId={params.get("crew") || undefined} />}
      {tab === "portage" && <PortageBillTab rows={rows} />}
      {tab === "radar" && <CertificateRadarTab />}
      {tab === "appraisals" && <AppraisalsTab rows={rows} />}
      {tab === "promotion" && <PromotionTab rows={rows} />}
      </>}
    </div>
  );
}
