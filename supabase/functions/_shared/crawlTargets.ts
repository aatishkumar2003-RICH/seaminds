// Generic career-page crawler: JSON-LD → ATS API → raw HTML text fallback.
// Never throws — always resolves with a result object.

const UA = 'SeaMindsBot/1.0 (+https://seaminds.life)';

export type CrawlResult = { items: any[]; method_used: string; note?: string };

const BLOCKED_HOSTS = ['indeed', 'linkedin', 'glassdoor', 'naukri', 'ziprecruiter'];

export function isBlockedUrl(url: string): boolean {
  try {
    const host = new URL(url).host.toLowerCase();
    return BLOCKED_HOSTS.some((b) => host.includes(b));
  } catch {
    return true;
  }
}

async function getHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'text/html,*/*' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

function locationOf(jobLocation: any): string | null {
  if (!jobLocation) return null;
  const loc = Array.isArray(jobLocation) ? jobLocation[0] : jobLocation;
  if (typeof loc === 'string') return loc;
  const a = loc?.address || loc;
  if (!a) return null;
  if (typeof a === 'string') return a;
  return [a.addressLocality, a.addressRegion, a.addressCountry?.name || a.addressCountry]
    .filter(Boolean).join(', ') || null;
}

function stripTags(s: string): string {
  return String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function collectJobPostings(node: any, out: any[]) {
  if (!node) return;
  if (Array.isArray(node)) { for (const n of node) collectJobPostings(n, out); return; }
  if (typeof node !== 'object') return;
  const t = node['@type'];
  const types = Array.isArray(t) ? t : [t];
  if (types.includes('JobPosting')) out.push(node);
  if (node['@graph']) collectJobPostings(node['@graph'], out);
  if (node.itemListElement) collectJobPostings(node.itemListElement, out);
  if (node.item) collectJobPostings(node.item, out);
}

function fromJsonLd(html: string, pageUrl: string): any[] {
  const blocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  const postings: any[] = [];
  for (const b of blocks) {
    const body = b.replace(/^[\s\S]*?>/, '').replace(/<\/script>$/i, '').trim();
    try { collectJobPostings(JSON.parse(body), postings); } catch { /* malformed block */ }
  }
  return postings.map((p) => ({
    title: p.title || p.name || null,
    description: stripTags(p.description || '').substring(0, 4000) || null,
    org: p.hiringOrganization?.name || p.hiringOrganization || null,
    location: locationOf(p.jobLocation) || (p.jobLocationType === 'TELECOMMUTE' ? 'Remote' : null),
    datePosted: typeof p.datePosted === 'string' ? p.datePosted.substring(0, 10) : null,
    employmentType: Array.isArray(p.employmentType) ? p.employmentType[0] : p.employmentType || null,
    url: p.url || p.applicationContact?.url || pageUrl,
  })).filter((j) => j.title);
}

type AtsHit = { provider: string; token: string };

function detectAts(url: string, html: string): AtsHit | null {
  const hay = `${url}\n${html}`;
  const patterns: [string, RegExp][] = [
    ['greenhouse', /boards(?:-api)?\.greenhouse\.io\/(?:embed\/job_board\?for=|v1\/boards\/)?([a-zA-Z0-9_-]+)/],
    ['greenhouse', /greenhouse\.io\/([a-zA-Z0-9_-]+)/],
    ['lever', /(?:jobs|api)\.lever\.co\/(?:v0\/postings\/)?([a-zA-Z0-9_-]+)/],
    ['smartrecruiters', /smartrecruiters\.com\/(?:v1\/companies\/)?([a-zA-Z0-9_-]+)/],
    ['workable', /(?:apply\.workable\.com\/(?:api\/v1\/widget\/accounts\/)?|([a-zA-Z0-9_-]+)\.workable\.com)([a-zA-Z0-9_-]+)?/],
    ['recruitee', /([a-zA-Z0-9_-]+)\.recruitee\.com/],
  ];
  for (const [provider, re] of patterns) {
    const m = hay.match(re);
    if (m) {
      const token = (m[1] || m[2] || '').trim();
      if (token && !['www', 'api', 'boards', 'jobs', 'apply', 'embed'].includes(token)) {
        return { provider, token };
      }
    }
  }
  return null;
}

async function fromAts(hit: AtsHit): Promise<any[]> {
  const { provider, token } = hit;
  if (provider === 'greenhouse') {
    const d = await getJson(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`);
    return (d.jobs || []).map((j: any) => ({
      title: j.title,
      description: stripTags(j.content || '').substring(0, 4000) || null,
      org: j.company_name || token,
      location: j.location?.name || null,
      datePosted: (j.updated_at || j.created_at || '').substring(0, 10) || null,
      employmentType: null,
      url: j.absolute_url || null,
    }));
  }
  if (provider === 'lever') {
    const d = await getJson(`https://api.lever.co/v0/postings/${token}?mode=json`);
    return (Array.isArray(d) ? d : []).map((j: any) => ({
      title: j.text,
      description: stripTags(j.descriptionPlain || j.description || '').substring(0, 4000) || null,
      org: token,
      location: j.categories?.location || null,
      datePosted: j.createdAt ? new Date(j.createdAt).toISOString().substring(0, 10) : null,
      employmentType: j.categories?.commitment || null,
      url: j.hostedUrl || j.applyUrl || null,
    }));
  }
  if (provider === 'smartrecruiters') {
    const d = await getJson(`https://api.smartrecruiters.com/v1/companies/${token}/postings`);
    return (d.content || []).map((j: any) => ({
      title: j.name,
      description: null,
      org: j.company?.name || token,
      location: [j.location?.city, j.location?.country].filter(Boolean).join(', ') || null,
      datePosted: (j.releasedDate || '').substring(0, 10) || null,
      employmentType: j.typeOfEmployment?.label || null,
      url: j.ref || `https://jobs.smartrecruiters.com/${token}/${j.id}`,
    }));
  }
  if (provider === 'workable') {
    const d = await getJson(`https://apply.workable.com/api/v1/widget/accounts/${token}?details=true`);
    return (d.jobs || []).map((j: any) => ({
      title: j.title,
      description: stripTags(j.description || '').substring(0, 4000) || null,
      org: d.name || token,
      location: [j.city, j.country].filter(Boolean).join(', ') || null,
      datePosted: (j.published_on || '').substring(0, 10) || null,
      employmentType: j.employment_type || null,
      url: j.url || j.application_url || null,
    }));
  }
  if (provider === 'recruitee') {
    const d = await getJson(`https://${token}.recruitee.com/api/offers/`);
    return (d.offers || []).map((j: any) => ({
      title: j.title,
      description: stripTags(j.description || '').substring(0, 4000) || null,
      org: j.company_name || token,
      location: [j.city, j.country].filter(Boolean).join(', ') || null,
      datePosted: (j.published_at || '').substring(0, 10) || null,
      employmentType: j.employment_type_code || null,
      url: j.careers_url || j.careers_apply_url || null,
    }));
  }
  return [];
}

function fromHtmlText(html: string, url: string): any[] {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 12000);
  if (text.length < 200) return [];
  return [{ text, source_url: url }];
}

export async function crawlTarget(url: string, method = 'auto'): Promise<CrawlResult> {
  try {
    if (isBlockedUrl(url)) {
      return { items: [], method_used: 'skipped', note: 'blocked domain' };
    }
    let html = '';
    try { html = await getHtml(url); } catch (e) { html = ''; if (method === 'jsonld' || method === 'html') throw e; }

    if (method === 'auto' || method === 'jsonld') {
      const ld = html ? fromJsonLd(html, url) : [];
      if (ld.length) return { items: ld, method_used: 'jsonld' };
      if (method === 'jsonld') return { items: [], method_used: 'jsonld', note: 'no JobPosting blocks' };
    }

    if (method === 'auto' || method === 'ats') {
      const hit = detectAts(url, html);
      if (hit) {
        const jobs = (await fromAts(hit)).filter((j: any) => j.title);
        if (jobs.length) return { items: jobs, method_used: `ats:${hit.provider}` };
      }
      if (method === 'ats') return { items: [], method_used: 'ats', note: 'no ATS board detected' };
    }

    const raw = html ? fromHtmlText(html, url) : [];
    if (raw.length) return { items: raw, method_used: 'html' };
    return { items: [], method_used: 'failed', note: 'no content extracted' };
  } catch (err) {
    return { items: [], method_used: 'failed', note: String(err).substring(0, 120) };
  }
}
