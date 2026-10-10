// Auto-load trigger for feeds. IntersectionObserver when available; scroll fallback
// for older iOS Safari (<12.2). Never runs two loads at once.

export interface SentinelEnv {
  IntersectionObserver?: typeof IntersectionObserver;
  addScroll?: (fn: () => void) => () => void;
  viewportHeight?: () => number;
}

/** Wraps an async loader so overlapping calls are ignored while one is in flight. */
export const singleFlight = (load: () => Promise<unknown>) => {
  let running = false;
  return async () => {
    if (running) return false;
    running = true;
    try { await load(); return true; } finally { running = false; }
  };
};

/** Watches `el`; calls onNear when it comes within `marginPx` of the visible area. Returns cleanup. */
export const watchSentinel = (
  el: Element,
  onNear: () => void,
  marginPx = 600,
  env: SentinelEnv = typeof window !== "undefined" ? (window as unknown as SentinelEnv) : {},
): (() => void) => {
  const IO = env.IntersectionObserver;
  if (IO) {
    const io = new IO((entries) => { if (entries.some((e) => e.isIntersecting)) onNear(); }, {
      rootMargin: `0px 0px ${marginPx}px 0px`,
    });
    io.observe(el);
    return () => io.disconnect();
  }
  // Fallback: capture scroll from any nested scroller (iOS momentum scrolling included).
  const check = () => {
    const vh = env.viewportHeight ? env.viewportHeight() : (typeof window !== "undefined" ? window.innerHeight : 0);
    if (el.getBoundingClientRect().top - vh < marginPx) onNear();
  };
  const add = env.addScroll || ((fn: () => void) => {
    document.addEventListener("scroll", fn, { capture: true, passive: true });
    window.addEventListener("resize", fn, { passive: true });
    return () => {
      document.removeEventListener("scroll", fn, { capture: true } as EventListenerOptions);
      window.removeEventListener("resize", fn);
    };
  });
  const remove = add(check);
  check();
  return remove;
};
