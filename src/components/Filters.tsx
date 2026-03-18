import { STATUS_MAP, ALL_STATUSES } from '../utils/constants';

interface FiltersProps {
  filter: string;
  setFilter: (filter: string) => void;
  search: string;
  setSearch: (search: string) => void;
  totalCount: number;
}

export default function Filters({ filter, setFilter, search, setSearch, totalCount }: FiltersProps) {
  const allFilters = ['All', ...ALL_STATUSES];

  return (
    <div className="filters">
      <input
        className="search"
        placeholder="🔍 Search..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {allFilters.map((s) => (
        <button
          key={s}
          className={`filter-btn${filter === s ? ' active' : ''}`}
          onClick={() => setFilter(s)}
        >
          {s === 'All'
            ? `All (${totalCount})`
            : `${STATUS_MAP[s]?.icon || ''} ${s}`}
        </button>
      ))}
    </div>
  );
}
