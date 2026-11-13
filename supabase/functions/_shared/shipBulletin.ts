// Pure plain-text shipboard bulletin builder (no imports, vitest-testable).
// Satellite mail strips attachments/images: everything is plain text, small, readable on a bridge PC.

const ENT: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " ", "&rsquo;": "'", "&lsquo;": "'", "&ldquo;": '"', "&rdquo;": '"', "&ndash;": "-", "&mdash;": "-" };
export const toText = (html: string) =>
  String(html || "").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, (m) => ENT[m] ?? " ")
    .replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/\s+/g, " ").replace(/ ([:;,.!?])/g, "$1").trim();

type Section = { heading: string; paras: string[]; items: string[] };
export function parseSections(html: string): { glance: string[]; sections: Section[] } {
  const glanceBlock = /AT A GLANCE[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i.exec(html)?.[1] || "";
  const glance = [...glanceBlock.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => toText(m[1])).filter(Boolean);
  const parts = html.split(/<h2[^>]*>/i).slice(1);
  const sections = parts.map((p) => {
    const [h, body = ""] = p.split(/<\/h2>/i);
    return {
      heading: toText(h),
      paras: [...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => toText(m[1])).filter(Boolean),
      items: [...body.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => toText(m[1])).filter(Boolean),
    };
  });
  return { glance, sections };
}

const WATCH_WORDS = [
  "To every officer and rating keeping the watch today: thank you for keeping world trade moving safely. Fair winds and a safe watch.",
  "A good watch is a quiet watch. Look after each other on board, rest when you can, and call home when the signal allows.",
  "Safety is never a delay. Take the extra minute for the checklist, the toolbox talk and the second look.",
  "Your family is proud of you. Every safe day at sea brings you one day closer to home.",
  "Ask questions, share knowledge, train the juniors. A strong ship is built by a team that talks.",
  "Fatigue is a hazard like any other. Respect your rest hours and those of your shipmates.",
  "Wherever you are sailing today, the SeaMinds Team wishes you calm seas and a smooth watch.",
];

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "..." : s);
const wrap = (s: string, w = 70, indent = "") => {
  const out: string[] = []; let line = "";
  for (const word of s.split(" ")) {
    if ((line + " " + word).trim().length > w) { out.push(indent + line.trim()); line = word; } else line += " " + word;
  }
  if (line.trim()) out.push(indent + line.trim());
  return out.join("\n");
};
const bullet = (s: string) => wrap(s, 66, "  ").replace(/^  /, "• ").replace(/\n/g, "\n");

/** Round down to a truthful "N,N00+" figure (never overstates the live count). */
export const jobsLabel = (n?: number | null) => {
  if (!n || n < 100) return "Thousands of";
  return `${(Math.floor(n / 100) * 100).toLocaleString("en-US")}+`;
};
export const crewInvite = (n?: number | null) => [
  "FIND YOUR NEXT CONTRACT DIRECT - FREE FOR ALL SEAFARERS",
  wrap(`Browse ${jobsLabel(n)} live deck, engine & offshore jobs. Build a verified Sea Profile, train on maritime competencies, and apply direct to managers.`),
  "Join free: https://seaminds.life/?utm_source=vessel_briefing&utm_medium=email&utm_campaign=crew_invite",
  "-".repeat(62),
  "",
];

export type BulletinPost = { title: string; slug: string; excerpt?: string | null; content: string; created_at?: string };

export function buildShipBulletin(post: BulletinPost, opts: { vessel?: string | null; date: Date; readUrl: string; unsubUrl: string; jobCount?: number | null }) {
  const { glance, sections } = parseSections(post.content || "");
  const find = (re: RegExp) => sections.find((s) => re.test(s.heading));
  const what = find(/what happened/i);
  const why = find(/why it matters/i);
  const deck = find(/deck/i);
  const engine = find(/engine/i);
  const check = find(/check|action|takeaway|safety/i);

  const take = (s: Section | undefined, n: number) => (s?.items || []).slice(0, n).map((i) => clip(i, 220));
  const takeaways = [
    ...take(deck, 2).map((t) => `Bridge team: ${t}`),
    ...take(engine, 2).map((t) => `Engine room: ${t}`),
  ];
  if (!takeaways.length) takeaways.push(...take(check, 3));

  const dateStr = opts.date.toISOString().slice(0, 10);
  const day = Math.floor(opts.date.getTime() / 864e5);
  const words = WATCH_WORDS[day % WATCH_WORDS.length];
  const line = "=".repeat(62);
  const thin = "-".repeat(62);

  const blocks: string[] = [
    line,
    "SEAMINDS DAILY MARITIME BULLETIN - SHIPBOARD EDITION",
    `Date: ${dateStr} | English edition`,
    `For: Master, Chief Engineer, Officers & Crew${opts.vessel ? ` of ${opts.vessel}` : ""}`,
    line,
    "",
    ...crewInvite(opts.jobCount),
    "TODAY'S STORY",
    wrap(toText(post.title).toUpperCase()),
    "",
  ];
  if (glance.length) blocks.push("AT A GLANCE", ...glance.slice(0, 3).map((g) => bullet(clip(g, 200))), "");
  const whatText = (what?.paras || [toText(post.excerpt || "")]).slice(0, 2).map((p) => wrap(clip(p, 700))).join("\n\n");
  if (whatText.trim()) blocks.push("WHAT HAPPENED", whatText, "");
  if (why?.paras[0]) blocks.push("WHY IT MATTERS ON BOARD", wrap(clip(why.paras[0], 600)), "");
  if (takeaways.length) blocks.push("BRIDGE & ENGINE ROOM TAKEAWAYS", ...takeaways.map(bullet), "");
  blocks.push(
    "WORDS FOR THE WATCH",
    wrap(words),
    "",
    thin,
    "FREE SERVICE - HELP YOUR SISTER VESSELS JOIN",
    wrap("This daily bulletin is a 100% free service for all ships and crew. Please help other vessels benefit too: simply REPLY to this email with the vessel name and verified email address of your sister vessels or any other ships, and we will add them to tomorrow's bulletin."),
    thin,
    "Please print or forward this bulletin to the messroom and officers.",
    `Full story (when in port or on crew Wi-Fi): ${opts.readUrl}`,
    "Free maritime news, vacancies and AI training: https://seaminds.life",
    "",
    "Safe seas,",
    "The SeaMinds Team | Maritime Intelligence Desk",
    "",
    `To stop these bulletins reply UNSUBSCRIBE or open: ${opts.unsubUrl}`,
    line,
  );
  const text = blocks.join("\n");
  const subject = clip(`SeaMinds Daily Bulletin ${dateStr}: ${toText(post.title)}`, 120);
  return { subject, text };
}
