import { useState } from "react";
import type { Project, ThoughtItem, Universe } from "../../domain/types";
import { universeStatus } from "../../domain/universeActions";
import { useI18n } from "../../i18n";
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
  const { t } = useI18n();
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
          <h2>{t("Universe Management")}</h2>
          <p className="muted">{t("Create, edit, archive, restore, and delete first-class universes.")}</p>
        </div>
      </div>

      {error && <div className="warn">{t(error)}</div>}

      <div className="card form">
        <h3>{t("Create Universe")}</h3>
        <label>{t("Name")}<input value={createName} onChange={(event) => setCreateName(event.target.value)} /></label>
        <label>{t("Description")}<textarea value={createDescription} onChange={(event) => setCreateDescription(event.target.value)} /></label>
        <div className="actions">
          <button onClick={handleCreate}>{t("Create Universe")}</button>
        </div>
      </div>

      <div className="stack">
        {universes.length === 0 && <EmptyState>{t("No universes yet.")}</EmptyState>}
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
                <span className="badge">{t(status)}</span>
              </div>
              <p>{universe.description || t("No description yet.")}</p>
              <div className="chips">
                <span>{t("{count} thoughts", { count: linkedThoughtCount })}</span>
                <span>{t("{count} projects", { count: linkedProjectCount })}</span>
              </div>

              <div className="row">
                <label>{t("Name")}<input value={draft.name} onChange={(event) => setDraft(universe, { name: event.target.value })} /></label>
                <label>{t("Description")}<textarea value={draft.description} onChange={(event) => setDraft(universe, { description: event.target.value })} /></label>
              </div>

              <div className="actions">
                <button className="ghost" onClick={() => onViewUniverse(universe.id)}>{t("View Universe")}</button>
                <button className="ghost" onClick={() => onUpdate(universe.id, draft)}>{t("Save")}</button>
                {status === "active" ? (
                  <button className="ghost" onClick={() => onArchive(universe.id)}>{t("Archive")}</button>
                ) : (
                  <button className="restore" onClick={() => onRestore(universe.id)}>{t("Restore")}</button>
                )}
                <button className="danger" onClick={() => onDelete(universe.id)}>{t("Delete")}</button>
                <button className="danger" onClick={() => onDetachDelete(universe.id)}>{t("Detach and Delete")}</button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
