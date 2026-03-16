import { useNavigate } from "react-router-dom";
import { MessageCircle, Shield, BookOpen, Briefcase, Heart, Users } from "lucide-react";

const features = [
  { icon: MessageCircle, title: "AI Wellness Companion", desc: "Private confidential conversations 24/7, never shared with your company." },
  { icon: Shield, title: "SMC Certified Score", desc: "World's first portable AI-verified crew competency score. Salary bidding marketplace." },
  { icon: BookOpen, title: "Maritime Academy", desc: "PSC inspection prep, vetting knowledge, STCW updates." },
  { icon: Briefcase, title: "Jobs Board", desc: "Verified job listings with minimum SMC Score requirements." },
  { icon: Heart, title: "Family Connection", desc: "Keep your family informed and connected during voyages." },
  { icon: Users, title: "Community", desc: "Connect with seafarers from 35 nationalities worldwide." },
];

const FeaturesSection = () => {
  const navigate = useNavigate();

  return (
    <section id="features" className="py-20 md:py-28 bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">Everything a Seafarer Needs. One App.</h2>
        <p className="text-muted-foreground text-center mb-14 max-w-xl mx-auto">Six powerful tools designed exclusively for life at sea.</p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} onClick={() => navigate('/app')} className="rounded-xl border border-border bg-card p-6 hover:border-primary/30 transition-colors cursor-pointer">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <f.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
