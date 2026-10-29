import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Lock, Mail } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// Private preview: only the owner account can use these features until the owner opens them.
const OWNER_EMAILS = ["atish@seaminds.life"];
const OWNER_UID = "492ee966-e015-4440-a415-6ad6275a4a9b";

export const isPreviewOwner = (user: { id?: string; email?: string | null } | null | undefined) =>
  !!user && (user.id === OWNER_UID || OWNER_EMAILS.includes(String(user.email || "").trim().toLowerCase()));

const OwnerPreviewGate = ({ feature, children }: { feature: string; children: ReactNode }) => {
  const { user, loading } = useAuth() as any;
  const navigate = useNavigate();
  if (loading) return null;
  if (isPreviewOwner(user)) return <>{children}</>;

  const subject = encodeURIComponent(`Early access request: ${feature}`);
  const body = encodeURIComponent(`Hello SeaMinds team,\n\nPlease approve early access to ${feature} for my company.\n\nCompany:\nAccount email: ${user?.email ?? ""}\n`);

  return (
    <div className="min-h-screen bg-background p-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-primary">
        <ChevronLeft size={18} /> Back
      </button>
      <div className="mx-auto mt-10 max-w-md rounded-2xl border border-primary/30 bg-card p-6 text-center">
        <Lock className="mx-auto mb-3 text-primary" size={36} />
        <h1 className="text-lg font-bold text-foreground">{feature} — Private Preview</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {feature} is currently in private preview with select partner fleets. Request early access at admin@seaminds.life.
        </p>
        <a
          href={`mailto:admin@seaminds.life?subject=${subject}&body=${body}`}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground"
        >
          <Mail size={16} /> Request early access
        </a>
      </div>
    </div>
  );
};

export default OwnerPreviewGate;
