import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Lock, Search, Trash2, CalendarIcon } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import CountryPricingTab from "@/components/admin/CountryPricingTab";
import SubAdminsTab from "@/components/admin/SubAdminsTab";

const ADMIN_PIN = "215151";
const LS_KEY = "sm_admin_auth";

/* ─── PIN Screen ─── */
function PinScreen({ onAuth }: { onAuth: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === ADMIN_PIN) {
      localStorage.setItem(LS_KEY, ADMIN_PIN);
      onAuth();
    } else {
      setError("Incorrect PIN");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#0D1B2A" }}>
      <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4 w-80">
        <h1 className="text-2xl font-bold" style={{ color: "#D4AF37" }}>Enter Admin PIN</h1>
        <Input
          type="password"
          value={pin}
          onChange={(e) => { setPin(e.target.value); setError(""); }}
          placeholder="PIN"
          className="text-center border-2"
          style={{ borderColor: "#D4AF37", background: "#1B2838", color: "#D4AF37" }}
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <Button type="submit" className="w-full" style={{ background: "#D4AF37", color: "#0D1B2A" }}>
          Submit
        </Button>
      </form>
    </div>
  );
}

/* ─── Crew Search Tab ─── */
function CrewSearchTab() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editRow, setEditRow] = useState<any | null>(null);
  const [editPassport, setEditPassport] = useState("");
  const [editDob, setEditDob] = useState("");
  const [saving, setSaving] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    const q = query.trim();

    // Build OR filter
    let sb = supabase.from("crew_profiles").select("*");
    const filters = [
      `first_name.ilike.%${q}%`,
      `last_name.ilike.%${q}%`,
      `crew_unique_id.ilike.%${q}%`,
      `whatsapp_number.ilike.%${q}%`,
      `passport_number.ilike.%${q}%`,
    ];
    sb = sb.or(filters.join(","));

    const { data, error } = await sb.limit(50);
    if (error) {
      // Try DOB exact match as fallback
      const { data: dobData } = await supabase
        .from("crew_profiles")
        .select("*")
        .eq("date_of_birth", q)
        .limit(50);
      setResults(dobData || []);
    } else {
      setResults(data || []);
    }
    setLoading(false);
  };

  const openEdit = (row: any) => {
    setEditRow(row);
    setEditPassport(row.passport_number || "");
    setEditDob(row.date_of_birth || "");
  };

  const saveEdit = async () => {
    if (!editRow) return;
    setSaving(true);
    const { error } = await supabase
      .from("crew_profiles")
      .update({ passport_number: editPassport, date_of_birth: editDob || null })
      .eq("id", editRow.id);
    setSaving(false);
    if (error) {
      toast.error("Failed to update: " + error.message);
    } else {
      toast.success("Updated successfully");
      setEditRow(null);
      search();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Search by Name, Crew ID (SM-XXXX-XXXXX), WhatsApp, Passport No, or Date of Birth"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          style={{ background: "#1B2838", color: "#E0E0E0", borderColor: "#D4AF37" }}
        />
        <Button onClick={search} disabled={loading} style={{ background: "#D4AF37", color: "#0D1B2A" }}>
          <Search className="w-4 h-4 mr-1" /> Search
        </Button>
      </div>

      {loading && <p style={{ color: "#D4AF37" }}>Searching…</p>}

      <div className="grid gap-3 md:grid-cols-2">
        {results.map((r) => (
          <div key={r.id} className="rounded-lg p-4 border" style={{ background: "#1B2838", borderColor: "#D4AF3744" }}>
            <div className="flex justify-between items-start mb-2">
              <Badge style={{ background: "#D4AF37", color: "#0D1B2A" }}>{r.crew_unique_id || "No ID"}</Badge>
              <Button size="sm" variant="outline" onClick={() => openEdit(r)}
                style={{ borderColor: "#D4AF37", color: "#D4AF37" }}>
                Edit
              </Button>
            </div>
            <p className="font-semibold text-lg" style={{ color: "#E0E0E0" }}>
              {r.first_name} {r.last_name}
            </p>
            <div className="grid grid-cols-2 gap-1 text-sm mt-1" style={{ color: "#A0A0A0" }}>
              <span>Rank: {r.role}</span>
              <span>Ship: {r.ship_name}</span>
              <span>Nationality: {r.nationality}</span>
              <span>WhatsApp: {r.whatsapp_number}</span>
              <span>Vessel Type: {r.vessel_type || "—"}</span>
              <span>Years at Sea: {r.years_at_sea}</span>
              <span>Onboarded: {r.onboarded ? "✅" : "❌"}</span>
            </div>
          </div>
        ))}
      </div>

      {results.length === 0 && !loading && query && (
        <p style={{ color: "#A0A0A0" }}>No results found.</p>
      )}

      <Dialog open={!!editRow} onOpenChange={() => setEditRow(null)}>
        <DialogContent style={{ background: "#0D1B2A", borderColor: "#D4AF37" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "#D4AF37" }}>
              Edit {editRow?.first_name} {editRow?.last_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm" style={{ color: "#A0A0A0" }}>Passport Number</label>
              <Input value={editPassport} onChange={(e) => setEditPassport(e.target.value)}
                style={{ background: "#1B2838", color: "#E0E0E0", borderColor: "#D4AF37" }} />
            </div>
            <div>
              <label className="text-sm" style={{ color: "#A0A0A0" }}>Date of Birth (YYYY-MM-DD)</label>
              <Input value={editDob} onChange={(e) => setEditDob(e.target.value)}
                placeholder="1990-01-15"
                style={{ background: "#1B2838", color: "#E0E0E0", borderColor: "#D4AF37" }} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveEdit} disabled={saving} style={{ background: "#D4AF37", color: "#0D1B2A" }}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Pricing Tab ─── */
const PRICE_KEYS = [
  { key: "price_free", label: "Free Tier Price ($)" },
  { key: "price_pro", label: "Pro Tier Price ($/month)" },
  { key: "price_company", label: "Company Tier Price ($/month)" },
  { key: "price_company_annual", label: "Company Annual Plan ($)" },
  { key: "price_self_assessment", label: "Self Assessment ($)" },
  { key: "price_manager_assessment", label: "Manager Assessment ($)" },
  { key: "price_job_single", label: "Job Single ($)" },
  { key: "price_job_monthly", label: "Job Monthly ($)" },
  { key: "price_job_annual", label: "Job Annual ($)" },
];

function PricingTab() {
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("admin_settings").select("*");
      if (data) {
        const map: Record<string, string> = {};
        let latest = "";
        data.forEach((r) => {
          map[r.key] = r.value;
          if (r.updated_at && r.updated_at > latest) latest = r.updated_at;
        });
        setPrices(map);
        if (latest) setUpdatedAt(latest);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const now = new Date().toISOString();
    const rows = PRICE_KEYS.map((pk) => ({
      key: pk.key,
      value: prices[pk.key] || "0",
      updated_at: now,
    }));
    const { error } = await supabase.from("admin_settings").upsert(rows, { onConflict: "key" });
    setSaving(false);
    if (error) {
      toast.error("Failed: " + error.message);
    } else {
      toast.success("Prices saved");
      setUpdatedAt(now);
    }
  };

  return (
    <div className="max-w-md space-y-4">
      {PRICE_KEYS.map((pk) => (
        <div key={pk.key}>
          <label className="text-sm" style={{ color: "#A0A0A0" }}>{pk.label}</label>
          <Input
            type="number"
            value={prices[pk.key] || ""}
            onChange={(e) => setPrices((p) => ({ ...p, [pk.key]: e.target.value }))}
            style={{ background: "#1B2838", color: "#E0E0E0", borderColor: "#D4AF37" }}
          />
        </div>
      ))}
      <Button onClick={save} disabled={saving} style={{ background: "#D4AF37", color: "#0D1B2A" }}>
        {saving ? "Saving…" : "Save Prices"}
      </Button>
      {updatedAt && (
        <p className="text-xs" style={{ color: "#A0A0A0" }}>
          Last updated: {new Date(updatedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}

/* ─── Discount Codes Tab ─── */
function DiscountCodesTab() {
  const [codes, setCodes] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    code: "",
    discount_type: "percent",
    discount_value: "",
    applies_to: "all",
    max_uses: "",
    valid_until: undefined as Date | undefined,
  });

  const load = useCallback(async () => {
    const { data } = await supabase.from("discount_codes").select("*").order("created_at", { ascending: false });
    setCodes(data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    const row: any = {
      code: form.code.toUpperCase(),
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      applies_to: form.applies_to,
      active: true,
    };
    if (form.max_uses) row.max_uses = Number(form.max_uses);
    if (form.valid_until) row.valid_until = form.valid_until.toISOString();

    const { error } = await supabase.from("discount_codes").insert(row);
    if (error) {
      toast.error("Failed: " + error.message);
    } else {
      toast.success("Code created");
      setShowForm(false);
      setForm({ code: "", discount_type: "percent", discount_value: "", applies_to: "all", max_uses: "", valid_until: undefined });
      load();
    }
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("discount_codes").update({ active }).eq("id", id);
    load();
  };

  const deleteCode = async (id: string) => {
    await supabase.from("discount_codes").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-4">
      <Button onClick={() => setShowForm(true)} style={{ background: "#D4AF37", color: "#0D1B2A" }}>
        Create New Code
      </Button>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ color: "#E0E0E0" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #D4AF3744" }}>
              {["Code", "Type", "Value", "Applies To", "Uses/Max", "Valid Until", "Active", ""].map((h) => (
                <th key={h} className="text-left p-2" style={{ color: "#D4AF37" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {codes.map((c) => (
              <tr key={c.id} style={{ borderBottom: "1px solid #1B2838" }}>
                <td className="p-2 font-mono">{c.code}</td>
                <td className="p-2">{c.discount_type}</td>
                <td className="p-2">{c.discount_value}{c.discount_type === "percent" ? "%" : "$"}</td>
                <td className="p-2">{c.applies_to}</td>
                <td className="p-2">{c.uses_count || 0}/{c.max_uses ?? "∞"}</td>
                <td className="p-2">{c.valid_until ? new Date(c.valid_until).toLocaleDateString() : "—"}</td>
                <td className="p-2">
                  <Switch checked={c.active} onCheckedChange={(v) => toggleActive(c.id, v)} />
                </td>
                <td className="p-2">
                  <Button size="icon" variant="ghost" onClick={() => deleteCode(c.id)}>
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent style={{ background: "#0D1B2A", borderColor: "#D4AF37" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "#D4AF37" }}>Create Discount Code</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm" style={{ color: "#A0A0A0" }}>Code</label>
              <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="SAVE20" style={{ background: "#1B2838", color: "#E0E0E0", borderColor: "#D4AF37" }} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm" style={{ color: "#A0A0A0" }}>Type</label>
                <Select value={form.discount_type} onValueChange={(v) => setForm((f) => ({ ...f, discount_type: v }))}>
                  <SelectTrigger style={{ background: "#1B2838", color: "#E0E0E0", borderColor: "#D4AF37" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percent</SelectItem>
                    <SelectItem value="fixed">Fixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm" style={{ color: "#A0A0A0" }}>Value</label>
                <Input type="number" value={form.discount_value}
                  onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))}
                  style={{ background: "#1B2838", color: "#E0E0E0", borderColor: "#D4AF37" }} />
              </div>
            </div>
            <div>
              <label className="text-sm" style={{ color: "#A0A0A0" }}>Applies To</label>
              <Select value={form.applies_to} onValueChange={(v) => setForm((f) => ({ ...f, applies_to: v }))}>
                <SelectTrigger style={{ background: "#1B2838", color: "#E0E0E0", borderColor: "#D4AF37" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="self_assessment">Self Assessment</SelectItem>
                  <SelectItem value="manager_assessment">Manager Assessment</SelectItem>
                  <SelectItem value="jobs">Jobs</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm" style={{ color: "#A0A0A0" }}>Max Uses (blank = unlimited)</label>
              <Input type="number" value={form.max_uses}
                onChange={(e) => setForm((f) => ({ ...f, max_uses: e.target.value }))}
                style={{ background: "#1B2838", color: "#E0E0E0", borderColor: "#D4AF37" }} />
            </div>
            <div>
              <label className="text-sm" style={{ color: "#A0A0A0" }}>Valid Until</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}
                    style={{ background: "#1B2838", color: "#E0E0E0", borderColor: "#D4AF37" }}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.valid_until ? format(form.valid_until, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={form.valid_until}
                    onSelect={(d) => setForm((f) => ({ ...f, valid_until: d || undefined }))}
                    className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={create} style={{ background: "#D4AF37", color: "#0D1B2A" }}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Main Dashboard ─── */
/* ─── DPA Contacts Tab ─── */
function DPAContactsTab() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", region: "Global", is_default: false, sort_order: "0" });

  const load = useCallback(async () => {
    const { data } = await supabase.from("dpa_contacts").select("*").order("sort_order", { ascending: true });
    setContacts(data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    const { error } = await supabase.from("dpa_contacts").insert({
      name: form.name, phone: form.phone, email: form.email || null,
      region: form.region || "Global", is_default: form.is_default, sort_order: Number(form.sort_order) || 0, active: true,
    });
    if (error) { toast.error("Failed: " + error.message); return; }
    toast.success("Contact added");
    setShowForm(false);
    setForm({ name: "", phone: "", email: "", region: "Global", is_default: false, sort_order: "0" });
    load();
  };

  const toggleField = async (id: string, field: string, value: boolean) => {
    await supabase.from("dpa_contacts").update({ [field]: value }).eq("id", id);
    load();
  };

  const deleteContact = async (id: string) => {
    await supabase.from("dpa_contacts").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg p-4 border" style={{ background: "#1B2838", borderColor: "#D4AF3744" }}>
        <p className="text-sm" style={{ color: "#D4AF37" }}>
          ⚠️ Default contacts are shown to ALL crew. Add your company DPA number here — it will appear first when crew triggers SOS.
        </p>
      </div>

      <Button onClick={() => setShowForm(true)} style={{ background: "#D4AF37", color: "#0D1B2A" }}>
        Add DPA Contact
      </Button>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ color: "#E0E0E0" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #D4AF3744" }}>
              {["Name", "Phone", "Email", "Region", "Default", "Active", "Sort", ""].map((h) => (
                <th key={h} className="text-left p-2" style={{ color: "#D4AF37" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={c.id} style={{ borderBottom: "1px solid #1B2838" }}>
                <td className="p-2 font-semibold">{c.name}</td>
                <td className="p-2 font-mono">{c.phone}</td>
                <td className="p-2">{c.email || "—"}</td>
                <td className="p-2"><Badge style={{ background: "#D4AF3733", color: "#D4AF37" }}>{c.region}</Badge></td>
                <td className="p-2"><Switch checked={c.is_default} onCheckedChange={(v) => toggleField(c.id, "is_default", v)} /></td>
                <td className="p-2"><Switch checked={c.active} onCheckedChange={(v) => toggleField(c.id, "active", v)} /></td>
                <td className="p-2">{c.sort_order}</td>
                <td className="p-2">
                  <Button size="icon" variant="ghost" onClick={() => deleteContact(c.id)}>
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent style={{ background: "#0D1B2A", borderColor: "#D4AF37" }}>
          <DialogHeader><DialogTitle style={{ color: "#D4AF37" }}>Add DPA Contact</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm" style={{ color: "#A0A0A0" }}>Name *</label>
              <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                style={{ background: "#1B2838", color: "#E0E0E0", borderColor: "#D4AF37" }} />
            </div>
            <div>
              <label className="text-sm" style={{ color: "#A0A0A0" }}>Phone *</label>
              <Input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+44 20 7323 2737" style={{ background: "#1B2838", color: "#E0E0E0", borderColor: "#D4AF37" }} />
            </div>
            <div>
              <label className="text-sm" style={{ color: "#A0A0A0" }}>Email</label>
              <Input value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                style={{ background: "#1B2838", color: "#E0E0E0", borderColor: "#D4AF37" }} />
            </div>
            <div>
              <label className="text-sm" style={{ color: "#A0A0A0" }}>Region</label>
              <Input value={form.region} onChange={(e) => setForm(f => ({ ...f, region: e.target.value }))}
                placeholder="Global" style={{ background: "#1B2838", color: "#E0E0E0", borderColor: "#D4AF37" }} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.is_default} onCheckedChange={(v) => setForm(f => ({ ...f, is_default: v }))} />
              <label className="text-sm" style={{ color: "#A0A0A0" }}>Is Default (shown to all crew)</label>
            </div>
            <div>
              <label className="text-sm" style={{ color: "#A0A0A0" }}>Sort Order</label>
              <Input type="number" value={form.sort_order} onChange={(e) => setForm(f => ({ ...f, sort_order: e.target.value }))}
                style={{ background: "#1B2838", color: "#E0E0E0", borderColor: "#D4AF37" }} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={create} disabled={!form.name || !form.phone} style={{ background: "#D4AF37", color: "#0D1B2A" }}>Add Contact</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Main Dashboard ─── */
export default function AdminDashboard() {
  const [authed, setAuthed] = useState(localStorage.getItem(LS_KEY) === ADMIN_PIN);
  const [tab, setTab] = useState<"crew" | "pricing" | "discount" | "country_pricing" | "sub_admins" | "dpa">("crew");

  if (!authed) return <PinScreen onAuth={() => setAuthed(true)} />;

  const lock = () => {
    localStorage.removeItem(LS_KEY);
    setAuthed(false);
  };

  const tabs = [
    { id: "crew" as const, label: "Crew Search" },
    { id: "pricing" as const, label: "Pricing" },
    { id: "discount" as const, label: "Discount Codes" },
    { id: "country_pricing" as const, label: "Country Pricing" },
    { id: "sub_admins" as const, label: "Sub-Admins" },
    { id: "dpa" as const, label: "SOS / DPA Contacts" },
  ];

  return (
    <div className="min-h-screen p-4 md:p-8" style={{ background: "#0D1B2A" }}>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "#D4AF37" }}>SeaMinds Admin</h1>
        <Button variant="outline" onClick={lock} style={{ borderColor: "#D4AF37", color: "#D4AF37" }}>
          <Lock className="w-4 h-4 mr-1" /> Lock
        </Button>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map((t) => (
          <Button key={t.id} onClick={() => setTab(t.id)}
            style={tab === t.id
              ? { background: "#D4AF37", color: "#0D1B2A" }
              : { background: "transparent", color: "#D4AF37", border: "1px solid #D4AF37" }
            }>
            {t.label}
          </Button>
        ))}
      </div>

      {tab === "crew" && <CrewSearchTab />}
      {tab === "pricing" && <PricingTab />}
      {tab === "discount" && <DiscountCodesTab />}
      {tab === "country_pricing" && <CountryPricingTab />}
      {tab === "sub_admins" && <SubAdminsTab />}
      {tab === "dpa" && <DPAContactsTab />}
    </div>
  );
}