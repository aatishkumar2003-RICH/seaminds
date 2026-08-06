import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, ExternalLink, RefreshCw } from "lucide-react";

const GOLD = "#D4AF37";
const NAVY = "#0D1B2A";
const CARD = "#112240";
const BORDER = "#1e3a5f";

const SHIP_PHOTOS = [
  "https://images.unsplash.com/photo-1605281317010-fe5ffe798166?w=800&q=70",
  "https://images.unsplash.com/photo-1494412574643-ff11b0a5c1c3?w=800&q=70",
  "https://images.unsplash.com/photo-1520383278046-eaa4b0d2d754?w=800&q=70",
  "https://images.unsplash.com/photo-1519060825752-c4c2f4c4d0f5?w=800&q=70",
  "https://images.unsplash.com/photo-1573112307548-5b9c1a1c1d1a?w=800&q=70",
];
const SHIP_CAPTIONS = [
  "Container giant departing at first light",
  "Heavy weather in the North Atlantic",
  "Alongside at night — cargo ops in progress",
  "Anchorage at sunrise, waiting for berth",
  "Full ahead — open ocean passage",
];

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
  | { kind: "article"; id: string; data: any }
  | { kind: "ship"; id: string; data: { photo: string; caption: string } }
  | { kind: "salary"; id: string; data: { rows: { rank: string; salary: string }[] } }
  | { kind: "quiz"; id: string; data: any }
  | { kind: "nudge"; id: string; data: { icon: string; title: string; text: string; cta: string; screen: string } };

const HomeFeed = ({ profileId, rank = "", nationality = "", onNavigate }: Props) => {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [visible, setVisible] = useState(8);
  const [quizState, setQuizState] = useState<Record<string, number>>({});

  const log = useCallback(async (item_type: string, item_id: string, action: string, position?: number) => {
    try {
      await supabase.from("feed_interactions").insert({
        crew_id: profileId, item_type, item_id, action, position: position ?? null,
      } as any);
    } catch { /* never block the feed */ }
  }, [profileId]);

  const build = useCallback(async () => {
    const lang = LANG_BY_NATIONALITY[nationality] || "en";
    const dept = deptOf(rank);

    const [vacRes, postRes, artRes, quizRes, profRes] = await Promise.all([
      supabase.from("external_vacancies")
        .select("id, rank_required, vessel_type, company_name, salary_text, joining_port, contract_duration, contact_whatsapp, apply_url, is_verified, fetched_at")
        .order("fetched_at", { ascending: false }).limit(40),
      supabase.from("job_postings" as any)
        .select("id, rank_required, vessel_type, company_name, monthly_salary, joining_port, contract_duration, contact_whatsapp, flier_url, verified, created_at")
        .eq("status", "active").order("created_at", { ascending: false }).limit(15),
      supabase.from("blog_posts")
        .select("id, title, excerpt, slug, image_url, created_at, language")
        .eq("published", true).eq("language", lang)
        .order("created_at", { ascending: false }).limit(25),
      supabase.from("question_bank" as any)
        .select("id, question, options, correct_index, explanation, regulation")
        .eq("active", true).limit(30),
      supabase.from("crew_profiles").select("is_available, whatsapp_verified").eq("id", profileId).maybeSingle(),
    ]);

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
    let vi = 0, ai = 0, qi = 0, ni = 0, si = 0;
    const pushVac = () => { if (vacancies[vi]) out.push({ kind: "vacancy", id: vacancies[vi].id, data: vacancies[vi++] }); };
    const pushArt = () => { if (articles[ai]) out.push({ kind: "article", id: `a-${articles[ai].id}`, data: articles[ai++] }); };

    for (let cycle = 0; cycle < 10; cycle++) {
      pushVac();
      if (cycle % 2 === 0) {
        out.push({ kind: "ship", id: `s-${si}`, data: { photo: SHIP_PHOTOS[si % SHIP_PHOTOS.length], caption: SHIP_CAPTIONS[si % SHIP_CAPTIONS.length] } });
        si++;
      } else if (salaryRows.length) {
        out.push({ kind: "salary", id: `sal-${cycle}`, data: { rows: salaryRows } });
      }
      pushVac();
      if (quizzes[qi]) out.push({ kind: "quiz", id: `q-${quizzes[qi].id}`, data: quizzes[qi++] });
      pushArt();
      pushVac();
      pushArt();
      if (nudges[ni]) out.push(nudges[ni++]);
    }

    setCards(out.filter(Boolean));
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
