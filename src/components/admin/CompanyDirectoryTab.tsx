import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Globe, Mail, Building2, ExternalLink, Search, Download } from 'lucide-react';

interface CompanyEntry {
  name: string;
  website: string | null;
  email: string | null;
  vacancyCount: number;
  ranks: string[];
  vesselTypes: string[];
  sources: string[];
  lastSeen: string | null;
}

export default function CompanyDirectoryTab() {
  const [companies, setCompanies] = useState<CompanyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('external_vacancies')
      .select('company_name, company_website, contact_email, rank_required, vessel_type, source, fetched_at')
      .not('company_name', 'is', null)
      .eq('is_scam_flagged', false);

    if (!data) { setLoading(false); return; }

    const map: Record<string, CompanyEntry> = {};
    for (const v of data) {
      const key = (v.company_name || '').trim().toLowerCase();
      if (!key || key === 'unknown' || key === 'confidential' || key.length < 2) continue;
      if (!map[key]) {
        map[key] = {
          name: v.company_name!,
          website: v.company_website || null,
          email: v.contact_email || null,
          vacancyCount: 0,
          ranks: [],
          vesselTypes: [],
          sources: [],
          lastSeen: null,
        };
      }
      const c = map[key];
      c.vacancyCount++;
      if (!c.website && v.company_website) c.website = v.company_website;
      if (!c.email && v.contact_email) c.email = v.contact_email;
      if (v.rank_required && !c.ranks.includes(v.rank_required)) c.ranks.push(v.rank_required);
      if (v.vessel_type && !c.vesselTypes.includes(v.vessel_type)) c.vesselTypes.push(v.vessel_type);
      if (v.source && !c.sources.includes(v.source)) c.sources.push(v.source);
      if (v.fetched_at && (!c.lastSeen || v.fetched_at > c.lastSeen)) c.lastSeen = v.fetched_at;
    }

    const sorted = Object.values(map).sort((a, b) => b.vacancyCount - a.vacancyCount);
    setCompanies(sorted);
    setLoading(false);
  };

  const filtered = search
    ? companies.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.ranks.some(r => r.toLowerCase().includes(search.toLowerCase())) ||
        c.vesselTypes.some(v => v.toLowerCase().includes(search.toLowerCase()))
      )
    : companies;

  const withWebsite = companies.filter(c => c.website).length;
  const withEmail = companies.filter(c => c.email).length;

  const exportCSV = () => {
    const headers = ['Company','Website','Email','Vacancies','Ranks','Vessel Types','Sources','Last Seen'];
    const rows = filtered.map(c => [
      `"${c.name.replace(/"/g, '""')}"`,
      c.website || '',
      c.email || '',
      c.vacancyCount,
      `"${c.ranks.join(', ')}"`,
      `"${c.vesselTypes.join(', ')}"`,
      `"${c.sources.join(', ')}"`,
      c.lastSeen ? new Date(c.lastSeen).toLocaleDateString() : '',
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `company-directory-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <p className="text-muted-foreground text-center py-10">Loading company directory...</p>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold text-foreground">🏢 Company Directory</h2>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span>Total: <strong className="text-foreground">{companies.length}</strong></span>
          <span>🌐 With Website: <strong className="text-primary">{withWebsite}</strong></span>
          <span>📧 With Email: <strong className="text-foreground">{withEmail}</strong></span>
        </div>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search companies, ranks, vessel types..."
          className="pl-9 h-9 text-sm"
        />
      </div>

      <div className="text-xs text-muted-foreground">
        Showing {filtered.length} of {companies.length} companies
      </div>

      <div className="grid gap-3">
        {filtered.slice(0, 100).map(c => (
          <div key={c.name} className="rounded-xl bg-card border border-border p-4 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Building2 size={14} className="text-primary shrink-0" />
                  <h3 className="text-sm font-semibold text-foreground truncate">{c.name}</h3>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>{c.vacancyCount} vacancy{c.vacancyCount !== 1 ? 'ies' : 'y'}</span>
                  {c.lastSeen && (
                    <span>Last seen: {new Date(c.lastSeen).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                {c.website && (
                  <a
                    href={c.website.startsWith('http') ? c.website : `https://${c.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded-md bg-primary/10 text-primary px-2.5 py-1.5 text-[11px] font-medium hover:bg-primary/20 transition-colors"
                  >
                    <Globe size={11} /> Website
                    <ExternalLink size={9} />
                  </a>
                )}
                {c.email && (
                  <a
                    href={`mailto:${c.email}`}
                    className="flex items-center gap-1 rounded-md bg-secondary text-foreground px-2.5 py-1.5 text-[11px] font-medium hover:bg-secondary/80 transition-colors"
                  >
                    <Mail size={11} /> {c.email}
                  </a>
                )}
              </div>
            </div>

            {(c.ranks.length > 0 || c.vesselTypes.length > 0) && (
              <div className="flex flex-wrap gap-1">
                {c.ranks.slice(0, 5).map(r => (
                  <Badge key={r} className="text-[10px] bg-primary/10 text-primary border-0">{r}</Badge>
                ))}
                {c.ranks.length > 5 && (
                  <Badge variant="outline" className="text-[10px]">+{c.ranks.length - 5} more</Badge>
                )}
                {c.vesselTypes.slice(0, 3).map(v => (
                  <Badge key={v} variant="secondary" className="text-[10px]">{v}</Badge>
                ))}
              </div>
            )}

            <div className="flex gap-1">
              {c.sources.map(s => (
                <span key={s} className="text-[10px] text-muted-foreground/60">
                  {({ google_jobs: '🔍', rss_feed: '📰', telegram: '📱', india_philippines: '🌏', regional_global: '🌍', internal: '🏢' } as Record<string, string>)[s] || '📋'} {s}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {filtered.length > 100 && (
        <p className="text-xs text-muted-foreground text-center">Showing first 100 of {filtered.length} results. Use search to narrow down.</p>
      )}
    </div>
  );
}
