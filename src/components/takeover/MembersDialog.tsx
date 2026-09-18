import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Member {
  user_id: string;
  email: string;
  role: string;
  created_at: string;
}

export default function MembersDialog({
  inspectionId,
  isOwner,
  onClose,
}: {
  inspectionId: string;
  isOwner: boolean;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"inspector" | "reviewer">("inspector");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.rpc("takeover_list_members" as any, { p_inspection_id: inspectionId });
    setMembers((data as any) || []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionId]);

  const add = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("takeover_add_member" as any, {
      p_inspection_id: inspectionId,
      p_email: email.trim(),
      p_role: role,
    });
    setBusy(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Could not grant access");
      return;
    }
    setEmail("");
    toast.success("Access granted");
    load();
  };

  const remove = async (userId: string) => {
    const { data, error } = await supabase.rpc("takeover_remove_member" as any, {
      p_inspection_id: inspectionId,
      p_user_id: userId,
    });
    if (error || (data as any)?.error) toast.error((data as any)?.error || "Could not remove access");
    else load();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end md:items-center justify-center p-3">
      <div className="w-full max-w-md rounded-2xl bg-[#112240] border border-[rgba(212,175,55,0.3)] p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-base font-bold text-[#D4AF37]">Who can open this inspection</h3>
          <button onClick={onClose} className="text-slate-300 p-2">
            <X size={18} />
          </button>
        </div>

        {isOwner && (
          <div className="space-y-2 mb-4">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Registered account email"
              className="w-full min-h-[44px] rounded-xl bg-[#0D1B2A] border border-[rgba(212,175,55,0.3)] px-3 text-sm text-slate-100"
            />
            <div className="flex gap-2">
              {(["inspector", "reviewer"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`flex-1 min-h-[44px] rounded-xl text-sm font-semibold border ${
                    role === r ? "bg-[#D4AF37] text-[#0D1B2A] border-[#D4AF37]" : "border-[rgba(212,175,55,0.3)] text-slate-300"
                  }`}
                >
                  {r === "inspector" ? "Inspector" : "Read-only reviewer"}
                </button>
              ))}
            </div>
            <button
              onClick={add}
              disabled={busy || !email.trim()}
              className="w-full min-h-[44px] rounded-xl bg-[#D4AF37] text-[#0D1B2A] font-bold disabled:opacity-60"
            >
              Grant access
            </button>
            <p className="text-[11px] text-[#94A3B8]">
              The account must already be registered. No invitation email is sent — share the link yourself.
            </p>
          </div>
        )}

        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m.user_id} className="flex justify-between items-center text-sm text-slate-200">
              <span>
                {m.email} <span className="text-[#94A3B8]">· {m.role}</span>
              </span>
              {isOwner && (
                <button onClick={() => remove(m.user_id)} className="text-xs text-red-300 px-2 py-1">
                  Remove
                </button>
              )}
            </li>
          ))}
          {!members.length && <li className="text-sm text-[#94A3B8]">Only you have access.</li>}
        </ul>
      </div>
    </div>
  );
}
