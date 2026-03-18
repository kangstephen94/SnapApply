import { useState, useCallback } from 'react';
import { useJobApps } from './hooks/useJobApps';
import { useWebhook } from './hooks/useWebhook';
import { genId } from './utils/constants';
import Header from './components/Header';
import Feedback from './components/Feedback';
import Stats from './components/Stats';
import Filters from './components/Filters';
import AppList from './components/AppList';
import AppForm from './components/AppForm';
import SetupWizard from './components/SetupWizard';
import type { JobApp, FeedbackMessage } from './types';
import './App.css';

export default function App() {
  const { apps, loading, addApp, updateApp, deleteApp, importApps } = useJobApps();
  const webhook = useWebhook();

  const [view, setView] = useState<'list' | 'form' | 'settings'>('list');
  const [editing, setEditing] = useState<JobApp | null>(null);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [scanMsg, setScanMsg] = useState<FeedbackMessage | null>(null);

  // ── Form handlers ──────────────────────────────────────────────
  const handleFormSubmit = useCallback(
    (formData: JobApp) => {
      if (editing) {
        updateApp(editing.id, formData);
      } else {
        addApp({ ...formData, id: genId() });
      }
      setEditing(null);
      setView('list');
    },
    [editing, addApp, updateApp]
  );

  const handleFormCancel = useCallback(() => {
    setEditing(null);
    setView('list');
  }, []);

  const handleEdit = useCallback((app: JobApp) => {
    setEditing(app);
    setView('form');
  }, []);

  const handleUpdateStatus = useCallback(
    (id: string, status: string) => {
      updateApp(id, { status });
    },
    [updateApp]
  );

  // ── CSV import ─────────────────────────────────────────────────
  const importCSV = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (!text) return;

        // Parse CSV handling quoted fields
        const parseRow = (line: string): string[] => {
          const fields: string[] = [];
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQuotes) {
              if (ch === '"' && line[i + 1] === '"') {
                current += '"';
                i++;
              } else if (ch === '"') {
                inQuotes = false;
              } else {
                current += ch;
              }
            } else {
              if (ch === '"') {
                inQuotes = true;
              } else if (ch === ',') {
                fields.push(current.trim());
                current = '';
              } else {
                current += ch;
              }
            }
          }
          fields.push(current.trim());
          return fields;
        };

        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) {
          setScanMsg({ ok: false, msg: 'CSV file is empty or has no data rows.' });
          setTimeout(() => setScanMsg(null), 4000);
          return;
        }

        // Detect header columns
        const headers = parseRow(lines[0]).map((h) => h.toLowerCase());
        const colMap = {
          date: headers.findIndex((h) => h.includes('date')),
          company: headers.findIndex((h) => h.includes('company')),
          role: headers.findIndex((h) => h.includes('role') || h.includes('title') || h.includes('position')),
          status: headers.findIndex((h) => h.includes('status')),
          location: headers.findIndex((h) => h.includes('location') || h.includes('city')),
          url: headers.findIndex((h) => h.includes('url') || h.includes('link')),
          notes: headers.findIndex((h) => h.includes('note')),
        };

        if (colMap.company === -1 || colMap.role === -1) {
          setScanMsg({ ok: false, msg: 'CSV must have "Company" and "Role" (or "Title"/"Position") columns.' });
          setTimeout(() => setScanMsg(null), 5000);
          return;
        }

        const newApps: JobApp[] = [];
        for (let i = 1; i < lines.length; i++) {
          const fields = parseRow(lines[i]);
          const company = fields[colMap.company] || '';
          const role = fields[colMap.role] || '';
          if (!company && !role) continue;

          newApps.push({
            id: genId(),
            date: (colMap.date !== -1 ? fields[colMap.date] : '') || new Date().toISOString().split('T')[0],
            company,
            role,
            location: colMap.location !== -1 ? fields[colMap.location] || '' : '',
            status: (colMap.status !== -1 ? fields[colMap.status] : '') || 'Applied',
            url: colMap.url !== -1 ? fields[colMap.url] || '' : '',
            notes: colMap.notes !== -1 ? fields[colMap.notes] || '' : '',
          });
        }

        if (newApps.length === 0) {
          setScanMsg({ ok: false, msg: 'No valid rows found in CSV.' });
          setTimeout(() => setScanMsg(null), 4000);
          return;
        }

        importApps(newApps);
        setScanMsg({ ok: true, msg: `Imported ${newApps.length} application${newApps.length !== 1 ? 's' : ''} from CSV!` });
        setTimeout(() => setScanMsg(null), 4000);
      };
      reader.readAsText(file);
    },
    [importApps, setScanMsg]
  );

  // ── CSV export ─────────────────────────────────────────────────
  const exportCSV = useCallback(() => {
    const headers = ['Date Applied', 'Company', 'Role', 'Location', 'Status', 'URL', 'Notes'];
    const rows = apps.map((a) =>
      [a.date, a.company, a.role, a.location || '', a.status, a.url || '', (a.notes || '').replace(/"/g, '""')]
        .map((v) => `"${v}"`)
        .join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `job-applications-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [apps]);

  // ── View toggle from Header ────────────────────────────────────
  const handleSetView = useCallback((v: 'list' | 'form' | 'settings') => {
    setView(v);
    if (v !== 'form') setEditing(null);
  }, []);

  if (loading) {
    return (
      <div className="empty" style={{ paddingTop: 60 }}>
        Loading…
      </div>
    );
  }

  const feedbackMsg = webhook.syncMsg || scanMsg;

  return (
    <>
      <Header
        appCount={apps.length}
        view={view}
        setView={handleSetView}
        webhookUrl={webhook.webhookUrl}
        syncing={webhook.syncing}
        onSync={() => webhook.syncToSheets(apps, false)}
        onExport={exportCSV}
        onImport={importCSV}
        scanMsg={scanMsg}
        setScanMsg={setScanMsg}
      />

      <Feedback message={feedbackMsg} />

      {view === 'settings' && (
        <SetupWizard
          webhookUrl={webhook.webhookUrl}
          setWebhookUrl={webhook.setWebhookUrl}
          saveUrl={webhook.saveUrl}
          syncing={webhook.syncing}
          testResult={webhook.testResult}
          syncToSheets={webhook.syncToSheets}
          onClose={() => setView('list')}
          apps={apps}
        />
      )}

      {view !== 'settings' && <Stats apps={apps} />}

      {view === 'form' && (
        <AppForm
          editing={editing}
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
        />
      )}

      {view !== 'settings' && (
        <>
          <Filters
            filter={filter}
            setFilter={setFilter}
            search={search}
            setSearch={setSearch}
            totalCount={apps.length}
          />
          <AppList
            apps={apps}
            filter={filter}
            search={search}
            onEdit={handleEdit}
            onDelete={deleteApp}
            onUpdateStatus={handleUpdateStatus}
          />
        </>
      )}
    </>
  );
}
