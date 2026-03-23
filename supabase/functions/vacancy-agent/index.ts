import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY')!;
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;

const MARITIME_QUERIES = [
  'Captain LNG tanker job vacancy','Chief Engineer bulk carrier hiring',
  'Chief Officer container ship vacancy','2nd Engineer tanker job',
  'Master mariner job hiring','Chief Mate vessel job',
  'Marine Engineer officer vacancy','Bosun AB seaman job hiring',
  'Filipino seafarer job vacancy','Indonesian seafarers hiring',
  'Indian seafarer officer job','Ukrainian seafarer vacancy',
  'offshore DP officer job vacancy','FPSO engineer hiring',
  'PSV AHTS officer job vacancy',
];

const RSS_FEEDS = [
  'https://gcaptain.com/feed','https://splash247.com/feed',
  'https://www.seatrade-maritime.com/rss.xml',
  'https://maritime-executive.com/rss',
  'https://www.marineinsight.com/feed',
];

const TELEGRAM_CHANNELS = [
  '@offshorevacancies','@seafarersvacancies','@seamindsjobs',
];

async function fetchGoogleJobs(query: string): Promise<any[]> {
  try {
    const url = `https://serpapi.com/search.json?engine=google_jobs&q=${encodeURIComponent(query)}&api_key=${SERPAPI_KEY}&num=10`;
    const res = await fetch(url);
    const data = await res.json();
    return data.jobs_results || [];
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

async function fetchTelegram(channel: string): Promise<any[]> {
  try {
    const channelName = channel.replace('@', '');
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?limit=20`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.ok) return [];
    const msgs = (data.result || [])
      .filter((u: any) => u.channel_post?.chat?.username === channelName && u.channel_post?.text)
      .map((u: any) => ({ text: u.channel_post.text, date: u.channel_post.date, channel }));
    return msgs.slice(0, 10);
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
- contact_email: string or null
- contact_whatsapp: string or null
- apply_url: string or null
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
      const msgs = await fetchTelegram(ch);
      telegramRaw.push(...msgs);
    }
    if (telegramRaw.length) {
      const processed = await processWithClaude(telegramRaw.map(m => ({ text: m.text, channel: m.channel })));
      stats.telegram = await saveVacancies(processed, 'telegram');
    }

    stats.saved = stats.google + stats.rss + stats.telegram;

    // Log to app_events
    await supabase.from('app_events').insert({
      event_type: 'vacancy_agent_run',
      message: `Vacancy agent completed: ${stats.saved} saved`,
      severity: 'info',
      metadata: { ...stats, duration_ms: Date.now() - startTime },
    });

    return new Response(JSON.stringify({ success: true, stats }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
