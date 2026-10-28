import { useEffect, useState } from "react";
import { ArrowLeft, Mail, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const contacts = [
  {
    title: "Support & Crew",
    email: "support@seaminds.life",
    subject: "SeaMinds%20support%20request",
    note: "Technical help, login, privacy and account deletion",
  },
  {
    title: "Corporate & Fleet",
    email: "admin@seaminds.life",
    subject: "SeaMinds%20commercial%20enquiry",
    note: "Companies, credits, partnerships and governance",
  },
];

const Contact = () => {
  useEffect(() => { document.title = "SeaMinds | Contact Us"; }, []);
  const [copied, setCopied] = useState<string | null>(null);

  const copyEmail = async (email: string) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("unavailable");
      await navigator.clipboard.writeText(email);
      setCopied(email);
      toast.success("Email address copied");
      setTimeout(() => setCopied((c) => (c === email ? null : c)), 2000);
    } catch {
      toast.error(`Couldn't copy automatically. Please copy ${email} manually.`);
    }
  };

  const goldColor = "#D4AF37";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0D1B2A" }}>
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-12">
        <Button
          variant="ghost"
          size="sm"
          className="mb-8 text-gray-300 hover:text-white hover:bg-white/10"
          onClick={() => (window.location.href = "/")}
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Homepage
        </Button>

        <h1 className="text-3xl font-bold mb-2" style={{ color: goldColor }}>
          Contact Us
        </h1>
        <p className="text-sm mb-6" style={{ color: "#A0AEC0" }}>
          Email us directly using the address that matches your enquiry. If your device has no email app, copy the address and use any email service.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 mb-8">
          {contacts.map((c) => (
            <div key={c.email} className="min-w-0 rounded-lg border border-border bg-card p-4 text-muted-foreground">
              <span className="flex items-center gap-2 font-semibold text-primary"><Mail className="w-4 h-4 shrink-0" /> {c.title}</span>
              <a href={`mailto:${c.email}?subject=${c.subject}`} className="block text-sm underline break-all mt-2">{c.email}</a>
              <span className="block text-xs mt-2">{c.note}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 h-10 w-full"
                onClick={() => copyEmail(c.email)}
                aria-label={`Copy ${c.email}`}
              >
                {copied === c.email ? <><Check className="w-4 h-4 mr-1" /> Copied</> : <><Copy className="w-4 h-4 mr-1" /> Copy email</>}
              </Button>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          <span className="block font-semibold text-primary mb-2">Corporate Entity</span>
          <span className="block">Legal Name: PT INDOGLOBAL SERVICE SOLUTIONS</span>
          <span className="block">NIB: 0105250010966</span>
          <span className="block">Domain: seaminds.life</span>
          <span className="block">Official Contact: <a href="mailto:admin@seaminds.life" className="underline">admin@seaminds.life</a></span>
        </div>

        <div className="h-px w-full my-10" style={{ backgroundColor: goldColor, opacity: 0.25 }} />
        <p className="text-xs text-center" style={{ color: "#8899AA" }}>
          © 2026 SeaMinds · Operated by PT INDOGLOBAL SERVICE SOLUTIONS (NIB: 0105250010966)
        </p>
      </div>
    </div>
  );
};

export default Contact;
