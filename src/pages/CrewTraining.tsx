import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import MaritimeEnglishLab from "@/components/training/MaritimeEnglishLab";
import MaritimeMasterBrain from "@/components/training/MaritimeMasterBrain";
import { Helmet } from "react-helmet-async";
import { ChevronLeft, ExternalLink, Loader2, CheckCircle2, GraduationCap, Clock, Home, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { openTraining, completeTraining, trainingLedger, recommendTraining, assignTraining, trainingError, type LedgerItem, type Recommendation, trainingCatalog, trainingMatrix, type CatalogItem, type Segment } from "@/lib/training";

const Shell = ({ children, onBack, onQuit }: { children: React.ReactNode; onBack: () => void; onQuit?: () => void }) => (
  <main className="min-h-screen bg-background text-foreground pb-12">
    <div className="mx-auto max-w-lg px-4 py-5 space-y-5">
      <div className="flex items-center justify-between">
        <Button variant="ghost" className="px-0 text-primary" onClick={onBack}><ChevronLeft /> Back</Button>
        <div className="flex items-center gap-1">
          {onQuit && <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onQuit}><RotateCcw size={16} /> Quit / restart</Button>}
          <Button asChild variant="ghost" size="sm" className="text-primary"><Link to="/app" aria-label="Home"><Home size={16} /> Home</Link></Button>
        </div>
      </div>
      {children}
    </div>
  </main>
);

const Module = ({ token }: { token: string }) => {
  const navigate = useNavigate();
  const [m, setM] = useState<any>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const d = await openTraining(token);
      setM(d);
      if (d.ok) {
        setAnswers(d.quiz.map(() => null));
        setLeft(Math.max(0, d.min_dwell_seconds - d.elapsed_seconds));
        if (d.status === "completed") setResult({ passed: true, correct: d.quiz_correct, total: d.quiz_total });
      }
    })();
  }, [token]);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const submit = async () => {
    if (busy || answers.some((a) => a === null)) return;
    setBusy(true);
    const d = await completeTraining(token, answers as number[]);
    setBusy(false);
    if (!d.ok) {
      if (d.wait_seconds) setLeft(d.wait_seconds);
      toast.error(trainingError(d.error_code, d.wait_seconds));
      return;
    }
    setResult(d);
    if (!d.passed) setLeft(60);
  };

  if (!m) return <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="animate-spin" size={18} /> Loading training…</p>;
  if (!m.ok) return (
    <section className="space-y-3">
      <h1 className="text-xl font-bold">{trainingError(m.error_code)}</h1>
      <Button onClick={() => navigate("/training")}>My training</Button>
    </section>
  );

  return (
    <article className="space-y-5">
      <Helmet><title>{`${m.title} | SeaMinds Training`}</title></Helmet>
      <header className="space-y-2">
        <GraduationCap className="text-primary" size={30} />
        <h1 className="text-2xl font-bold">{m.title}</h1>
        <p className="text-sm text-muted-foreground">{m.summary}</p>
        {m.reasons?.length > 0 && (
          <div className="rounded-lg border border-primary/40 bg-card p-3">
            <p className="text-xs font-bold text-primary mb-1">Why this was chosen for you</p>
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">{m.reasons.map((r: string) => <li key={r}>{r}</li>)}</ul>
          </div>
        )}
      </header>

      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h2 className="font-bold">Briefing</h2>
        <ol className="space-y-2 text-sm list-decimal pl-5">{m.key_points.map((p: string) => <li key={p}>{p}</li>)}</ol>
        {m.media_url && (
          <a href={m.media_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline">
            <ExternalLink size={14} /> {m.media_label || "Official reference"}
          </a>
        )}
      </section>

      {result?.passed ? (
        <section className="rounded-lg border border-primary bg-card p-5 text-center space-y-2">
          <CheckCircle2 className="mx-auto text-primary" size={36} />
          <h2 className="text-lg font-bold">Training completed</h2>
          <p className="text-sm text-muted-foreground">{result.correct}/{result.total} correct. Saved to your SeaMinds training record — the company that assigned it can now see it as completed.</p>
          <div className="flex flex-col gap-2 pt-1">
            <Button asChild variant="outline" className="rounded-xl border-primary text-primary">
              <a href={`https://wa.me/?text=${encodeURIComponent(`Training completed on SeaMinds ✅\n${m.title}\nQuiz: ${result.correct}/${result.total} · ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC\nVerified record: ${window.location.origin}/training`)}`} target="_blank" rel="noopener noreferrer">Tell my manager on WhatsApp</a>
            </Button>
            <Button onClick={() => navigate("/training")}>My training</Button>
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          <h2 className="font-bold">Confirm what you learned</h2>
          {result && !result.passed && (
            <p role="alert" className="text-sm text-destructive">{result.correct}/{result.total} correct. Re-read the briefing and check question {result.wrong_questions.join(", ")}.</p>
          )}
          {m.quiz.map((q: any, qi: number) => (
            <fieldset key={qi} className="space-y-2">
              <legend className="text-sm font-semibold">{qi + 1}. {q.q}</legend>
              {q.options.map((o: string, oi: number) => (
                <label key={oi} className={`flex items-start gap-2 rounded-lg border p-3 text-sm cursor-pointer ${answers[qi] === oi ? "border-primary bg-primary/10" : "border-border"}`}>
                  <input type="radio" name={`q${qi}`} className="mt-0.5 accent-primary" checked={answers[qi] === oi}
                    onChange={() => setAnswers((a) => a.map((v, i) => (i === qi ? oi : v)))} />
                  {o}
                </label>
              ))}
            </fieldset>
          ))}
          <Button className="w-full rounded-xl font-bold" disabled={busy || left > 0 || answers.some((a) => a === null)} onClick={submit}>
            {busy ? "Checking…" : left > 0 ? <><Clock /> Read the briefing — {left}s</> : "Submit answers"}
          </Button>
        </section>
      )}
    </article>
  );
};

const MyTraining = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") || "required") as "required" | "matrix" | "records" | "english" | "brain";
  const english = tab === "english";
  const [items, setItems] = useState<LedgerItem[] | null>(null);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [segment, setSegment] = useState<Segment>("TANKER");

  const load = useCallback(async () => {
    const [l, r, c] = await Promise.all([trainingLedger(null), recommendTraining(null, "", 4), trainingCatalog()]);
    setCatalog(c.ok ? c.items : []);
    setItems(l.ok ? l.items : []);
    setRecs(r.ok ? r.items.filter((x: Recommendation) => !x.assigned) : []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const start = async (slug: string) => {
    setBusy(slug);
    const d = await assignTraining(null, [slug], "");
    setBusy(null);
    if (!d.ok) return toast.error(trainingError(d.error_code));
    navigate(`/training/${d.assigned[0].token}`);
  };
  const openItem = (c: CatalogItem) => (c.token ? navigate(`/training/${c.token}`) : start(c.slug));
  const requiredCount = (items || []).filter((i) => i.company?.trim() && i.status !== "completed" && i.token).length;
  const TABS = [
    ["required", "⭐ Required", requiredCount],
    ["matrix", "📋 Matrix", 0],
    ["records", "📊 Records", 0],
    ["english", "🎙️ English", 0],
    ["brain", "🧠 Brain", 0],
  ] as const;

  return (
    <section className="space-y-4">
      <Helmet><title>My Training | SeaMinds</title></Helmet>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">My training</h1>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => navigate("/maritime-interview")}>AI interview practice</Button>
      </div>
      <div role="tablist" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 no-scrollbar">
        {TABS.map(([k, label, n]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setParams(k === "required" ? {} : { tab: k }, { replace: true })}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${tab === k ? "border-primary bg-primary text-primary-foreground" : "border-primary/40 text-primary"}`}>
            {label}{n > 0 && <span className={`ml-1.5 rounded-full px-1.5 text-[10px] ${tab === k ? "bg-background text-primary" : "bg-primary text-primary-foreground"}`}>{n}</span>}
          </button>
        ))}
      </div>
      {tab === "brain" ? <MaritimeMasterBrain /> : english ? <MaritimeEnglishLab /> : items === null ? <p className="text-muted-foreground">Loading…</p> : (
        <>
          {tab === "required" && (() => {
            const required = items.filter((i) => i.company?.trim() && i.status !== "completed" && i.token);
            return (
              <div className="space-y-2">
                {required.length === 0 && recs.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nothing required right now. Pick any module from the Matrix tab.</p>
                )}
                {required.map((i) => (
                  <div key={`req-${i.slug}`} className="flex items-center gap-3 rounded-xl border border-primary bg-card p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[10px] font-bold uppercase text-primary">Required · {i.company}</p>
                      <p className="text-sm font-semibold leading-snug">{i.title}</p>
                    </div>
                    <Button size="sm" className="shrink-0 rounded-lg font-bold" onClick={() => navigate(`/training/${i.token}`)}>{i.status === "opened" ? "Continue" : "Start"}</Button>
                  </div>
                ))}
                {recs.map((r) => (
                  <div key={`rec-${r.slug}`} className="flex items-center gap-3 rounded-xl border border-primary/40 bg-card p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">Recommended for you</p>
                      <p className="text-sm font-semibold leading-snug">{r.title}</p>
                    </div>
                    <Button size="sm" variant="outline" className="shrink-0 rounded-lg border-primary text-primary" disabled={busy === r.slug} onClick={() => start(r.slug)}>{busy === r.slug ? "…" : "Start"}</Button>
                  </div>
                ))}
              </div>
            );
          })()}
          {tab === "records" && items.length === 0 && <p className="text-sm text-muted-foreground">No training records yet.</p>}
          {tab === "records" && items.length > 0 && (
            <div className="space-y-4">
              {Object.entries(items.reduce<Record<string, LedgerItem[]>>((g, i) => {
                const k = i.company?.trim() || "";
                (g[k] ||= []).push(i);
                return g;
              }, {})).sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b))).map(([company, list]) => {
                const done = list.filter((i) => i.status === "completed").length;
                return (
                  <div key={company || "self"} className="rounded-xl border border-primary/30 bg-card p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-primary">{company ? `🏢 Assigned by ${company}` : "🧭 My own training"}</p>
                      <span className="text-xs text-muted-foreground">{done}/{list.length} done</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-border"><div className="h-full bg-primary" style={{ width: `${(done / list.length) * 100}%` }} /></div>
                    {list.map((i) => (
                      <div key={i.slug} className="rounded-lg border border-border p-3 flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm">{i.status === "completed" ? "✓ " : ""}{i.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {i.status === "completed" ? `Completed ${new Date(i.completed_at!).toLocaleDateString()} · ${i.quiz_correct}/${i.quiz_total}` : i.status === "opened" ? "In progress" : "Not started"}
                          </p>
                        </div>
                        {i.token && <Button size="sm" variant={i.status === "completed" ? "outline" : "default"} onClick={() => navigate(`/training/${i.token}`)}>{i.status === "completed" ? "Review" : i.status === "opened" ? "Continue" : "Start"}</Button>}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
          {tab === "matrix" && catalog.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-bold text-primary">Browse all training (optional)</h2>
              <div className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-card p-1" role="tablist">
                {([["TANKER", "Tanker"], ["DRY", "Dry cargo"], ["ALL", "All"]] as const).map(([k, label]) => (
                  <button key={k} role="tab" aria-selected={segment === k} onClick={() => setSegment(k)}
                    className={`rounded-lg py-2 text-xs font-bold ${segment === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{label}</button>
                ))}
              </div>
              {trainingMatrix(catalog, segment).map((g) => g.items.length > 0 && (
                <div key={g.tier} className="space-y-2">
                  <div><p className="text-sm font-bold">{g.label} · {g.items.filter((i) => i.status === "completed").length}/{g.items.length}</p><p className="text-xs text-muted-foreground">{g.hint}</p></div>
                  {g.items.map((c) => (
                    <div key={c.slug} className="rounded-lg border border-border bg-card p-3 flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{c.status === "completed" ? "✓ " : ""}{c.title}</p>
                        {c.media_url && <a href={c.media_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline"><ExternalLink size={11} />{c.media_label || "Official reference"}</a>}
                      </div>
                      <Button size="sm" variant={c.status === "completed" ? "outline" : "default"} disabled={busy === c.slug} onClick={() => openItem(c)}>
                        {busy === c.slug ? "…" : c.status === "completed" ? "Review" : c.status ? "Continue" : "Start"}
                      </Button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
};

const CrewTraining = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, isReady } = useAuth();
  const loading = !isReady;

  useEffect(() => {
    if (!loading && !user) navigate(`/join?next=${encodeURIComponent(token ? `/training/${token}` : "/training")}`, { replace: true });
  }, [loading, user, token, navigate]);

  return (
    <Shell
      onBack={() => (token ? navigate("/training", { replace: true }) : window.history.state?.idx > 0 ? navigate(-1) : navigate("/app", { replace: true }))}
      onQuit={token ? () => {
        if (window.confirm("Quit this module? Your unsaved answers will be cleared and you can restart it any time.")) navigate("/training", { replace: true });
      } : undefined}
    >
      {!user ? <p className="text-muted-foreground">Loading…</p> : token ? <Module token={token} /> : <MyTraining />}
      <p className="text-xs text-muted-foreground">Training is for learning and preparation; it is not an STCW certificate. <Link to="/app" className="text-primary underline">Open SeaMinds</Link></p>
    </Shell>
  );
};

export default CrewTraining;
