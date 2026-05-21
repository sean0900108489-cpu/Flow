import { useState } from "react";
import type { Project, ThoughtItem, Universe } from "../../domain/types";
import { universeStatus } from "../../domain/universeActions";
import { EmptyState } from "../common/EmptyState";

interface UniverseDraft {
  name: string;
  description: string;
}

export function Universes({
  universes,
  thoughts,
  projects,
  error,
  onCreate,
  onUpdate,
  onArchive,
  onRestore,
  onDelete,
  onDetachDelete,
  onViewUniverse
}: {
  universes: Universe[];
  thoughts: ThoughtItem[];
  projects: Project[];
  error?: string;
  onCreate: (input: { name: string; description?: string }) => boolean;
  onUpdate: (id: string, patch: { name?: string; description?: string }) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  onDetachDelete: (id: string) => void;
  onViewUniverse: (id: string) => void;
}) {
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [drafts, setDrafts] = useState<Record<string, UniverseDraft>>({});

  const setDraft = (universe: Universe, patch: Partial<UniverseDraft>) => {
    setDrafts((current) => {
      const existing = current[universe.id] ?? {
        name: universe.name,
        description: universe.description
      };

      return {
        ...current,
        [universe.id]: {
          ...existing,
          ...patch
        }
      };
    });
  };

  const handleCreate = () => {
    const didCreate = onCreate({ name: createName, description: createDescription });

    if (didCreate) {
      setCreateName("");
      setCreateDescription("");
    }
  };

  return (
    <section className="panel">
      <div className="head">
        <div>
          <h2>Universe Management</h2>
          <p className="muted">Create, edit, archive, restore, and delete first-class universes.</p>
        </div>
      </div>

      {error && <div className="warn">{error}</div>}

      <div className="card form">
        <h3>Create Universe</h3>
        <label>Name<input value={createName} onChange={(event) => setCreateName(event.target.value)} /></label>
        <label>Description<textarea value={createDescription} onChange={(event) => setCreateDescription(event.target.value)} /></label>
        <div className="actions">
          <button onClick={handleCreate}>Create Universe</button>
        </div>
      </div>

      <div className="stack">
        {universes.length === 0 && <EmptyState>No universes yet.</EmptyState>}
        {universes.map((universe) => {
          const draft = drafts[universe.id] ?? {
            name: universe.name,
            description: universe.description
          };
          const status = universeStatus(universe);
          const linkedThoughtCount = thoughts.filter((thought) => thought.universeId === universe.id).length;
          const linkedProjectCount = projects.filter((project) => project.universeId === universe.id).length;

          return (
            <div className="card form" key={universe.id}>
              <div className="line">
                <strong>{universe.name}</strong>
                <span className="badge">{status}</span>
              </div>
              <p>{universe.description || "No description yet."}</p>
              <div className="chips">
                <span>{linkedThoughtCount} thoughts</span>
                <span>{linkedProjectCount} projects</span>
              </div>

              <div className="row">
                <label>Name<input value={draft.name} onChange={(event) => setDraft(universe, { name: event.target.value })} /></label>
                <label>Description<textarea value={draft.description} onChange={(event) => setDraft(universe, { description: event.target.value })} /></label>
              </div>

              <div className="actions">
                <button className="ghost" onClick={() => onViewUniverse(universe.id)}>View Universe</button>
                <button className="ghost" onClick={() => onUpdate(universe.id, draft)}>Save</button>
                {status === "active" ? (
                  <button className="ghost" onClick={() => onArchive(universe.id)}>Archive</button>
                ) : (
                  <button className="restore" onClick={() => onRestore(universe.id)}>Restore</button>
                )}
                <button className="danger" onClick={() => onDelete(universe.id)}>Delete</button>
                <button className="danger" onClick={() => onDetachDelete(universe.id)}>Detach and Delete</button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
