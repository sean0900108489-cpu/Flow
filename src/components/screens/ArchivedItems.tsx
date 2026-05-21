import { useState } from "react";
import type { ListSortBy } from "../../domain/listQuery";
import { filterProjects, filterThoughts, sortProjects, sortThoughts } from "../../domain/listQuery";
import type { Project, ThoughtItem, Universe } from "../../domain/types";
import { readinessLabel, statusLabel, typeLabel } from "../../domain/labels";
import { EmptyState } from "../common/EmptyState";
import { ListControls } from "../common/ListControls";

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
  const [thoughtSearchText, setThoughtSearchText] = useState("");
  const [thoughtTypeFilter, setThoughtTypeFilter] = useState<ThoughtItem["type"] | "all">("all");
  const [thoughtStatusFilter, setThoughtStatusFilter] = useState<ThoughtItem["status"] | "all">("all");
  const [thoughtUniverseFilter, setThoughtUniverseFilter] = useState("all");
  const [thoughtSortBy, setThoughtSortBy] = useState<ListSortBy>("updated_desc");
  const [projectSearchText, setProjectSearchText] = useState("");
  const [projectStatusFilter, setProjectStatusFilter] = useState<Project["status"] | "all">("all");
  const [projectUniverseFilter, setProjectUniverseFilter] = useState("all");
  const [projectSortBy, setProjectSortBy] = useState<ListSortBy>("updated_desc");
  const visibleThoughts = sortThoughts(
    filterThoughts(thoughts, {
      searchText: thoughtSearchText,
      type: thoughtTypeFilter,
      status: thoughtStatusFilter,
      universeId: thoughtUniverseFilter
    }),
    thoughtSortBy
  );
  const visibleProjects = sortProjects(
    filterProjects(projects, {
      searchText: projectSearchText,
      status: projectStatusFilter,
      universeId: projectUniverseFilter
    }),
    projectSortBy
  );

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
        <ListControls
          searchText={thoughtSearchText}
          onSearchTextChange={setThoughtSearchText}
          typeFilter={thoughtTypeFilter}
          onTypeFilterChange={setThoughtTypeFilter}
          statusFilter={thoughtStatusFilter}
          onStatusFilterChange={(value) => setThoughtStatusFilter(value as ThoughtItem["status"] | "all")}
          universeFilter={thoughtUniverseFilter}
          onUniverseFilterChange={setThoughtUniverseFilter}
          sortBy={thoughtSortBy}
          onSortByChange={setThoughtSortBy}
          universes={universes}
        />
        <div className="archive-list">
          {visibleThoughts.length === 0 && <EmptyState>No archived thoughts.</EmptyState>}
          {visibleThoughts.map((thought) => {
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
        <ListControls
          searchText={projectSearchText}
          onSearchTextChange={setProjectSearchText}
          statusFilter={projectStatusFilter}
          onStatusFilterChange={(value) => setProjectStatusFilter(value as Project["status"] | "all")}
          statusOptions={[{ value: "archived", label: "archived" }]}
          universeFilter={projectUniverseFilter}
          onUniverseFilterChange={setProjectUniverseFilter}
          sortBy={projectSortBy}
          onSortByChange={setProjectSortBy}
          universes={universes}
        />
        <div className="archive-list">
          {visibleProjects.length === 0 && <EmptyState>No archived projects.</EmptyState>}
          {visibleProjects.map((project) => {
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
