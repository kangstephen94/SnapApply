import { useMemo } from 'react';
import type { JobApp } from '../types';

interface StatsProps {
  apps: JobApp[];
}

export default function Stats({ apps }: StatsProps) {
  const items = useMemo(() => {
    const counts: Record<string, number> = {};
    apps.forEach((a) => {
      counts[a.status] = (counts[a.status] || 0) + 1;
    });
    return [
      { label: 'Total', val: apps.length, col: '#3B82F6' },
      { label: 'Applied', val: counts['Applied'] || 0, col: '#6366F1' },
      { label: 'Interviewing', val: counts['Interviewing'] || 0, col: '#F59E0B' },
      { label: 'Offers', val: counts['Offer Received'] || 0, col: '#10B981' },
      { label: 'Rejected', val: counts['Rejected'] || 0, col: '#EF4444' },
    ];
  }, [apps]);

  return (
    <div className="stats">
      {items.map((s) => (
        <div
          key={s.label}
          className="stat"
          style={{ borderLeft: `3px solid ${s.col}` }}
        >
          <div className="stat-value" style={{ color: s.col }}>
            {s.val}
          </div>
          <div className="stat-label">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
