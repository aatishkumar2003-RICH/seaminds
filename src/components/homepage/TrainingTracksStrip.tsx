import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type Track = { slug: string; title: string; departments: string[]; is_new: boolean };

/** Live list of published training tracks — new courses appear automatically. */
const TrainingTracksStrip = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  useEffect(() => {
    let alive = true;
    supabase.rpc("public_training_tracks" as any, { p_limit: 24 } as any).then(({ data }) => {
      if (alive && Array.isArray(data)) setTracks(data as Track[]);
    });
    return () => { alive = false; };
  }, []);
  if (tracks.length === 0) return null;
  const loop = [...tracks, ...tracks];
  return (
    <section aria-label="Live training tracks" className="max-w-6xl mx-auto px-4 pt-2">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[11px] font-bold tracking-wider text-primary">🧠 LIVE TRAINING TRACKS · MARITIME BRAIN</h2>
        <Link to="/training" className="text-[11px] font-bold text-primary no-underline">ALL TRAINING →</Link>
      </div>
      <div className="sm-tape overflow-hidden rounded-xl border border-primary/30 bg-card/60">
        <div className="sm-tape-track flex w-max gap-2 p-2">
          {loop.map((t, i) => (
            <Link key={`${t.slug}-${i}`} to="/training" aria-hidden={i >= tracks.length}
              className="whitespace-nowrap rounded-full border border-primary/30 px-3 py-1 text-[11px] text-foreground no-underline hover:bg-primary/10">
              {t.is_new && <span className="mr-1 font-bold text-primary">✨ NEW</span>}{t.title}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrainingTracksStrip;
