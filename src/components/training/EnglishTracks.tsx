import { useMemo, useState } from "react";
import { MessageCircle, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SCENARIOS, type Dept, type Scenario } from "@/lib/maritimeEnglish";
import { tracksFor, buildExam, gradeExam, loadTracks, saveTracks, bestExam, shareText, PASS_MARK, type TrackId, type ExamResult } from "@/lib/englishTracks";
import type { HintLang } from "@/lib/maritimeEnglishHints";
import { Drill } from "@/components/training/MaritimeEnglishLab";

const byId = (id: string) => SCENARIOS.find((s) => s.id === id)!;

interface Props { dept: Dept; best: Record<string, number>; lang: HintLang | null; setLang: (l: HintLang | null) => void; onAttempt: (sc: Scenario, s: number) => void; onOpenLesson: (sc: Scenario) => void }

const EnglishTracks = ({ dept, best, lang, setLang, onAttempt, onOpenLesson }: Props) => {
  const tracks = useMemo(() => tracksFor(dept), [dept]);
  const [state, setState] = useState(loadTracks);
  const [exam, setExam] = useState<{ items: Scenario[]; step: number; scores: number[] } | null>(null);
  const [result, setResult] = useState<ExamResult | null>(null);
  const update = (s: typeof state) => { setState(s); saveTracks(s); };
  const track = tracks.find((t) => t.id === state.active) ?? null;

  const startExam = () => { setResult(null); setExam({ items: buildExam(dept, best), step: 0, scores: [] }); };

  if (exam && track) {
    const sc = exam.items[exam.step];
    return <Drill key={`exam-${exam.step}-${sc.id}`} sc={sc} isDaily={false} lang={lang} setLang={setLang}
      onBack={() => setExam(null)}
      onDone={(s) => { onAttempt(sc, s); setExam((e) => e && ({ ...e, scores: [...e.scores.slice(0, e.step), s] })); }}
      exam={{ step: exam.step + 1, total: exam.items.length, onNext: () => {
        if (exam.step + 1 < exam.items.length) return setExam({ ...exam, step: exam.step + 1 });
        const r = gradeExam(track.id, exam.items.map((it, i) => ({ sc: it, score: exam.scores[i] ?? 0 })));
        update({ ...state, exams: [...state.exams, r].slice(-50) }); setExam(null); setResult(r);
      } }} />;
  }

  if (result && track) {
    const text = shareText(result, track);
    return (
      <div className="rounded-2xl border-2 border-primary bg-card p-5 space-y-3 text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-primary">SeaMinds Maritime English · Score card</p>
        <p className="text-sm font-semibold">{track.icon} {track.label}</p>
        <p className="text-5xl font-bold text-primary">{result.score}<span className="text-lg text-muted-foreground">%</span></p>
        <p className="font-bold">{result.passed ? "✅ PASSED — track complete" : `Not yet — pass mark is ${PASS_MARK}%`}</p>
        <p className="text-xs text-muted-foreground">{new Date(result.date).toLocaleString()}</p>
        {result.weak.length > 0 && (
          <div className="text-left rounded-xl bg-background border border-border p-3 space-y-2">
            <p className="text-xs font-bold text-primary">Practise these, then retake anytime:</p>
            {result.weak.map((id) => <button key={id} type="button" onClick={() => { setResult(null); onOpenLesson(byId(id)); }} className="block text-sm underline text-left">{byId(id).title}</button>)}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button asChild className="rounded-xl font-bold"><a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} /> WhatsApp</a></Button>
          <Button variant="outline" className="rounded-xl" onClick={async () => { try { await navigator.clipboard.writeText(text); toast.success("Score card copied"); } catch { toast.error("Could not copy"); } }}><Copy size={16} /> Copy</Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="rounded-xl" onClick={startExam}>Retake (new questions)</Button>
          <Button variant="ghost" className="rounded-xl text-primary" onClick={() => setResult(null)}>Back to my class</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-primary">🗓️ Choose your class — when do you join?</p>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {tracks.map((t) => {
            const b = bestExam(state, t.id);
            return (
              <button key={t.id} type="button" onClick={() => update({ ...state, active: t.id })}
                className={`rounded-xl border p-2 text-left ${state.active === t.id ? "border-primary bg-primary/15" : "border-primary/30 bg-card"}`}>
                <p className="text-lg">{t.icon}</p>
                <p className="text-xs font-bold leading-tight">{t.label}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{t.who}</p>
                {b && <p className="text-[10px] font-bold text-primary mt-1">{b.passed ? "✓ Passed" : "Best"} {b.score}%</p>}
              </button>
            );
          })}
        </div>
      </div>

      {track && (() => {
        const all = track.days.flatMap((d) => d.lessons);
        const done = all.filter((id) => best[id] !== undefined).length;
        const b = bestExam(state, track.id);
        return (
          <div className="rounded-2xl border border-primary/40 bg-card p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-primary">{track.icon} {track.label}</span>
              <span className="text-muted-foreground">{done}/{all.length} lessons</span>
            </div>
            <div className="h-2 rounded-full bg-border overflow-hidden"><div className="h-full bg-primary" style={{ width: `${Math.round((done / all.length) * 100)}%` }} /></div>
            <Button className="w-full rounded-xl font-bold" onClick={startExam}>📝 {b ? "Retake" : "Take"} self-assessment now · 3 questions</Button>
            <p className="text-[11px] text-muted-foreground text-center">Open anytime, unlimited retakes. Pass {PASS_MARK}% to complete this class. Questions match your rank and change every time.{b ? ` Best: ${b.score}%${b.passed ? " ✓" : ""}` : ""}</p>
            {track.days.map((d, i) => (
              <div key={i} className="space-y-1.5">
                <p className="text-xs font-bold">Day {i + 1} · {d.title}</p>
                {d.lessons.map((id) => {
                  const sc = byId(id); const s = best[id];
                  return (
                    <button key={id} type="button" onClick={() => onOpenLesson(sc)} className="w-full flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-left">
                      <span className="text-sm">{s !== undefined ? "✓" : "▶"} {sc.title}</span>
                      <span className="text-xs font-bold text-primary">{s !== undefined ? `${s}` : "Start"}</span>
                    </button>
                  );
                })}
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">Go at your own pace — finish all days in one sitting if you fly soon.</p>
          </div>
        );
      })()}
    </div>
  );
};

export default EnglishTracks;
