import { useState, useEffect } from "react";
import { ArrowLeft, Plus, X } from "lucide-react";

interface Cert {
  id: string;
  name: string;
  issueDate: string;
  expiryDate: string;
  certNumber: string;
}

const STORAGE_KEY = "seaminds_certs";

const SUGGESTED_CERTS = [
  "STCW Basic Safety",
  "Medical Certificate",
  "Certificate of Competency",
  "GMDSS Certificate",
  "ECDIS Type Approval",
  "Flag State Endorsement",
];

const getDaysRemaining = (expiryDate: string) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - now.getTime()) / 86400000);
};

const CertWallet = () => {
  const [certs, setCerts] = useState<Cert[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [certNumber, setCertNumber] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setCerts(JSON.parse(saved));
    } catch {}
  }, []);

  const saveCerts = (updated: Cert[]) => {
    setCerts(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const handleSave = () => {
    if (!name.trim() || !issueDate || !expiryDate) return;
    const newCert: Cert = {
      id: crypto.randomUUID(),
      name: name.trim(),
      issueDate,
      expiryDate,
      certNumber: certNumber.trim(),
    };
    saveCerts([...certs, newCert]);
    setName("");
    setIssueDate("");
    setExpiryDate("");
    setCertNumber("");
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    saveCerts(certs.filter((c) => c.id !== id));
  };

  if (showForm) {
    return (
      <div className="flex flex-col h-full px-4 py-3 overflow-y-auto">
        <button
          onClick={() => setShowForm(false)}
          className="flex items-center gap-2 mb-4"
          style={{ color: "#D4AF37" }}
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-medium">Back</span>
        </button>

        <h2 className="text-lg font-bold text-foreground mb-1">Add Certificate</h2>
        <p className="text-xs text-muted-foreground mb-5">
          Track your maritime certificates and never miss a renewal.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Certificate Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. STCW Basic Safety"
              className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {SUGGESTED_CERTS.map((s) => (
                <button
                  key={s}
                  onClick={() => setName(s)}
                  className="text-[10px] px-2.5 py-1 rounded-full border transition-colors"
                  style={{
                    borderColor: name === s ? "#D4AF37" : "rgba(255,255,255,0.1)",
                    color: name === s ? "#D4AF37" : "rgba(255,255,255,0.5)",
                    background: name === s ? "rgba(212,175,55,0.1)" : "transparent",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Issue Date *
            </label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Expiry Date *
            </label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Certificate Number (optional)
            </label>
            <input
              type="text"
              value={certNumber}
              onChange={(e) => setCertNumber(e.target.value)}
              placeholder="e.g. PH-2024-12345"
              className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={!name.trim() || !issueDate || !expiryDate}
            className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-40 transition-opacity"
            style={{
              background: "linear-gradient(135deg, #D4AF37, #C5941F)",
              color: "#0D1B2A",
            }}
          >
            Save Certificate
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full px-4 py-3 overflow-y-auto">
      <div className="mb-4">
        <h1 className="text-xl font-bold" style={{ color: "#D4AF37" }}>
          📜 Certificate Wallet
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Track expiry. Never miss renewal.
        </p>
      </div>

      {certs.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-sm text-muted-foreground mb-1">No certificates added yet</p>
          <p className="text-xs text-muted-foreground mb-4">
            Add your maritime certificates to track expiry dates and stay compliant.
          </p>
        </div>
      ) : (
        <div className="space-y-3 flex-1">
          {certs
            .sort((a, b) => getDaysRemaining(a.expiryDate) - getDaysRemaining(b.expiryDate))
            .map((cert) => {
              const days = getDaysRemaining(cert.expiryDate);
              const isExpired = days < 0;
              const badgeColor = isExpired
                ? "#ef4444"
                : days < 30
                ? "#ef4444"
                : days < 90
                ? "#f59e0b"
                : "#22c55e";
              const badgeText = isExpired
                ? "EXPIRED"
                : `${days}d remaining`;

              return (
                <div
                  key={cert.id}
                  className="rounded-xl p-3.5"
                  style={{
                    background: "rgba(13,27,42,0.8)",
                    border: `1px solid ${isExpired ? "rgba(239,68,68,0.3)" : "rgba(212,175,55,0.15)"}`,
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">
                        {cert.name}
                      </p>
                      {cert.certNumber && (
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          #{cert.certNumber}
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Expires: {new Date(cert.expiryDate).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                        style={{
                          background: `${badgeColor}20`,
                          color: badgeColor,
                        }}
                      >
                        {badgeText}
                      </span>
                      <button
                        onClick={() => handleDelete(cert.id)}
                        className="p-1 rounded-full hover:bg-secondary transition-colors"
                      >
                        <X size={14} className="text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      <div className="pt-4 pb-2">
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors"
          style={{
            border: "1.5px solid #D4AF37",
            color: "#D4AF37",
            background: "transparent",
          }}
        >
          <Plus size={16} />
          Add Certificate
        </button>
      </div>
    </div>
  );
};

export default CertWallet;
