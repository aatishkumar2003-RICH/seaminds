import { useState } from "react";
import CrewPaymentGate from "@/components/smc/CrewPaymentGate";
import SMCScoreCertificate from "@/components/smc/SMCScoreCertificate";

interface SMCScoreTabProps {
  profileId: string;
}

const SMCScoreTab = ({ profileId }: SMCScoreTabProps) => {
  // For demo purposes, toggle between payment gate and score display
  // In production, check smc_payments table for completed payment
  const [hasPaid, setHasPaid] = useState(false);

  if (!hasPaid) {
    return <CrewPaymentGate profileId={profileId} onPaymentSuccess={() => setHasPaid(true)} />;
  }

  return <SMCScoreCertificate />;
};

export default SMCScoreTab;
