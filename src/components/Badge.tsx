import { STATUS_MAP } from '../utils/constants';

interface BadgeProps {
  status: string;
}

export default function Badge({ status }: BadgeProps) {
  const s = STATUS_MAP[status] || STATUS_MAP.Applied;
  return (
    <span
      className="badge"
      style={{
        color: s.color,
        background: s.bg,
        border: `1px solid ${s.color}22`,
      }}
    >
      {s.icon} {status}
    </span>
  );
}
