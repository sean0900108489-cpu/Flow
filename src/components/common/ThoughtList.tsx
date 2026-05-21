import { useState } from "react";
import type { ListSortBy } from "../../domain/listQuery";
import { filterThoughts, sortThoughts } from "../../domain/listQuery";
import type { ThoughtItem, Universe } from "../../domain/types";
import { universeOptionsForItemUniverseIds } from "../../domain/universeActions";
import { statusLabel, typeLabel } from "../../domain/labels";
import { EmptyState } from "./EmptyState";
import { ListControls } from "./ListControls";

export function ThoughtList({
  thoughts,
  universes,
  onSelect,
  compact = false,
  showControls = false,
  showStatusFilter = false
}: {
  thoughts: ThoughtItem[];
  universes: Universe[];
  onSelect: (id: string) => void;
  compact?: boolean;
  showControls?: boolean;
  showStatusFilter?: boolean;
}) {
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState<ThoughtItem["type"] | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ThoughtItem["status"] | "all">("all");
  const [universeFilter, setUniverseFilter] = useState("all");
  const [sortBy, setSortBy] = useState<ListSortBy>("updated_desc");
  const universeOptions = universeOptionsForItemUniverseIds(universes, thoughts.map((thought) => thought.universeId));
  const visibleThoughts = showControls
    ? sortThoughts(
        filterThoughts(thoughts, {
          searchText,
          type: typeFilter,
          status: showStatusFilter ? statusFilter : "all",
          universeId: universeFilter
        }),
        sortBy
      )
    : thoughts;

  return (
    <div className={compact ? "compact" : "panel"}>
      {showControls && (
        <ListControls
          searchText={searchText}
          onSearchTextChange={setSearchText}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          statusFilter={showStatusFilter ? statusFilter : undefined}
          onStatusFilterChange={showStatusFilter ? (value) => setStatusFilter(value as ThoughtItem["status"] | "all") : undefined}
          universeFilter={universeFilter}
          onUniverseFilterChange={setUniverseFilter}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          universes={universeOptions}
        />
      )}
      <div className="stack">
        {visibleThoughts.length === 0 && <EmptyState>沒有想法。</EmptyState>}
        {visibleThoughts.map((t) => {
          const u = universes.find((x) => x.id === t.universeId);
          return (
            <button className="item" key={t.id} onClick={() => onSelect(t.id)}>
              <div className="line">
                <strong>{t.title}</strong>
                <span className={`badge ${t.type}`}>{typeLabel[t.type]}</span>
              </div>
              <span>{t.nextAction || t.content || "尚未設定下一步"}</span>
              <div className="chips">
                <span>{statusLabel[t.status]}</span>
                {u && <span>{u.name}</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
