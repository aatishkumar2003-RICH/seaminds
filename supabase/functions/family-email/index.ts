import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { to, familyName, crewName, shipName, voyageDay, mood, moodEmoji, daysUntilSignOff, personalMessage } = await req.json();

    let subject: string;
    let html: string;

    if (personalMessage) {
      // Instant personal message
      subject = `A message from ${crewName} at sea`;
      html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; background: #0a1628; color: #e2e8f0; padding: 32px; border-radius: 16px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <span style="font-size: 28px;">⚓</span>
            <h2 style="color: #d4a843; margin: 8px 0 0;">SeaMinds</h2>
          </div>
          <p style="color: #94a3b8; font-size: 14px;">Dear ${familyName},</p>
          <p style="color: #e2e8f0; font-size: 15px; line-height: 1.7;">${crewName} sent you a personal message from <strong>${shipName}</strong>:</p>
          <div style="background: #1a2744; border-left: 3px solid #d4a843; padding: 16px 20px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #e2e8f0; font-size: 15px; line-height: 1.7; margin: 0; white-space: pre-line;">${personalMessage}</p>
          </div>
          <p style="color: #94a3b8; font-size: 13px; margin-top: 24px;">Day ${voyageDay} of voyage</p>
          <hr style="border: none; border-top: 1px solid #1e293b; margin: 24px 0;" />
          <p style="color: #64748b; font-size: 11px; text-align: center;">With care, The SeaMinds Team</p>
        </div>
      `;
    } else {
      // Weekly welfare update
      subject = `Weekly update from ${crewName} at sea`;
      html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; background: #0a1628; color: #e2e8f0; padding: 32px; border-radius: 16px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <span style="font-size: 28px;">⚓</span>
            <h2 style="color: #d4a843; margin: 8px 0 0;">SeaMinds</h2>
          </div>
          <p style="color: #94a3b8; font-size: 14px;">Dear ${familyName},</p>
          <p style="color: #e2e8f0; font-size: 15px; line-height: 1.7;">${crewName} checked in on SeaMinds today — <strong>Day ${voyageDay}</strong> of his voyage on <strong>${shipName}</strong>.</p>
          <div style="background: #1a2744; padding: 20px; border-radius: 12px; margin: 20px 0;">
            <p style="color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px;">This week's mood</p>
            <p style="color: #e2e8f0; font-size: 20px; margin: 0;">${mood} ${moodEmoji}</p>
            ${daysUntilSignOff ? `<p style="color: #94a3b8; font-size: 13px; margin: 12px 0 0;">Days until sign-off: <strong style="color: #d4a843;">${daysUntilSignOff}</strong></p>` : ''}
          </div>
          <p style="color: #e2e8f0; font-size: 14px; line-height: 1.7;">${crewName} is using SeaMinds to stay mentally strong at sea. His conversations remain private but he wanted you to know he is doing well.</p>
          <hr style="border: none; border-top: 1px solid #1e293b; margin: 24px 0;" />
          <p style="color: #64748b; font-size: 11px; text-align: center;">With care, The SeaMinds Team</p>
        </div>
      `;
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "SeaMinds <onboarding@resend.dev>",
        to: [to],
        subject,
        html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Resend error:", data);
      return new Response(JSON.stringify({ error: "Failed to send email", details: data }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Family email error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
