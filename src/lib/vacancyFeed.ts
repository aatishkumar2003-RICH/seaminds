import { supabase } from "@/integrations/supabase/client";
import { formatSalaryText } from "@/lib/salary";

/** One vacancy shape shared by every SeaMinds surface (feed, home, jobs, homepage). */
export interface UnifiedVacancy {
  id: string;
  kind: "direct" | "external";
  rank: string;
  vessel: string | null;
  port: string | null;
  joiningDate: string | null;
  contractDuration: string | null;
  salaryText: string | null;
  company: string;
  verified: boolean;
  qualityScore: number | null;
  postedAt: string | null;
  expiresAt: string | null;
  notes: string | null;
  email: string | null;
  whatsapp: string | null;
  applyUrl: string | null;
  positions: number;
  flierUrl: string | null;
  postingBatchId: string | null;
  source: string | null;
  isNew: boolean;
}

const DAY = 24 * 3600 * 1000;
const isNewSince = (iso: string | null) =>
  !!iso && Date.now() - new Date(iso).getTime() < DAY;

/** Display salary for a unified vacancy — shared formatter, never duplicated. */
export const vacancySalary = (v: UnifiedVacancy, suffix = "/month") =>
  formatSalaryText(v.salaryText, suffix);

const mapDirect = (r: Record<string, any>): UnifiedVacancy => ({
  id: String(r.id),
  kind: "direct",
  rank: r.rank_required || "Crew",
  vessel: r.vessel_type || null,
  port: r.joining_port || null,
  joiningDate: r.joining_date || null,
  contractDuration: r.contract_duration || null,
  salaryText: r.monthly_salary ?? null,
  company: r.company_name || "Maritime Company",
  verified: !!r.verified,
  qualityScore: null,
  postedAt: r.created_at || null,
  expiresAt: r.expires_at || null,
  notes: r.additional_notes || null,
  email: r.contact_email || null,
  whatsapp: r.contact_whatsapp || null,
  applyUrl: null,
  positions: Number(r.positions) > 0 ? Number(r.positions) : 1,
  flierUrl: r.flier_url || null,
  postingBatchId: r.posting_batch_id || null,
  source: "seaminds",
  isNew: isNewSince(r.created_at || null),
});

const mapExternal = (r: Record<string, any>): UnifiedVacancy => ({
  id: String(r.id),
  kind: "external",
  rank: r.rank_required || r.title || "Crew",
  vessel: r.vessel_type || null,
  port: r.joining_port || null,
  joiningDate: r.joining_date || null,
  contractDuration: r.contract_duration || null,
  salaryText: r.salary_text ?? null,
  company: r.company_name || "Maritime Company",
  verified: r.is_verified === undefined || r.is_verified === null ? false : !!r.is_verified,
  qualityScore: r.quality_score ?? null,
  postedAt: r.created_at || null,
  expiresAt: r.expires_at || null,
  notes: r.description || null,
  email: r.contact_email || null,
  whatsapp: r.contact_whatsapp || null,
  applyUrl: r.apply_url || r.company_website || null,
  positions: 1,
  flierUrl: null,
  postingBatchId: null,
  source: r.source || null,
  isNew: isNewSince(r.created_at || null),
});

export interface LoadVacanciesOpts {
  limitDirect?: number;
  limitExternal?: number;
  minQuality?: number;
}

/** Loads live direct + external vacancies, merged and sorted newest first. */
export const loadVacancies = async (opts: LoadVacanciesOpts = {}): Promise<UnifiedVacancy[]> => {
  const nowIso = new Date().toISOString();

  let extQuery = supabase
    .from("external_vacancies")
    .select(
      "id, title, rank_required, vessel_type, joining_port, joining_date, contract_duration, salary_text, company_name, company_website, is_verified, quality_score, created_at, expires_at, description, contact_email, contact_whatsapp, apply_url, source"
    )
    .eq("is_scam_flagged", false)
    .gt("expires_at", nowIso);
  if (opts.minQuality !== undefined) extQuery = extQuery.gte("quality_score", opts.minQuality);

  const [directRes, extRes] = await Promise.all([
    supabase
      .from("job_postings")
      .select(
        "id, rank_required, vessel_type, joining_port, joining_date, contract_duration, monthly_salary, company_name, verified, created_at, expires_at, additional_notes, contact_email, contact_whatsapp, positions, flier_url, posting_batch_id"
      )
      .eq("status", "active")
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(opts.limitDirect ?? 20),
    extQuery.order("created_at", { ascending: false }).limit(opts.limitExternal ?? 50),
  ]);

  const rows = [
    ...(((directRes.data as any[]) || []).map(mapDirect)),
    ...(((extRes.data as any[]) || []).map(mapExternal)),
  ];
  return rows.sort(
    (a, b) => new Date(b.postedAt || 0).getTime() - new Date(a.postedAt || 0).getTime()
  );
};

/** Vacancy/job-posting ids the signed-in crew has already applied to. */
export const loadMyApplicationTargets = async (): Promise<Set<string>> => {
  const out = new Set<string>();
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return out;
    const { data } = await supabase
      .from("job_applications")
      .select("vacancy_id, job_posting_id")
      .eq("crew_id", uid);
    ((data as any[]) || []).forEach((r) => {
      if (r.vacancy_id) out.add(String(r.vacancy_id));
      if (r.job_posting_id) out.add(String(r.job_posting_id));
    });
  } catch {
    /* applied state is best-effort — never block the feed */
  }
  return out;
};
