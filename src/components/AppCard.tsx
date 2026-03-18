import { useState } from 'react';
import Badge from './Badge';
import StatusSelect from './StatusSelect';
import type { JobApp } from '../types';

interface AppCardProps {
  app: JobApp;
  onEdit: (app: JobApp) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
}

export default function AppCard({ app, onEdit, onDelete, onUpdateStatus }: AppCardProps) {
  const [expanded, setExpanded] = useState(false);

  const urlDisplay =
    app.url && app.url.length > 40 ? app.url.slice(0, 40) + '...' : app.url;

  return (
    <div className="card" onClick={() => setExpanded(!expanded)}>
      <div className="card-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="card-company">{app.company}</div>
          <div className="card-role">{app.role}</div>
        </div>
        <div className="card-date">{app.date}</div>
        <Badge status={app.status} />
        <span className={`card-expand${expanded ? ' open' : ''}`}>▼</span>
      </div>

      {expanded && (
        <div className="card-detail" onClick={(e) => e.stopPropagation()}>
          {app.location && (
            <div style={{ marginBottom: 6 }}>
              <span className="card-detail-label">Location: </span>
              {app.location}
            </div>
          )}
          {app.url && (
            <div style={{ marginBottom: 6 }}>
              <span className="card-detail-label">URL: </span>
              <a href={app.url} target="_blank" rel="noopener noreferrer">
                {urlDisplay}
              </a>
            </div>
          )}
          {app.notes && (
            <div style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>
              <span className="card-detail-label">Notes: </span>
              {app.notes}
            </div>
          )}
          <div className="card-actions">
            <StatusSelect
              value={app.status}
              onChange={(s) => onUpdateStatus(app.id, s)}
              small
            />
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onEdit(app)}
            >
              ✏️ Edit
            </button>
            <button
              className="btn btn-secondary btn-sm btn-danger"
              onClick={() => onDelete(app.id)}
            >
              🗑 Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
