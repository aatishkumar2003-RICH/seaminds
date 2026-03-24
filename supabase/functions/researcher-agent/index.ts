import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

// ─── Claude helper ───────────────────────────────────────────────
async function askClaude(prompt: string, maxTokens = 2000): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

// ─── Fetch a URL with timeout ─────────────────────────────────────
async function fetchPage(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SeaMinds/1.0; +https://seaminds.life)' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return await res.text();
  } catch {
    return '';
  }
}

// ─── Extract vacancies from HTML using Claude ─────────────────────
async function extractVacanciesFromHTML(html: string, company: any): Promise<any[]> {
  if (!html || html.length < 100) return [];
  
  // Trim HTML to key section to save tokens
  const trimmed = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 8000);

  const prompt = `You are a maritime vacancy extraction specialist. Extract ALL job vacancies from this text scraped from ${company.company_name}'s careers page (${company.vacancy_url}).

Known company details:
- Company: ${company.company_name}
- Type: ${company.company_type}
- Fleet: ${(company.fleet_types || []).join(', ')}
- Crewing email: ${company.crewing_email || 'unknown'}
- Preferred nationalities: ${(company.preferred_nationalities || []).join(', ')}

For each vacancy found, output a JSON object. Return ONLY a valid JSON array, no markdown, no explanation.

Fields:
- rank_required: string (standard maritime rank e.g. "Captain", "Chief Engineer", "2nd Officer")
- vessel_type: string or null
- salary_min: number or null (USD/month)
- salary_max: number or null (USD/month)
- joining_port: string or null
- joining_date: string or null
- contract_duration: string or null
- contact_email: string (use ${company.crewing_email || 'null'} if no email found in text)
- contact_whatsapp: string or null
- apply_url: string (use ${company.vacancy_url} as fallback)
- company_name: "${company.company_name}"
- title: string
- description: string (max 100 chars)
- quality_score: number 0-100
- is_scam: boolean (always false for known companies)

If NO vacancies found, return empty array [].

Page text:
${trimmed}`;

  const result = await askClaude(prompt, 3000);
  try {
    return JSON.parse(result.replace(/```json|```/g, '').trim());
  } catch {
    return [];
  }
}

// ─── Process pending admin instructions ──────────────────────────
async function processInstructions(): Promise<string[]> {
  const { data: instructions } = await supabase
    .from('agent_instructions')
    .select('*')
    .eq('status', 'pending')
    .order('priority', { ascending: true })
    .limit(10);

  const results: string[] = [];

  for (const inst of (instructions || [])) {
    try {
      // Ask Claude to interpret the instruction
      const interpretation = await askClaude(`You are the SeaMinds vacancy agent. Interpret this admin instruction and output a JSON action object.

Instruction: "${inst.instruction}"

Output one of these action types as JSON:
1. Check a specific company now: {"action":"check_company","company":"Anglo-Eastern"}
2. Add a URL to monitor: {"action":"add_url","company":"Company Name","url":"https://...","email":"hr@company.com"}  
3. Add a company to knowledge base: {"action":"add_company","company":"Name","url":"https://...","email":"hr@...","fleet":["LNG"],"nationalities":["Indian"]}
4. Set check frequency: {"action":"set_frequency","company":"Name","frequency":"daily"}
5. Disable a source: {"action":"disable","company":"Name"}
6. Filter by criteria: {"action":"add_filter","field":"vessel_type","value":"LNG"}
7. Cannot execute: {"action":"manual_required","reason":"explanation"}

Return ONLY the JSON object, no markdown.`, 500);

      let action: any = {};
      try { action = JSON.parse(interpretation.replace(/```json|```/g, '').trim()); } catch { action = { action: 'manual_required', reason: 'Parse error' }; }

      let resultMsg = '';

      if (action.action === 'check_company') {
        const { data: company } = await supabase
          .from('agent_knowledge')
          .select('*')
          .ilike('company_name', `%${action.company}%`)
          .single();
        if (company) {
          const html = await fetchPage(company.vacancy_url);
          const vacancies = await extractVacanciesFromHTML(html, company);
          const saved = await saveVacancies(vacancies, 'researcher_agent', company.company_name);
          await supabase.from('agent_knowledge').update({ last_checked: new Date().toISOString(), last_success: saved > 0 ? new Date().toISOString() : company.last_success, total_vacancies_found: (company.total_vacancies_found || 0) + saved }).eq('id', company.id);
          resultMsg = `✅ Checked ${action.company}: found ${vacancies.length} vacancies, saved ${saved}`;
        } else {
          resultMsg = `⚠️ ${action.company} not in knowledge base yet`;
        }
      } else if (action.action === 'add_url' || action.action === 'add_company') {
        await supabase.from('agent_knowledge').upsert({
          company_name: action.company,
          vacancy_url: action.url,
          crewing_email: action.email,
          fleet_types: action.fleet || [],
          preferred_nationalities: action.nationalities || [],
          is_active: true,
          check_frequency: 'daily',
        }, { onConflict: 'company_name' });
        resultMsg = `✅ Added ${action.company} to knowledge base — will check daily`;
      } else if (action.action === 'set_frequency') {
        await supabase.from('agent_knowledge').update({ check_frequency: action.frequency }).ilike('company_name', `%${action.company}%`);
        resultMsg = `✅ ${action.company} check frequency set to ${action.frequency}`;
      } else if (action.action === 'disable') {
        await supabase.from('agent_knowledge').update({ is_active: false }).ilike('company_name', `%${action.company}%`);
        resultMsg = `✅ Disabled monitoring for ${action.company}`;
      } else {
        resultMsg = `⚠️ Manual action needed: ${action.reason || inst.instruction}`;
      }

      // Mark instruction as done
      await supabase.from('agent_instructions').update({
        status: 'done',
        result: resultMsg,
        executed_at: new Date().toISOString(),
      }).eq('id', inst.id);

      // Log to conversation
      await supabase.from('agent_conversations').insert({
        direction: 'from_agent',
        message: resultMsg,
        message_type: 'instruction',
      });

      results.push(resultMsg);
    } catch (e) {
      await supabase.from('agent_instructions').update({ status: 'failed', result: String(e) }).eq('id', inst.id);
    }
  }

  return results;
}

// ─── Save vacancies to database ───────────────────────────────────
async function saveVacancies(items: any[], source: string, companyName?: string): Promise<number> {
  let saved = 0;
  for (const item of items) {
    if (!item.rank_required || item.is_scam) continue;
    const extId = `${source}-${companyName || ''}-${item.rank_required}-${item.vessel_type || ''}`.replace(/\s+/g, '_').substring(0, 100);
    const { error } = await supabase.from('external_vacancies').upsert({
      source,
      external_id: extId,
      title: item.title || `${item.rank_required} — ${item.vessel_type || 'Various'}`,
      rank_required: item.rank_required,
      vessel_type: item.vessel_type,
      company_name: item.company_name || companyName,
      salary_min: item.salary_min,
      salary_max: item.salary_max,
      salary_text: item.salary_min ? `$${item.salary_min}–${item.salary_max}/mo` : null,
      joining_port: item.joining_port,
      joining_date: item.joining_date,
      contract_duration: item.contract_duration,
      description: item.description,
      apply_url: item.apply_url,
      contact_email: item.contact_email,
      contact_whatsapp: item.contact_whatsapp,
      quality_score: item.quality_score || 70,
      is_verified: true,
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

// ─── Main researcher loop ─────────────────────────────────────────
async function runResearcher(): Promise<any> {
  const stats: Record<string, number> = {};
  const errors: string[] = [];
  let totalSaved = 0;

  // Step 1: Process pending instructions first
  const instructionResults = await processInstructions();

  // Step 2: Get companies due for checking
  const now = new Date();
  const { data: companies } = await supabase
    .from('agent_knowledge')
    .select('*')
    .eq('is_active', true)
    .not('vacancy_url', 'is', null);

  const dueCompanies = (companies || []).filter((c: any) => {
    if (!c.last_checked) return true;
    const last = new Date(c.last_checked);
    const diffHours = (now.getTime() - last.getTime()) / 3600000;
    const freqHours: Record<string, number> = { hourly: 1, '6h': 6, daily: 24, weekly: 168 };
    return diffHours >= (freqHours[c.check_frequency] || 24);
  });

  // Step 3: Check each company
  for (const company of dueCompanies) {
    try {
      const html = await fetchPage(company.vacancy_url);
      if (!html) {
        errors.push(`${company.company_name}: fetch failed`);
        continue;
      }

      const vacancies = await extractVacanciesFromHTML(html, company);
      const saved = await saveVacancies(vacancies, 'researcher_agent', company.company_name);
      totalSaved += saved;
      stats[company.company_name] = saved;

      // Update knowledge base with results
      await supabase.from('agent_knowledge').update({
        last_checked: now.toISOString(),
        last_success: saved > 0 ? now.toISOString() : company.last_success,
        total_vacancies_found: (company.total_vacancies_found || 0) + saved,
        success_rate: Math.round(((company.success_rate || 0) * 0.9) + (saved > 0 ? 10 : 0)),
      }).eq('id', company.id);

      // Small delay between companies to be polite
      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      errors.push(`${company.company_name}: ${String(e).substring(0, 100)}`);
    }
  }

  // Step 4: Log to app_events
  await supabase.from('app_events').insert({
    event_type: 'researcher_agent_run',
    message: `Researcher completed: checked ${dueCompanies.length} companies, saved ${totalSaved} vacancies`,
    severity: 'info',
    metadata: {
      companies_checked: dueCompanies.length,
      total_saved: totalSaved,
      stats,
      errors,
      instructions_processed: instructionResults.length,
    },
  });

  // Step 5: Log summary to conversations
  await supabase.from('agent_conversations').insert({
    direction: 'from_agent',
    message: `Researcher run complete. Checked ${dueCompanies.length} companies. Saved ${totalSaved} vacancies. ${errors.length > 0 ? `Errors: ${errors.join(', ')}` : 'No errors.'}`,
    message_type: 'report',
  });

  return { companies_checked: dueCompanies.length, total_saved: totalSaved, stats, errors, instructions: instructionResults };
}

// ─── HTTP Handler ─────────────────────────────────────────────────
Deno.serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  // Allow manual instruction via POST
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      if (body.instruction) {
        await supabase.from('agent_instructions').insert({
          instruction: body.instruction,
          instruction_type: body.urgent ? 'one_time' : 'one_time',
          priority: body.urgent ? 1 : 5,
        });
        await supabase.from('agent_conversations').insert({
          direction: 'from_admin',
          message: body.instruction,
          message_type: 'instruction',
        });
        // Execute immediately if urgent
        if (body.urgent) {
          const result = await runResearcher();
          return new Response(JSON.stringify({ success: true, executed: true, result }), {
            headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ success: true, queued: true, message: 'Instruction queued for next run' }), {
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }
    } catch {}
  }

  // Regular GET = run researcher
  try {
    const result = await runResearcher();
    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
