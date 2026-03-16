import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";

const FLAG_OFFSET = 0x1F1E6;
function countryFlag(code: string) {
  if (!code || code === "DEFAULT") return "🌍";
  const upper = code.toUpperCase();
  return String.fromCodePoint(
    upper.charCodeAt(0) - 65 + FLAG_OFFSET,
    upper.charCodeAt(1) - 65 + FLAG_OFFSET
  );
}

const PRICE_COLS = [
  { key: "price_self_assessment", label: "Self Assessment ($)" },
  { key: "price_manager_assessment", label: "Manager Assessment ($)" },
  { key: "price_job_single", label: "Job Single ($)" },
  { key: "price_job_monthly", label: "Job Monthly ($)" },
  { key: "price_job_annual", label: "Job Annual ($)" },
] as const;

export default function CountryPricingTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("country_pricing").select("*");
      if (data) {
        const sorted = data.sort((a, b) => {
          if (a.country_code === "DEFAULT") return 1;
          if (b.country_code === "DEFAULT") return -1;
          return a.country_name.localeCompare(b.country_name);
        });
        setRows(sorted);
      }
    })();
  }, []);

  const update = (id: string, field: string, value: any) => {
    setRows((r) => r.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
    setChanged((s) => new Set(s).add(id));
  };

  const saveAll = async () => {
    if (changed.size === 0) return;
    setSaving(true);
    const toSave = rows
      .filter((r) => changed.has(r.id))
      .map((r) => ({
        id: r.id,
        country_code: r.country_code,
        country_name: r.country_name,
        currency: r.currency,
        price_self_assessment: Number(r.price_self_assessment) || 0,
        price_manager_assessment: Number(r.price_manager_assessment) || 0,
        price_job_single: Number(r.price_job_single) || 0,
        price_job_monthly: Number(r.price_job_monthly) || 0,
        price_job_annual: Number(r.price_job_annual) || 0,
        active: r.active,
        updated_at: new Date().toISOString(),
      }));
    const { error } = await supabase.from("country_pricing").upsert(toSave, { onConflict: "id" });
    setSaving(false);
    if (error) toast.error("Failed: " + error.message);
    else {
      toast.success(`Saved ${toSave.length} row(s)`);
      setChanged(new Set());
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm px-1" style={{ color: "#A0A0A0" }}>
        Prices are automatically applied based on crew nationality at payment. <strong style={{ color: "#D4AF37" }}>DEFAULT</strong> row applies to all other countries.
      </p>
      <Button onClick={saveAll} disabled={saving || changed.size === 0} style={{ background: "#D4AF37", color: "#0D1B2A" }}>
        {saving ? "Saving…" : `Save All (${changed.size} changed)`}
      </Button>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ color: "#E0E0E0" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #D4AF3744" }}>
              {["", "Country", ...PRICE_COLS.map((c) => c.label), "Active"].map((h) => (
                <th key={h} className="text-left p-2 whitespace-nowrap" style={{ color: "#D4AF37" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderBottom: "1px solid #1B2838" }}>
                <td className="p-2 text-lg">{countryFlag(r.country_code)}</td>
                <td className="p-2 whitespace-nowrap">{r.country_name}</td>
                {PRICE_COLS.map((col) => (
                  <td key={col.key} className="p-2">
                    <Input
                      type="number"
                      value={r[col.key] ?? ""}
                      onChange={(e) => update(r.id, col.key, e.target.value)}
                      className="w-20"
                      style={{ background: "#1B2838", color: "#E0E0E0", borderColor: "#D4AF3744" }}
                    />
                  </td>
                ))}
                <td className="p-2">
                  <Switch checked={r.active ?? true} onCheckedChange={(v) => update(r.id, "active", v)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
