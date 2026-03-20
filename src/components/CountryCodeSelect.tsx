import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search } from "lucide-react";

interface CountryCode {
  flag: string;
  name: string;
  code: string;
}

interface CountryCodeSelectProps {
  value: string;
  onChange: (code: string) => void;
  codes: CountryCode[];
}

const CountryCodeSelect = ({ value, onChange, codes }: CountryCodeSelectProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = codes.find((c) => c.code === value && c.name) || codes[0];

  const filtered = codes.filter(
    (c) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.includes(search)
  );

  useEffect(() => {
    if (open) {
      setSearch("");
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 w-28 rounded-xl border border-border bg-secondary px-2 py-3 text-sm text-foreground outline-none focus:border-primary"
      >
        <span>{selected.flag}</span>
        <span className="flex-1 text-left">{selected.code}</span>
        <ChevronDown size={14} className="text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-56 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Search size={14} className="text-muted-foreground shrink-0" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search country..."
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">No results</div>
            )}
            {filtered.map((c) => (
              <button
                key={c.code + c.name}
                type="button"
                onClick={() => {
                  onChange(c.code);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 text-left text-sm px-3 py-2.5 transition-colors hover:bg-secondary ${
                  c.code === value ? "bg-secondary/60 font-medium" : "text-foreground"
                }`}
              >
                <span>{c.flag}</span>
                <span className="flex-1 truncate">{c.name}</span>
                <span className="text-muted-foreground">{c.code}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CountryCodeSelect;
