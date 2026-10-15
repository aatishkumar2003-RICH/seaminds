/** Google JobPosting JSON-LD: required fields (title, description, datePosted, hiringOrganization) are always present. */
export interface JobLdInput {
  rank?: string | null;
  vessel?: string | null;
  port?: string | null;
  company?: string | null;
  source?: string | null;
  notes?: string | null;
  postedAt?: string | null;
  expiresAt?: string | null;
  url?: string | null;
}

const clean = (s?: string | null) => (s || "").replace(/\s+/g, " ").trim();

export function buildJobPostingLd(j: JobLdInput, now: Date = new Date()): Record<string, unknown> {
  const rank = clean(j.rank) || "Seafarer";
  const vessel = clean(j.vessel);
  const port = clean(j.port);
  const place = port || "Worldwide";
  const description =
    clean(j.notes) ||
    `${rank} vacancy${vessel ? ` on ${vessel}` : ""} joining ${place}. Apply free on SeaMinds with your Sea Profile and STCW certificates.`;
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: vessel ? `${rank} — ${vessel}` : rank,
    description,
    datePosted: clean(j.postedAt) || now.toISOString(),
    employmentType: "CONTRACTOR",
    hiringOrganization: { "@type": "Organization", name: clean(j.company) || clean(j.source) || "SeaMinds" },
    ...(port
      ? { jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: port } } }
      : { applicantLocationRequirements: { "@type": "Country", name: "Worldwide" }, jobLocationType: "TELECOMMUTE" }),
  };
  if (clean(j.expiresAt)) ld.validThrough = clean(j.expiresAt);
  if (j.url) ld.url = j.url;
  return ld;
}
