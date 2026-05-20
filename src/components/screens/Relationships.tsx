import type { AppState } from "../../domain/types";

export function Relationships({ state }: { state: AppState }) {
  const name = (targetId: string) =>
    state.thoughts.find((x) => x.id === targetId)?.title ||
    state.projects.find((x) => x.id === targetId)?.name ||
    state.universes.find((x) => x.id === targetId)?.name ||
    targetId;

  return (
    <section className="panel">
      <h2>Relationships</h2>
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
