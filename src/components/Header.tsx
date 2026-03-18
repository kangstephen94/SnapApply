import { useRef } from 'react';
import type { FeedbackMessage } from '../types';

interface HeaderProps {
  appCount: number;
  view: 'list' | 'form' | 'settings';
  setView: (view: 'list' | 'form' | 'settings') => void;
  webhookUrl: string;
  syncing: boolean;
  onSync: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  scanMsg: FeedbackMessage | null;
  setScanMsg: (msg: FeedbackMessage | null) => void;
}

export default function Header({
  appCount,
  view,
  setView,
  webhookUrl,
  syncing,
  onSync,
  onExport,
  onImport,
  scanMsg,
  setScanMsg,
}: HeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isExtension =
    typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage;

  const scanCurrentPage = () => {
    if (!isExtension) {
      setScanMsg({ ok: false, msg: 'Scan only works inside the Chrome extension.' });
      setTimeout(() => setScanMsg(null), 4000);
      return;
    }
    setScanMsg({ ok: true, msg: 'Scanning...' });
    chrome.runtime.sendMessage({ type: 'SCAN_PAGE' }, (resp: { ok?: boolean; error?: string }) => {
      if (resp && resp.ok) {
        setScanMsg({
          ok: true,
          msg: 'Injected! Check the page for the save widget.',
        });
      } else {
        setScanMsg({
          ok: false,
          msg: resp ? resp.error || 'Failed to scan page' : 'Failed to scan page',
        });
      }
      setTimeout(() => setScanMsg(null), 4000);
    });
  };

  const toggleForm = () => {
    setView(view === 'form' ? 'list' : 'form');
  };

  return (
    <div className="header">
      <div>
        <h1>Job Tracker</h1>
        <div className="sub">
          {appCount} application{appCount !== 1 ? 's' : ''} tracked
        </div>
      </div>
      <div className="header-actions">
        <button
          className="btn btn-secondary btn-icon"
          onClick={() =>
            setView(view === 'settings' ? 'list' : 'settings')
          }
          title="Settings"
        >
          ⚙️
        </button>
        <button
          className="btn btn-secondary"
          onClick={scanCurrentPage}
          title="Detect job on current page"
        >
          🔍 Scan Page
        </button>
        <button
          className="btn btn-secondary"
          onClick={onExport}
          disabled={appCount === 0}
        >
          📥 Export
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImport(file);
            e.target.value = '';
          }}
        />
        <button
          className="btn btn-secondary"
          onClick={() => fileInputRef.current?.click()}
        >
          📤 Import
        </button>
        {webhookUrl && (
          <button
            className="btn btn-secondary"
            onClick={onSync}
            disabled={syncing || appCount === 0}
          >
            {syncing ? '⏳...' : '📊 Sync'}
          </button>
        )}
        <button className="btn btn-primary" onClick={toggleForm}>
          {view === 'form' ? '✕ Close' : '+ Add'}
        </button>
      </div>
    </div>
  );
}
