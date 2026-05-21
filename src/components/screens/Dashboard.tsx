import { useState } from "react";
import type { AppState, Project } from "../../domain/types";
import { readiness } from "../../domain/readiness";
import { readinessLabel } from "../../domain/labels";
import type { ListSortBy } from "../../domain/listQuery";
import { filterProjects, filterThoughts, sortProjects, sortThoughts } from "../../domain/listQuery";
import { isUniverseActive, universeOptionsForItemUniverseIds } from "../../domain/universeActions";
import { ListControls } from "../common/ListControls";
import { Metric } from "../common/Metric";

export function Dashboard({
  state,
  activeProjects,
  setScreen,
  selectThought,
  selectProject
}: {
  state: AppState;
  activeProjects: Project[];
  setScreen: (screen: string) => void;
  selectThought: (id: string) => void;
  selectProject: (id: string) => void;
}) {
  const [thoughtSearchText, setThoughtSearchText] = useState("");
  const [thoughtTypeFilter, setThoughtTypeFilter] = useState<"all" | AppState["thoughts"][number]["type"]>("all");
  const [thoughtUniverseFilter, setThoughtUniverseFilter] = useState("all");
  const [thoughtSortBy, setThoughtSortBy] = useState<ListSortBy>("updated_desc");
  const [projectSearchText, setProjectSearchText] = useState("");
  const [projectStatusFilter, setProjectStatusFilter] = useState<Project["status"] | "all">("all");
  const [projectUniverseFilter, setProjectUniverseFilter] = useState("all");
  const [projectSortBy, setProjectSortBy] = useState<ListSortBy>("updated_desc");
  const active = state.thoughts.filter((x) => x.status === "active");
  const inbox = state.thoughts.filter((x) => x.status === "inbox");
  const activeUniverses = state.universes.filter(isUniverseActive);
  const thoughtUniverseOptions = universeOptionsForItemUniverseIds(state.universes, active.map((thought) => thought.universeId));
  const projectUniverseOptions = universeOptionsForItemUniverseIds(state.universes, activeProjects.map((project) => project.universeId));
  const visibleActive = sortThoughts(
    filterThoughts(active, {
      searchText: thoughtSearchText,
      type: thoughtTypeFilter,
      status: "all",
      universeId: thoughtUniverseFilter
    }),
    thoughtSortBy
  );
  const visibleProjects = sortProjects(
    filterProjects(activeProjects, {
      searchText: projectSearchText,
      status: projectStatusFilter,
      universeId: projectUniverseFilter
    }),
    projectSortBy
  );

  return (
    <section className="grid two">
      <div className="panel hero">
        <h2>我現在想做什麼？</h2>
        <p>優先看 Active Thought、Project Readiness、Next Action。</p>
        <div className="metrics">
          <Metric label="Inbox" value={inbox.length} />
          <Metric label="Active" value={active.length} />
          <Metric label="Universes" value={activeUniverses.length} />
          <Metric label="Projects" value={activeProjects.length} />
        </div>
      </div>

      <div className="panel">
        <h2>目前下一步</h2>
        <ListControls
          searchText={thoughtSearchText}
          onSearchTextChange={setThoughtSearchText}
          typeFilter={thoughtTypeFilter}
          onTypeFilterChange={setThoughtTypeFilter}
          universeFilter={thoughtUniverseFilter}
          onUniverseFilterChange={setThoughtUniverseFilter}
          sortBy={thoughtSortBy}
          onSortByChange={setThoughtSortBy}
          universes={thoughtUniverseOptions}
        />
        <div className="stack">
          {visibleActive.map((t) => (
            <button className="item" key={t.id} onClick={() => { selectThought(t.id); setScreen("thought"); }}>
              <strong>{t.title}</strong>
              <span>{t.nextAction || "尚未設定下一步"}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>Universes</h2>
        <div className="cards">
          {activeUniverses.map((u) => (
            <div className="card" key={u.id}>
              <strong>{u.name}</strong>
              <p>{u.purpose || u.description}</p>
              <div className="chips">
                <span>{u.focus}</span>
                <span>{state.thoughts.filter((t) => t.universeId === u.id).length} thoughts</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>Projects</h2>
        <ListControls
          searchText={projectSearchText}
          onSearchTextChange={setProjectSearchText}
          statusFilter={projectStatusFilter}
          onStatusFilterChange={(value) => setProjectStatusFilter(value as Project["status"] | "all")}
          statusOptions={[{ value: "active", label: "active" }]}
          universeFilter={projectUniverseFilter}
          onUniverseFilterChange={setProjectUniverseFilter}
          sortBy={projectSortBy}
          onSortByChange={setProjectSortBy}
          universes={projectUniverseOptions}
        />
        <div className="stack">
          {visibleProjects.map((p) => {
            const r = readiness(p);
            return (
              <button className="item" key={p.id} onClick={() => { selectProject(p.id); setScreen("project"); }}>
                <strong>{p.name}</strong>
                <span>{r.score}% · {readinessLabel[r.value]}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
