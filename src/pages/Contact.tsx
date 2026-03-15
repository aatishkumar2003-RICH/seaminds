import { useEffect, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { ArrowLeft, Mail, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Invalid email address").max(255),
  subject: z.string().min(1, "Please select a subject"),
  message: z.string().trim().min(1, "Message is required").max(2000),
});

const subjects = ["General", "Company Demo", "Technical Support", "Partnership"];

const Contact = () => {
  useEffect(() => { document.title = "SeaMinds | Contact Us"; }, []);

  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = contactSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((i) => { fieldErrors[i.path[0] as string] = i.message; });
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("contact_submissions" as any).insert([{
      name: result.data.name,
      email: result.data.email,
      subject: result.data.subject,
      message: result.data.message,
    }]);

    setSubmitting(false);
    if (error) {
      setErrors({ form: "Something went wrong. Please try again." });
      return;
    }
    setSubmitted(true);
    trackEvent("contact_form_submit", { subject: result.data.subject });
  };

  const labelStyle = { color: "#A0AEC0" };
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
        <div className="flex items-center gap-2 mb-8">
          <Mail className="w-4 h-4" style={{ color: goldColor }} />
          <a href="mailto:info@indossol.com" className="text-sm underline" style={{ color: "#A0AEC0" }}>
            info@indossol.com
          </a>
        </div>
        <div className="h-px w-full mb-8" style={{ backgroundColor: goldColor, opacity: 0.25 }} />

        {submitted ? (
          <div className="text-center py-16">
            <CheckCircle className="w-12 h-12 mx-auto mb-4" style={{ color: goldColor }} />
            <p className="text-lg font-semibold text-white mb-2">Thank you.</p>
            <p style={{ color: "#A0AEC0" }}>We will respond within 24 hours.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm mb-1.5 font-medium" style={labelStyle}>Name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                placeholder="Your full name"
              />
              {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm mb-1.5 font-medium" style={labelStyle}>Email</label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                placeholder="your@email.com"
              />
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm mb-1.5 font-medium" style={labelStyle}>Subject</label>
              <Select value={form.subject} onValueChange={(v) => setForm({ ...form, subject: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Select a subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.subject && <p className="text-red-400 text-xs mt-1">{errors.subject}</p>}
            </div>

            <div>
              <label className="block text-sm mb-1.5 font-medium" style={labelStyle}>Message</label>
              <Textarea
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 min-h-[120px]"
                placeholder="How can we help?"
              />
              {errors.message && <p className="text-red-400 text-xs mt-1">{errors.message}</p>}
            </div>

            {errors.form && <p className="text-red-400 text-sm">{errors.form}</p>}

            <Button
              type="submit"
              disabled={submitting}
              className="w-full text-sm font-semibold h-11"
              style={{ backgroundColor: goldColor, color: "#0D1B2A" }}
            >
              {submitting ? "Sending..." : "Send Message"}
            </Button>
          </form>
        )}

        <div className="h-px w-full my-10" style={{ backgroundColor: goldColor, opacity: 0.25 }} />
        <p className="text-xs text-center" style={{ color: "#8899AA" }}>
          © 2026 SeaMinds. Built by a Master Mariner. MLC 2006 Compliant.
        </p>
      </div>
    </div>
  );
};

export default Contact;
