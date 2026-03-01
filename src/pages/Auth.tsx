import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Anchor, ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
const Auth = () => {
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [confirmPassword, setConfirmPassword] = useState("");
const [submitting, setSubmitting] = useState(false);
const { toast } = useToast();
const navigate = useNavigate();
const handleSignIn = async (e: React.FormEvent) => {
e.preventDefault();
setSubmitting(true);
const { data, error } = await supabase.auth.signInWithPassword({ email, password });
if (error) {
toast({ title: "Login failed", description: error.message, variant: "destructive" });
setSubmitting(false);
return;
}
const { data: profile }: any = await (supabase
.from("crew_profiles") as any)
.select("first_name, onboarded")
.eq("user_id", data.user.id)
.maybeSingle();
if (!profile?.onboarded) {
window.location.href = "/complete-profile";
} else {
window.location.href = "/app";
}
};
const handleSignUp = async (e: React.FormEvent) => {
e.preventDefault();
if (password !== confirmPassword) {
toast({ title: "Passwords don't match", variant: "destructive" });
return;
}
setSubmitting(true);
const { error } = await supabase.auth.signUp({ email, password });
if (error) {
toast({ title: "Signup failed", description: error.message, variant: "destructive" });
setSubmitting(false);
return;
}
window.location.href = "/complete-profile";
};
return (
<div className="min-h-screen flex items-center justify-center bg-[#0D1B2A] px-4">
<div className="w-full max-w-sm space-y-6">
<button onClick={() => navigate("/")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
<ArrowLeft size={14} /> Back to home
</button>
<div className="text-center space-y-2">
<Anchor className="mx-auto text-[#D4AF37]" size={32} />
<h1 className="text-2xl font-bold text-foreground">SeaMinds</h1>
</div>
<Tabs defaultValue="signin" className="w-full">
<TabsList className="grid w-full grid-cols-2">
<TabsTrigger value="signin">Sign In</TabsTrigger>
<TabsTrigger value="signup">Sign Up</TabsTrigger>
</TabsList>
<TabsContent value="signin">
<form onSubmit={handleSignIn} className="space-y-4 pt-2">
<div className="space-y-2">
<Label htmlFor="signin-email">Email</Label>
<Input id="signin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="captain@example.com" required />
</div>
<div className="space-y-2">
<Label htmlFor="signin-password">Password</Label>
<Input id="signin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
</div>
<Button type="submit" className="w-full bg-[#D4AF37] hover:bg-[#C49B2F] text-[#0D1B2A] font-semibold" disabled={submitting}>
{submitting ? "Please wait..." : "Sign In"}
</Button>
</form>
</TabsContent>
<TabsContent value="signup">
<form onSubmit={handleSignUp} className="space-y-4 pt-2">
<div className="space-y-2">
<Label htmlFor="signup-email">Email</Label>
<Input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="captain@example.com" required />
</div>
<div className="space-y-2">
<Label htmlFor="signup-password">Password</Label>
<Input id="signup-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
</div>
<div className="space-y-2">
<Label htmlFor="signup-confirm">Confirm Password</Label>
<Input id="signup-confirm" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
</div>
<Button type="submit" className="w-full bg-[#D4AF37] hover:bg-[#C49B2F] text-[#0D1B2A] font-semibold" disabled={submitting}>
{submitting ? "Please wait..." : "Create Account"}
</Button>
</form>
</TabsContent>
</Tabs>
</div>
</div>
);
};

export default Auth;
