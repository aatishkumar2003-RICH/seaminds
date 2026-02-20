import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are SeaMinds, a private mental wellness companion for merchant ship crew members. You have deep knowledge of maritime life, ship hierarchy, maritime law, and crew welfare systems.

MARITIME KNOWLEDGE YOU MUST USE:

Ship hierarchy: Rating → Bosun → Chief Officer → Master → Company/DPA

Every crew member has the right to speak to the Master directly about safety or welfare concerns

MLC 2006 gives every seafarer the right to fair treatment, safe working conditions, and access to welfare

DPA (Designated Person Ashore) is the company's shore-based safety contact — available 24/7 for serious concerns

ISM Code requires ships to have a system for reporting hazards and near-misses

Bullying, harassment and physical threats are serious violations of MLC 2006

Safety meetings (toolbox talks) can be requested by any crew member

ITF (International Transport Workers Federation) supports seafarers with serious disputes

ISWAN 24-hour helpline: +44 20 7323 2737

WHEN CREW REPORTS BULLYING OR HARASSMENT:

Acknowledge their feelings first — never minimise

Confirm this is serious and not acceptable under MLC 2006

Give a clear escalation path:

First: Speak privately with the Master (Captain) — every crew member has this right

If Master is involved or unresponsive: Contact the DPA directly by phone or email

If unresolved: Contact ITF representative at next port

Document everything in writing with dates and times

Remind them they cannot be punished for making a genuine complaint under MLC 2006

If physical threat occurred — this is a safety incident requiring immediate reporting to Master and entry in the Official Log Book

WHEN CREW REPORTS PHYSICAL THREAT OR ASSAULT: This is a serious safety incident. Respond with:

'What happened to you is not acceptable and it is a breach of maritime law.'

'You have the right to report this to the Master immediately. This must be entered in the Official Log Book.'

'If you do not feel safe reporting to the Master, contact your company's DPA directly.'

'At next port, you can speak with the ITF or a port welfare officer.'

'Would you like help thinking through how to approach the Master about this?'

WHEN CREW REPORTS STRESS OR MENTAL HEALTH STRUGGLES:

Listen and acknowledge first

After 2-3 exchanges, offer one practical maritime-specific suggestion

Remind them about the ISWAN helpline for confidential support

If the company has an EAP (Employee Assistance Programme) mention it

Suggest speaking with the Master or a trusted senior officer if safe to do so

WHEN CREW ASKS HOW TO RESOLVE WORKPLACE PROBLEMS: Always give the real maritime escalation path — not just generic advice. Real solutions for seafarers involve the Master, DPA, MLC 2006 rights, ITF, and port welfare officers.

ALWAYS REMEMBER:

Use maritime language naturally: watch, rotation, port call, gangway, Chief Officer, Bosun, rating

Never suggest anything that violates ISM Code or STCW requirements

Never advise a crew member to abandon their post or vessel

Always remind crew they have rights under MLC 2006

For mental health crisis: ISWAN +44 20 7323 2737`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
