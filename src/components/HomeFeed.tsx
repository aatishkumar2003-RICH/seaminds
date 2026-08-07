import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, ExternalLink, RefreshCw } from "lucide-react";
import { trackPixel } from "@/lib/metaPixel";
import ShareResult from "@/components/ShareResult";

const GOLD = "#D4AF37";
const NAVY = "#0D1B2A";
const CARD = "#112240";
const BORDER = "#1e3a5f";


const LANG_BY_NATIONALITY: Record<string, string> = {
  Filipino: "tl", Indian: "hi", Indonesian: "id",
};

const DEPT_KEYS: Record<string, string[]> = {
  engine: ["engineer", "eto", "oiler", "fitter", "motorman", "electr"],
  deck: ["captain", "master", "officer", "mate", "bosun", "ab", "os", "seaman", "deck"],
  catering: ["cook", "steward", "messman", "chef"],
};

const deptOf = (rank: string) => {
  const r = (rank || "").toLowerCase();
  for (const [dept, keys] of Object.entries(DEPT_KEYS)) if (keys.some((k) => r.includes(k))) return dept;
  return "";
};

const timeAgo = (iso: string) => {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString();
};

interface Props {
  profileId: string;
  rank?: string;
  nationality?: string;
  onNavigate?: (screen: string) => void;
}

type Card =
  | { kind: "vacancy"; id: string; data: any }
  | { kind: "company"; id: string; data: any }
  | { kind: "article"; id: string; data: any }
  | { kind: "ship"; id: string; data: { photo: string; caption: string } }
  | { kind: "stats"; id: string; data: { items: any[] } }
  | { kind: "salary"; id: string; data: { rows: { rank: string; salary: string }[] } }
  | { kind: "quiz"; id: string; data: any }
  | { kind: "channels"; id: string; data: Record<string, never> }
  | { kind: "nudge"; id: string; data: { icon: string; title: string; text: string; cta: string; screen: string } };

const HomeFeed = ({ profileId, rank = "", nationality = "", onNavigate }: Props) => {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [visible, setVisible] = useState(8);
  const [quizState, setQuizState] = useState<Record<string, number>>({});
  const [engaged, setEngaged] = useState<Record<string, { interested: boolean; saved: boolean; count: number }>>({});

  const log = useCallback(async (item_type: string, item_id: string, action: string, position?: number) => {
    try {
      await supabase.from("feed_interactions").insert({
        crew_id: profileId, item_type, item_id, action, position: position ?? null,
      } as any);
    } catch { /* never block the feed */ }
  }, [profileId]);

  const engage = async (postId: string, action: "interested" | "save" | "view", position?: number) => {
    try {
      const { data } = await supabase.rpc("engage_company_post" as any, { p_post_id: postId, p_action: action });
      const res: any = data;
      if (action !== "view") log("company_post", postId, action, position);
      if (action === "interested" && res?.active) {
        alert("The company can now see you are interested. Keep your CV and availability up to date.");
      }
      setEngaged((s) => ({
        ...s,
        [postId]: {
          interested: action === "interested" ? !!res?.active : (s[postId]?.interested ?? false),
          saved: action === "save" ? true : (s[postId]?.saved ?? false),
          count: typeof res?.interested === "number" ? res.interested : (s[postId]?.count ?? 0),
        },
      }));
    } catch { /* never break the feed */ }
  };


  const build = useCallback(async () => {
    const lang = LANG_BY_NATIONALITY[nationality] || "en";
    const dept = deptOf(rank);

    const [vacRes, postRes, cpostRes, artRes, quizRes, profRes, shipRes, streakRes, scoreRes] = await Promise.all([
      supabase.from("external_vacancies")
        .select("id, rank_required, vessel_type, company_name, salary_text, joining_port, contract_duration, contact_whatsapp, apply_url, is_verified, fetched_at")
        .order("fetched_at", { ascending: false }).limit(40),
      supabase.from("job_postings" as any)
        .select("id, rank_required, vessel_type, company_name, monthly_salary, joining_port, contract_duration, contact_whatsapp, flier_url, verified, created_at")
        .eq("status", "active").order("created_at", { ascending: false }).limit(15),
      supabase.from("company_posts" as any)
        .select("id, company_name, post_type, caption, image_url, whatsapp, link_url, verified, created_at")
        .eq("status", "live")
        .order("created_at", { ascending: false })
        .limit(15),
      supabase.from("blog_posts")
        .select("id, title, excerpt, slug, image_url, created_at, language")
        .eq("published", true).eq("language", lang)
        .order("created_at", { ascending: false }).limit(25),
      supabase.from("question_bank" as any)
        .select("id, question, options, correct_index, explanation, regulation")
        .eq("active", true).limit(30),
      supabase.from("crew_profiles").select("is_available, whatsapp_verified").eq("id", profileId).maybeSingle(),
      supabase.from("ship_photos" as any).select("id, photo_url, caption").eq("active", true).limit(20),
      supabase.from("wellness_streaks").select("current_streak").eq("crew_profile_id", profileId).maybeSingle(),
      supabase.from("smc_assessments").select("overall_score").eq("crew_profile_id", profileId).eq("status", "completed").order("completed_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const companyPosts = ((cpostRes.data as any[]) || []);
    const ships = (((shipRes.data as any[]) || []).sort(() => Math.random() - 0.5));
    const streak = (streakRes.data as any)?.current_streak;
    const score = (scoreRes.data as any)?.overall_score;
    const statItems = [
      { icon: "🔥", value: streak ?? 0, label: "day streak", screen: "chat" },
      { icon: "📜", value: "—", label: "certificates", screen: "resume" },
      { icon: "⏱", value: "—", label: "rest hours", screen: "resthours" },
      { icon: "🏆", value: score ? Number(score).toFixed(1) : "Get", label: "SMC", screen: "smc", highlight: true },
    ];

    // Fall back to English articles if the language has none
    let articles: any[] = (artRes.data as any[]) || [];
    if (articles.length < 5) {
      const en = await supabase.from("blog_posts")
        .select("id, title, excerpt, slug, image_url, created_at, language")
        .eq("published", true).eq("language", "en")
        .order("created_at", { ascending: false }).limit(20);
      articles = [...articles, ...((en.data as any[]) || [])];
    }

    const vacancies: any[] = [
      ...(((postRes.data as any[]) || []).map((p) => ({
        id: `p-${p.id}`, rank: p.rank_required, vessel: p.vessel_type, company: p.company_name,
        salary: p.monthly_salary, port: p.joining_port, duration: p.contract_duration,
        flier: p.flier_url, whatsapp: p.contact_whatsapp, applyUrl: null,
        verified: !!p.verified, posted: p.created_at, own: true,
      }))),
      ...(((vacRes.data as any[]) || []).map((v) => ({
        id: `e-${v.id}`, rank: v.rank_required, vessel: v.vessel_type, company: v.company_name,
        salary: v.salary_text, port: v.joining_port, duration: v.contract_duration,
        flier: null, whatsapp: v.contact_whatsapp, applyUrl: v.apply_url,
        verified: !!v.is_verified, posted: v.fetched_at, own: false,
      }))),
    ];

    // Rank-relevant vacancies first
    vacancies.sort((a, b) => {
      const am = deptOf(a.rank) === dept ? 1 : 0;
      const bm = deptOf(b.rank) === dept ? 1 : 0;
      if (am !== bm) return bm - am;
      return +new Date(b.posted) - +new Date(a.posted);
    });

    const salaryRows = vacancies
      .filter((v) => v.salary && String(v.salary).match(/\d/))
      .slice(0, 5).map((v) => ({ rank: v.rank || "Crew", salary: String(v.salary) }));

    const quizzes = ((quizRes.data as any[]) || []).sort(() => Math.random() - 0.5);
    const prof: any = profRes.data || {};

    const nudges: Card[] = [];
    if (!prof.is_available) nudges.push({
      kind: "nudge", id: "n-avail",
      data: { icon: "🚀", title: "Companies are searching your rank", text: "Turn on availability so manning companies can find your profile.", cta: "Go Available", screen: "smc" },
    });
    nudges.push({
      kind: "nudge", id: "n-score",
      data: { icon: "🏆", title: "Know where you stand", text: "Get your competency score — companies sort crew by it.", cta: "Check My Score", screen: "smc" },
    });
    nudges.push({
      kind: "nudge", id: "n-cv",
      data: { icon: "📄", title: "Keep your CV current", text: "A complete CV gets seen first when a company searches.", cta: "Open My CV", screen: "resume" },
    });

    // Interleave: vacancy · ship/salary · vacancy · quiz · article · vacancy · article · nudge
    const out: Card[] = [];
    let vi = 0, ai = 0, qi = 0, ni = 0, si = 0, ci = 0;
    const pushVac = () => { if (vacancies[vi]) out.push({ kind: "vacancy", id: vacancies[vi].id, data: vacancies[vi++] }); };
    const pushArt = () => { if (articles[ai]) out.push({ kind: "article", id: `a-${articles[ai].id}`, data: articles[ai++] }); };

    for (let cycle = 0; cycle < 10; cycle++) {
      pushVac();
      if (companyPosts[ci]) out.push({ kind: "company", id: `c-${companyPosts[ci].id}`, data: companyPosts[ci++] });
      if (cycle === 0) out.push({ kind: "stats", id: "stats", data: { items: statItems } });
      if (cycle % 2 === 0) {
        if (ships.length) {
          const sp = ships[si % ships.length];
          out.push({ kind: "ship", id: `s-${si}`, data: { photo: sp.photo_url, caption: sp.caption || "Life at sea" } });
          si++;
        } else if (salaryRows.length) {
          out.push({ kind: "salary", id: `sal-${cycle}`, data: { rows: salaryRows } });
        }
      } else if (salaryRows.length) {
        out.push({ kind: "salary", id: `sal-${cycle}`, data: { rows: salaryRows } });
      }
      if (cycle === 0) out.push({ kind: "channels", id: "ch-1", data: {} });
      pushVac();
      if (quizzes[qi]) out.push({ kind: "quiz", id: `q-${quizzes[qi].id}`, data: quizzes[qi++] });
      pushArt();
      pushVac();
      pushArt();
      if (nudges[ni]) out.push(nudges[ni++]);
    }

    setCards(out.filter(Boolean));

    // Count one view per company post shown
    companyPosts.slice(0, 6).forEach((p: any) => {
      supabase.rpc("engage_company_post" as any, { p_post_id: p.id, p_action: "view" }).then(() => {}, () => {});
    });

  }, [profileId, rank, nationality]);

  useEffect(() => { build().finally(() => setLoading(false)); }, [build]);

  const refresh = async () => {
    setRefreshing(true);
    setVisible(8);
    await build();
    setRefreshing(false);
  };

  const applyTo = (v: any) => {
    log("vacancy", v.id, "apply");
    trackPixel("Contact", { content_name: "job_apply", content_category: v.rank || "crew" });
    if (v.whatsapp) {
      const d = String(v.whatsapp).replace(/[^\d]/g, "");
      if (d) return window.open(`https://wa.me/${d}?text=${encodeURIComponent(`Hello, I am interested in the ${v.rank} position (seen on SeaMinds).`)}`, "_blank");
    }
    if (v.applyUrl) return window.open(v.applyUrl, "_blank");
  };

  const answerQuiz = async (q: any, idx: number) => {
    setQuizState((s) => ({ ...s, [q.id]: idx }));
    const correct = idx === q.correct_index;
    log("quiz", q.id, correct ? "quiz_correct" : "quiz_wrong");
    try {
      await supabase.from("quiz_answers").insert({
        crew_id: profileId, question_id: q.id, chosen_index: idx, is_correct: correct,
      } as any);
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <div className="px-4 py-4 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl animate-pulse" style={{ background: CARD, height: 190, border: `1px solid ${BORDER}` }} />
        ))}
      </div>
    );
  }

  const shown = cards.slice(0, visible);

  return (
    <div className="pb-4">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div>
          <h1 className="text-lg font-bold" style={{ color: GOLD }}>Your Feed</h1>
          <p className="text-[11px]" style={{ color: "#94a3b8" }}>
            Jobs, knowledge and life at sea{rank ? ` · ${rank}` : ""}
          </p>
        </div>
        <button onClick={refresh} disabled={refreshing}
          className="p-2 rounded-full" style={{ background: CARD, border: `1px solid ${BORDER}`, cursor: "pointer" }}>
          <RefreshCw size={15} style={{ color: GOLD }} className={refreshing ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="px-4 space-y-3">
        {shown.map((c, i) => {
          if (c.kind === "company") {
            const p = c.data;
            const TYPE_LABEL: Record<string, string> = {
              hiring: "🚢 Hiring", update: "📢 Company Update", fleet: "⚓ Fleet News",
              training: "🎓 Training", welfare: "🤝 Crew Welfare",
            };
            return (
              <article key={c.id} className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                {p.image_url && (
                  <img src={p.image_url} alt={p.company_name} loading="lazy"
                    className="w-full object-cover" style={{ maxHeight: 420 }} />
                )}
                <div className="p-4 space-y-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-extrabold truncate" style={{ color: GOLD }}>{p.company_name}</span>
                    {p.verified && <span className="text-[11px]" style={{ color: "#22c55e" }}>✅</span>}
                    <span className="ml-auto text-[10px] shrink-0" style={{ color: "#94a3b8" }}>{timeAgo(p.created_at)}</span>
                  </div>
                  <span className="inline-block rounded-full px-2.5 py-1 text-[10px] font-bold"
                    style={{ background: "rgba(212,175,55,0.12)", color: GOLD, border: `1px solid rgba(212,175,55,0.35)` }}>
                    {TYPE_LABEL[p.post_type] || "📢 Update"}
                  </span>
                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: "#e2e8f0" }}>{p.caption}</p>
                  <div className="flex gap-2">
                    {p.whatsapp && (
                      <button
                        onClick={() => {
                          log("company_post", p.id, "apply", i);
                          const d = String(p.whatsapp).replace(/[^\d]/g, "");
                          if (d) window.open(`https://wa.me/${d}?text=${encodeURIComponent(`Hello ${p.company_name}, I saw your post on SeaMinds and would like to apply.`)}`, "_blank");
                        }}
                        className="flex-1 rounded-xl py-2.5 font-bold text-[13px] flex items-center justify-center gap-2"
                        style={{ background: GOLD, color: NAVY, border: "none", cursor: "pointer" }}
                      >
                        <MessageCircle size={14} /> Apply on WhatsApp
                      </button>
                    )}
                    {p.link_url && (
                      <button
                        onClick={() => { log("company_post", p.id, "link", i); window.open(p.link_url, "_blank"); }}
                        className="rounded-xl px-4 py-2.5 font-bold text-[13px]"
                        style={{ background: "transparent", color: GOLD, border: `1px solid ${GOLD}`, cursor: "pointer" }}
                      >
                        <ExternalLink size={14} />
                      </button>
                    )}
                  </div>
                  <div className="flex items-start gap-2 pt-1">
                    <p className="text-[9.5px] leading-snug flex-1" style={{ color: "#64748b" }}>
                      Posted by the company. SeaMinds does not endorse third-party advertisements.
                      No company may charge you a fee for a job.
                    </p>
                    <button
                      onClick={async () => {
                        if (!window.confirm("Report this post to SeaMinds?\n\nUse this if the company asks for payment, the post is not maritime, or it looks like a scam.")) return;
                        try {
                          await supabase.rpc("report_company_post" as any, { post_id: p.id, reason: "reported from feed" });
                          log("company_post", p.id, "report", i);
                          alert("Thank you. SeaMinds will review this post.");
                        } catch {
                          alert("Could not send the report. Please try again.");
                        }
                      }}
                      className="shrink-0 text-[9.5px] underline"
                      style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", padding: 0 }}
                    >
                      Report
                    </button>
                  </div>
                </div>
              </article>
            );
          }

          if (c.kind === "vacancy") {
            const v = c.data;
            return (
              <article key={c.id} className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                {v.flier && <img src={v.flier} alt={v.rank} loading="lazy" className="w-full object-cover" style={{ maxHeight: 380 }} />}
                <div className="p-4 space-y-2.5">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <h2 className="text-base font-extrabold text-white leading-tight">{v.rank || "Crew"}</h2>
                      <p className="text-xs truncate" style={{ color: GOLD }}>{v.company || "Maritime Company"}{v.verified ? " ✅" : ""}</p>
                    </div>
                    <span className="text-[10px] shrink-0" style={{ color: "#94a3b8" }}>{timeAgo(v.posted)}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: "#cbd5e1" }}>
                    {v.vessel && <span>🚢 {v.vessel}</span>}
                    {v.port && <span>📍 {v.port}</span>}
                    {v.duration && <span>📆 {v.duration}</span>}
                  </div>
                  {v.salary && <p className="font-extrabold text-sm" style={{ color: "#22c55e" }}>💰 {v.salary}</p>}
                  <button onClick={() => applyTo(v)}
                    className="w-full rounded-xl py-2.5 font-bold text-[13px] flex items-center justify-center gap-2"
                    style={{ background: GOLD, color: NAVY, border: "none", cursor: "pointer" }}>
                    {v.whatsapp ? <><MessageCircle size={14} /> Apply on WhatsApp</> : <><ExternalLink size={14} /> View & Apply</>}
                  </button>
                </div>
              </article>
            );
          }

          if (c.kind === "stats") {
            return (
              <article key={c.id} className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <p className="text-[10px] font-bold tracking-wider mb-3" style={{ color: GOLD }}>⚓ YOUR PROGRESS</p>
                <div className="grid grid-cols-4 gap-2">
                  {c.data.items.map((s: any, k: number) => (
                    <button key={k} onClick={() => onNavigate?.(s.screen)}
                      className="rounded-xl py-2.5 text-center"
                      style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, cursor: "pointer" }}>
                      <div className="text-base leading-none mb-1">{s.icon}</div>
                      <div className="text-sm font-extrabold" style={{ color: s.highlight ? GOLD : "#fff" }}>{s.value}</div>
                      <div className="text-[9px] mt-0.5" style={{ color: "#94a3b8" }}>{s.label}</div>
                    </button>
                  ))}
                </div>
              </article>
            );
          }

          if (c.kind === "ship") {
            return (
              <article key={c.id} className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <img src={c.data.photo} alt="Ship of the day" loading="lazy" className="w-full object-cover" style={{ height: 200 }} />
                <div className="p-3">
                  <p className="text-[10px] font-bold tracking-wider" style={{ color: GOLD }}>🚢 SHIP OF THE DAY</p>
                  <p className="text-sm text-white mt-0.5">{c.data.caption}</p>
                </div>
              </article>
            );
          }

          if (c.kind === "channels") {
            return (
              <article key={c.id} className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <p className="text-[10px] font-bold tracking-wider mb-1" style={{ color: GOLD }}>🔔 NEVER MISS A JOB</p>
                <p className="text-[12px] mb-3" style={{ color: "#cbd5e1" }}>
                  Get every new vacancy the moment it lands — free, on the app you already use.
                </p>
                <div className="flex gap-2">
                  <a href="https://whatsapp.com/channel/0029Vb8xcAJBFLgOKwwdTJ2V" target="_blank" rel="noopener noreferrer"
                    className="flex-1 rounded-xl py-2.5 text-center text-[12px] font-bold"
                    style={{ background: "#25D366", color: "#fff" }}>
                    WhatsApp
                  </a>
                  <a href="https://t.me/seamindsjobs" target="_blank" rel="noopener noreferrer"
                    className="flex-1 rounded-xl py-2.5 text-center text-[12px] font-bold"
                    style={{ background: "#229ED9", color: "#fff" }}>
                    Telegram
                  </a>
                </div>
              </article>
            );
          }



          if (c.kind === "salary") {
            return (
              <article key={c.id} className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <p className="text-[10px] font-bold tracking-wider mb-2.5" style={{ color: GOLD }}>💰 SALARIES ON THE BOARD NOW</p>
                <div className="space-y-1.5">
                  {c.data.rows.map((r, k) => (
                    <div key={k} className="flex justify-between items-center text-[13px]">
                      <span className="text-white truncate mr-3">{r.rank}</span>
                      <span className="font-bold shrink-0" style={{ color: "#22c55e" }}>{r.salary}</span>
                    </div>
                  ))}
                </div>
              </article>
            );
          }

          if (c.kind === "quiz") {
            const q = c.data;
            const opts: string[] = Array.isArray(q.options) ? q.options : (() => { try { return JSON.parse(q.options); } catch { return []; } })();
            const chosen = quizState[q.id];
            const answered = chosen !== undefined;
            return (
              <article key={c.id} className="rounded-2xl p-4" style={{ background: "linear-gradient(160deg, rgba(212,175,55,0.12), rgba(17,34,64,1))", border: `1px solid rgba(212,175,55,0.4)` }}>
                <p className="text-[10px] font-bold tracking-wider mb-2" style={{ color: GOLD }}>🧠 TEST YOURSELF</p>
                <p className="text-sm font-semibold text-white mb-3">{q.question}</p>
                <div className="space-y-2">
                  {opts.map((o, k) => {
                    const isRight = k === q.correct_index;
                    const picked = chosen === k;
                    return (
                      <button key={k} disabled={answered} onClick={() => answerQuiz(q, k)}
                        className="w-full text-left rounded-xl px-3 py-2 text-[12px]"
                        style={{
                          background: answered ? (isRight ? "rgba(34,197,94,0.18)" : picked ? "rgba(239,68,68,0.18)" : "transparent") : "rgba(255,255,255,0.04)",
                          border: `1px solid ${answered && isRight ? "#22c55e" : answered && picked ? "#ef4444" : BORDER}`,
                          color: "#e2e8f0", cursor: answered ? "default" : "pointer",
                        }}>
                        {String.fromCharCode(65 + k)}. {o}
                      </button>
                    );
                  })}
                </div>
                {answered && (
                  <div className="mt-3 rounded-xl p-3" style={{ background: "rgba(0,0,0,0.25)" }}>
                    <p className="text-[12px] font-bold mb-1" style={{ color: chosen === q.correct_index ? "#22c55e" : "#f59e0b" }}>
                      {chosen === q.correct_index ? "✅ Correct" : "❌ Not quite"}
                    </p>
                    {q.explanation && <p className="text-[11px]" style={{ color: "#cbd5e1" }}>{q.explanation}</p>}
                    {q.regulation && <p className="text-[10px] mt-1" style={{ color: "#94a3b8" }}>📘 {q.regulation}</p>}
                    <ShareResult
                      compact
                      text={chosen === q.correct_index
                        ? `I got today's SeaMinds maritime question right ⚓🧠 Can you? "${q.question}"`
                        : `Tough maritime question of the day on SeaMinds ⚓🧠 "${q.question}" — can you get it right?`}
                    />
                  </div>
                )}
              </article>
            );
          }

          if (c.kind === "article") {
            const a = c.data;
            return (
              <article key={c.id} className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                {a.image_url && <img src={a.image_url} alt={a.title} loading="lazy" className="w-full object-cover" style={{ height: 150 }} />}
                <div className="p-4">
                  <p className="text-[10px] font-bold tracking-wider mb-1" style={{ color: GOLD }}>📖 READ</p>
                  <h2 className="text-sm font-bold text-white leading-snug mb-1">{a.title}</h2>
                  {a.excerpt && <p className="text-[11px] mb-2.5" style={{ color: "#94a3b8" }}>{a.excerpt}</p>}
                  <button onClick={() => { log("article", a.id, "tap", i); window.open(`/blog/${a.slug}`, "_blank"); }}
                    className="rounded-xl px-4 py-2 text-[12px] font-bold"
                    style={{ background: "transparent", color: GOLD, border: `1px solid ${GOLD}`, cursor: "pointer" }}>
                    Read article
                  </button>
                </div>
              </article>
            );
          }

          const n = (c as any).data;
          return (
            <article key={c.id} className="rounded-2xl p-4 flex gap-3 items-start" style={{ background: "rgba(212,175,55,0.08)", border: `1px solid rgba(212,175,55,0.35)` }}>
              <span className="text-2xl shrink-0">{n.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white">{n.title}</p>
                <p className="text-[11px] mb-2" style={{ color: "#cbd5e1" }}>{n.text}</p>
                <button onClick={() => { log("nudge", c.id, "tap", i); onNavigate?.(n.screen); }}
                  className="rounded-xl px-4 py-1.5 text-[12px] font-bold"
                  style={{ background: GOLD, color: NAVY, border: "none", cursor: "pointer" }}>
                  {n.cta}
                </button>
              </div>
            </article>
          );
        })}

        {visible < cards.length && (
          <button onClick={() => setVisible((v) => v + 8)}
            className="w-full rounded-xl py-3 text-[13px] font-bold"
            style={{ background: CARD, color: GOLD, border: `1px solid ${BORDER}`, cursor: "pointer" }}>
            Load more
          </button>
        )}
      </div>
    </div>
  );
};

export default HomeFeed;
