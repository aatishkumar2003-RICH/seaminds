import { ArrowLeft, Shield, Phone, Scale, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ITFRightsProps {
  onBack: () => void;
}

const ITFRights = ({ onBack }: ITFRightsProps) => {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border flex items-center gap-3">
        <button onClick={onBack} className="text-muted-foreground">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="font-semibold text-foreground">ITF Rights</h2>
          <p className="text-[11px] text-muted-foreground">Your rights as a seafarer</p>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {/* Important notice */}
          <div className="rounded-xl bg-primary/10 border border-primary/20 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield size={16} className="text-primary" />
              <p className="text-sm font-semibold text-primary">You Cannot Be Punished</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Under the MLC 2006, seafarers have the right to make complaints without fear of retaliation. 
              Contacting the ITF is confidential. Your employer cannot penalise, dismiss, or blacklist you for contacting the ITF.
            </p>
          </div>

          {/* What ITF inspects */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">What ITF Inspects</h3>
            <ul className="space-y-1.5">
              {[
                "Seafarer Employment Agreements — comparing your contract to CBA terms",
                "Wage payments — ensuring you receive at least ITF-approved CBA minimums",
                "Hours of work and rest — checking actual records vs. requirements",
                "Food quality, quantity, and drinking water standards",
                "Accommodation conditions — cleanliness, heating, ventilation",
                "Repatriation arrangements — your right to go home",
                "Social security and insurance provisions",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-primary/60 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* How to contact */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <Phone size={14} className="text-primary" />
              How to Contact ITF Confidentially
            </h3>
            <ul className="space-y-1.5">
              {[
                "ITF Seafarers' app — download from app store, message directly",
                "Email: mail@itf.org.uk — all communications treated confidentially",
                "ITF inspectors visit ports worldwide — ask port welfare to arrange",
                "ITF has inspectors in over 50 countries",
                "You can request contact through port chaplains or welfare centres",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-primary/60 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Underpaid wages */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <Scale size={14} className="text-primary" />
              If Your Wages Are Underpaid
            </h3>
            <ul className="space-y-1.5">
              {[
                "ITF can compare your wages against the approved CBA for your vessel",
                "If underpaid, ITF will negotiate with the shipowner for back pay",
                "ITF has recovered over $50 million in unpaid wages annually",
                "In abandonment cases, ITF helps with food, fuel, and repatriation",
                "Flag state and port state can also be involved to enforce payment",
                "Keep copies of your contract, payslips, and bank statements as evidence",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-primary/60 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Link */}
          <a
            href="https://www.itfseafarers.org"
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <Button variant="outline" className="w-full gap-2">
              <ExternalLink size={14} />
              Visit itfseafarers.org
            </Button>
          </a>
        </div>
      </ScrollArea>
    </div>
  );
};

export default ITFRights;
