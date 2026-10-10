// Service-worker runtime caching rules (imported by vite.config.ts). No imports — testable.
// User-specific and transactional backend calls are NEVER cached; only public catalogue reads are.

/** Public, non-personal tables that may be served from cache when the network stalls. */
export const PUBLIC_CACHEABLE_TABLES = ["blog_posts", "ship_photos", "question_bank"] as const;

/** Old cache names to delete on update (held user data before this change). */
export const LEGACY_CACHE_NAMES = ["supabase-api"];

export const PUBLIC_CACHE_NAME = "supabase-public-v2";

const publicPattern = new RegExp(
  `^https:\\/\\/[^/]*\\.supabase\\.co\\/rest\\/v1\\/(${PUBLIC_CACHEABLE_TABLES.join("|")})(\\?|$)`,
  "i",
);

export const runtimeCachingRules = [
  {
    urlPattern: publicPattern,
    handler: "NetworkFirst" as const,
    options: {
      cacheName: PUBLIC_CACHE_NAME,
      networkTimeoutSeconds: 6,
      expiration: { maxEntries: 40, maxAgeSeconds: 300 },
    },
  },
  {
    // Everything else on the backend (auth, profiles, applications, RPCs, functions, storage): never cached.
    urlPattern: /^https:\/\/[^/]*\.supabase\.co\/.*/i,
    handler: "NetworkOnly" as const,
  },
];

/** Which handler a URL gets (first matching rule wins, like Workbox). */
export const cacheHandlerFor = (url: string): string | null => {
  const r = runtimeCachingRules.find((x) => x.urlPattern.test(url));
  return r ? r.handler : null;
};

/** Removes caches from older service workers that may hold personal responses. */
export const purgeLegacyCaches = async (cs: Pick<CacheStorage, "delete"> | undefined = (globalThis as any).caches) => {
  if (!cs) return;
  await Promise.allSettled(LEGACY_CACHE_NAMES.map((n) => cs.delete(n)));
};
