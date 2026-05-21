import type { ListSortBy } from "../../domain/listQuery";
import type { ThoughtStatus, ThoughtType, Universe } from "../../domain/types";
import { statusLabel, typeLabel } from "../../domain/labels";

const thoughtTypes: ThoughtType[] = ["inspiration", "task", "project", "goal", "question", "note"];
const thoughtStatuses: ThoughtStatus[] = ["inbox", "active", "paused", "done", "archived"];

export interface SelectOption {
  value: string;
  label: string;
}

export function ListControls({
  searchText,
  onSearchTextChange,
  typeFilter,
  onTypeFilterChange,
  statusFilter,
  onStatusFilterChange,
  statusOptions,
  universeFilter,
  onUniverseFilterChange,
  sortBy,
  onSortByChange,
  universes = []
}: {
  searchText: string;
  onSearchTextChange: (value: string) => void;
  typeFilter?: ThoughtType | "all";
  onTypeFilterChange?: (value: ThoughtType | "all") => void;
  statusFilter?: string;
  onStatusFilterChange?: (value: string) => void;
  statusOptions?: SelectOption[];
  universeFilter?: string;
  onUniverseFilterChange?: (value: string) => void;
  sortBy: ListSortBy;
  onSortByChange: (value: ListSortBy) => void;
  universes?: Universe[];
}) {
  const resolvedStatusOptions =
    statusOptions ?? thoughtStatuses.map((status) => ({ value: status, label: statusLabel[status] }));

  return (
    <div className="list-controls">
      <label>
        Search
        <input value={searchText} onChange={(event) => onSearchTextChange(event.target.value)} placeholder="Search" />
      </label>

      {typeFilter !== undefined && onTypeFilterChange && (
        <label>
          Type
          <select value={typeFilter} onChange={(event) => onTypeFilterChange(event.target.value as ThoughtType | "all")}>
            <option value="all">All types</option>
            {thoughtTypes.map((type) => (
              <option key={type} value={type}>{typeLabel[type]}</option>
            ))}
          </select>
        </label>
      )}

      {statusFilter !== undefined && onStatusFilterChange && (
        <label>
          Status
          <select value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)}>
            <option value="all">All statuses</option>
            {resolvedStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      )}

      {universeFilter !== undefined && onUniverseFilterChange && (
        <label>
          Universe
          <select value={universeFilter} onChange={(event) => onUniverseFilterChange(event.target.value)}>
            <option value="all">All universes</option>
            {universes.map((universe) => (
              <option key={universe.id} value={universe.id}>{universe.name}</option>
            ))}
          </select>
        </label>
      )}

      <label>
        Sort
        <select value={sortBy} onChange={(event) => onSortByChange(event.target.value as ListSortBy)}>
          <option value="updated_desc">Updated newest</option>
          <option value="updated_asc">Updated oldest</option>
          <option value="title_asc">Title A-Z</option>
          <option value="title_desc">Title Z-A</option>
        </select>
      </label>
    </div>
  );
}
