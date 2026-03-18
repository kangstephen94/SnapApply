import { useState, useEffect, useCallback } from 'react';
import Storage from '../utils/storage';
import type { JobApp, FeedbackMessage } from '../types';

export function useWebhook() {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<FeedbackMessage | null>(null);
  const [testResult, setTestResult] = useState<FeedbackMessage | null>(null);

  useEffect(() => {
    Storage.get('webhook-url').then((url) => setWebhookUrl(url || ''));
  }, []);

  const saveUrl = useCallback(async (url: string) => {
    setWebhookUrl(url);
    await Storage.set('webhook-url', url);
  }, []);

  const syncToSheets = useCallback(
    async (apps: JobApp[], testOnly = false) => {
      if (!webhookUrl) {
        setSyncMsg({ ok: false, msg: 'No webhook URL configured.' });
        return;
      }
      setSyncing(true);
      setSyncMsg(null);
      setTestResult(null);

      const rows = testOnly
        ? [
            {
              date: new Date().toISOString().split('T')[0],
              company: 'Test Company',
              role: 'Test Role',
              location: '',
              status: 'Applied',
              url: '',
              notes: 'Connection test — delete this row',
            },
          ]
        : apps;

      const payload = JSON.stringify({
        headers: ['Date Applied', 'Company', 'Role', 'Location', 'Status', 'URL', 'Notes'],
        rows: rows.map((a) => [
          a.date,
          a.company,
          a.role,
          a.location || '',
          a.status,
          a.url || '',
          a.notes || '',
        ]),
      });

      try {
        const resp = await fetch(webhookUrl, {
          method: 'POST',
          body: payload,
          redirect: 'follow',
        });
        if (resp.ok || resp.type === 'opaque') {
          const msg = testOnly
            ? 'Test row sent! Check your Google Sheet.'
            : `Synced ${apps.length} applications to Sheets!`;
          testOnly
            ? setTestResult({ ok: true, msg })
            : setSyncMsg({ ok: true, msg });
        } else {
          throw new Error('HTTP ' + resp.status);
        }
      } catch (err) {
        if (err instanceof TypeError) {
          try {
            await fetch(webhookUrl, {
              method: 'POST',
              mode: 'no-cors',
              body: payload,
            });
            const msg = testOnly
              ? 'Request sent! Check your sheet to confirm.'
              : `Sent ${apps.length} applications — check your sheet!`;
            testOnly
              ? setTestResult({ ok: true, msg })
              : setSyncMsg({ ok: true, msg });
          } catch (e2) {
            const msg = 'Failed: ' + (e2 instanceof Error ? e2.message : String(e2));
            testOnly
              ? setTestResult({ ok: false, msg })
              : setSyncMsg({ ok: false, msg });
          }
        } else {
          const msg = 'Failed: ' + (err instanceof Error ? err.message : String(err));
          testOnly
            ? setTestResult({ ok: false, msg })
            : setSyncMsg({ ok: false, msg });
        }
      }

      setSyncing(false);
      if (!testOnly) {
        setTimeout(() => setSyncMsg(null), 5000);
      }
    },
    [webhookUrl]
  );

  return {
    webhookUrl,
    setWebhookUrl,
    saveUrl,
    syncing,
    syncMsg,
    testResult,
    setTestResult,
    syncToSheets,
  };
}
