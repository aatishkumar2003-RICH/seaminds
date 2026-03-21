import { useState, useEffect } from 'react';

export interface VoyageStatus {
  isOnline: boolean;
  isVoyageMode: boolean;
  signalStrength: 0 | 1 | 2 | 3 | 4;
  connectionType: string;
}

export function useVoyageMode(): VoyageStatus {
  const getStatus = (): VoyageStatus => {
    const online = navigator.onLine;
    const conn = (navigator as any).connection;
    let strength: 0 | 1 | 2 | 3 | 4 = online ? 4 : 0;
    let type = 'WiFi';
    if (online && conn) {
      type = (conn.effectiveType || 'wifi').toUpperCase();
      const dl = conn.downlink || 10;
      if (dl < 0.5) strength = 1;
      else if (dl < 2) strength = 2;
      else if (dl < 6) strength = 3;
      else strength = 4;
      if (type === 'SLOW-2G' || type === '2G') strength = 1;
    }
    if (!online) { strength = 0; type = '—'; }
    return { isOnline: online, isVoyageMode: !online || strength <= 1, signalStrength: strength, connectionType: type };
  };

  const [status, setStatus] = useState<VoyageStatus>(getStatus);
  useEffect(() => {
    const update = () => setStatus(getStatus());
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    const conn = (navigator as any).connection;
    if (conn) conn.addEventListener('change', update);
    const t = setInterval(update, 30000);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      if (conn) conn.removeEventListener('change', update);
      clearInterval(t);
    };
  }, []);
  return status;
}
