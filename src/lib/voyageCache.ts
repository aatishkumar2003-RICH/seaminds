const NEWS_KEY = 'sm_voyage_news';
const NEWS_TS_KEY = 'sm_voyage_news_ts';

export const voyageCache = {
  saveNews: (items: any[]) => {
    try {
      localStorage.setItem(NEWS_KEY, JSON.stringify(items.slice(0, 60)));
      localStorage.setItem(NEWS_TS_KEY, Date.now().toString());
    } catch (e) { console.warn('VoyageCache save failed', e); }
  },
  loadNews: (): any[] => {
    try {
      const raw = localStorage.getItem(NEWS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },
  getLastSync: (): Date | null => {
    const ts = localStorage.getItem(NEWS_TS_KEY);
    return ts ? new Date(parseInt(ts)) : null;
  },
  count: (): number => {
    try {
      const r = localStorage.getItem(NEWS_KEY);
      return r ? JSON.parse(r).length : 0;
    } catch { return 0; }
  }
};
