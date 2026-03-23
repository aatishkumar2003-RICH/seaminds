import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY')!;
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;

const MARITIME_QUERIES = [
  'Captain Chief Engineer seafarer job vacancy India',
  'Chief Officer 2nd Engineer merchant navy India hiring',
  'Filipino seafarer officer vacancy hiring 2026',
  'Manning agency Philippines seaman job hiring',
  'Master mariner LNG tanker job India Mumbai',
  'Marine engineer officer job Chennai Kolkata India',
  'Captain Chief Engineer job Manila Philippines',
  'AB OS rating seafarer job Philippines hiring',
  'offshore DP officer job vacancy India',
  'FPSO tanker engineer officer job Southeast Asia',
  'Indonesian seafarer crew job vacancy 2026',
  'manning agency Indonesia Jakarta seaman hiring',
  'Ukrainian seafarer officer job vacancy Europe',
  'крюинг вакансії моряк Україна officer',
  'Bangladesh seafarer officer engineer job hiring',
  'Myanmar seaman crew job vacancy hiring',
];

const RSS_FEEDS = [
  'https://gcaptain.com/feed','https://splash247.com/feed',
  'https://www.seatrade-maritime.com/rss.xml',
  'https://maritime-executive.com/rss',
  'https://www.marineinsight.com/feed',
];

const TELEGRAM_CHANNELS = ['offshorevacancies', 'seafarersvacancies', 'marinemanjobs', 'craborabota', 'seabordjobs', 'marinejobbangladesh'];

async function fetchGoogleJobs(query: string): Promise<any[]> {
  try {
    const url = `https://serpapi.com/search.json?engine=google_jobs&q=${encodeURIComponent(query)}&api_key=${SERPAPI_KEY}&num=10`;
    const res = await fetch(url);
    const data = await res.json();
    return (data.jobs_results || []).slice(0, 5).map((j: any) => ({
      ...j,
      apply_url: j.apply_options?.[0]?.link || j.related_links?.[0]?.link || null,
      contact_email: j.apply_options?.find((o: any) => o.title?.toLowerCase().includes('email'))?.link?.replace('mailto:','') || null,
    }));
  } catch { return []; }
}

async function fetchRSS(url: string): Promise<any[]> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'SeaMinds/1.0' } });
    const xml = await res.text();
    const items: any[] = [];
    const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
    for (const match of itemMatches) {
      const content = match[1];
      const title = content.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() || '';
      const desc = content.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)?.[1]?.trim() || '';
      const link = content.match(/<link[^>]*>(.*?)<\/link>/)?.[1]?.trim() || '';
      const pubDate = content.match(/<pubDate[^>]*>(.*?)<\/pubDate>/)?.[1]?.trim() || '';
      if (title) items.push({ title, description: desc, link, pubDate, source: url });
    }
    return items.slice(0, 10);
  } catch { return []; }
}

async function fetchTelegramChannel(channel: string): Promise<any[]> {
  try {
    // Read public channel via web preview - no bot membership needed
    const res = await fetch(`https://t.me/s/${channel}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SeaMinds/1.0)' }
    });
    const html = await res.text();
    const items: any[] = [];

    // Extract message blocks
    const messages = html.matchAll(/<div[^>]*class="[^"]*tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/g);
    for (const msg of messages) {
      const raw = msg[1].replace(/<[^>]+>/g, ' ').trim();
      if (raw.length < 20) continue;
      // Only keep messages that look like job postings
      if (/captain|chief|officer|engineer|bosun|cook|rating|vacancy|hiring|salary|\$|whatsapp|contact|apply/i.test(raw)) {
        // Extract contact details directly from raw text
        const email = raw.match(/[\w.-]+@[\w.-]+\.\w{2,}/)?.[0] || null;
        const whatsapp = raw.match(/(?:wa\.me\/|whatsapp[:\s]+|📱\s*)(\+?[\d\s()-]{8,15})/i)?.[1]?.trim() || null;
        const phone = raw.match(/\+\d[\d\s()-]{7,14}/)?.[0] || null;
        items.push({
          text: raw.substring(0, 500),
          channel,
          contact_email: email,
          contact_whatsapp: whatsapp || phone,
        });
      }
    }
    return items.slice(0, 15);
  } catch { return []; }
}

async function processWithClaude(rawItems: any[]): Promise<any[]> {
  if (!rawItems.length) return [];
  const prompt = `You are a maritime job data extractor. Extract structured vacancy data from these raw job postings. For each item, output a JSON object with these exact fields:
- rank_required: string (e.g. "Captain", "Chief Engineer", "2nd Officer", "AB", "Cook" — use standard maritime ranks only)
- vessel_type: string (e.g. "LNG", "Bulk Carrier", "Container", "Tanker", "Offshore", "FPSO", "General Cargo" — null if unclear)  
- company_name: string or null
- salary_min: number or null (USD/month)
- salary_max: number or null (USD/month)
- joining_port: string or null
- joining_date: string or null
- contract_duration: string or null
- contact_email: string or null (extract ANY email found in the text, including in URLs like mailto:, or company domain emails inferred from company website)
- contact_whatsapp: string or null (extract phone numbers, WhatsApp links, wa.me links, any +countrycode numbers)
- apply_url: string or null (IMPORTANT: always include this if available — it is the fallback when no direct contact exists)
- company_website: string or null (extract company website URL if mentioned)
- quality_score: number 0-100 (100=complete structured listing, 50=partial flier, 10=vague post)
- is_scam: boolean (true if: requests money from seafarer, no company name AND no contact, salary >$50k/month, generic "all ranks needed")
- scam_reason: string or null
- source_type: "structured_listing" | "flier" | "paper_cutting" | "social_post"
- title: string (clean job title)
- description: string (max 200 chars summary)
- external_id: string (generate unique hash from title+company+port)

Return ONLY a valid JSON array. No markdown, no explanation. If an item is not a job vacancy at all, skip it.

Raw items:
${JSON.stringify(rawItems.slice(0, 20), null, 1)}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  const text = data.content?.[0]?.text || '[]';
  try {
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch { return []; }
}

async function saveVacancies(items: any[], source: string) {
  if (!items.length) return 0;
  let saved = 0;
  for (const item of items) {
    if (!item.rank_required || item.is_scam) continue;
    const { error } = await supabase.from('external_vacancies').upsert({
      source,
      external_id: item.external_id || `${source}-${Date.now()}-${Math.random()}`,
      title: item.title,
      rank_required: item.rank_required,
      vessel_type: item.vessel_type,
      company_name: item.company_name,
      salary_min: item.salary_min,
      salary_max: item.salary_max,
      salary_text: item.salary_min ? `$${item.salary_min}-${item.salary_max}/month` : null,
      joining_port: item.joining_port,
      joining_date: item.joining_date,
      contract_duration: item.contract_duration,
      description: item.description,
      apply_url: item.apply_url,
      contact_email: item.contact_email,
      contact_whatsapp: item.contact_whatsapp,
      company_website: item.company_website || null,
      quality_score: item.quality_score || 50,
      is_verified: false,
      is_scam_flagged: false,
      scam_flags: [],
      fetched_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      raw_data: item,
    }, { onConflict: 'source,external_id', ignoreDuplicates: true });
    if (!error) saved++;
  }
  return saved;
}

// Helper to extract company website URLs from HTML content
function extractWebsite(content: string, excludeDomains: string[] = []): string | null {
  const urls = content.match(/href="(https?:\/\/[^"]{8,100})"/g) || [];
  for (const u of urls) {
    const url = u.match(/href="([^"]*)"/)?.[1] || '';
    if (excludeDomains.some(d => url.includes(d))) continue;
    if (/\.(pdf|jpg|png|gif|css|js)$/i.test(url)) continue;
    if (/facebook|twitter|instagram|youtube|linkedin|t\.me|wa\.me|whatsapp|google|apple/i.test(url)) continue;
    if (/^\w+:\/\/[^/]+\/?$/.test(url) || /\/(about|contact|career|jobs)/i.test(url)) return url;
  }
  const wwwMatch = content.match(/(?:website|web|site|www)[:\s]+(?:https?:\/\/)?((?:www\.)?[\w.-]+\.\w{2,6})/i);
  if (wwwMatch) return `https://${wwwMatch[1]}`;
  return null;
}

// INDIA — Seadonna
async function scrapeSeadonna(): Promise<any[]> {
  try {
    const res = await fetch('https://seadonna.com/category/sea-jobs-2', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SeaMinds/1.0)' }
    });
    const html = await res.text();
    const items: any[] = [];
    const posts = html.matchAll(/<article[^>]*>([\s\S]*?)<\/article>/g);
    for (const post of posts) {
      const content = post[1];
      const title = content.match(/<h[23][^>]*>([^<]{5,80})<\/h[23]>/)?.[1]?.trim() || '';
      const email = content.match(/[\w.-]+@[\w.-]+\.\w{2,}/)?.[0] || null;
      const phone = content.match(/(?:\+91|0)[\d\s-]{9,12}/)?.[0] || null;
      const link = content.match(/href="([^"]*seadonna\.com[^"]*)"/)?.[1] || null;
      const website = extractWebsite(content, ['seadonna.com']);
      if (title && /captain|chief|officer|engineer|master|bosun|cook|rating|navy|seafarer/i.test(title)) {
        items.push({ title, contact_email: email, contact_whatsapp: phone, apply_url: link, company_website: website, nationality_fit: ['Indian'], source_url: 'seadonna.com' });
      }
    }
    return items.slice(0, 20);
  } catch { return []; }
}

// INDIA — Wasailor
async function scrapeWasailor(): Promise<any[]> {
  try {
    const res = await fetch('https://www.wasailor.com/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SeaMinds/1.0)' }
    });
    const html = await res.text();
    const items: any[] = [];
    const posts = html.matchAll(/<div[^>]*class="[^"]*post[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g);
    for (const post of posts) {
      const content = post[1];
      const title = content.match(/<h[234][^>]*>([^<]{5,80})<\/h[234]>/)?.[1]?.trim() || '';
      const whatsapp = content.match(/(?:wa\.me\/|whatsapp[:\s]+|\+91)(\+?[\d\s()-]{10,14})/i)?.[1] || null;
      const email = content.match(/[\w.-]+@[\w.-]+\.\w{2,}/)?.[0] || null;
      if (title && /captain|chief|officer|engineer|bosun|cook|ab|gp|rating/i.test(title)) {
        items.push({ title, contact_whatsapp: whatsapp, contact_email: email, nationality_fit: ['Indian'], source_url: 'wasailor.com' });
      }
    }
    return items.slice(0, 20);
  } catch { return []; }
}

// INDIA — SeaJob.net
async function scrapeSeaJobNet(): Promise<any[]> {
  try {
    const res = await fetch('https://www.seajob.net/joblist.asp', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SeaMinds/1.0)' }
    });
    const html = await res.text();
    const items: any[] = [];
    const rows = html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g);
    for (const row of rows) {
      const content = row[1];
      const cells = Array.from(content.matchAll(/<td[^>]*>([^<]{2,60})<\/td>/g)).map(m => m[1].trim());
      if (cells.length >= 2 && /captain|chief|officer|engineer|master|bosun/i.test(cells.join(' '))) {
        const email = content.match(/[\w.-]+@[\w.-]+\.\w{2,}/)?.[0] || null;
        items.push({ title: cells[0], vessel_type: cells[1] || null, contact_email: email, nationality_fit: ['Indian'], source_url: 'seajob.net' });
      }
    }
    return items.slice(0, 20);
  } catch { return []; }
}

// PHILIPPINES — PinoySeaman
async function scrapePinoySeaman(): Promise<any[]> {
  try {
    const res = await fetch('https://pinoyseaman.ph/home', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SeaMinds/1.0)' }
    });
    const html = await res.text();
    const items: any[] = [];
    const posts = html.matchAll(/<div[^>]*class="[^"]*job[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>|<div)/g);
    for (const post of posts) {
      const content = post[1];
      const title = content.match(/<h[234][^>]*>([^<]{5,80})<\/h[234]>/)?.[1]?.trim() || '';
      const company = content.match(/(?:agency|company)[:\s]+([^<\n]{3,50})/i)?.[1]?.trim() || null;
      const email = content.match(/[\w.-]+@[\w.-]+\.\w{2,}/)?.[0] || null;
      const link = content.match(/href="(https?:\/\/[^"]*pinoyseaman[^"]*)"/)?.[1] || null;
      if (title && /captain|chief|officer|engineer|bosun|cook|ab|os|wiper|messman/i.test(title)) {
        items.push({ title, company_name: company, contact_email: email, apply_url: link, nationality_fit: ['Filipino'], source_url: 'pinoyseaman.ph' });
      }
    }
    return items.slice(0, 20);
  } catch { return []; }
}

// PHILIPPINES — SeamanJobSite
async function scrapeSeamanJobSite(): Promise<any[]> {
  try {
    const res = await fetch('https://seamanjobsite.workabroad.ph/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SeaMinds/1.0)' }
    });
    const html = await res.text();
    const items: any[] = [];
    const jobs = html.matchAll(/class="job[^"]*"[^>]*>([\s\S]*?)(?=class="job|<\/section|<footer)/g);
    for (const job of jobs) {
      const content = job[1];
      const title = content.match(/<h[234][^>]*>([^<]{5,80})<\/h[234]>/)?.[1]?.trim() || '';
      const company = content.match(/class="[^"]*company[^"]*"[^>]*>([^<]{3,60})</)?.[1]?.trim() || null;
      const link = content.match(/href="([^"]*workabroad[^"]*)"/)?.[1] || null;
      if (title) {
        items.push({ title, company_name: company, apply_url: link, nationality_fit: ['Filipino'], source_url: 'seamanjobsite.workabroad.ph' });
      }
    }
    return items.slice(0, 20);
  } catch { return []; }
}

// PHILIPPINES — POEA/DMW Official Job Orders (Government database)
async function scrapePOEA(): Promise<any[]> {
  try {
    const res = await fetch('https://www.dmw.gov.ph/archives/poea/joborder.html', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SeaMinds/1.0)' }
    });
    const html = await res.text();
    const items: any[] = [];
    const rows = html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g);
    for (const row of rows) {
      const cells = Array.from(row[1].matchAll(/<td[^>]*>([^<]{2,80})<\/td>/g)).map(m => m[1].trim());
      if (cells.length >= 3 && /seaman|seafarer|marine|vessel|ship/i.test(cells.join(' '))) {
        items.push({ title: cells[0], company_name: cells[1] || null, joining_port: 'Manila', nationality_fit: ['Filipino'], source_url: 'dmw.gov.ph', quality_score: 90 });
      }
    }
    return items.slice(0, 20);
  } catch { return []; }
}

// INDONESIA — Pelaut.com (Indonesian seafarer portal)
async function scrapePelaut(): Promise<any[]> {
  try {
    const res = await fetch('https://pelaut.com/lowongan', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SeaMinds/1.0)' }
    });
    const html = await res.text();
    const items: any[] = [];
    const posts = html.matchAll(/<div[^>]*class="[^"]*job[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>|<div)/g);
    for (const post of posts) {
      const content = post[1];
      const title = content.match(/<h[234][^>]*>([^<]{5,80})<\/h[234]>/)?.[1]?.trim() || '';
      const company = content.match(/(?:company|perusahaan)[:\s]+([^<\n]{3,50})/i)?.[1]?.trim() || null;
      const link = content.match(/href="([^"]*pelaut[^"]*)"/)?.[1] || null;
      if (title && /captain|chief|officer|engineer|bosun|cook|ab|os|rating|nakhoda|masinis|mualim/i.test(title)) {
        items.push({ title, company_name: company, apply_url: link, nationality_fit: ['Indonesian'], source_url: 'pelaut.com' });
      }
    }
    return items.slice(0, 20);
  } catch { return []; }
}

// INDONESIA — Kapal.co.id
async function scrapeKapal(): Promise<any[]> {
  try {
    const res = await fetch('https://kapal.co.id/lowongan-kerja-pelaut', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SeaMinds/1.0)' }
    });
    const html = await res.text();
    const items: any[] = [];
    const posts = html.matchAll(/<article[^>]*>([\s\S]*?)<\/article>/g);
    for (const post of posts) {
      const content = post[1];
      const title = content.match(/<h[234][^>]*>([^<]{5,100})<\/h[234]>/)?.[1]?.trim() || '';
      const email = content.match(/[\w.-]+@[\w.-]+\.\w{2,}/)?.[0] || null;
      const phone = content.match(/(?:\+62|08)[\d\s-]{8,14}/)?.[0] || null;
      const link = content.match(/href="([^"]*kapal\.co\.id[^"]*)"/)?.[1] || null;
      if (title && /captain|chief|officer|engineer|bosun|cook|rating|nakhoda|masinis|mualim|pelaut/i.test(title)) {
        items.push({ title, contact_email: email, contact_whatsapp: phone, apply_url: link, nationality_fit: ['Indonesian'], source_url: 'kapal.co.id' });
      }
    }
    return items.slice(0, 20);
  } catch { return []; }
}

// UKRAINE — CrewBoard (Ukrainian manning portal)
async function scrapeCrewBoard(): Promise<any[]> {
  try {
    const res = await fetch('https://crewboard.net/vacancies', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SeaMinds/1.0)' }
    });
    const html = await res.text();
    const items: any[] = [];
    const rows = html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g);
    for (const row of rows) {
      const content = row[1];
      const cells = Array.from(content.matchAll(/<td[^>]*>([\s\S]{2,120}?)<\/td>/g)).map(m => m[1].replace(/<[^>]+>/g, '').trim());
      if (cells.length >= 2 && /captain|chief|officer|engineer|master|bosun|cook|electrician|motorman/i.test(cells.join(' '))) {
        const email = content.match(/[\w.-]+@[\w.-]+\.\w{2,}/)?.[0] || null;
        const link = content.match(/href="([^"]*crewboard[^"]*)"/)?.[1] || null;
        items.push({ title: cells[0], vessel_type: cells[1] || null, company_name: cells[2] || null, contact_email: email, apply_url: link, nationality_fit: ['Ukrainian'], source_url: 'crewboard.net' });
      }
    }
    return items.slice(0, 20);
  } catch { return []; }
}

// UKRAINE — MarineTraffic Jobs / Moryak.info
async function scrapeMoryak(): Promise<any[]> {
  try {
    const res = await fetch('https://moryak.info/vacancy/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SeaMinds/1.0)' }
    });
    const html = await res.text();
    const items: any[] = [];
    const posts = html.matchAll(/<div[^>]*class="[^"]*vacanc[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>|<div)/g);
    for (const post of posts) {
      const content = post[1];
      const title = content.match(/<h[234][^>]*>([^<]{5,100})<\/h[234]>/)?.[1]?.trim() ||
                    content.match(/<a[^>]*>([^<]{5,100})<\/a>/)?.[1]?.trim() || '';
      const company = content.match(/(?:company|компанія|компания)[:\s]+([^<\n]{3,50})/i)?.[1]?.trim() || null;
      const email = content.match(/[\w.-]+@[\w.-]+\.\w{2,}/)?.[0] || null;
      const link = content.match(/href="([^"]*moryak\.info[^"]*)"/)?.[1] || null;
      if (title && /captain|chief|officer|engineer|master|bosun|cook|капітан|механік|помічник|штурман/i.test(title)) {
        items.push({ title, company_name: company, contact_email: email, apply_url: link, nationality_fit: ['Ukrainian'], source_url: 'moryak.info' });
      }
    }
    return items.slice(0, 20);
  } catch { return []; }
}

// BANGLADESH — MarineJob BD
async function scrapeMarineJobBD(): Promise<any[]> {
  try {
    const res = await fetch('https://marinejobbd.com/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SeaMinds/1.0)' }
    });
    const html = await res.text();
    const items: any[] = [];
    const posts = html.matchAll(/<article[^>]*>([\s\S]*?)<\/article>/g);
    for (const post of posts) {
      const content = post[1];
      const title = content.match(/<h[234][^>]*>([^<]{5,100})<\/h[234]>/)?.[1]?.trim() || '';
      const email = content.match(/[\w.-]+@[\w.-]+\.\w{2,}/)?.[0] || null;
      const phone = content.match(/(?:\+880|01)[\d\s-]{8,13}/)?.[0] || null;
      const link = content.match(/href="([^"]*marinejobbd[^"]*)"/)?.[1] || null;
      if (title && /captain|chief|officer|engineer|bosun|cook|ab|os|rating|seaman|seafarer/i.test(title)) {
        items.push({ title, contact_email: email, contact_whatsapp: phone, apply_url: link, nationality_fit: ['Bangladeshi'], source_url: 'marinejobbd.com' });
      }
    }
    return items.slice(0, 20);
  } catch { return []; }
}

// MYANMAR — Myanmar Seafarer Portal
async function scrapeMyanmar(): Promise<any[]> {
  try {
    const res = await fetch('https://www.myanmarseafarers.org/jobs', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SeaMinds/1.0)' }
    });
    const html = await res.text();
    const items: any[] = [];
    const posts = html.matchAll(/<div[^>]*class="[^"]*(?:job|post|listing)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>|<div)/g);
    for (const post of posts) {
      const content = post[1];
      const title = content.match(/<h[234][^>]*>([^<]{5,100})<\/h[234]>/)?.[1]?.trim() || '';
      const company = content.match(/(?:company|agency)[:\s]+([^<\n]{3,50})/i)?.[1]?.trim() || null;
      const link = content.match(/href="([^"]*myanmarseafarers[^"]*)"/)?.[1] || null;
      if (title && /captain|chief|officer|engineer|bosun|cook|ab|os|rating|seaman/i.test(title)) {
        items.push({ title, company_name: company, apply_url: link, nationality_fit: ['Myanmar'], source_url: 'myanmarseafarers.org' });
      }
    }
    return items.slice(0, 20);
  } catch { return []; }
}

// GLOBAL — CrewLink Maritime
async function scrapeCrewLink(): Promise<any[]> {
  try {
    const res = await fetch('https://www.crewlink.com/jobs', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SeaMinds/1.0)' }
    });
    const html = await res.text();
    const items: any[] = [];
    const posts = html.matchAll(/<div[^>]*class="[^"]*(?:job|vacancy|listing)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>|<div)/g);
    for (const post of posts) {
      const content = post[1];
      const title = content.match(/<h[234][^>]*>([^<]{5,100})<\/h[234]>/)?.[1]?.trim() || '';
      const company = content.match(/(?:company|employer)[:\s]+([^<\n]{3,50})/i)?.[1]?.trim() || null;
      const link = content.match(/href="([^"]*crewlink[^"]*)"/)?.[1] || null;
      if (title) {
        items.push({ title, company_name: company, apply_url: link, nationality_fit: [], source_url: 'crewlink.com' });
      }
    }
    return items.slice(0, 20);
  } catch { return []; }
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  };
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  const stats = { google: 0, rss: 0, telegram: 0, saved: 0, errors: [] as string[] };

  try {
    // 1. Google Jobs via SerpAPI
    const googleRaw: any[] = [];
    for (const query of MARITIME_QUERIES.slice(0, 8)) {
      const results = await fetchGoogleJobs(query);
      googleRaw.push(...results.map(j => ({
        title: j.title, company: j.company_name, location: j.location,
        description: j.description, via: j.via, extensions: j.detected_extensions,
      })));
      await new Promise(r => setTimeout(r, 500));
    }
    if (googleRaw.length) {
      const processed = await processWithClaude(googleRaw);
      stats.google = await saveVacancies(processed, 'google_jobs');
    }

    // 2. RSS Feeds
    const rssRaw: any[] = [];
    for (const feed of RSS_FEEDS) {
      const items = await fetchRSS(feed);
      rssRaw.push(...items);
    }
    const rssJobItems = rssRaw.filter(i =>
      /captain|chief|officer|engineer|bosun|seaman|seafarer|vacancy|hiring|crew|maritime job/i.test(i.title + i.description)
    );
    if (rssJobItems.length) {
      const processed = await processWithClaude(rssJobItems);
      stats.rss = await saveVacancies(processed, 'rss_feed');
    }

    // 3. Telegram
    const telegramRaw: any[] = [];
    for (const ch of TELEGRAM_CHANNELS) {
      const msgs = await fetchTelegramChannel(ch);
      telegramRaw.push(...msgs);
    }
    if (telegramRaw.length) {
      const processed = await processWithClaude(telegramRaw.map(m => ({ text: m.text, channel: m.channel })));
      stats.telegram = await saveVacancies(processed, 'telegram');
    }

    // 4. India + Philippines focused scraping
    const indiaPhilippinesRaw: any[] = [
      ...await scrapeSeadonna(),
      ...await scrapeWasailor(),
      ...await scrapeSeaJobNet(),
      ...await scrapePinoySeaman(),
      ...await scrapeSeamanJobSite(),
      ...await scrapePOEA(),
    ];
    if (indiaPhilippinesRaw.length) {
      const processed = await processWithClaude(indiaPhilippinesRaw);
      const ipSaved = await saveVacancies(processed, 'india_philippines');
      stats.saved += ipSaved;
    }

    // 5. Indonesia, Ukraine, Bangladesh, Myanmar, Global scrapers
    const expandedRegionalRaw: any[] = [
      ...await scrapePelaut(),
      ...await scrapeKapal(),
      ...await scrapeCrewBoard(),
      ...await scrapeMoryak(),
      ...await scrapeMarineJobBD(),
      ...await scrapeMyanmar(),
      ...await scrapeCrewLink(),
    ];
    if (expandedRegionalRaw.length) {
      const processed = await processWithClaude(expandedRegionalRaw);
      const erSaved = await saveVacancies(processed, 'regional_global');
      stats.saved += erSaved;
    }

    stats.saved += stats.google + stats.rss + stats.telegram;

    // Email notifications to available crew with matching ranks
    let emailsSent = 0;
    if (stats.saved > 0) {
      try {
        // Get newly saved vacancies (last 30 min to catch this run's saves)
        const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        const { data: newVacancies } = await supabase
          .from('external_vacancies')
          .select('rank_required, vessel_type, company_name, salary_text, title')
          .gte('fetched_at', thirtyMinAgo)
          .eq('is_scam_flagged', false)
          .gte('quality_score', 30);

        if (newVacancies?.length) {
          // Group new jobs by rank
          const jobsByRank: Record<string, typeof newVacancies> = {};
          for (const v of newVacancies) {
            const rank = (v.rank_required || '').toLowerCase();
            if (!rank) continue;
            if (!jobsByRank[rank]) jobsByRank[rank] = [];
            jobsByRank[rank].push(v);
          }

          // Get available crew with email
          const { data: availableCrew } = await supabase
            .from('crew_profiles')
            .select('first_name, email, role')
            .eq('is_available', true)
            .eq('job_alerts_enabled', true)
            .not('email', 'is', null);

          const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
          if (availableCrew?.length && RESEND_KEY) {
            for (const crew of availableCrew) {
              if (!crew.email) continue;
              const crewRank = (crew.role || '').toLowerCase();
              const matchingJobs = jobsByRank[crewRank];
              if (!matchingJobs?.length) continue;

              const jobListHtml = matchingJobs.slice(0, 5).map(j =>
                `<tr><td style="padding:8px;border-bottom:1px solid #eee">${j.title || `${j.rank_required} — ${j.vessel_type || 'Various'}`}</td><td style="padding:8px;border-bottom:1px solid #eee">${j.company_name || 'N/A'}</td><td style="padding:8px;border-bottom:1px solid #eee">${j.salary_text || '—'}</td></tr>`
              ).join('');

              const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <div style="background:#0a1628;padding:20px;border-radius:8px 8px 0 0;text-align:center">
    <h1 style="color:#D4AF37;margin:0;font-size:20px">⚓ New Jobs Match Your Profile</h1>
  </div>
  <div style="background:#ffffff;padding:20px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px">
    <p style="color:#374151;font-size:14px">Hi ${crew.first_name},</p>
    <p style="color:#374151;font-size:14px">We found <strong>${matchingJobs.length} new ${crew.role}</strong> position${matchingJobs.length > 1 ? 's' : ''} that match your profile:</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0">
      <tr style="background:#f9fafb"><th style="padding:8px;text-align:left">Position</th><th style="padding:8px;text-align:left">Company</th><th style="padding:8px;text-align:left">Salary</th></tr>
      ${jobListHtml}
    </table>
    ${matchingJobs.length > 5 ? `<p style="color:#6b7280;font-size:13px">+ ${matchingJobs.length - 5} more positions</p>` : ''}
    <a href="https://seaminds.lovable.app" style="display:inline-block;background:#D4AF37;color:#0a1628;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin:16px 0">View All Jobs →</a>
    <p style="color:#9ca3af;font-size:12px;margin-top:20px">You're receiving this because you're marked as available on SeaMinds.</p>
  </div>
</div>`;

              const emailRes = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_KEY}` },
                body: JSON.stringify({
                  from: 'SeaMinds Jobs <jobs@seaminds.life>',
                  to: [crew.email],
                  subject: `⚓ ${matchingJobs.length} new ${crew.role} job${matchingJobs.length > 1 ? 's' : ''} found for you`,
                  html,
                }),
              });
              if (emailRes.ok) emailsSent++;
            }
          }
        }
      } catch (emailErr) {
        stats.errors.push(`Email notifications: ${String(emailErr)}`);
      }
    }

    // Log to app_events
    await supabase.from('app_events').insert({
      event_type: 'vacancy_agent_run',
      message: `Vacancy agent completed: ${stats.saved} saved, ${emailsSent} emails sent`,
      severity: 'info',
      metadata: { ...stats, emailsSent, duration_ms: Date.now() - startTime },
    });

    return new Response(JSON.stringify({ success: true, stats: { ...stats, emailsSent } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
