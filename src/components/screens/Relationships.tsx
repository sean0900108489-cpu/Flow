import type { AppState } from "../../domain/types";
import { useI18n } from "../../i18n";
import { EmptyState } from "../common/EmptyState";

function relationshipTypeLabel(type: string, t: (key: string) => string) {
  return t(type);
}

export function Relationships({
  state,
  onOpenRelationshipExplorer
}: {
  state: AppState;
  onOpenRelationshipExplorer: () => void;
}) {
  const { t } = useI18n();
  const name = (targetId: string) =>
    state.thoughts.find((x) => x.id === targetId)?.title ||
    state.projects.find((x) => x.id === targetId)?.name ||
    state.universes.find((x) => x.id === targetId)?.name ||
    targetId;

  return (
    <section className="panel">
      <div className="head">
        <div>
          <h2>{t("Relationships")}</h2>
          <p className="muted">{t("For impact analysis, open Relationship Explorer.")}</p>
        </div>
        <button className="ghost" onClick={onOpenRelationshipExplorer}>{t("Open Relationship Explorer")}</button>
      </div>
      <div className="stack">
        {state.relationships.length === 0 ? (
          <EmptyState>{t("No relationships yet.")}</EmptyState>
        ) : (
          state.relationships.map((r) => (
            <div className="rel" key={r.id}>
              <strong>{name(r.sourceId)}</strong>
              <span>{relationshipTypeLabel(r.type, t)}</span>
              <strong>{name(r.targetId)}</strong>
              <p>{r.description}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
