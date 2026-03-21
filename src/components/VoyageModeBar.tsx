import React from 'react';
import { type VoyageStatus } from '@/hooks/useVoyageMode';
import { voyageCache } from '@/lib/voyageCache';

const SignalBars = ({ strength }: { strength: number }) => (
  <div className="flex items-end gap-[2px] h-3">
    {[1, 2, 3, 4].map(i => (
      <div
        key={i}
        className={`w-[3px] rounded-sm transition-colors ${
          i <= strength ? 'bg-primary' : 'bg-muted-foreground/30'
        }`}
        style={{ height: `${4 + i * 3}px` }}
      />
    ))}
  </div>
);

export const VoyageModeBar: React.FC<{ status: VoyageStatus }> = ({ status }) => {
  if (!status.isVoyageMode) return null;
  const last = voyageCache.getLastSync();
  const count = voyageCache.count();
  const fmt = (d: Date | null) => {
    if (!d) return 'Not cached';
    const m = Math.floor((Date.now() - d.getTime()) / 60000);
    if (m < 2) return 'Just cached';
    if (m < 60) return `${m}m ago`;
    return `${Math.floor(m / 60)}h ago`;
  };
  return (
    <div className="flex items-center justify-between px-4 py-1.5 bg-amber-500/15 border-b border-amber-500/30 text-xs">
      <span className="font-medium text-amber-400">
        ⚓ {status.isOnline ? 'Voyage Mode' : 'Offline'}
      </span>
      <div className="flex items-center gap-2 text-muted-foreground">
        {count > 0 && (
          <span>{count} articles · {fmt(last)}</span>
        )}
        <SignalBars strength={status.signalStrength} />
        <span>{status.connectionType}</span>
      </div>
    </div>
  );
};
export default VoyageModeBar;
