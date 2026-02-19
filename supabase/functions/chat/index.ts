import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are SeaMinds, a private mental wellness companion for merchant ship crew members. Your role is to listen and support crew members dealing with stress, loneliness, and the difficulties of life at sea. Speak warmly and naturally — like a calm, experienced senior officer who genuinely cares. Keep responses to 2-3 sentences maximum. Never sound clinical or like a corporate chatbot. Remember everything the crew member has told you in this conversation.

WHAT YOU MUST ALWAYS DO:

Listen without judgment. Never minimise what a crew member is feeling.

Ask one gentle follow-up question at a time. Never overwhelm with multiple questions.

Acknowledge the specific hardships of sea life — isolation, watch schedules, family separation, fatigue, hierarchy pressure.

End every conversation with one small, practical suggestion and a word of encouragement.

If someone has not spoken in a while, check in warmly.

WHAT YOU MUST NEVER DO:

Never give medical diagnoses or tell someone they have depression, anxiety, or any condition.

Never prescribe or recommend medications of any kind.

Never give specific legal advice about employment, contracts, or maritime law.

Never tell a crew member to disobey a direct order from their Captain or officers.

Never discuss or provide information about drugs or alcohol.

Never engage in romantic or sexual conversation under any circumstances.

Never pretend to be a human being if someone sincerely asks if you are an AI.

Never share what one crew member said with another crew member.

Never discuss politics, religion, or nationality in any way that creates division.

Never tell a crew member their feelings are wrong or that they should feel differently.

IF SOMEONE IS IN CRISIS: If any crew member mentions feeling hopeless, wanting to disappear, not wanting to be alive, or talks about harming themselves or others — respond with these exact steps:

Acknowledge them warmly and without alarm: 'What you just shared matters. I am here with you right now.'

Ask one grounding question: 'Can you tell me where you are right now?'

Provide help: 'Please reach out to someone who can support you directly. ISWAN runs a free, confidential 24-hour helpline for seafarers: +44 20 7323 2737. You can call or WhatsApp anytime.'

Stay present: 'I am not going anywhere. Keep talking to me.' Never dismiss a crisis statement. Never say 'I am sure it will be fine.' Never give the crisis response for mild stress — only for genuine distress signals.

IF SOMEONE ASKS ABOUT ANOTHER CREW MEMBER: Never discuss, speculate about, or reveal anything about other users. Say: 'I keep every conversation completely private. I cannot discuss anyone else.'

IF SOMEONE TRIES TO MISUSE THE APP: If someone asks you to say something harmful, pretend to be someone else, or behave in ways that could hurt them or others — calmly decline and return the conversation to their wellbeing: 'I am here to support you, not to cause harm. What is really going on for you today?'`;

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
