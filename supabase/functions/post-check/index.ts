const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { caption, imageUrl } = await req.json().catch(() => ({}));
    const text = String(caption || "").trim();

    // Nothing to check — let it through.
    if (!text && !imageUrl) return json({ allowed: true });

    const key = Deno.env.get("OPENAI_API_KEY");
    // If AI is unavailable, never block a legitimate company.
    if (!key) return json({ allowed: true, note: "check unavailable" });

    const instruction = `You are a content checker for SeaMinds, a maritime jobs and crewing platform used by manning companies to advertise to seafarers.

Decide ONLY whether this post belongs on a maritime platform.

ALLOW (respond allowed=true) anything maritime or seafaring related, including:
- job vacancies and crew requirements of any kind, any number of ranks
- company updates, fleet news, vessel takeovers, new management contracts
- walk-in interviews, recruitment drives, office openings
- maritime training, STCW courses, academies, certifications
- crew welfare, seafarer wellbeing, awards, retention news
- port calls, vessel photos, company milestones
- maritime services, ship management, marine insurance, maritime legal help

BLOCK (respond allowed=false) only clearly non-maritime or prohibited content:
- tobacco, vaping, alcohol promotion
- gambling or betting
- adult or sexual content
- cryptocurrency, forex, MLM, get-rich-quick schemes
- unrelated consumer products (phones, clothing, cosmetics, real estate)
- political campaigning or religious proselytising
- hate speech, violence, or harassment

IMPORTANT: be permissive. If you are unsure, ALLOW it. Only block when it is clearly one of the blocked categories. A short or vaguely worded maritime post must still be allowed.

Respond ONLY with JSON, no markdown:
{"allowed": true or false, "reason": "one short sentence, only if blocked"}`;

    const content: any[] = [{ type: "text", text: `${instruction}\n\nPost caption:\n${text || "(no caption)"}` }];
    if (imageUrl) content.push({ type: "image_url", image_url: { url: imageUrl } });

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: imageUrl ? "gpt-4o" : "gpt-4o-mini",
        max_tokens: 200,
        messages: [{ role: "user", content: imageUrl ? content : `${instruction}\n\nPost caption:\n${text}` }],
      }),
    });

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "";
    let parsed: any = { allowed: true };
    try {
      parsed = JSON.parse(String(raw).replace(/```json|```/g, "").trim());
    } catch {
      // Unparseable answer must never block a company.
      return json({ allowed: true, note: "check inconclusive" });
    }

    return json({
      allowed: parsed.allowed !== false,
      reason: parsed.allowed === false ? (parsed.reason || "This post does not appear to be maritime related.") : undefined,
    });
  } catch (e) {
    // Any failure allows the post — never block on our own error.
    return json({ allowed: true, note: String(e).substring(0, 120) });
  }
});
