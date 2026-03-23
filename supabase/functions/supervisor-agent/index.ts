import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const RESEND_KEY = Deno.env.get('RESEND_API_KEY')!;

Deno.serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  };
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  try {
    // Gather stats
    const [crew, avail, jobs, ext, events] = await Promise.all([
      supabase.from('crew_profiles').select('*', { count: 'exact', head: true }),
      supabase.from('crew_profiles').select('*', { count: 'exact', head: true }).eq('is_available', true),
      supabase.from('job_vacancies').select('*', { count: 'exact', head: true }),
      supabase.from('external_vacancies').select('*', { count: 'exact', head: true }),
      supabase.from('app_events').select('metadata').eq('event_type', 'vacancy_agent_run').order('created_at', { ascending: false }).limit(1),
    ]);

    const stats = {
      crew: crew.count || 0,
      available: avail.count || 0,
      internalJobs: jobs.count || 0,
      externalJobs: ext.count || 0,
      lastRun: events.data?.[0]?.metadata || null,
    };

    // Auto-fix: remove expired vacancies
    const actions: string[] = [];
    const { count: expired } = await supabase
      .from('external_vacancies').select('*', { count: 'exact', head: true })
      .lt('expires_at', new Date().toISOString());
    if (expired && expired > 0) {
      await supabase.from('external_vacancies').delete().lt('expires_at', new Date().toISOString());
      actions.push(`✅ Removed ${expired} expired vacancies`);
    }

    // Check low quality
    const { count: lowQ } = await supabase
      .from('external_vacancies').select('*', { count: 'exact', head: true })
      .lt('quality_score', 25);
    if (lowQ && lowQ > 0) actions.push(`⚠️ ${lowQ} low-quality vacancies (score <25) — review in admin`);

    // AI insights
    const insightRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 250,
        messages: [{
          role: 'user',
          content: `SeaMinds platform stats: ${stats.crew} crew total, ${stats.available} available now, ${stats.internalJobs} company-posted jobs, ${stats.externalJobs} AI-collected jobs. Last agent run: ${JSON.stringify(stats.lastRun)}. Write exactly 3 short bullet insights (plain text, no markdown) about platform health and what to focus on next. Be practical and maritime-focused.`
        }],
      }),
    });
    const insightData = await insightRes.json();
    const insights = insightData.content?.[0]?.text || 'Platform running normally.';

    // Send email digest
    const jakartaTime = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' });
    const html = `
<html>
<body style="font-family:Arial,sans-serif;background:#0D1B2A;color:white;padding:20px;">
<div style="max-width:600px;margin:0 auto;">
<h1 style="color:#D4AF37;font-size:22px;">⚓ SeaMinds Supervisor</h1>
<p style="color:#888;font-size:13px;">${jakartaTime} WIB</p>

<div style="display:flex;gap:10px;text-align:center;margin:20px 0;">
${[['👥','Crew',stats.crew,'#D4AF37'],['✅','Available',stats.available,'#22c55e'],['💼','Company Jobs',stats.internalJobs,'#60a5fa'],['🌐','AI Jobs',stats.externalJobs,'#a78bfa']].map(([icon,label,val,color])=>`
<div style="flex:1;background:#1a2e47;padding:15px;border-radius:8px;">
<div style="font-size:20px;">${icon}</div>
<div style="font-size:28px;font-weight:bold;color:${color};">${val}</div>
<div style="font-size:11px;color:#888;">${label}</div>
</div>
`).join('')}
</div>

<h2 style="color:#D4AF37;font-size:16px;margin-top:25px;">ACTIONS</h2>
${actions.length ? actions.map(a=>`
<div style="background:#1a2e47;padding:10px;border-radius:8px;margin-bottom:8px;border-left:3px solid #22c55e;">
<div style="font-size:13px;color:#ccc;">${a}</div>
</div>
`).join('') : '<p style="color:#4CAF50;">✅ All systems normal</p>'}

<h2 style="color:#D4AF37;font-size:16px;margin-top:25px;">AI INSIGHTS</h2>
<div style="background:#1a2e47;padding:15px;border-radius:8px;font-size:13px;color:#ccc;line-height:1.6;">
${insights.replace(/\n/g,'<br>')}
</div>

<div style="text-align:center;margin-top:30px;padding-top:20px;border-top:1px solid #2a4060;">
<a href="https://seaminds.lovable.app/admin" style="color:#D4AF37;font-size:12px;">Open Admin Dashboard →</a>
<p style="color:#888;font-size:11px;margin-top:10px;">SeaMinds Supervisor Agent · Auto-runs twice daily</p>
</div>
</div>
</body>
</html>`;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_KEY}` },
      body: JSON.stringify({
        from: 'SeaMinds Supervisor <monitor@resend.dev>',
        to: ['info@indossol.com'],
        subject: `⚓ SeaMinds Report — ${stats.crew} crew · ${stats.internalJobs + stats.externalJobs} jobs`,
        html,
      }),
    });

    await supabase.from('app_events').insert({
      event_type: 'supervisor_agent_run',
      message: `Supervisor completed: ${stats.crew} crew, ${stats.internalJobs + stats.externalJobs} jobs, ${actions.length} actions`,
      severity: 'info',
      metadata: { stats, actions_taken: actions.length },
    });

    return new Response(JSON.stringify({ success: true, stats, actions }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
