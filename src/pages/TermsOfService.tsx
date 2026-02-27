import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const clauses = [
  { title: "1. Acceptance of Terms", body: "By accessing or using the SeaMinds platform, you agree to be bound by these Terms of Service. If you do not agree, you must not use the platform." },
  { title: "2. Eligibility", body: "SeaMinds is available to seafarers, maritime professionals, and authorised company representatives. You must be at least 18 years old to create an account." },
  { title: "3. User Accounts", body: "You are responsible for maintaining the confidentiality of your account credentials. You agree to provide accurate, current, and complete information during registration." },
  { title: "4. Privacy & Confidentiality", body: "All conversations with the SeaMinds AI companion are private and confidential. Your personal data is processed in accordance with our Privacy Policy and applicable data protection laws including GDPR." },
  { title: "5. SMC Score Assessments", body: "The SeaMinds Competency (SMC) Score is an indicative assessment tool. While we strive for accuracy, scores should be used as guidance alongside professional judgement. Assessment results remain your property." },
  { title: "6. Acceptable Use", body: "You agree not to misuse the platform, including but not limited to: submitting false documents, impersonating others, attempting to manipulate assessment scores, or using the service for any unlawful purpose." },
  { title: "7. Intellectual Property", body: "All content, designs, logos, and technology on SeaMinds are owned by SeaMinds or its licensors. You may not reproduce, distribute, or create derivative works without written permission." },
  { title: "8. Payment & Refunds", body: "Certain features require payment. All fees are stated in USD unless otherwise indicated. Refund requests must be submitted within 14 days of purchase and are subject to our refund policy." },
  { title: "9. Data Protection & MLC 2006 Compliance", body: "SeaMinds operates in compliance with the Maritime Labour Convention (MLC) 2006. We are committed to protecting seafarer welfare rights and ensuring data is never shared with employers without explicit consent." },
  { title: "10. Limitation of Liability", body: "SeaMinds provides information and tools for guidance purposes. We are not liable for decisions made based on platform content. The platform is provided 'as is' without warranties of any kind." },
  { title: "11. Termination", body: "We reserve the right to suspend or terminate accounts that violate these terms. You may delete your account at any time. Upon termination, your data will be handled in accordance with our Privacy Policy." },
  { title: "12. Changes to Terms", body: "We may update these Terms of Service from time to time. Continued use of the platform after changes constitutes acceptance. We will notify users of material changes via email or in-app notification." },
];

const TermsOfService = () => {
  const navigate = useNavigate();
  useEffect(() => { document.title = "SeaMinds | Terms of Service"; }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <Button variant="ghost" size="sm" className="mb-8" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>

        <h1 className="text-3xl font-bold gold-glow mb-2">Terms of Service</h1>
        <p className="text-muted-foreground text-sm mb-8">Last updated: February 2026</p>
        <Separator className="mb-8" />

        <div className="space-y-8">
          {clauses.map((c) => (
            <section key={c.title}>
              <h2 className="text-lg font-semibold text-primary mb-2">{c.title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{c.body}</p>
            </section>
          ))}
        </div>

        <Separator className="my-10" />
        <p className="text-xs text-muted-foreground text-center">
          © 2026 SeaMinds. Built by a Master Mariner. MLC 2006 Compliant.
        </p>
      </div>
    </div>
  );
};

export default TermsOfService;
