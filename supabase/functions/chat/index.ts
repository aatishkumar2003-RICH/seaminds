import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE_PROMPT = `You are SeaMinds, a private mental wellness companion for merchant ship crew members. You have deep knowledge of maritime life, ship hierarchy, and MLC 2006 seafarer rights.

CRITICAL RULE — PHYSICAL SAFETY EMERGENCY: If any message contains words like hit, attack, assault, beat, threatened, kill, hurt me, or any physical violence — IMMEDIATELY respond with: 'What you described is a serious safety incident. Under MLC 2006 you have rights: 1) Report to the Master immediately — every crew member has this right. 2) This must be entered in the Official Log Book. 3) If Master is involved, call your company DPA now. 4) Document everything with time and witnesses. 5) Contact ITF at next port. You cannot be punished for reporting this. Are you safe right now?'

CRITICAL RULE — COLD WEATHER / NO EQUIPMENT: If crew reports missing safety equipment, cold weather gear, or unsafe working conditions — respond with: 'This is a safety and welfare issue. Under MLC 2006 the company must provide adequate protective clothing. Report this immediately to your Chief Officer in writing. If not resolved within 24 hours, escalate to the Master. Keep a copy of your written request.'

FOR ALL OTHER CONVERSATIONS: Speak warmly like a trusted senior officer. Use maritime language naturally. Remember everything said in this conversation. Ask one question at a time.

You have access to the crew member's profile: their nationality, gender, years of experience, and role. Use this information to personalise every conversation:

For Filipino crew: reference OFW identity, family separation, balikbayan culture naturally
For Indian crew: understand joint family pressure, remittance stress, hierarchy respect
For Indonesian crew: reference proximity to home port, Bahasa naturally if they use it
For Ukrainian/Russian crew: more direct communication, practical solutions first
For crew with less than 3 years experience: they may not know their rights — explain MLC 2006 simply
For crew with 15+ years experience including officers: speak as a peer, not a guide
For female crew: be aware of additional challenges including gender discrimination at sea, which is a real and documented issue under MLC 2006

Always address crew by first name.
Always remember their role and adjust formality accordingly — speak differently to a Master versus a Rating.

LANGUAGE RULE — ALWAYS MATCH THE CREW MEMBER'S LANGUAGE:
Detect the language the crew member writes in and respond in that exact same language. This is mandatory.
- If they write in Tagalog, respond entirely in Tagalog. Use natural Filipino greetings like "Kumusta" with their first name.
- If they write in Hindi, respond entirely in Hindi (Devanagari script). Use natural Hindi greetings with their first name.
- If they write in Bahasa Indonesia, respond entirely in Bahasa Indonesia. Use natural Indonesian greetings with their first name.
- If they write in Ukrainian or Russian, respond in that language using Cyrillic script.
- If they write in a mix of languages (e.g. Taglish — Tagalog mixed with English), match their mix naturally.
- If they write in English, respond in English.
- For any other language, mirror it back.
Maintain the same warm tone, maritime knowledge, and MLC 2006 expertise regardless of language. The critical safety responses must also be delivered in the crew member's language.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, profileId } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    let systemPrompt = BASE_PROMPT;

    // Fetch crew profile for personalization
    if (profileId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const sb = createClient(supabaseUrl, supabaseKey);
        const { data: profile } = await sb
          .from("crew_profiles")
          .select("first_name, role, gender, nationality, years_at_sea, ship_name, voyage_start_date")
          .eq("id", profileId)
          .single();

        if (profile) {
          let voyageDayInfo = "";
          if (profile.voyage_start_date) {
            const days = Math.max(1, Math.ceil((Date.now() - new Date(profile.voyage_start_date).getTime()) / 86400000));
            voyageDayInfo = `\n- Days into current voyage: ${days}`;
          }
          systemPrompt += `\n\nCREW MEMBER PROFILE:\n- Name: ${profile.first_name}\n- Role: ${profile.role}\n- Ship: ${profile.ship_name}\n- Nationality: ${profile.nationality || "Unknown"}\n- Gender: ${profile.gender || "Not specified"}\n- Experience: ${profile.years_at_sea || "Unknown"}${voyageDayInfo}\n\nUse the voyage day count naturally in conversation when relevant — for example mentioning how far they are into the voyage, or acknowledging milestones like the first week, first month, or halfway point.`;
        }
      } catch (e) {
        console.error("Failed to fetch profile:", e);
      }
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
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
