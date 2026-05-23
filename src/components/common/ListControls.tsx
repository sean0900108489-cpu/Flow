import type { ListSortBy } from "../../domain/listQuery";
import type { ThoughtStatus, ThoughtType, Universe } from "../../domain/types";
import { useI18n } from "../../i18n";

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
  const { t } = useI18n();
  const resolvedStatusOptions =
    statusOptions ?? thoughtStatuses.map((status) => ({ value: status, label: status }));

  return (
    <div className="list-controls">
      <label>
        {t("Search")}
        <input value={searchText} onChange={(event) => onSearchTextChange(event.target.value)} placeholder={t("Search")} />
      </label>

      {typeFilter !== undefined && onTypeFilterChange && (
        <label>
          {t("Type")}
          <select value={typeFilter} onChange={(event) => onTypeFilterChange(event.target.value as ThoughtType | "all")}>
            <option value="all">{t("All types")}</option>
            {thoughtTypes.map((type) => (
              <option key={type} value={type}>{t(type)}</option>
            ))}
          </select>
        </label>
      )}

      {statusFilter !== undefined && onStatusFilterChange && (
        <label>
          {t("Status")}
          <select value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)}>
            <option value="all">{t("All statuses")}</option>
            {resolvedStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>{t(option.label)}</option>
            ))}
          </select>
        </label>
      )}

      {universeFilter !== undefined && onUniverseFilterChange && (
        <label>
          {t("Universe")}
          <select value={universeFilter} onChange={(event) => onUniverseFilterChange(event.target.value)}>
            <option value="all">{t("All universes")}</option>
            {universes.map((universe) => (
              <option key={universe.id} value={universe.id}>{universe.name}</option>
            ))}
          </select>
        </label>
      )}

      <label>
        {t("Sort")}
        <select value={sortBy} onChange={(event) => onSortByChange(event.target.value as ListSortBy)}>
          <option value="updated_desc">{t("Updated newest")}</option>
          <option value="updated_asc">{t("Updated oldest")}</option>
          <option value="title_asc">{t("Title A-Z")}</option>
          <option value="title_desc">{t("Title Z-A")}</option>
        </select>
      </label>
    </div>
  );
}
