import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, ChevronLeft, CircleHelp, Copy, FileCheck2, Globe2, GraduationCap, Headphones, LifeBuoy, Maximize2, Minimize2, Pause, Play, Search, ShieldCheck, Ship, SlidersHorizontal, Trophy, Users, Volume2, VolumeX, Clock3 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import SupportCenter from "@/components/SupportCenter";
import { guideAudiences, guideLessons } from "@/components/guide/guideLessons";
import { guideLink, guideRoleFromProfiles, guideStep, parseGuideRole, type GuideRole } from "@/lib/userGuide";
import seamindsLogo from "@/assets/seaminds-logo.png";

const icons: Record<string, LucideIcon> = { profile: Users, certificate: FileCheck2, world: Globe2, score: Trophy, interview: Headphones, training: GraduationCap, rest: Clock3, privacy: ShieldCheck, tools: SlidersHorizontal, help: LifeBuoy, manager: Ship, vacancy: FileCheck2, staff: Ship };

export default function UserGuide() {
  const { user, isReady } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [detectedRole, setDetectedRole] = useState<GuideRole>("crew");
  const [detecting, setDetecting] = useState(true);
  const [search, setSearch] = useState("");
  const [presenting, setPresenting] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const touch = useRef<number | null>(null);
  const role = parseGuideRole(params.get("role")) ?? detectedRole;
  const lessons = guideLessons[role];
  const lesson = lessons.find(l => l.id === params.get("section")) ?? lessons[0];
  const stepIndex = guideStep(params.get("step"), lesson.steps.length);
  const step = lesson.steps[stepIndex];
  const lessonIndex = lessons.indexOf(lesson);
  const Icon = icons[lesson.icon] ?? BookOpen;
  const matching = lessons.filter(l => `${l.title} ${l.subtitle} ${l.steps.map(s => s.text).join(" ")} ${l.tips.flat().join(" ")}`.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    if (!isReady) return;
    let active = true;
    setDetecting(true);
    if (!user) { setDetectedRole("crew"); setDetecting(false); return; }
    // Public help personalisation only, never workspace authorization.
    Promise.all([
      supabase.from("manager_profiles").select("id").eq("user_id", user.id).maybeSingle(),
      supabase.from("fleet_staff_members").select("status").eq("user_id", user.id).maybeSingle(),
    ]).then(([manager, staff]) => {
      if (!active) return;
      setDetectedRole(guideRoleFromProfiles(!!manager.data, !!staff.data));
      if (manager.error || staff.error) toast.info("Choose your guide audience if your account could not be matched.");
      setDetecting(false);
    }).catch(() => { if (active) { setDetecting(false); toast.info("Choose your guide audience to continue."); } });
    return () => { active = false; };
  }, [isReady, user?.id]);

  const choose = useCallback((audience: GuideRole, section: string, index = 0) => {
    setParams({ role: audience, section, step: String(index) });
    setPlaying(false);
  }, [setParams]);
  const move = useCallback((direction: number) => {
    if (direction > 0 && stepIndex === lesson.steps.length - 1) {
      const next = lessons[lessonIndex + 1];
      if (next) setParams({ role, section: next.id, step: "0" });
      else setPlaying(false);
    } else if (direction < 0 && stepIndex === 0) {
      const previous = lessons[lessonIndex - 1];
      if (previous) setParams({ role, section: previous.id, step: String(previous.steps.length - 1) });
    } else setParams({ role, section: lesson.id, step: String(stepIndex + direction) });
  }, [lesson, lessonIndex, lessons, role, setParams, stepIndex]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => move(1), 18000);
    return () => window.clearTimeout(timer);
  }, [playing, move]);
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (!presenting || helpOpen || imageOpen || (event.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName))) return;
      if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
      if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
      if (event.key === "Escape") { setPresenting(false); setPlaying(false); }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [presenting, move, helpOpen, imageOpen]);
  useEffect(() => {
    setSpeaking(false);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    return () => { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); };
  }, [role, lesson.id, stepIndex]);
  useEffect(() => {
    const changed = () => { if (!document.fullscreenElement) { setPresenting(false); setPlaying(false); } };
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);
  const present = async () => {
    if (presenting) {
      setPresenting(false); setPlaying(false);
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    } else {
      setPresenting(true);
      try { await stage.current?.requestFullscreen(); } catch { /* Expanded view works without native fullscreen. */ }
    }
  };
  const narrate = () => {
    if (!("speechSynthesis" in window)) { toast.info("Audio narration is not available in this browser."); return; }
    window.speechSynthesis.cancel();
    if (speaking) { setSpeaking(false); return; }
    setPlaying(false);
    const speech = new SpeechSynthesisUtterance(`${lesson.title}. Step ${stepIndex + 1}. ${step.title}. ${step.text}`);
    speech.lang = "en"; speech.rate = 0.95;
    speech.onend = speech.onerror = () => setSpeaking(false);
    setSpeaking(true); window.speechSynthesis.speak(speech);
  };
  const share = async () => {
    try { await navigator.clipboard.writeText(guideLink(window.location.origin, role, lesson.id, stepIndex)); toast.success("This guide step's link copied"); }
    catch { toast.error("Could not copy. Share the address from your browser instead."); }
  };
  const finished = stepIndex === lesson.steps.length - 1 && lessonIndex === lessons.length - 1;

  return (
    <div ref={stage} className={`bg-background text-foreground ${presenting ? "fixed inset-0 z-[60] overflow-y-auto" : "min-h-screen"}`}>
      <Helmet><title>SeaMinds User Guide | Crew, ShipManagers & Staff</title><meta name="description" content="SeaMinds interactive user guide: CVs, certificate expiry, jobs, competency scores, training and recruitment. Visual lessons and seminar presentation mode." /><meta property="og:title" content="SeaMinds Interactive User Guide" /><meta property="og:description" content="Visual walkthroughs for seafarers, ShipManagers and ship management staff." /><meta property="og:type" content="website" /><meta name="twitter:card" content="summary" /></Helmet>
      <header className="border-b border-border"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-8">
        <div className="flex min-w-0 items-center gap-3"><Button variant="ghost" size="icon" aria-label={presenting ? "Exit presentation" : "Back to SeaMinds"} title="Back" onClick={() => presenting ? present() : navigate("/")}><ChevronLeft /></Button><Link to="/" className="flex items-center gap-2"><img src={seamindsLogo} className="h-8 w-8 object-contain" alt="SeaMinds" /><span className="text-base font-semibold sm:text-lg">SeaMinds <span className="hidden font-normal text-muted-foreground sm:inline">/ User guide</span></span></Link></div>
        <Button variant="outline" onClick={async () => { setPlaying(false); if (presenting) await present(); setHelpOpen(true); }} className="shrink-0 border-primary/40 text-primary"><LifeBuoy /><span className="hidden sm:inline">AI Help Center</span><span className="sm:hidden">Help</span></Button>
      </div></header>
      <main className="mx-auto max-w-7xl px-4 pb-8 sm:px-8">
        {!presenting && <div className="flex flex-wrap items-end justify-between gap-5 pb-6 pt-8 sm:pt-10"><div><p className="mb-2 text-xs font-semibold uppercase tracking-normal text-primary">THE SEAMINDS FIELD GUIDE</p><h1 className="text-3xl font-semibold sm:text-4xl">Your next step, made clear.</h1><p className="mt-3 text-sm text-muted-foreground">{guideAudiences[role].description}</p></div><div className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" />Public walkthroughs · No personal records</div></div>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-4">
          <div role="tablist" aria-label="Guide audience" className="flex w-full gap-1 rounded-lg bg-secondary p-1 sm:w-auto">{(Object.keys(guideAudiences) as GuideRole[]).map(r => <Button key={r} variant={r === role ? "default" : "ghost"} role="tab" aria-selected={r === role} onClick={() => { choose(r, guideLessons[r][0].id); setSearch(""); }} className="h-auto min-h-10 min-w-0 flex-1 whitespace-normal px-3 text-xs sm:text-sm">{guideAudiences[r].label}</Button>)}</div>
          <div className="flex items-center gap-1"><Button variant="ghost" size="icon" title="Copy this step's link" aria-label="Copy guide link" onClick={share}><Copy /></Button><Button variant="ghost" size="icon" title={speaking ? "Stop narration" : "Listen to this step (browser voice)"} aria-label={speaking ? "Stop narration" : "Listen to this step"} onClick={narrate}>{speaking ? <VolumeX /> : <Volume2 />}</Button><Button variant="outline" onClick={present}>{presenting ? <Minimize2 /> : <Maximize2 />}{presenting ? "Exit" : "Present"}</Button></div>
        </div>
        {detecting && !params.get("role") && user && <p role="status" className="py-2 text-xs text-muted-foreground">Matching your guide to your account…</p>}
        <div className={`grid gap-6 pt-6 ${presenting ? "" : "lg:grid-cols-[250px_minmax(0,1fr)]"}`}>
          {!presenting && <aside className="min-w-0"><label className="relative mb-4 block"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Find a guide topic or problem" placeholder="Find a topic or problem" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></label><div className="mb-3 flex items-center justify-between text-xs text-muted-foreground"><span>{guideAudiences[role].short} collection</span><span>{lessons.length} topics</span></div><nav aria-label="Guide topics" className="flex gap-2 overflow-x-auto pb-3 lg:flex-col lg:overflow-visible lg:pb-0">{matching.map(l => { const TopicIcon = icons[l.icon] ?? BookOpen; return <Button key={l.id} variant="ghost" aria-current={l.id === lesson.id ? "step" : undefined} onClick={() => choose(role, l.id)} className={`h-auto min-h-12 shrink-0 justify-start whitespace-normal rounded-lg px-3 py-3 text-left text-sm lg:w-full ${l.id === lesson.id ? "border border-primary/40 bg-primary/10 text-primary" : "border border-transparent text-muted-foreground"}`}><TopicIcon /><span>{l.title}</span></Button>; })}</nav>{matching.length === 0 && <div className="space-y-3 py-4 text-sm text-muted-foreground"><p>No matching guide topic.</p><Button variant="link" onClick={() => setHelpOpen(true)}>Ask DORA instead <ArrowRight /></Button></div>}<p className="mt-5 hidden border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground lg:block">Updated 17 October 2026<br />Public lessons never grant workspace access.</p></aside>}
          <section className="min-w-0" aria-label="Interactive walkthrough">
            <div className="mb-5 flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span><div><h2 className="text-lg font-semibold">{lesson.title}</h2><p className="text-xs text-muted-foreground">{lesson.subtitle}</p></div></div><span className="shrink-0 text-xs text-muted-foreground">{String(lessonIndex + 1).padStart(2, "0")} / {String(lessons.length).padStart(2, "0")}</span></div>
            {role === "staff" && <p className="mb-4 border-l-2 border-primary bg-primary/10 px-4 py-3 text-sm text-primary">Under development & testing — not all modules are operational.</p>}
            <div className="overflow-hidden rounded-lg border border-border bg-card" onTouchStart={e => { touch.current = e.touches[0].clientX; }} onTouchEnd={e => { if (touch.current !== null && Math.abs(e.changedTouches[0].clientX - touch.current) > 65) { setPlaying(false); move(e.changedTouches[0].clientX < touch.current ? 1 : -1); } touch.current = null; }}>
              <div className="flex items-center justify-between border-b border-border px-5 py-3"><span className="text-xs font-medium text-primary">WALKTHROUGH</span><div className="flex items-center gap-3"><span className="text-xs text-muted-foreground">Step {stepIndex + 1} of {lesson.steps.length}</span><Button variant="ghost" size="icon" className="h-8 w-8" title={playing ? "Pause automatic steps" : "Play automatic steps (18 seconds each)"} aria-label={playing ? "Pause walkthrough" : "Play walkthrough"} onClick={() => setPlaying(!playing)}>{playing ? <Pause /> : <Play />}</Button></div></div>
              <div key={`${role}-${lesson.id}-${stepIndex}`} className={`guide-step-enter p-5 sm:p-8 ${presenting ? "min-h-[380px]" : "min-h-[310px]"}`} aria-live="polite"><div className="mb-6 flex items-center gap-3"><span className="text-5xl font-light text-primary/70">{String(stepIndex + 1).padStart(2, "0")}</span><span className="h-px flex-1 bg-border" /><span className="text-xs text-muted-foreground">{guideAudiences[role].short}</span></div><h3 className={`max-w-3xl font-semibold leading-tight ${presenting ? "text-3xl sm:text-5xl" : "text-2xl sm:text-3xl"}`}>{step.title}</h3><p className={`mt-5 max-w-3xl leading-relaxed text-secondary-foreground ${presenting ? "text-lg sm:text-2xl" : "text-base sm:text-lg"}`}>{step.text}</p></div>
              <div className="flex items-center gap-1 px-5 pb-5 sm:px-8" aria-label="Walkthrough steps">{lesson.steps.map((s, i) => <Button key={s.title} variant="ghost" size="sm" title={s.title} aria-label={`Step ${i + 1}: ${s.title}`} aria-current={i === stepIndex ? "step" : undefined} onClick={() => choose(role, lesson.id, i)} className={`h-8 min-w-0 flex-1 rounded-sm px-0 ${i === stepIndex ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-secondary text-muted-foreground"}`}>{i + 1}</Button>)}</div><div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3"><Button variant="ghost" disabled={lessonIndex === 0 && stepIndex === 0} onClick={() => { setPlaying(false); move(-1); }}><ArrowLeft /><span className="hidden sm:inline">Previous</span></Button><Button variant="ghost" className="text-primary" onClick={() => { setPlaying(false); move(1); }} disabled={finished}>{stepIndex === lesson.steps.length - 1 ? "Next topic" : "Next step"}<ArrowRight /></Button></div>
            </div>
            {!presenting && <><div className="flex flex-wrap items-center gap-3 py-5"><Button asChild className="max-w-full whitespace-normal"><Link to={lesson.href}>{lesson.action}<ArrowRight /></Link></Button>{lesson.image && <Button variant="outline" onClick={() => setImageOpen(true)}><Maximize2 />View actual screen</Button>}</div>{lesson.image && <figure className="mb-5 border-l-2 border-primary/40 pl-4"><Button variant="ghost" className="h-auto w-full justify-start rounded-lg p-0" onClick={() => setImageOpen(true)} aria-label={`Enlarge ${lesson.title} screenshot`}><img src={lesson.image} alt={lesson.imageAlt} loading="lazy" className="max-h-56 w-full rounded-lg object-contain object-left" /></Button><figcaption className="mt-2 text-xs text-muted-foreground">Actual SeaMinds screen · no personal records shown</figcaption></figure>}<details className="group border-y border-border"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-4 text-sm font-semibold"><span className="flex items-center gap-2"><CircleHelp className="h-4 w-4 text-primary" />Something not working?</span><ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" /></summary><div className="space-y-4 pb-5">{lesson.tips.map(([q, a]) => <div key={q}><h4 className="text-sm font-semibold">{q}</h4><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{a}</p></div>)}<Button variant="link" className="h-auto px-0" onClick={() => setHelpOpen(true)}>Still stuck? Ask DORA <ArrowRight /></Button></div></details><p className="mt-4 flex gap-2 text-xs leading-relaxed text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{lesson.note}</p></>}
          </section>
        </div>
        {!presenting && <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5 text-xs text-muted-foreground"><span>SeaMinds · A clear course forward.</span><div className="flex gap-4"><Link to="/terms" className="hover:text-primary">Terms</Link><Link to="/privacy" className="hover:text-primary">Privacy</Link><a href="mailto:support@seaminds.life" className="hover:text-primary">Human support</a></div></footer>}
      </main>
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}><DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto p-4"><DialogTitle className="pr-8">DORA AI Help Center</DialogTitle><DialogDescription>Get help, then raise a support request if needed.</DialogDescription>{user ? <SupportCenter sourceScreen="guide" onBack={() => setHelpOpen(false)} /> : <div className="space-y-4 py-4"><p className="text-sm text-muted-foreground">Sign in to ask DORA and track support requests. Every guide is available without signing in.</p><Button asChild><Link to={`/join?next=${encodeURIComponent(`/guide?${params.toString()}`)}`}>Sign in for DORA <ArrowRight /></Link></Button><p className="text-sm"><a className="text-primary underline" href="mailto:support@seaminds.life">Email support@seaminds.life</a></p><p className="text-xs text-muted-foreground">Never share passwords, OTP codes or private wellness messages.</p></div>}</DialogContent></Dialog>
      <Dialog open={imageOpen} onOpenChange={setImageOpen}><DialogContent className="max-h-[92dvh] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto"><DialogTitle>{lesson.title} — actual screen</DialogTitle><DialogDescription>Privacy-safe screenshot captured from SeaMinds on 17 October 2026.</DialogDescription>{lesson.image && <img src={lesson.image} alt={lesson.imageAlt} className="w-full rounded-lg" />}</DialogContent></Dialog>
    </div>
  );
}