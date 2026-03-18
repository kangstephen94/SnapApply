import { STATUS_MAP, ALL_STATUSES } from '../utils/constants';

interface StatusSelectProps {
  value: string;
  onChange: (status: string) => void;
  small?: boolean;
}

export default function StatusSelect({ value, onChange, small }: StatusSelectProps) {
  return (
    <select
      className="form-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={
        small
          ? { width: 'auto', padding: '4px 8px', fontSize: '11px' }
          : undefined
      }
    >
      {ALL_STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_MAP[s].icon} {s}
        </option>
      ))}
    </select>
  );
}
