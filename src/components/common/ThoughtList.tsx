import type { ThoughtItem, Universe } from "../../domain/types";
import { statusLabel, typeLabel } from "../../domain/labels";
import { EmptyState } from "./EmptyState";

export function ThoughtList({
  thoughts,
  universes,
  onSelect,
  compact = false
}: {
  thoughts: ThoughtItem[];
  universes: Universe[];
  onSelect: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "compact" : "panel"}>
      <div className="stack">
        {thoughts.length === 0 && <EmptyState>沒有想法。</EmptyState>}
        {thoughts.map((t) => {
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
