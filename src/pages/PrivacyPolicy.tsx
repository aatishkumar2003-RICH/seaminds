import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import HomeNav from "@/components/homepage/HomeNav";
import HomeFooter from "@/components/homepage/HomeFooter";

const sections = [
  {
    title: "1. Introduction",
    body: `SeaMinds ("we", "our", "us") operates the SeaMinds platform at seaminds.life. This Privacy Policy explains how we collect, use, store and protect your personal information when you use our services. By using SeaMinds you agree to the practices described here.`,
  },
  {
    title: "2. Information We Collect",
    body: `We collect the following categories of data:

• Account information — name, email address, nationality, rank, vessel details and WhatsApp number provided during registration.
• Professional data — certificates, sea service records, medical fitness status and CV content uploaded for the SMC Score assessment.
• Wellness data — mood check-ins, streak records and AI chat conversations (subject to the Sealed Envelope Principle below).
• Usage data — pages visited, features used, device type and browser information.
• Location data — approximate coordinates if you enable location-based features (you can disable this at any time).`,
  },
  {
    title: "3. The Sealed Envelope Principle",
    body: `Your wellness data and AI conversation content are treated as sealed. This means:

• No employer, ship manager, senior officer or third party can access your wellness check-ins or chat history.
• Wellness data is encrypted and accessible only to you.
• This principle is fundamental to SeaMinds and cannot be overridden by any company subscription or integration.
• Aggregated, fully anonymised statistics may be used to improve the platform but can never be traced back to an individual.`,
  },
  {
    title: "4. How We Use Your Information",
    body: `We use your data to:

• Provide and personalise the SeaMinds platform and its features.
• Generate your SMC Command Score and digital CV.
• Track certificate expiry dates and send renewal reminders.
• Improve our AI tools, content and user experience.
• Communicate service updates and safety-related information.
• Comply with applicable maritime regulations (MLC 2006).`,
  },
  {
    title: "5. Data Sharing",
    body: `We do not sell your personal data. We may share limited information only in these cases:

• With employers — only your SMC Score, professional qualifications and availability status, and only when you explicitly opt in via the "Visible to Employers" toggle.
• Service providers — trusted third-party processors (hosting, payment, AI) who are contractually bound to protect your data.
• Legal obligations — when required by law, regulation or valid legal process.`,
  },
  {
    title: "6. Data Storage & Security",
    body: `Your data is stored on secure, encrypted cloud infrastructure. We implement industry-standard security measures including:

• Encryption in transit (TLS) and at rest.
• Row-level security ensuring users can only access their own data.
• Regular security reviews and access controls.
• Minimal data retention — CV documents are processed and immediately discarded; only structured data is stored.`,
  },
  {
    title: "7. Your Rights",
    body: `You have the right to:

• Access — request a copy of the personal data we hold about you.
• Correction — update or correct inaccurate information.
• Deletion — request deletion of your account and associated data.
• Portability — receive your data in a structured, machine-readable format.
• Withdraw consent — opt out of optional data processing at any time.

To exercise any of these rights, contact us at the address below.`,
  },
  {
    title: "8. Cookies & Analytics",
    body: `We use essential cookies required for the platform to function. We may use anonymised analytics to understand usage patterns. We do not use advertising cookies or trackers.`,
  },
  {
    title: "9. Children's Privacy",
    body: `SeaMinds is designed for professional seafarers. We do not knowingly collect data from individuals under the age of 16. If we become aware that we have collected data from a minor, we will delete it promptly.`,
  },
  {
    title: "10. Changes to This Policy",
    body: `We may update this Privacy Policy from time to time. Material changes will be communicated via the platform. Continued use after changes constitutes acceptance of the updated policy.`,
  },
  {
    title: "11. Contact",
    body: `For privacy-related enquiries, data requests or complaints:

Email: privacy@seaminds.life
Website: seaminds.life/contact

This policy is governed by the laws of the Republic of Indonesia.`,
  },
];

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen" style={{ background: "#0D1B2A" }}>
      <Helmet>
        <title>Privacy Policy — SeaMinds</title>
        <meta name="description" content="SeaMinds Privacy Policy — how we collect, use, store and protect seafarer data. Built on the Sealed Envelope Principle." />
        <link rel="canonical" href="https://seaminds.life/privacy" />
      </Helmet>
      <HomeNav />
      <div className="max-w-3xl mx-auto px-4 pt-24 pb-16">
        <Button
          variant="ghost"
          className="mb-6 hover:opacity-80"
          style={{ color: "#D4AF37" }}
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Homepage
        </Button>

        <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{ color: "#E0E6ED" }}>
          Privacy Policy
        </h1>
        <p className="text-sm mb-10" style={{ color: "#64748B" }}>
          Last updated: March 2026
        </p>

        <div className="space-y-8">
          {sections.map((s) => (
            <section key={s.title}>
              <h2 className="text-lg font-bold mb-3" style={{ color: "#D4AF37" }}>
                {s.title}
              </h2>
              <div className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "#CBD5E1" }}>
                {s.body}
              </div>
            </section>
          ))}
        </div>
      </div>
      <HomeFooter />
    </div>
  );
};

export default PrivacyPolicy;
