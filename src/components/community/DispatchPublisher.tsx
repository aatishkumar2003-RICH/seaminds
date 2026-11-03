import { useEffect, useState } from "react";
import { Camera, Youtube, Send, X, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DISPATCH_CATEGORIES, DispatchCategory, compressPhoto, normalizeYoutubeUrl } from "@/lib/crewDispatch";

type Mine = { id: string; title: string; category: string; created_at: string; photo_path: string | null; youtube_url: string | null };

const DispatchPublisher = ({ profileId }: { profileId: string }) => {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<DispatchCategory>("life_at_sea");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [youtube, setYoutube] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mine, setMine] = useState<Mine[]>([]);

  const loadMine = async () => {
    const { data } = await supabase
      .from("crew_dispatches")
      .select("id,title,category,created_at,photo_path,youtube_url")
      .eq("author_id", profileId)
      .order("created_at", { ascending: false })
      .limit(10);
    setMine((data as Mine[]) || []);
  };
  useEffect(() => { if (profileId) loadMine(); }, [profileId]);

  const reset = () => { setTitle(""); setBody(""); setYoutube(""); setPhoto(null); setConfirmed(false); };

  const submit = async () => {
    if (title.trim().length < 3) return toast.error("Add a short title");
    const yt = youtube.trim() ? normalizeYoutubeUrl(youtube) : null;
    if (youtube.trim() && !yt) return toast.error("Use a full YouTube link (https://youtube.com/… or youtu.be/…)");
    if (!confirmed) return toast.error("Please confirm the confidentiality check");
    setSaving(true);
    try {
      let photo_path: string | null = null;
      if (photo) {
        const blob = await compressPhoto(photo);
        photo_path = `${profileId}/${crypto.randomUUID()}.webp`;
        const { error } = await supabase.storage.from("crew-dispatches").upload(photo_path, blob, { contentType: "image/webp" });
        if (error) throw error;
      }
      const { error } = await supabase.from("crew_dispatches").insert({
        category, title: title.trim(), body: body.trim(), youtube_url: yt, photo_path, confidentiality_confirmed: true,
      } as never);
      if (error) throw error;
      toast.success("Dispatch shared ⚓");
      reset(); setOpen(false); loadMine();
    } catch (e) {
      toast.error((e as Error).message || "Could not share dispatch");
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("crew_dispatches").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setMine((m) => m.filter((x) => x.id !== id));
  };

  return (
    <div className="bg-card rounded-2xl border border-primary/30 p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Voice of the Sea</p>
          <p className="text-sm font-medium text-foreground">Share your moment from ship or shore</p>
        </div>
        <button onClick={() => setOpen(true)} className="flex items-center gap-1 bg-primary text-primary-foreground text-sm font-bold rounded-xl px-3 py-2">
          <Plus size={16} /> Share
        </button>
      </div>

      {mine.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">My dispatches</p>
          {mine.map((d) => {
            const c = DISPATCH_CATEGORIES.find((x) => x.id === d.category);
            return (
              <div key={d.id} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2">
                <span>{c?.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{d.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(d.created_at).toLocaleDateString()} {d.photo_path ? "· 📷" : ""} {d.youtube_url ? "· ▶️" : ""}
                  </p>
                </div>
                <button aria-label="Delete dispatch" onClick={() => remove(d.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-card border border-primary/30 rounded-t-2xl sm:rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">New Dispatch</h2>
              <button aria-label="Close" onClick={() => setOpen(false)} className="text-muted-foreground"><X size={20} /></button>
            </div>
            <p className="text-[11px] text-muted-foreground">Your rank and vessel type are added from your profile automatically.</p>

            <div className="flex flex-wrap gap-2">
              {DISPATCH_CATEGORIES.map((c) => (
                <button key={c.id} onClick={() => setCategory(c.id)}
                  className={`text-xs rounded-full px-3 py-1.5 border ${category === c.id ? "bg-primary text-primary-foreground border-primary" : "border-border text-foreground"}`}>
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>

            <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 120))} placeholder="Title — e.g. Crossing Suez at sunrise"
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground" />
            <textarea value={body} onChange={(e) => setBody(e.target.value.slice(0, 3000))} rows={4} placeholder="Tell your story…"
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground" />

            <label className="flex items-center gap-2 border border-dashed border-border rounded-xl px-3 py-2 text-sm text-foreground cursor-pointer">
              <Camera size={16} className="text-primary" />
              <span className="truncate">{photo ? photo.name : "Add a photo (optional)"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
            </label>
            <div className="flex items-center gap-2 border border-border rounded-xl px-3 py-2">
              <Youtube size={16} className="text-primary" />
              <input value={youtube} onChange={(e) => setYoutube(e.target.value)} placeholder="YouTube or Shorts link (optional)"
                className="flex-1 bg-transparent text-sm text-foreground outline-none" />
            </div>

            <label className="flex items-start gap-2 text-xs text-foreground">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5" />
              I confirm this contains no confidential company documents, cargo manifests or other people's faces without consent.
            </label>

            <button disabled={saving} onClick={submit}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold rounded-xl py-3 disabled:opacity-60">
              <Send size={16} /> {saving ? "Sharing…" : "Share Dispatch"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DispatchPublisher;
