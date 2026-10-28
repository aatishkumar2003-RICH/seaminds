import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const sections = [
  {
    title: "1. Acceptance of Terms",
    body: "SeaMinds (seaminds.life) is owned and operated by PT INDOGLOBAL SERVICE SOLUTIONS (NIB: 0105250010966), Indonesia. By accessing or using the SeaMinds platform, you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, you must discontinue use of the platform immediately. These terms apply to all users including seafarers, maritime professionals, and company representatives.",
  },
  {
    title: "2. Use of Service",
    body: "SeaMinds provides AI-powered wellness support, competency assessments (SeaMinds Score), maritime academy resources, job matching, and community tools for seafarers and maritime companies. You agree to use the platform only for lawful purposes and in accordance with these terms. You must not misuse the service, submit false documents, impersonate others, or attempt to manipulate assessment scores.",
  },
  {
    title: "3. Privacy and Data",
    body: "Your privacy is paramount. All conversations with the SeaMinds AI companion are private and confidential under our Sealed Envelope Principle — wellness data is never shared with employers without your explicit written consent. Personal data is processed in accordance with our Privacy Policy, GDPR, and the Maritime Labour Convention (MLC) 2006 seafarer welfare standards. You retain ownership of your assessment results and personal information at all times.",
  },
  {
    title: "4. Wellness Disclaimer",
    body: "SeaMinds provides AI-powered wellness support tools for informational and self-help purposes only. These tools are not a substitute for professional medical advice, diagnosis, or treatment. If you are experiencing a medical or mental health emergency, please contact your vessel's medical officer, use the SOS emergency feature, or call local emergency services immediately. SeaMinds does not guarantee any specific health outcomes from using the wellness features.",
  },
  {
    title: "5. Intellectual Property & Copyright",
    body: "© 2024–2026 SeaMinds. All rights reserved. All content, text, designs, logos, software, source code, assessments, question banks, AI companion technology, and graphics on the SeaMinds platform are owned by SeaMinds or its licensors and are protected by international copyright law, including the Berne Convention, and other intellectual property laws. You may not copy, scrape, reproduce, distribute, modify, republish, or create derivative works from any SeaMinds content without prior written permission. The SeaMinds Score methodology, certification system, and the SeaMinds name and logo are proprietary to SeaMinds. Vacancy adverts remain the property of their respective recruiters. To report suspected copyright infringement or request a licence, email admin@seaminds.life with details of the work and where it appears.",
  },
  {
    title: "6. Limitation of Liability",
    body: "SeaMinds provides information, tools, and assessments for guidance purposes. The platform is provided 'as is' without warranties of any kind, express or implied. SeaMinds shall not be liable for any direct, indirect, incidental, or consequential damages arising from your use of the platform, reliance on assessment scores, or decisions made based on platform content. Our total liability shall not exceed the amount paid by you in the twelve months preceding the claim.",
  },
  {
    title: "7. Governing Law",
    body: "These Terms of Service shall be governed by and construed in accordance with the laws of the Republic of Indonesia. Any disputes arising from or relating to these terms or your use of the platform shall be subject to the exclusive jurisdiction of the courts of Jakarta, Indonesia. Where applicable, the Maritime Labour Convention (MLC) 2006 provisions shall supplement these terms in matters relating to seafarer welfare and rights.",
  },
  {
    title: "8. Contact",
    body: "If you have any questions about these Terms of Service, please contact us at admin@seaminds.life. For urgent seafarer welfare matters, use the SOS feature within the app for immediate assistance.",
  },
  {
    title: "9. Maritime Asset Marketplace & Vessel Listings",
    body: "(1) Scope: SeaMinds provides a passive introductory directory and electronic noticeboard enabling registered owners, authorised managers and authorised brokers (\"Listing Providers\") to advertise commercial vessels for sale, and enabling prospective buyers to communicate with them directly. (2) No brokerage, advisory or fiduciary relationship: SeaMinds is not a shipbroker, maritime agent, arbitrator, surveyor, marine engineer, financial intermediary or escrow provider. SeaMinds does not participate in negotiations or offers; does not draft, verify or execute Memoranda of Agreement, Bills of Sale or closing protocols; does not hold, handle, transmit or escrow deposits or purchase funds; and does not guarantee the condition, seaworthiness, class standing, regulatory compliance (including BWTS, scrubber, EEXI/CII, SOLAS or MARPOL) or lawful title of any vessel. (3) \"As is, where is\" data and buyer due diligence: all listings and media are supplied solely by the Listing Provider and are not surveyed or verified by SeaMinds. Reliance on listing data is at the buyer's sole risk; physical and underwater inspection, machinery audit, class record review and title, lien and encumbrance checks through qualified maritime counsel are the buyer's responsibility before any binding commitment. (4) Sanctions: users must not list, negotiate or facilitate transactions involving vessels, persons or jurisdictions subject to sanctions or export controls of the United Nations, United States (OFAC), European Union, United Kingdom (OFSI) or other applicable authorities. SeaMinds may suspend or remove any listing suspected of non-compliance without liability. (5) Seller warranties and indemnity: Listing Providers warrant their authority to offer the vessel and the accuracy of their listing, and indemnify SeaMinds against claims arising from unauthorised listings, false particulars or infringing materials. (6) Limitation of liability: to the maximum extent permitted by law, SeaMinds, its founders, officers and service providers shall not be liable for any direct, indirect, incidental, consequential, special or punitive damages, including loss of profit, opportunity, inspection costs, charter revenue or transaction costs, arising from any listing or transaction.",
  },
];

const TermsOfService = () => {
  useEffect(() => {
    document.title = "SeaMinds | Terms of Service";
  }, []);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0D1B2A" }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <Button
          variant="ghost"
          size="sm"
          className="mb-8 text-gray-300 hover:text-white hover:bg-white/10"
          onClick={() => (window.location.href = "/")}
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Homepage
        </Button>

        <h1
          className="text-3xl font-bold mb-2"
          style={{ color: "#D4AF37" }}
        >
          Terms of Service
        </h1>
        <p className="text-sm mb-8" style={{ color: "#8899AA" }}>
          Last updated: March 2026
        </p>
        <div
          className="h-px w-full mb-8"
          style={{ backgroundColor: "#D4AF37", opacity: 0.25 }}
        />

        <div className="space-y-8">
          {sections.map((s) => (
            <section key={s.title}>
              <h2
                className="text-lg font-semibold mb-2"
                style={{ color: "#D4AF37" }}
              >
                {s.title}
              </h2>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "#A0AEC0" }}
              >
                {s.body}
              </p>
            </section>
          ))}
        </div>

        <div
          className="h-px w-full my-10"
          style={{ backgroundColor: "#D4AF37", opacity: 0.25 }}
        />
        <p className="text-xs text-center" style={{ color: "#8899AA" }}>
          © 2026 SeaMinds · Operated by PT INDOGLOBAL SERVICE SOLUTIONS (NIB: 0105250010966) · admin@seaminds.life
        </p>
      </div>
    </div>
  );
};

export default TermsOfService;
