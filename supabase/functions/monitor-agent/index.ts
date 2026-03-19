import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Get unprocessed events from last 30 minutes
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: events } = await supabase
    .from('app_events')
    .select('*')
    .eq('emailed', false)
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  if (!events || events.length === 0) {
    return new Response(JSON.stringify({ message: 'No new events' }), { headers: cors });
  }

  // Group by type
  const errors = events.filter(e => e.severity === 'error');
  const signups = events.filter(e => e.event_type === 'crew_signup');
  const warnings = events.filter(e => e.severity === 'warning');

  // Get total crew count
  const { count: totalCrew } = await supabase
    .from('crew_profiles')
    .select('*', { count: 'exact', head: true });

  // Build email HTML
  const html = `
  <html>
    <body style="font-family:Arial,sans-serif;background:#0D1B2A;color:white;padding:20px;">
      <div style="max-width:600px;margin:0 auto;">
        <h1 style="color:#D4AF37;font-size:22px;">⚓ SeaMinds Monitor Report</h1>
        <p style="color:#888;font-size:13px;">${new Date().toUTCString()}</p>
      </div>

      <div style="max-width:600px;margin:20px auto;">
        <div style="display:flex;gap:10px;text-align:center;">
          <div style="flex:1;background:#1a2e47;padding:15px;border-radius:8px;">
            <div style="font-size:28px;font-weight:bold;color:#D4AF37;">${totalCrew || 0}</div>
            <div style="font-size:11px;color:#888;">Total Crew</div>
          </div>
          <div style="flex:1;background:#1a2e47;padding:15px;border-radius:8px;">
            <div style="font-size:28px;font-weight:bold;color:#4CAF50;">${signups.length}</div>
            <div style="font-size:11px;color:#888;">New Signups (30min)</div>
          </div>
          <div style="flex:1;background:#1a2e47;padding:15px;border-radius:8px;">
            <div style="font-size:28px;font-weight:bold;color:${errors.length > 0 ? '#f44336' : '#4CAF50'};">${errors.length}</div>
            <div style="font-size:11px;color:#888;">Errors (30min)</div>
          </div>
        </div>

        ${errors.length > 0 ? `
        <h2 style="color:#f44336;font-size:16px;margin-top:25px;">🔴 Errors Requiring Attention</h2>
        ${errors.slice(0, 10).map(e => `
          <div style="background:#1a2e47;padding:12px;border-radius:8px;margin-bottom:8px;border-left:3px solid #f44336;">
            <div style="font-weight:bold;font-size:13px;color:#f44336;">${e.event_type}</div>
            <div style="font-size:12px;color:#ccc;margin-top:4px;">${e.message}</div>
            <div style="font-size:11px;color:#888;margin-top:4px;">${e.user_id ? 'User: '+e.user_id : 'Anonymous'} · ${new Date(e.created_at).toLocaleTimeString()}</div>
          </div>
        `).join('')}
        ` : '<p style="color:#4CAF50;margin-top:20px;">✅ No errors in the last 30 minutes</p>'}

        ${signups.length > 0 ? `
        <h2 style="color:#4CAF50;font-size:16px;margin-top:25px;">🆕 New Crew Signups</h2>
        ${signups.slice(0, 5).map(e => `
          <div style="background:#1a2e47;padding:12px;border-radius:8px;margin-bottom:8px;border-left:3px solid #4CAF50;">
            <div style="font-weight:bold;font-size:13px;color:white;">${e.metadata?.name || 'New crew member'}</div>
            <div style="font-size:12px;color:#D4AF37;">${e.metadata?.rank || ''} · ${e.metadata?.nationality || ''}</div>
            <div style="font-size:11px;color:#888;margin-top:4px;">${new Date(e.created_at).toLocaleTimeString()}</div>
          </div>
        `).join('')}
        ` : ''}

        ${warnings.length > 0 ? `
        <h2 style="color:#FF9800;font-size:16px;margin-top:25px;">⚠️ Warnings</h2>
        ${warnings.slice(0, 5).map(e => `
          <div style="background:#1a2e47;padding:10px;border-radius:8px;margin-bottom:8px;border-left:3px solid #FF9800;">
            <div style="font-size:12px;color:#ccc;">${e.message}</div>
            <div style="font-size:11px;color:#888;margin-top:4px;">${new Date(e.created_at).toLocaleTimeString()}</div>
          </div>
        `).join('')}
        ` : ''}

        <div style="text-align:center;margin-top:30px;padding-top:20px;border-top:1px solid #2a4060;">
          <p style="color:#888;font-size:11px;">SeaMinds Monitoring Agent · PT Indoglobal Service Solutions</p>
          <a href="https://seaminds.lovable.app/admin" style="color:#D4AF37;font-size:12px;">Open Admin Dashboard</a>
        </div>
      </div>
    </body>
  </html>`;

  // Send email via Resend
  const emailResp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'SeaMinds Monitor <monitor@resend.dev>',
      to: ['aatishkumar2003@gmail.com'],
      subject: `⚓ SeaMinds: ${errors.length > 0 ? `🔴 ${errors.length} errors` : '✅ All good'} · ${signups.length} new crew · Total: ${totalCrew}`,
      html,
    }),
  });

  // Mark events as emailed
  const ids = events.map(e => e.id);
  await supabase.from('app_events').update({ emailed: true }).in('id', ids);

  const result = await emailResp.json();
  return new Response(JSON.stringify({ sent: emailResp.ok, events: events.length, result }), { headers: cors });
});
