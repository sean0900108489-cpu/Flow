import { useState } from "react";
import type { ListSortBy } from "../../domain/listQuery";
import { filterProjects, filterThoughts, sortProjects, sortThoughts } from "../../domain/listQuery";
import type { Project, ThoughtItem, Universe } from "../../domain/types";
import { universeOptionsForItemUniverseIds } from "../../domain/universeActions";
import { useI18n } from "../../i18n";
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
  const { t } = useI18n();
  const [thoughtSearchText, setThoughtSearchText] = useState("");
  const [thoughtTypeFilter, setThoughtTypeFilter] = useState<ThoughtItem["type"] | "all">("all");
  const [thoughtStatusFilter, setThoughtStatusFilter] = useState<ThoughtItem["status"] | "all">("all");
  const [thoughtUniverseFilter, setThoughtUniverseFilter] = useState("all");
  const [thoughtSortBy, setThoughtSortBy] = useState<ListSortBy>("updated_desc");
  const [projectSearchText, setProjectSearchText] = useState("");
  const [projectStatusFilter, setProjectStatusFilter] = useState<Project["status"] | "all">("all");
  const [projectUniverseFilter, setProjectUniverseFilter] = useState("all");
  const [projectSortBy, setProjectSortBy] = useState<ListSortBy>("updated_desc");
  const thoughtUniverseOptions = universeOptionsForItemUniverseIds(universes, thoughts.map((thought) => thought.universeId));
  const projectUniverseOptions = universeOptionsForItemUniverseIds(universes, projects.map((project) => project.universeId));
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
        <h2>{t("Archived Items")}</h2>
        <EmptyState>{t("No archived items yet.")}</EmptyState>
      </section>
    );
  }

  return (
    <section className="grid two archived">
      <div className="panel">
        <h2>{t("Archived Thoughts")}</h2>
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
          universes={thoughtUniverseOptions}
        />
        <div className="archive-list">
          {visibleThoughts.length === 0 && <EmptyState>{t("No archived thoughts.")}</EmptyState>}
          {visibleThoughts.map((thought) => {
            const universe = universes.find((x) => x.id === thought.universeId);

            return (
              <div className="archive-card" key={thought.id}>
                <div className="line">
                  <strong>{thought.title}</strong>
                  <span className={`badge ${thought.type}`}>{t(thought.type)}</span>
                </div>
                <div className="chips">
                  <span>{t(thought.status)}</span>
                  {universe && <span>{universe.name}</span>}
                </div>
                <div className="actions">
                  <button className="restore" onClick={() => onRestoreThought(thought.id)}>{t("Restore Thought")}</button>
                  <button className="danger" onClick={() => onDeleteThought(thought.id)}>{t("Delete Thought")}</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel">
        <h2>{t("Archived Projects")}</h2>
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
          universes={projectUniverseOptions}
        />
        <div className="archive-list">
          {visibleProjects.length === 0 && <EmptyState>{t("No archived projects.")}</EmptyState>}
          {visibleProjects.map((project) => {
            const universe = universes.find((x) => x.id === project.universeId);

            return (
              <div className="archive-card" key={project.id}>
                <div className="line">
                  <strong>{project.name}</strong>
                  <span className="badge">{t(project.status)}</span>
                </div>
                <div className="chips">
                  <span>{t(project.readiness)}</span>
                  {universe && <span>{universe.name}</span>}
                </div>
                <div className="actions">
                  <button className="restore" onClick={() => onRestoreProject(project.id)}>{t("Restore Project")}</button>
                  <button className="danger" onClick={() => onDeleteProject(project.id)}>{t("Delete Project")}</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
