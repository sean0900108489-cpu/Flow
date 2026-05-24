import { useState } from "react";
import type { AppState, Project } from "../../domain/types";
import { readiness } from "../../domain/readiness";
import type { ListSortBy } from "../../domain/listQuery";
import { filterProjects, filterThoughts, sortProjects, sortThoughts } from "../../domain/listQuery";
import { listNextActions } from "../../domain/nextActions";
import { buildReviewQueue } from "../../domain/reviewQueue";
import { isUniverseActive, universeOptionsForItemUniverseIds } from "../../domain/universeActions";
import { ListControls } from "../common/ListControls";
import { Metric } from "../common/Metric";
import { useI18n } from "../../i18n";

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
  const { t: translate } = useI18n();
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
  const nextActions = listNextActions(state);
  const availableNextActions = nextActions.filter((action) => action.status === "available");
  const dashboardNextActions = availableNextActions.slice(0, 4);
  const reviewQueue = buildReviewQueue(state);
  const firstReviewItem = reviewQueue[0];
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
        <h2>{translate("What do I want to do now?")}</h2>
        <p>{translate("Prioritize active thoughts, project readiness, and next actions.")}</p>
        <div className="metrics">
          <Metric label={translate("Inbox")} value={inbox.length} />
          <Metric label={translate("Active")} value={active.length} />
          <Metric label={translate("Universes")} value={activeUniverses.length} />
          <Metric label={translate("Projects")} value={activeProjects.length} />
        </div>
      </div>

      <div className="panel">
        <div className="head">
          <div>
            <h2>{translate("Global Search")}</h2>
            <p className="muted">{translate("Open any thought, project, universe, decision, blocker, relationship, action, or command.")}</p>
          </div>
        </div>
        <div className="actions">
          <button className="ghost" onClick={() => setScreen("global-search")}>{translate("Open Global Search")}</button>
        </div>
      </div>

      <div className="panel">
        <div className="head">
          <div>
            <h2>{translate("Review Queue")}</h2>
            <p className="muted">{translate("{count} drafts, decisions, blockers, or handoffs need review", { count: reviewQueue.length })}</p>
          </div>
        </div>
        {firstReviewItem ? (
          <button className="item" onClick={() => setScreen("review-queue")}>
            <strong>{firstReviewItem.title}</strong>
            <span>{firstReviewItem.subtitle}</span>
          </button>
        ) : (
          <div className="notice">{translate("No pending review items.")}</div>
        )}
        <div className="actions">
          <button className="ghost" onClick={() => setScreen("review-queue")}>{translate("Open Review Queue")}</button>
        </div>
      </div>

      <div className="panel">
        <div className="head">
          <div>
            <h2>{translate("Next Actions")}</h2>
            <p className="muted">{translate("{count} available actions", { count: availableNextActions.length })}</p>
          </div>
        </div>
        {dashboardNextActions.length > 0 ? (
          <div className="stack">
            {dashboardNextActions.map((action) => (
              <button className="item" key={action.id} onClick={() => setScreen("next-actions")}>
                <strong>{action.title}</strong>
                <span>{action.actionText}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="notice">{translate("No available next action.")}</div>
        )}
        <div className="actions">
          <button className="ghost" onClick={() => setScreen("next-actions")}>{translate("Open Next Action Center")}</button>
        </div>
      </div>

      <div className="panel">
        <h2>{translate("Current next steps")}</h2>
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
              <span>{t.nextAction || translate("No next action set yet.")}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>{translate("Universes")}</h2>
        <div className="cards">
          {activeUniverses.map((u) => (
            <div className="card" key={u.id}>
              <strong>{u.name}</strong>
              <p>{u.purpose || u.description}</p>
              <div className="chips">
                <span>{u.focus}</span>
                <span>{translate("{count} thoughts", { count: state.thoughts.filter((t) => t.universeId === u.id).length })}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>{translate("Projects")}</h2>
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
                <span>{r.score}% · {translate(r.value)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
