import { useEffect } from 'react';
import { useProgress } from '../store/useStore';

/** XP・バッジ獲得の通知。先頭から1件ずつ表示する */
export function Toast() {
  const msg = useProgress((s) => s.pendingToasts[0]);
  const shift = useProgress((s) => s.shiftToast);

  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(shift, 2600);
    return () => window.clearTimeout(t);
  }, [msg, shift]);

  if (!msg) return null;
  return (
    <div className="toast" role="status" onClick={shift}>
      {msg}
    </div>
  );
}
