import { useEffect, useState, lazy, Suspense } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ChevronLeft, FileText, Zap, Anchor, ArrowRight, Loader2 } from "lucide-react";

const CvUpload = lazy(() => import("@/components/CvUpload"));
const QuickProfile = lazy(() => import("@/pages/QuickProfile"));
const LANG_LABEL: Record<string, string> = {
  en: "English", vi: "Tiếng Việt", tl: "Tagalog", hi: "हिन्दी", id: "Bahasa Indonesia",
};

const InterviewInvite = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const { user, isReady } = useAuth();
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const prepare = search.get("prepare");
  const round2 = search.get("round") === "2";

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        if (!token) return;
        const { data, error } = await supabase.rpc("get_interview_by_token" as any, { p_token: token });
        if (active) setInfo(error ? { ok: false, error: "Could not load this invitation. Please try again." } : data);
      } catch {
        if (active) setInfo({ ok: false, error: "Could not load this invitation. Please try again." });
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [token]);

  const choose = (path: "cv" | "quick") => {
    if (!token) return;
    const params = new URLSearchParams({ prepare: path });
    if (round2) params.set("round", "2");
    const dest = `/interview/${encodeURIComponent(token)}?${params}`;
    if (!user) { navigate(`/join?next=${encodeURIComponent(dest)}`); return; }
    setSearch(params);
  };
  const startInterview = () => navigate(`/interview/${token}/exam${round2 ? "?round=2" : ""}`, { replace: true });
  const changeChoice = () => setSearch(round2 ? { round: "2" } : {});

  return (
    <main className="min-h-screen bg-background text-foreground pb-10">
      <Helmet>
        <title>{info?.ok ? `${info.company} Crew Assessment | SeaMinds` : "Crew Assessment | SeaMinds"}</title>
        <meta name="description" content="Prepare your profile with a CV photo, PDF or Quick Profile, then take your invited SeaMinds crew interview." />
      </Helmet>
      <div className="mx-auto max-w-lg px-4 py-6 space-y-6">
        <Button variant="ghost" className="px-0 text-primary" onClick={() => prepare ? changeChoice() : navigate(-1)}>
          <ChevronLeft /> Back
        </Button>
        {loading || !isReady ? (
          <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="animate-spin" size={18} /> Loading invitation…</p>
        ) : !info?.ok ? (
          <section className="space-y-4">
            <Anchor className="text-primary" size={36} />
            <h1 className="text-xl font-bold">{info?.error || "This interview link is not valid."}</h1>
            <p className="text-sm text-muted-foreground">Ask the company for a new link, or browse live vacancies on SeaMinds.</p>
            <Button onClick={() => navigate("/feed")}>See live jobs <ArrowRight /></Button>
          </section>
        ) : info.already_done && !round2 ? (
          <section className="space-y-4">
            <h1 className="text-xl font-bold">You have completed this interview</h1>
            <p className="text-sm text-muted-foreground">{info.company} can see your result.</p>
            <Button onClick={() => navigate(`/interview/${token}/exam`)}>Open interview result <ArrowRight /></Button>
          </section>
        ) : (
          <>
            <header className="space-y-3">
              <Anchor size={32} className="text-primary" />
              <h1 className="text-2xl font-bold break-words">{info.company} Crew Assessment</h1>
              <p className="text-sm text-muted-foreground">Position: <strong className="text-foreground">{info.rank}</strong>{info.vessel ? ` · Vessel: ${info.vessel}` : ""}</p>
              <p className="text-xs text-muted-foreground">{LANG_LABEL[info.language] || "English"} · Maritime English assessed separately</p>
            </header>
            {user && (prepare === "cv" || prepare === "quick") ? (
              <section className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-bold text-primary">{prepare === "cv" ? "Scan your CV" : "Quick Profile"}</h2>
                  {!round2 && <Button variant="link" className="px-0" onClick={changeChoice}>Change option</Button>}
                </div>
                <p className="text-sm text-muted-foreground">Confirm and save your details to continue to your interview with {info.company}.</p>
                <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
                  {prepare === "cv" ? <CvUpload onParsed={startInterview} /> : <QuickProfile embedded onComplete={startInterview} />}
                </Suspense>
              </section>
            ) : (
              <section className="space-y-4">
                <h2 className="text-lg font-semibold">Choose how to prepare your profile</h2>
                <article className="rounded-lg border border-primary/50 bg-card p-5 space-y-3">
                  <div className="flex items-center gap-2 text-primary"><FileText size={22} /><h3 className="font-bold">AI CV Scan</h3><span className="ml-auto text-xs">Recommended</span></div>
                  <p className="text-sm text-muted-foreground">Take a clear photo or upload your CV PDF. SeaMinds AI extracts your sea time, vessels and certificates for you to confirm — no retyping your CV.</p>
                  <Button className="w-full h-auto py-3 whitespace-normal rounded-xl font-bold" onClick={() => choose("cv")}><FileText /> Upload or Scan My CV <ArrowRight /></Button>
                </article>
                {!round2 && <article className="rounded-lg border border-border bg-card p-5 space-y-3">
                  <div className="flex items-center gap-2 text-primary"><Zap size={22} /><h3 className="font-bold">1-Minute Quick Profile</h3></div>
                  <p className="text-sm text-muted-foreground">No CV file on your phone? Select your rank, sea time and vessel types, then answer a few short experience questions.</p>
                  <Button variant="outline" className="w-full h-auto py-3 whitespace-normal rounded-xl border-primary text-primary" onClick={() => choose("quick")}><Zap /> Fill Quick Profile <ArrowRight /></Button>
                </article>}
                <p className="text-sm text-muted-foreground">Once your profile is saved, you can start your interview. {round2 ? "A CV is required for this manager-requested round." : "No CV is required for Quick Profile."}</p>
                {!user && <p className="text-xs text-muted-foreground">Create your free account or sign in next. Your invitation stays with you.</p>}
              </section>
            )}
            <footer className="border-t border-border pt-4 space-y-2 text-xs text-muted-foreground">
              <p>Free for crew. Your profile stays in your SeaMinds account.</p>
              <p>AI extraction is not independent verification. Interview scoring follows the company's assessment round.</p>
            </footer>
          </>
        )}
      </div>
    </main>
  );
};
export default InterviewInvite;
