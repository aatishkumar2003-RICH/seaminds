import { useState, useEffect, useCallback } from "react";
import { Newspaper, Globe, ExternalLink, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { voyageCache } from '@/lib/voyageCache';
import { useVoyageMode } from '@/hooks/useVoyageMode';
import VoyageModeBar from '@/components/VoyageModeBar';

type CountryKey = "india" | "philippines" | "indonesia" | "ukraine" | "russia" | "china" | "myanmar" | "bangladesh" | "croatia" | "greece" | "uk" | "usa";

const NATIONALITY_TO_COUNTRY: Record<string, CountryKey> = {
  "Indian": "india", "India": "india",
  "Filipino": "philippines", "Philippines": "philippines",
  "Indonesian": "indonesia", "Indonesia": "indonesia",
  "Ukrainian": "ukraine", "Ukraine": "ukraine",
  "Russian": "russia", "Russia": "russia",
  "Chinese": "china", "China": "china",
  "Burmese": "myanmar", "Myanmar": "myanmar",
  "Bangladeshi": "bangladesh", "Bangladesh": "bangladesh",
  "Croatian": "croatia", "Croatia": "croatia",
  "Greek": "greece", "Greece": "greece",
  "British": "uk", "United Kingdom": "uk", "UK": "uk",
  "American": "usa", "USA": "usa", "United States": "usa",
};

const decodeHTML = (html: string) => {
  const txt = document.createElement('textarea');
  txt.innerHTML = html;
  return txt.value;
};

interface FeedItem {
  title: string;
  summary: string;
  pubDate: string;
  link: string;
}

const COUNTRIES: { key: CountryKey; name: string; flag: string; feedUrl: string; moreUrl: string; moreLabel: string }[] = [
  { key: "india", name: "India", flag: "🇮🇳", feedUrl: "https://feeds.feedburner.com/ndtvnews-top-stories", moreUrl: "https://ndtv.com", moreLabel: "ndtv.com" },
  { key: "philippines", name: "Philippines", flag: "🇵🇭", feedUrl: "https://inquirer.net/feed", moreUrl: "https://inquirer.net", moreLabel: "inquirer.net" },
  { key: "indonesia", name: "Indonesia", flag: "🇮🇩", feedUrl: "https://kompas.com/rss/headlines", moreUrl: "https://kompas.com", moreLabel: "kompas.com" },
  { key: "ukraine", name: "Ukraine", flag: "🇺🇦", feedUrl: "https://ukrinform.net/rss/block-ato", moreUrl: "https://ukrinform.net", moreLabel: "ukrinform.net" },
  { key: "russia", name: "Russia", flag: "🇷🇺", feedUrl: "https://tass.com/rss/v2.xml", moreUrl: "https://tass.com", moreLabel: "tass.com" },
  { key: "china", name: "China", flag: "🇨🇳", feedUrl: "https://www.chinadaily.com.cn/rss/world_rss.xml", moreUrl: "https://chinadaily.com.cn", moreLabel: "chinadaily.com.cn" },
  { key: "myanmar", name: "Myanmar", flag: "🇲🇲", feedUrl: "https://www.irrawaddy.com/feed", moreUrl: "https://irrawaddy.com", moreLabel: "irrawaddy.com" },
  { key: "bangladesh", name: "Bangladesh", flag: "🇧🇩", feedUrl: "https://www.thedailystar.net/frontpage/rss.xml", moreUrl: "https://thedailystar.net", moreLabel: "thedailystar.net" },
  { key: "croatia", name: "Croatia", flag: "🇭🇷", feedUrl: "https://www.total-croatia-news.com/feed", moreUrl: "https://total-croatia-news.com", moreLabel: "total-croatia-news.com" },
  { key: "greece", name: "Greece", flag: "🇬🇷", feedUrl: "https://www.ekathimerini.com/rss", moreUrl: "https://ekathimerini.com", moreLabel: "ekathimerini.com" },
  { key: "uk", name: "United Kingdom", flag: "🇬🇧", feedUrl: "https://feeds.bbci.co.uk/news/rss.xml", moreUrl: "https://bbc.co.uk", moreLabel: "bbc.co.uk" },
  { key: "usa", name: "USA", flag: "🇺🇸", feedUrl: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml", moreUrl: "https://nytimes.com", moreLabel: "nytimes.com" },
];

const MARITIME_FEEDS = [
  "https://splash247.com/feed",
  "https://gcaptain.com/feed",
  "https://www.seatrade-maritime.com/rss.xml",
];

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "1 day ago";
    return `${diffDays} days ago`;
  } catch {
    return "";
  }
}

type FeedState = { items: FeedItem[]; loading: boolean; error: boolean };

const News = ({ nationality }: { nationality?: string }) => {
  const [selectedCountry, setSelectedCountry] = useState<CountryKey | null>(() => {
    if (nationality) {
      const mapped = NATIONALITY_TO_COUNTRY[nationality];
      if (mapped) return mapped;
    }
    return null;
  });
  const [countryFeeds, setCountryFeeds] = useState<Record<string, FeedState>>({});
  const [maritimeNews, setMaritimeNews] = useState<FeedState>({ items: [], loading: true, error: false });
  const [refreshing, setRefreshing] = useState(false);
  const voyageStatus = useVoyageMode();

  const fetchFeed = useCallback(async (feedUrl: string): Promise<{ items: FeedItem[]; error: boolean }> => {
    try {
      const { data, error } = await supabase.functions.invoke("rss-feed", {
        body: { feedUrl, limit: 5 },
      });
      if (error || !data?.success) return { items: [], error: true };
      return { items: data.items || [], error: false };
    } catch {
      return { items: [], error: true };
    }
  }, []);

  const fetchMaritimeNews = useCallback(async () => {
    if (!navigator.onLine) {
      const cached = voyageCache.loadNews();
      if (cached.length > 0) {
        setMaritimeNews({ items: cached, loading: false, error: false });
        return;
      }
    }

    setMaritimeNews(prev => ({ ...prev, loading: true, error: false }));
    const allItems: FeedItem[] = [];
    let hasError = true;

    for (const feedUrl of MARITIME_FEEDS) {
      const result = await fetchFeed(feedUrl);
      if (!result.error) {
        hasError = false;
        allItems.push(...result.items);
      }
    }

    // Sort by date, take top 8
    allItems.sort((a, b) => {
      const da = new Date(a.pubDate).getTime() || 0;
      const db = new Date(b.pubDate).getTime() || 0;
      return db - da;
    });

    const items = allItems.slice(0, 8);
    setMaritimeNews({ items, loading: false, error: hasError && allItems.length === 0 });
    voyageCache.saveNews(items);
  }, [fetchFeed]);

  const fetchCountryNews = useCallback(async (key: CountryKey) => {
    const country = COUNTRIES.find(c => c.key === key);
    if (!country) return;

    setCountryFeeds(prev => ({ ...prev, [key]: { items: [], loading: true, error: false } }));
    const result = await fetchFeed(country.feedUrl);
    setCountryFeeds(prev => ({
      ...prev,
      [key]: { items: result.items.slice(0, 5), loading: false, error: result.error },
    }));
  }, [fetchFeed]);

  useEffect(() => {
    fetchMaritimeNews();
  }, [fetchMaritimeNews]);

  useEffect(() => {
    if (selectedCountry && !countryFeeds[selectedCountry]) {
      fetchCountryNews(selectedCountry);
    }
  }, [selectedCountry, countryFeeds, fetchCountryNews]);

  const handleRefresh = async () => {
    setRefreshing(true);
    const promises: Promise<void>[] = [fetchMaritimeNews()];
    if (selectedCountry) {
      setCountryFeeds(prev => {
        const copy = { ...prev };
        delete copy[selectedCountry];
        return copy;
      });
      promises.push(fetchCountryNews(selectedCountry));
    }
    await Promise.all(promises);
    setRefreshing(false);
  };

  const countryInfo = selectedCountry ? COUNTRIES.find(c => c.key === selectedCountry) : null;
  const countryFeed = selectedCountry ? countryFeeds[selectedCountry] : null;

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Maritime News</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Live headlines from around the world</p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-primary"
        >
          <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Country Selector */}
        <div className="rounded-xl bg-card border border-border p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Globe size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              {selectedCountry ? `${countryInfo?.flag} ${countryInfo?.name} News` : "Select your home country for local news"}
            </h2>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {COUNTRIES.map((c) => (
              <button
                key={c.key}
                onClick={() => setSelectedCountry(c.key)}
                className={`flex flex-col items-center gap-1 rounded-lg p-2 transition-colors ${
                  selectedCountry === c.key
                    ? "bg-primary/20 border border-primary/40"
                    : "bg-secondary/50 border border-transparent hover:bg-secondary"
                }`}
              >
                <span className="text-xl">{c.flag}</span>
                <span className="text-[9px] text-muted-foreground leading-tight text-center">{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Country News */}
        {selectedCountry && countryFeed && (
          <div className="space-y-3">
            {countryFeed.loading ? (
              <div className="rounded-xl bg-card border border-border p-6 flex items-center justify-center">
                <RefreshCw size={16} className="animate-spin text-primary mr-2" />
                <span className="text-xs text-muted-foreground">Loading {countryInfo?.name} news...</span>
              </div>
            ) : countryFeed.error ? (
              <div className="rounded-xl bg-card border border-border p-6 text-center space-y-2">
                <AlertCircle size={20} className="text-destructive mx-auto" />
                <p className="text-xs text-muted-foreground">Could not load {countryInfo?.name} news</p>
                <Button size="sm" variant="outline" onClick={() => fetchCountryNews(selectedCountry)}>
                  Tap to retry
                </Button>
              </div>
            ) : (
              <>
                {countryFeed.items.map((article, i) => (
                  <a
                    key={i}
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-xl bg-card border border-border p-4 space-y-2 hover:border-primary/30 transition-colors"
                  >
                    <h3 className="font-semibold text-foreground text-sm leading-snug">{decodeHTML(article.title)}</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                        {countryInfo?.name}
                      </Badge>
                      {article.pubDate && (
                        <span className="text-[10px] text-primary font-medium">{timeAgo(article.pubDate)}</span>
                      )}
                    </div>
                    {article.summary && (
                      <p className="text-xs text-muted-foreground leading-relaxed">{decodeHTML(article.summary)}</p>
                    )}
                  </a>
                ))}
                <a
                  href={countryInfo?.moreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl bg-secondary/50 border border-border p-3 text-xs text-primary hover:bg-secondary transition-colors"
                >
                  <ExternalLink size={12} />
                  Full news available at {countryInfo?.moreLabel}
                </a>
              </>
            )}
          </div>
        )}

        {/* Maritime Industry News */}
        <div className="pt-2">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Newspaper size={14} className="text-primary" />
            Maritime Industry News
          </h2>
          <div className="space-y-3">
            {maritimeNews.loading ? (
              <div className="rounded-xl bg-card border border-border p-6 flex items-center justify-center">
                <RefreshCw size={16} className="animate-spin text-primary mr-2" />
                <span className="text-xs text-muted-foreground">Loading maritime news...</span>
              </div>
            ) : maritimeNews.error ? (
              <div className="rounded-xl bg-card border border-border p-6 text-center space-y-2">
                <AlertCircle size={20} className="text-destructive mx-auto" />
                <p className="text-xs text-muted-foreground">Could not load maritime news</p>
                <Button size="sm" variant="outline" onClick={fetchMaritimeNews}>
                  Tap to retry
                </Button>
              </div>
            ) : (
              maritimeNews.items.map((article, i) => (
                <a
                  key={i}
                  href={article.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-xl bg-card border border-border p-4 space-y-2 hover:border-primary/30 transition-colors"
                >
                  <h3 className="font-semibold text-foreground text-sm leading-snug">{decodeHTML(article.title)}</h3>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">Maritime</Badge>
                    {article.pubDate && (
                      <span className="text-[10px] text-primary font-medium">{timeAgo(article.pubDate)}</span>
                    )}
                  </div>
                  {article.summary && (
                    <p className="text-xs text-muted-foreground leading-relaxed">{decodeHTML(article.summary)}</p>
                  )}
                </a>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default News;
