import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'chess-dojo-install-dismissed';

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/** 「ホーム画面に追加」の案内とオフライン対応の状態表示 */
export function InstallCard() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(readDismissed);
  const [installed, setInstalled] = useState(isStandalone);
  const [offlineReady, setOfflineReady] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => setOfflineReady(!!navigator.serviceWorker.controller)).catch(() => {});
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || dismissed) return offlineReady ? <p className="muted small center">✓ オフラインでも使えます</p> : null;

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  return (
    <div className="card install">
      <h3>📲 ホーム画面に追加</h3>
      <p className="muted">アプリのように起動でき、オフラインでも使えます。</p>
      {prompt ? (
        <button
          className="btn primary wide"
          onClick={async () => {
            await prompt.prompt();
            const r = await prompt.userChoice;
            if (r.outcome === 'accepted') setInstalled(true);
            setPrompt(null);
          }}
        >
          追加する
        </button>
      ) : isIos ? (
        <p className="small">Safari の共有ボタン(□↑)から「ホーム画面に追加」を選んでください。</p>
      ) : (
        <p className="small">ブラウザのメニューから「ホーム画面に追加」または「アプリをインストール」を選んでください。</p>
      )}
      <button className="btn ghost small" onClick={dismiss}>
        今は表示しない
      </button>
    </div>
  );
}
