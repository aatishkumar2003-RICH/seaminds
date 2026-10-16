import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ChevronLeft, ExternalLink, Loader2, CheckCircle2, GraduationCap, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { openTraining, completeTraining, trainingLedger, recommendTraining, assignTraining, trainingError, type LedgerItem, type Recommendation } from "@/lib/training";

const Shell = ({ children, onBack }: { children: React.ReactNode; onBack: () => void }) => (
  <main className="min-h-screen bg-background text-foreground pb-12">
    <div className="mx-auto max-w-lg px-4 py-5 space-y-5">
      <Button variant="ghost" className="px-0 text-primary" onClick={onBack}><ChevronLeft /> Back</Button>
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
          <p className="text-sm text-muted-foreground">{result.correct}/{result.total} correct. This is saved in your SeaMinds training record and your next assessment can include these topics.</p>
          <Button onClick={() => navigate("/training")}>My training</Button>
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
  const [items, setItems] = useState<LedgerItem[] | null>(null);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [l, r] = await Promise.all([trainingLedger(null), recommendTraining(null, "", 4)]);
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

  return (
    <section className="space-y-5">
      <Helmet><title>My Training | SeaMinds</title></Helmet>
      <h1 className="text-2xl font-bold">My training</h1>
      {items === null ? <p className="text-muted-foreground">Loading…</p> : (
        <>
          {items.length > 0 && (
            <div className="space-y-2">
              {items.map((i) => (
                <div key={i.slug} className="rounded-lg border border-border bg-card p-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm">{i.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {i.status === "completed" ? `Completed ${new Date(i.completed_at!).toLocaleDateString()} · ${i.quiz_correct}/${i.quiz_total}` : i.status === "opened" ? "In progress" : "Assigned"}
                    </p>
                  </div>
                  {i.token && <Button size="sm" variant={i.status === "completed" ? "outline" : "default"} onClick={() => navigate(`/training/${i.token}`)}>{i.status === "completed" ? "Review" : "Open"}</Button>}
                </div>
              ))}
            </div>
          )}
          <h2 className="font-bold text-primary">Recommended for you</h2>
          {recs.length === 0 ? <p className="text-sm text-muted-foreground">No new recommendations. Complete your profile or an assessment for sharper suggestions.</p> : recs.map((r) => (
            <div key={r.slug} className="rounded-lg border border-primary/40 bg-card p-4 space-y-2">
              <p className="font-semibold">{r.title}</p>
              <p className="text-xs text-muted-foreground">{r.summary}</p>
              <p className="text-xs text-primary">{r.reasons.join(" · ")}</p>
              <Button size="sm" className="rounded-xl font-bold" disabled={busy === r.slug} onClick={() => start(r.slug)}>{busy === r.slug ? "Starting…" : "Start"}</Button>
            </div>
          ))}
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
    <Shell onBack={() => (token ? navigate("/training") : navigate(-1))}>
      {!user ? <p className="text-muted-foreground">Loading…</p> : token ? <Module token={token} /> : <MyTraining />}
      <p className="text-xs text-muted-foreground">Training is for learning and preparation; it is not an STCW certificate. <Link to="/app" className="text-primary underline">Open SeaMinds</Link></p>
    </Shell>
  );
};

export default CrewTraining;
