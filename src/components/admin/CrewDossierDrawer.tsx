import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/sonner";
import { MessageCircle, Mail } from "lucide-react";
import { STATUS_META, type ManningStatus } from "@/lib/crewManning";

const GOLD = "#D4AF37";
const CARD = "#112240";
const BORDER = "rgba(212,175,55,0.3)";
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—");
const arr = (v: any) => { try { const p = typeof v === "string" ? JSON.parse(v) : v; return Array.isArray(p) ? p : []; } catch { return []; } };

type Ev = { at: string; text: string; icon: string };

export default function CrewDossierDrawer({ crew, onClose, onSaved }: { crew: any | null; onClose: () => void; onSaved: () => void }) {
  const [cv, setCv] = useState<any>(null);
  const [events, setEvents] = useState<Ev[]>([]);
  const [scores, setScores] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [passport, setPassport] = useState("");
  const [dob, setDob] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!crew) return;
    setPassport(crew.passport_number || ""); setDob(crew.date_of_birth || "");
    setBusy(true);
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    (async () => {
      const [c, ev, apps, sc, logins] = await Promise.all([
        supabase.from("crew_cv_data").select("*").eq("user_id", crew.id).maybeSingle(),
        supabase.from("app_events").select("event_type, message, created_at").eq("user_id", crew.id).gte("created_at", since).order("created_at", { ascending: false }).limit(50),
        supabase.from("job_applications").select("rank_applied, company_name, vessel_type, outcome, created_at").eq("crew_id", crew.id).order("created_at", { ascending: false }).limit(30),
        supabase.from("smc_assessments").select("overall_score, score_band, status, completed_at, started_at").eq("crew_profile_id", crew.id).order("started_at", { ascending: false }).limit(10),
        crew.email ? supabase.from("signup_log").select("role, signed_up_at").eq("email", String(crew.email).toLowerCase()).gte("signed_up_at", since).order("signed_up_at", { ascending: false }).limit(30) : Promise.resolve({ data: [] as any[] }),
      ]);
      setCv(c.data || null);
      setScores(sc.data || []);
      const list: Ev[] = [
        ...((logins as any).data || []).map((l: any) => ({ at: l.signed_up_at, icon: "🔑", text: l.role || "Signed in" })),
        ...(ev.data || []).map((e: any) => ({ at: e.created_at, icon: "📌", text: e.message || e.event_type })),
        ...(apps.data || []).filter((a: any) => a.created_at >= since).map((a: any) => ({ at: a.created_at, icon: "💼", text: `Applied: ${[a.rank_applied, a.vessel_type, a.company_name].filter(Boolean).join(" · ")}${a.outcome ? ` (${a.outcome})` : ""}` })),
        ...(sc.data || []).filter((s: any) => (s.completed_at || s.started_at) >= since).map((s: any) => ({ at: s.completed_at || s.started_at, icon: "🎖️", text: s.completed_at ? `Completed assessment — ${s.overall_score ?? "?"} (${s.score_band || "—"})` : "Started an assessment" })),
      ];
      if (c.data?.updated_at && c.data.updated_at >= since) list.push({ at: c.data.updated_at, icon: "📄", text: "Updated CV" });
      if (crew.created_at >= since) list.push({ at: crew.created_at, icon: "🆕", text: "Registered on SeaMinds" });
      list.sort((a, b) => (a.at < b.at ? 1 : -1));
      setEvents(list);
      setBusy(false);
    })();
  }, [crew]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("crew_profiles").update({ passport_number: passport, date_of_birth: dob || null }).eq("id", crew.id);
    setSaving(false);
    if (error) return toast.error("Could not save: " + error.message);
    toast.success("Saved"); onSaved();
  };

  const st = crew ? STATUS_META[crew._status as ManningStatus] : null;
  const wa = String(crew?.whatsapp_number || "").replace(/[^0-9]/g, "");
  const sea = arr(cv?.sea_service);
  const certs = arr(cv?.certificates);

  return (
    <Sheet open={!!crew} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto" style={{ background: "#0D1B2A", borderColor: BORDER }}>
        {crew && (
          <>
            <SheetHeader>
              <SheetTitle style={{ color: GOLD }}>{`${crew.first_name || ""} ${crew.last_name || ""}`.trim() || crew.email}</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 mt-3 text-sm" style={{ color: "#E0E0E0" }}>
              <div className="rounded-xl p-3 space-y-1" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <p className="text-xs" style={{ color: "#94A3B8" }}>{crew.crew_unique_id || "No Crew ID"} · {crew.email || "no email"}</p>
                <p><b style={{ color: GOLD }}>{crew._rank || "Rank not set"}</b> · {crew._nat.flag} {crew._nat.name}{crew._nat.source !== "declared" && crew._nat.source !== "none" ? " (auto-detected)" : ""}</p>
                <p className="font-bold" style={{ color: st?.color }}>● {st?.label}{crew.available_from ? ` · from ${new Date(crew.available_from).toLocaleDateString("en-GB")}` : ""}{crew.ship_name ? ` · ${crew.ship_name}` : ""}</p>
                <p className="text-xs" style={{ color: "#94A3B8" }}>Last active {fmt(crew.last_seen)} · Joined {fmt(crew.created_at)}</p>
                <div className="flex gap-2 pt-2">
                  {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold" style={{ background: GOLD, color: "#0D1B2A" }}><MessageCircle className="w-3 h-3" /> WhatsApp</a>}
                  {crew.email && <a href={`mailto:${crew.email}`} className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold" style={{ color: GOLD, border: `1px solid ${GOLD}` }}><Mail className="w-3 h-3" /> Email</a>}
                </div>
              </div>

              <Section title="🕒 Activity — last 7 days">
                {busy ? <p style={{ color: "#94A3B8" }}>Loading…</p> : events.length === 0 ? <p style={{ color: "#94A3B8" }}>No recorded activity in the last 7 days.</p> : (
                  <ul className="space-y-2">{events.map((e, i) => (
                    <li key={i} className="flex gap-2"><span>{e.icon}</span><div><p>{e.text}</p><p className="text-[11px]" style={{ color: "#94A3B8" }}>{fmt(e.at)}</p></div></li>
                  ))}</ul>
                )}
              </Section>

              <Section title="⚓ Experience">
                <p>Sea service: {crew.total_sea_service_band || "—"} yrs · In rank: {crew.years_in_rank_band || "—"} yrs</p>
                <p>Vessel types: {crew.vessel_type || "—"}</p>
                {sea.length > 0 && <ul className="mt-2 space-y-1 text-xs">{sea.slice(0, 10).map((s: any, i: number) => (
                  <li key={i}>🚢 {s.vesselName || s.vessel_name || "Vessel"} · {s.rankOnBoard || s.rank || ""} · {s.vesselType || s.vessel_type || ""} {s.signOn || s.from ? `(${s.signOn || s.from} → ${s.signOff || s.to || "…"})` : ""}</li>
                ))}</ul>}
              </Section>

              <Section title="📜 Certificates & scores">
                {certs.length === 0 ? <p style={{ color: "#94A3B8" }}>No certificates in CV.</p> : <ul className="text-xs space-y-1">{certs.slice(0, 12).map((c: any, i: number) => (
                  <li key={i}>• {c.name || c.title || c.type || "Certificate"}{c.expiry || c.expiryDate ? ` — expires ${c.expiry || c.expiryDate}` : ""}</li>
                ))}</ul>}
                {scores.filter((s) => s.completed_at).slice(0, 3).map((s, i) => (
                  <p key={i} className="text-xs mt-1">🎖️ Competency score {s.overall_score ?? "?"} ({s.score_band || "—"}) · {fmt(s.completed_at)}</p>
                ))}
              </Section>

              <Section title="🛂 Admin edit">
                <label className="text-xs" style={{ color: "#94A3B8" }}>Passport number</label>
                <input value={passport} onChange={(e) => setPassport(e.target.value)} className="w-full px-2 py-1.5 rounded-lg mb-2" style={{ background: "#0D1B2A", border: `1px solid ${BORDER}` }} />
                <label className="text-xs" style={{ color: "#94A3B8" }}>Date of birth (YYYY-MM-DD)</label>
                <input value={dob} onChange={(e) => setDob(e.target.value)} className="w-full px-2 py-1.5 rounded-lg mb-2" style={{ background: "#0D1B2A", border: `1px solid ${BORDER}` }} />
                <button onClick={save} disabled={saving} className="px-4 py-1.5 rounded-xl text-xs font-bold" style={{ background: GOLD, color: "#0D1B2A" }}>{saving ? "Saving…" : "Save"}</button>
              </Section>
              <p className="text-[11px]" style={{ color: "#64748B" }}>Wellness chat content is private and never shown here.</p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <p className="font-bold mb-2" style={{ color: GOLD }}>{title}</p>
      {children}
    </div>
  );
}
