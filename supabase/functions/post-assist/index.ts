const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { imageUrl, draft, postType, companyName } = await req.json().catch(() => ({}));
    const key = Deno.env.get("OPENAI_API_KEY");
    if (!key) return json({ success: false, error: "AI is not available right now." });

    const typeHint: Record<string, string> = {
      hiring: "a crew hiring advert",
      update: "a company update",
      fleet: "fleet news",
      training: "a training announcement",
      welfare: "a crew welfare announcement",
    };

    const instruction = `You write short adverts for a maritime manning company posting to seafarers on SeaMinds.

This is ${typeHint[postType] || "a company post"} from ${companyName || "a manning company"}.

${imageUrl ? "Read the attached flier image and turn it into a clear caption. List every rank you can see." : ""}
${draft ? `The company wrote this rough note, keep their meaning:\n"${draft}"` : ""}

Rules:
- 40 to 90 words. Short lines, easy to scan on a phone.
- Plain simple English — many readers are not native speakers.
- Lead with what the seafarer cares about: the ranks, the vessel, joining port and dates.
- List multiple ranks on one line separated by commas if there are several.
- Do NOT invent details that are not given. If salary or dates are unknown, leave them out.
- No hashtags. No emoji except at most one at the start.
- Never ask seafarers for money or fees.

Also extract any ranks mentioned.

Return ONLY JSON, no markdown:
{"caption": "the caption text", "ranks": ["Chief Officer", "2nd Officer"]}`;

    const messages = imageUrl
      ? [{ role: "user", content: [
          { type: "text", text: instruction },
          { type: "image_url", image_url: { url: imageUrl } },
        ] }]
      : [{ role: "user", content: instruction }];

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: imageUrl ? "gpt-4o" : "gpt-4o-mini",
        max_tokens: 600,
        messages,
      }),
    });

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "";
    try {
      const parsed = JSON.parse(String(raw).replace(/```json|```/g, "").trim());
      return json({ success: true, caption: parsed.caption || "", ranks: parsed.ranks || [] });
    } catch {
      return json({ success: false, error: "Could not read that. Please write your message." });
    }
  } catch (e) {
    return json({ success: false, error: "AI help is unavailable. Please write your message." });
  }
});
