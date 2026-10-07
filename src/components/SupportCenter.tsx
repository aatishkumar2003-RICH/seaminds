import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, Copy, LifeBuoy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CATEGORIES = [
  { value: "ASSESSMENT", label: "Assessment / SeaMinds Score" },
  { value: "CV_BUILDER", label: "CV / Certificates" },
  { value: "INTERVIEW", label: "Interview" },
  { value: "AUTH", label: "Login / Account" },
  { value: "SYSTEM", label: "App / Other" },
] as const;

interface MyTicket { ticket_ref: string; category: string; status: string; subject: string; created_at: string }

interface Props { sourceScreen: string; onBack: () => void }

const newId = () => crypto.randomUUID();

export default function SupportCenter({ sourceScreen, onBack }: Props) {
  const { user } = useAuth();
  const submissionId = useRef<string>(newId());
  const [category, setCategory] = useState<string>("SYSTEM");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticketRef, setTicketRef] = useState<string | null>(null);
  const [tickets, setTickets] = useState<MyTicket[]>([]);

  const loadTickets = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("support_tickets")
      .select("ticket_ref, category, status, subject, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setTickets((data as MyTicket[]) ?? []);
  }, [user]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  const submit = async () => {
    if (!subject.trim() || !description.trim()) { setError("Please add a subject and describe the problem."); return; }
    setSending(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("support-submit", {
        body: {
          submission_id: submissionId.current,
          category,
          subject: subject.trim(),
          description: description.trim(),
          contact_email: email.trim() || null,
          contact_whatsapp: whatsapp.trim() || null,
          route_pathname: `/app/${sourceScreen.replace(/[^a-z]/gi, "")}`,
          client_build: null,
        },
      });
      if (fnError) {
        // deno-lint-ignore no-explicit-any
        const ctx = (fnError as any).context as Response | undefined;
        const status = ctx?.status;
        let code = "";
        try { code = (await ctx?.json())?.error ?? ""; } catch { /* ignore */ }
        if (status === 401 || code === "AUTH_INVALID") setError("Your session has expired. Please sign in again, then tap Send — your report will not be duplicated.");
        else if (status === 429 || code === "RATE_LIMITED") setError("Too many reports were sent recently. Please wait a while and try again.");
        else if (status === 409 || code === "SUBMISSION_CONFLICT") setError("This report could not be matched to your account. Please sign in again and retry.");
        else setError("Could not send right now (poor connection?). Tap Send again — it will not create a duplicate.");
        return;
      }
      if (!data?.ok || !data?.ticket_ref) { setError("Could not send right now. Tap Send again — it will not create a duplicate."); return; }
      setTicketRef(data.ticket_ref);
      submissionId.current = newId();
      setSubject(""); setDescription("");
      loadTickets();
    } catch {
      setError("Could not send right now (poor connection?). Tap Send again — it will not create a duplicate.");
    } finally {
      setSending(false);
    }
  };

  const copyRef = async () => {
    if (!ticketRef) return;
    try { await navigator.clipboard.writeText(ticketRef); toast.success("Reference copied"); } catch { toast.error("Could not copy"); }
  };

  const labelFor = (c: string) => CATEGORIES.find((x) => x.value === c)?.label ?? c;

  return (
    <div className="mx-auto w-full max-w-xl space-y-5 px-4 py-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} aria-label="Back" className="flex h-9 w-9 items-center justify-center rounded-full text-primary hover:bg-secondary">
          <ChevronLeft size={22} />
        </button>
        <LifeBuoy size={20} className="text-primary" />
        <h1 className="text-lg font-bold text-foreground">Help & Support</h1>
      </div>

      <div className="rounded-xl border border-primary/30 bg-card p-3 text-xs leading-relaxed text-muted-foreground">
        Never send passwords, OTP codes, or wellness chat messages here. For an urgent safety problem or emergency, use the SOS button.
      </div>

      {ticketRef && (
        <div className="space-y-2 rounded-xl border border-primary/40 bg-card p-4 text-center">
          <p className="text-sm text-foreground">Your report was received. Keep this reference:</p>
          <p className="font-mono text-base font-bold tracking-wide text-primary break-all">{ticketRef}</p>
          <div className="flex justify-center gap-2">
            <Button size="sm" variant="outline" onClick={copyRef}><Copy size={14} className="mr-1" /> Copy</Button>
            <Button size="sm" variant="ghost" onClick={() => setTicketRef(null)}>New report</Button>
          </div>
        </div>
      )}

      {!ticketRef && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="space-y-1">
            <Label>What is it about?</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Subject</Label>
            <Input value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} placeholder="Short title" />
          </div>
          <div className="space-y-1">
            <Label>Describe the problem</Label>
            <Textarea value={description} maxLength={2000} rows={5} onChange={(e) => setDescription(e.target.value)} placeholder="What happened? What were you trying to do?" />
            <p className="text-right text-[10px] text-muted-foreground">{description.length}/2000</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Email (optional)</Label>
              <Input type="email" value={email} maxLength={254} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="space-y-1">
              <Label>WhatsApp (optional)</Label>
              <Input type="tel" value={whatsapp} maxLength={32} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+63…" />
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button className="w-full rounded-xl font-bold" disabled={sending} onClick={submit}>
            {sending ? "Sending…" : "Send"}
          </Button>
        </div>
      )}

      {user && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">My Support Requests</h2>
          {tickets.length === 0 ? (
            <p className="text-xs text-muted-foreground">No requests yet.</p>
          ) : tickets.map((t) => (
            <div key={t.ticket_ref} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm text-foreground">{t.subject}</span>
                <Badge variant="outline" className="shrink-0 text-[10px]">{t.status.replace("_", " ")}</Badge>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                <span className="font-mono">{t.ticket_ref}</span> · {labelFor(t.category)} · {new Date(t.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
