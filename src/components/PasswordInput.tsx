import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  autoComplete?: string;
  onEnter?: () => void;
}

/** Password field with a show/hide toggle. */
const PasswordInput = ({ value, onChange, placeholder = "••••••••", className, style, autoComplete, onEnter }: Props) => {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative", width: "100%" }}>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && onEnter) onEnter(); }}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={className}
        style={{ ...style, paddingRight: 46 }}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        style={{
          position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
          background: "transparent", border: "none", cursor: "pointer",
          padding: 10, display: "flex", alignItems: "center", justifyContent: "center",
          color: "#94a3b8",
        }}
      >
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
};

export default PasswordInput;
