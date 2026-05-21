import type { AppState } from "../../domain/types";

export function Relationships({
  state,
  onOpenRelationshipExplorer
}: {
  state: AppState;
  onOpenRelationshipExplorer: () => void;
}) {
  const name = (targetId: string) =>
    state.thoughts.find((x) => x.id === targetId)?.title ||
    state.projects.find((x) => x.id === targetId)?.name ||
    state.universes.find((x) => x.id === targetId)?.name ||
    targetId;

  return (
    <section className="panel">
      <div className="head">
        <div>
          <h2>Relationships</h2>
          <p className="muted">For impact analysis, open Relationship Explorer.</p>
        </div>
        <button className="ghost" onClick={onOpenRelationshipExplorer}>Open Relationship Explorer</button>
      </div>
      <div className="stack">
        {state.relationships.map((r) => (
          <div className="rel" key={r.id}>
            <strong>{name(r.sourceId)}</strong>
            <span>{r.type}</span>
            <strong>{name(r.targetId)}</strong>
            <p>{r.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
