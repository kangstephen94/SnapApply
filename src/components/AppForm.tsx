import { useState, useEffect } from 'react';
import StatusSelect from './StatusSelect';
import { emptyForm, genId } from '../utils/constants';
import type { JobApp } from '../types';

interface AppFormProps {
  editing: JobApp | null;
  onSubmit: (app: JobApp) => void;
  onCancel: () => void;
}

export default function AppForm({ editing, onSubmit, onCancel }: AppFormProps) {
  const [form, setForm] = useState(emptyForm());

  useEffect(() => {
    if (editing) {
      setForm({ ...editing });
    } else {
      setForm(emptyForm());
    }
  }, [editing]);

  const update = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = () => {
    if (!form.company || !form.role) return;
    onSubmit({
      ...form,
      id: editing?.id || genId(),
    });
  };

  const isValid = form.company && form.role;

  return (
    <div className="form-panel">
      <div className="form-title">
        {editing ? '✏️ Edit Application' : '➕ Log New Application'}
      </div>
      <div className="form-grid">
        <label>
          <span className="form-label">Company *</span>
          <input
            className="form-input"
            placeholder="e.g. Coinbase"
            value={form.company}
            onChange={(e) => update('company', e.target.value)}
          />
        </label>
        <label>
          <span className="form-label">Role *</span>
          <input
            className="form-input"
            placeholder="e.g. Senior Backend Engineer"
            value={form.role}
            onChange={(e) => update('role', e.target.value)}
          />
        </label>
        <label>
          <span className="form-label">Date Applied</span>
          <input
            className="form-input"
            type="date"
            value={form.date}
            onChange={(e) => update('date', e.target.value)}
          />
        </label>
        <label>
          <span className="form-label">Status</span>
          <StatusSelect
            value={form.status}
            onChange={(v) => update('status', v)}
          />
        </label>
        <label>
          <span className="form-label">Location</span>
          <input
            className="form-input"
            placeholder="e.g. San Francisco, CA / Remote"
            value={form.location}
            onChange={(e) => update('location', e.target.value)}
          />
        </label>
        <label className="full">
          <span className="form-label">Application URL</span>
          <input
            className="form-input"
            placeholder="https://..."
            value={form.url}
            onChange={(e) => update('url', e.target.value)}
          />
        </label>
        <label className="full">
          <span className="form-label">Notes</span>
          <textarea
            className="form-input"
            placeholder="Referral, recruiter name..."
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
          />
        </label>
      </div>
      <div className="form-actions">
        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={!isValid}
        >
          {editing ? 'Save Changes' : 'Log Application'}
        </button>
        <button className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
