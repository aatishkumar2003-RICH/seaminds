import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function CompanyProfileEditor({ userId, onSaved }: { userId: string; onSaved: () => void }) {
  const [form, setForm] = useState({ full_name: "", company_name: "", country: "", phone: "" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    supabase.from("manager_profiles").select("full_name,company_name,country,phone").eq("user_id", userId).maybeSingle().then(({ data, error }) => {
      if (!active) return;
      if (error || !data) setError(error?.message || "Complete company registration from the Ship Manager sign-in page first.");
      else setForm({ full_name: data.full_name || "", company_name: data.company_name || "", country: data.country || "", phone: data.phone || "" });
      setLoading(false);
    });
    return () => { active = false; };
  }, [userId]);
  const save = async () => {
    if (Object.values(form).some(value => !value.trim())) return toast.error("Complete all company profile fields");
    if (!/^\+?[\d\s()-]{7,25}$/.test(form.phone)) return toast.error("Enter a valid contact phone with country code");
    setBusy(true);
    const { error } = await supabase.from("manager_profiles").update({ full_name: form.full_name.trim(), company_name: form.company_name.trim(), country: form.country.trim(), phone: form.phone.replace(/[\s()-]/g, "") }).eq("user_id", userId).select("user_id").single();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Company profile saved"); onSaved();
  };
  if (loading) return <p className="text-xs text-muted-foreground">Loading company profile…</p>;
  if (error) return <p role="alert" className="text-xs text-muted-foreground">{error}</p>;
  return <form className="space-y-3" onSubmit={e => { e.preventDefault(); void save(); }}>{([['full_name','Your full name'],['company_name','Company name'],['country','Company country'],['phone','Contact phone']] as const).map(([key,label]) => <label key={key} className="block text-xs space-y-1">{label}<Input aria-label={label} value={form[key]} type={key === 'phone' ? 'tel' : 'text'} maxLength={120} required onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}<Button type="submit" disabled={busy} className="w-full">{busy ? "Saving…" : "Save company profile"}</Button></form>;
}