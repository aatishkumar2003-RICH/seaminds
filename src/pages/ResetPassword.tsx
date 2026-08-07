import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase puts the recovery session in the URL hash on arrival
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setReady(!!session));
    return () => sub.subscription.unsubscribe();
  }, []);

  const save = async () => {
    if (password.length < 8) return toast.error("Password must be at least 8 characters.");
    if (password !== confirm) return toast.error("Passwords do not match.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated. You can sign in now.");
    navigate("/manager");
  };

  const inputClass = "w-full bg-secondary text-foreground text-sm rounded-xl px-4 py-3 placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen max-w-md mx-auto bg-background px-6">
      <div className="w-full max-w-sm space-y-5">
        <h1 className="text-xl font-semibold text-foreground text-center">Set a new password</h1>
        {!ready && (
          <p className="text-xs text-center text-muted-foreground">
            Open this page from the reset link in your email.
          </p>
        )}
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="New password" className={inputClass} />
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm new password" className={inputClass} />
        <button onClick={save} disabled={loading || !ready}
          className="w-full bg-primary text-primary-foreground font-medium text-sm rounded-xl py-3.5 disabled:opacity-30">
          {loading ? "Saving..." : "Save new password"}
        </button>
        <button onClick={() => navigate("/manager")}
          className="w-full text-xs text-muted-foreground">
          Back to sign in
        </button>
      </div>
    </div>
  );
};

export default ResetPassword;
