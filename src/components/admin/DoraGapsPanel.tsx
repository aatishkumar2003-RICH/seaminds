import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Row = { id: string; summary: string; hit_count: number; status: string; last_seen: string };

export default function DoraGapsPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const load = () =>
    supabase.from("dora_unanswered_clusters").select("id,summary,hit_count,status,last_seen")
      .eq("status", "OPEN").order("hit_count", { ascending: false }).limit(30)
      .then(({ data }) => setRows((data as Row[]) ?? []));
  useEffect(() => { load(); }, []);
  const mark = async (id: string, status: string) => {
    await supabase.from("dora_unanswered_clusters").update({ status }).eq("id", id);
    load();
  };
  return (
    <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-2">
      <h3 className="text-sm font-bold text-foreground">DORA — questions with no help article</h3>
      {rows.length === 0 && <p className="text-xs text-muted-foreground">No open gaps yet.</p>}
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-2 text-xs">
          <span className="font-bold text-primary w-8">{r.hit_count}×</span>
          <span className="flex-1 text-foreground">{r.summary}</span>
          <button className="text-primary underline" onClick={() => mark(r.id, "ARTICLE_ADDED")}>Article added</button>
          <button className="text-muted-foreground underline" onClick={() => mark(r.id, "IGNORED")}>Ignore</button>
        </div>
      ))}
    </div>
  );
}
