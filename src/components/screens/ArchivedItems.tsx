import type { Project, ThoughtItem, Universe } from "../../domain/types";
import { readinessLabel, statusLabel, typeLabel } from "../../domain/labels";
import { EmptyState } from "../common/EmptyState";

export function ArchivedItems({
  thoughts,
  projects,
  universes,
  onRestoreThought,
  onDeleteThought,
  onRestoreProject,
  onDeleteProject
}: {
  thoughts: ThoughtItem[];
  projects: Project[];
  universes: Universe[];
  onRestoreThought: (id: string) => void;
  onDeleteThought: (id: string) => void;
  onRestoreProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
}) {
  if (thoughts.length === 0 && projects.length === 0) {
    return (
      <section className="panel">
        <h2>Archived Items</h2>
        <EmptyState>No archived items yet.</EmptyState>
      </section>
    );
  }

  return (
    <section className="grid two archived">
      <div className="panel">
        <h2>Archived Thoughts</h2>
        <div className="archive-list">
          {thoughts.length === 0 && <EmptyState>No archived thoughts.</EmptyState>}
          {thoughts.map((thought) => {
            const universe = universes.find((x) => x.id === thought.universeId);

            return (
              <div className="archive-card" key={thought.id}>
                <div className="line">
                  <strong>{thought.title}</strong>
                  <span className={`badge ${thought.type}`}>{typeLabel[thought.type]}</span>
                </div>
                <div className="chips">
                  <span>{statusLabel[thought.status]}</span>
                  {universe && <span>{universe.name}</span>}
                </div>
                <div className="actions">
                  <button className="restore" onClick={() => onRestoreThought(thought.id)}>Restore Thought</button>
                  <button className="danger" onClick={() => onDeleteThought(thought.id)}>Delete Thought</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel">
        <h2>Archived Projects</h2>
        <div className="archive-list">
          {projects.length === 0 && <EmptyState>No archived projects.</EmptyState>}
          {projects.map((project) => {
            const universe = universes.find((x) => x.id === project.universeId);

            return (
              <div className="archive-card" key={project.id}>
                <div className="line">
                  <strong>{project.name}</strong>
                  <span className="badge">{project.status}</span>
                </div>
                <div className="chips">
                  <span>{readinessLabel[project.readiness]}</span>
                  {universe && <span>{universe.name}</span>}
                </div>
                <div className="actions">
                  <button className="restore" onClick={() => onRestoreProject(project.id)}>Restore Project</button>
                  <button className="danger" onClick={() => onDeleteProject(project.id)}>Delete Project</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
