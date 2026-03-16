import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/sonner";

const COUNTRIES = [
  "Philippines", "Indonesia", "India", "Vietnam", "Myanmar",
  "Ukraine", "Russia", "China", "Greece", "Croatia",
  "Nigeria", "Bangladesh", "All Countries",
];

const PERM_KEYS = [
  { key: "view_crew", label: "View Crew" },
  { key: "search_crew", label: "Search Crew" },
  { key: "create_discounts", label: "Create Discounts" },
  { key: "view_assessments", label: "View Assessments" },
  { key: "edit_pricing", label: "Edit Country Pricing" },
];

const DEFAULT_PERMS: Record<string, boolean> = {
  view_crew: true, search_crew: true, create_discounts: true,
  view_assessments: true, edit_pricing: false,
};

export default function SubAdminsTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", email: "", pin: "",
    assigned_countries: [] as string[],
    permissions: { ...DEFAULT_PERMS },
  });

  const load = useCallback(async () => {
    const { data } = await supabase.from("sub_admins").select("*").order("created_at", { ascending: false });
    setRows(data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.name || !form.email || form.pin.length !== 6) {
      toast.error("Fill all fields. PIN must be 6 digits.");
      return;
    }
    const { error } = await supabase.from("sub_admins").insert({
      name: form.name,
      email: form.email,
      pin: form.pin,
      assigned_countries: form.assigned_countries,
      permissions: form.permissions,
      active: true,
    });
    if (error) toast.error("Failed: " + error.message);
    else {
      toast.success("Sub-admin created");
      setShowForm(false);
      setForm({ name: "", email: "", pin: "", assigned_countries: [], permissions: { ...DEFAULT_PERMS } });
      load();
    }
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("sub_admins").update({ active }).eq("id", id);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    await supabase.from("sub_admins").delete().eq("id", deleteId);
    setDeleteId(null);
    toast.success("Deleted");
    load();
  };

  const permsSummary = (p: any) => {
    if (!p) return "—";
    return PERM_KEYS.filter((pk) => p[pk.key]).map((pk) => pk.label).join(", ") || "None";
  };

  const toggleCountry = (c: string) => {
    setForm((f) => {
      const has = f.assigned_countries.includes(c);
      return { ...f, assigned_countries: has ? f.assigned_countries.filter((x) => x !== c) : [...f.assigned_countries, c] };
    });
  };

  return (
    <div className="space-y-4">
      <Button onClick={() => setShowForm(true)} style={{ background: "#D4AF37", color: "#0D1B2A" }}>
        Add Sub-Admin
      </Button>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ color: "#E0E0E0" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #D4AF3744" }}>
              {["Name", "Email", "Countries", "Permissions", "Active", "Last Login", ""].map((h) => (
                <th key={h} className="text-left p-2" style={{ color: "#D4AF37" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderBottom: "1px solid #1B2838" }}>
                <td className="p-2 font-semibold">{r.name}</td>
                <td className="p-2">{r.email}</td>
                <td className="p-2 max-w-[200px] truncate">{(r.assigned_countries || []).join(", ") || "—"}</td>
                <td className="p-2 max-w-[250px] text-xs">{permsSummary(r.permissions)}</td>
                <td className="p-2">
                  <Switch checked={r.active ?? true} onCheckedChange={(v) => toggleActive(r.id, v)} />
                </td>
                <td className="p-2 text-xs">{r.last_login ? new Date(r.last_login).toLocaleString() : "Never"}</td>
                <td className="p-2">
                  <Button size="icon" variant="ghost" onClick={() => setDeleteId(r.id)}>
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add form */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent style={{ background: "#0D1B2A", borderColor: "#D4AF37" }} className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ color: "#D4AF37" }}>Add Sub-Admin</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm" style={{ color: "#A0A0A0" }}>Name</label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                style={{ background: "#1B2838", color: "#E0E0E0", borderColor: "#D4AF37" }} />
            </div>
            <div>
              <label className="text-sm" style={{ color: "#A0A0A0" }}>Email</label>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                style={{ background: "#1B2838", color: "#E0E0E0", borderColor: "#D4AF37" }} />
            </div>
            <div>
              <label className="text-sm" style={{ color: "#A0A0A0" }}>PIN (6 digits)</label>
              <Input type="text" maxLength={6} value={form.pin}
                onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                placeholder="000000"
                style={{ background: "#1B2838", color: "#E0E0E0", borderColor: "#D4AF37" }} />
            </div>
            <div>
              <label className="text-sm block mb-2" style={{ color: "#A0A0A0" }}>Assigned Countries</label>
              <div className="grid grid-cols-2 gap-2">
                {COUNTRIES.map((c) => (
                  <label key={c} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "#E0E0E0" }}>
                    <Checkbox checked={form.assigned_countries.includes(c)} onCheckedChange={() => toggleCountry(c)} />
                    {c}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm block mb-2" style={{ color: "#A0A0A0" }}>Permissions</label>
              <div className="space-y-2">
                {PERM_KEYS.map((pk) => (
                  <label key={pk.key} className="flex items-center justify-between text-sm" style={{ color: "#E0E0E0" }}>
                    {pk.label}
                    <Switch checked={form.permissions[pk.key]}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, permissions: { ...f.permissions, [pk.key]: v } }))} />
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={create} style={{ background: "#D4AF37", color: "#0D1B2A" }}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent style={{ background: "#0D1B2A", borderColor: "#D4AF37" }}>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: "#D4AF37" }}>Delete Sub-Admin?</AlertDialogTitle>
            <AlertDialogDescription style={{ color: "#A0A0A0" }}>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel style={{ borderColor: "#D4AF37", color: "#D4AF37" }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} style={{ background: "#ef4444", color: "#fff" }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
