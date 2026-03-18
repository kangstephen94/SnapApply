import AppCard from './AppCard';
import type { JobApp } from '../types';

interface AppListProps {
  apps: JobApp[];
  filter: string;
  search: string;
  onEdit: (app: JobApp) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
}

export default function AppList({
  apps,
  filter,
  search,
  onEdit,
  onDelete,
  onUpdateStatus,
}: AppListProps) {
  const filtered = apps.filter((a) => {
    const matchStatus = filter === 'All' || a.status === filter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      a.company.toLowerCase().includes(q) ||
      a.role.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  if (apps.length === 0) {
    return (
      <div className="empty">
        No applications yet. Click &quot;+ Add&quot; to get started!
      </div>
    );
  }

  if (filtered.length === 0) {
    return <div className="empty">No applications match your filter.</div>;
  }

  return (
    <div>
      {filtered.map((app) => (
        <AppCard
          key={app.id}
          app={app}
          onEdit={onEdit}
          onDelete={onDelete}
          onUpdateStatus={onUpdateStatus}
        />
      ))}
    </div>
  );
}
