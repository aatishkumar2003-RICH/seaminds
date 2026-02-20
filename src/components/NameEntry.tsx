import { useState } from "react";
import { Anchor } from "lucide-react";

interface NameEntryProps {
  onSubmit: (firstName: string, shipName: string, role: string) => void;
}

const ROLES = ["Captain", "Officer", "Rating", "Engineer"];

const NameEntry = ({ onSubmit }: NameEntryProps) => {
  const [firstName, setFirstName] = useState("");
  const [shipName, setShipName] = useState("");
  const [role, setRole] = useState("");

  const canSubmit = firstName.trim() && shipName.trim() && role;

  return (
    <div className="flex flex-col items-center justify-center h-full px-8">
      <div className="w-full max-w-xs space-y-8">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto">
            <Anchor size={28} className="text-primary" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Welcome to SeaMinds</h1>
          <p className="text-sm text-muted-foreground">Tell us a little about yourself</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground uppercase tracking-wide">First Name</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="e.g. Rajan"
              className="w-full bg-secondary text-foreground text-sm rounded-xl px-4 py-3 placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground uppercase tracking-wide">Ship Name</label>
            <input
              type="text"
              value={shipName}
              onChange={(e) => setShipName(e.target.value)}
              placeholder="e.g. MV Pacific Star"
              className="w-full bg-secondary text-foreground text-sm rounded-xl px-4 py-3 placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground uppercase tracking-wide">Your Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-secondary text-foreground text-sm rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-primary appearance-none"
            >
              <option value="" disabled className="text-muted-foreground">Select your role</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={() => canSubmit && onSubmit(firstName.trim(), shipName.trim(), role)}
          disabled={!canSubmit}
          className="w-full bg-primary text-primary-foreground font-medium text-sm rounded-xl py-3.5 disabled:opacity-30 transition-opacity"
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default NameEntry;
