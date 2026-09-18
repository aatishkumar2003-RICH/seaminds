import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { isBlank } from "@/lib/takeover/answers";
import type { ItemStatus, SaveState } from "@/hooks/takeover/useInspection";

export const GOLD = "#D4AF37";

export const Label = ({ children }: { children: ReactNode }) => (
  <span className="block text-[11px] uppercase tracking-wide text-[#94A3B8] mb-1">{children}</span>
);

export const Guidance = ({ title, body }: { title: string; body?: string }) =>
  body ? (
    <div className="mb-2">
      <span className="text-[11px] uppercase tracking-wide text-[#D4AF37]/70">{title}</span>
      <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">{body}</p>
    </div>
  ) : null;

export function OptionGroup<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { value: T; label: string; tone?: "good" | "bad" | "muted" }[];
  value?: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-[44px] px-4 rounded-xl text-sm font-semibold border transition-colors disabled:opacity-50",
              active
                ? o.tone === "bad"
                  ? "bg-red-500/20 border-red-400 text-red-200"
                  : o.tone === "muted"
                  ? "bg-slate-500/20 border-slate-400 text-slate-100"
                  : "bg-[#D4AF37] border-[#D4AF37] text-[#0D1B2A]"
                : "bg-transparent border-[rgba(212,175,55,0.3)] text-slate-300"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export const TextField = ({
  label,
  value,
  onChange,
  disabled,
  placeholder,
  type = "text",
  multiline,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  type?: string;
  multiline?: boolean;
}) => (
  <label className="block">
    <Label>{label}</Label>
    {multiline ? (
      <textarea
        value={value ?? ""}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full rounded-xl bg-[#0D1B2A] border border-[rgba(212,175,55,0.3)] px-3 py-2 text-sm text-slate-100 disabled:opacity-60"
      />
    ) : (
      <input
        type={type}
        value={value ?? ""}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-h-[44px] rounded-xl bg-[#0D1B2A] border border-[rgba(212,175,55,0.3)] px-3 text-sm text-slate-100 disabled:opacity-60"
      />
    )}
  </label>
);

/** Number entry that keeps blank (unknown) distinct from 0. */
export const NumberField = ({
  label,
  value,
  onChange,
  disabled,
  hint,
  error,
}: {
  label: string;
  value?: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
  hint?: string;
  error?: string;
}) => (
  <label className="block">
    <Label>{label}</Label>
    <input
      inputMode="numeric"
      value={isBlank(value) ? "" : String(value)}
      disabled={disabled}
      placeholder="blank = unknown"
      onChange={(e) => {
        const t = e.target.value.trim();
        onChange(t === "" ? null : Number(t));
      }}
      className={cn(
        "w-full min-h-[44px] rounded-xl bg-[#0D1B2A] border px-3 text-sm text-slate-100 disabled:opacity-60",
        error ? "border-red-400" : "border-[rgba(212,175,55,0.3)]"
      )}
    />
    {hint && <span className="text-[11px] text-[#94A3B8]">{hint}</span>}
    {error && <span className="block text-[11px] text-red-300">{error}</span>}
  </label>
);

export const ItemCard = ({ children, flagged }: { children: ReactNode; flagged?: boolean }) => (
  <div
    className={cn(
      "rounded-2xl bg-[#112240] border p-4 mb-3",
      flagged ? "border-red-400/50" : "border-[rgba(212,175,55,0.3)]"
    )}
  >
    {children}
  </div>
);

export const SaveIndicator = ({ state }: { state: SaveState }) => {
  const map: Record<SaveState, { text: string; cls: string }> = {
    idle: { text: "Ready", cls: "text-[#94A3B8]" },
    saving: { text: "Saving…", cls: "text-[#D4AF37]" },
    saved: { text: "Saved to server", cls: "text-green-400" },
    unsynced: { text: "Unsynced", cls: "text-amber-400" },
    failed: { text: "Save failed", cls: "text-red-400" },
    conflict: { text: "Conflict — needs a decision", cls: "text-amber-300" },
  };
  const s = map[state];
  return <span className={cn("text-xs font-semibold", s.cls)}>{s.text}</span>;
};

/** Per-item sync badge so an inspector can see exactly which row is behind. */
export const ItemSyncBadge = ({ status }: { status?: ItemStatus }) => {
  if (!status || status === "clean") return null;
  const map: Record<Exclude<ItemStatus, "clean">, { t: string; c: string }> = {
    pending: { t: "unsynced", c: "text-amber-400" },
    saving: { t: "saving…", c: "text-[#D4AF37]" },
    failed: { t: "save failed", c: "text-red-400" },
    conflict: { t: "conflict", c: "text-amber-300" },
  };
  const s = map[status];
  return <span className={cn("text-[10px] font-semibold", s.c)}>{s.t}</span>;
};

/** Multi-select chips — nothing is preselected and nothing is inferred. */
export function MultiSelect({
  options,
  values,
  onChange,
  disabled,
}: {
  options: readonly { value: string; label: string }[];
  values?: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
}) {
  const set = new Set(values || []);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = set.has(o.value);
        return (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            onClick={() => {
              const next = new Set(set);
              if (active) next.delete(o.value);
              else next.add(o.value);
              onChange([...next]);
            }}
            className={cn(
              "min-h-[40px] px-3 rounded-xl text-xs font-semibold border transition-colors disabled:opacity-50",
              active
                ? "bg-[#D4AF37] border-[#D4AF37] text-[#0D1B2A]"
                : "bg-transparent border-[rgba(212,175,55,0.3)] text-slate-300"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export const WarnNote = ({ children }: { children: ReactNode }) => (
  <p className="text-[11px] text-amber-300 bg-amber-400/10 border border-amber-400/30 rounded-xl px-3 py-2">
    {children}
  </p>
);
