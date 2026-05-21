import { useMemo, useState } from "react";
import type { AppState, Universe } from "../../domain/types";
import {
  listNextActions,
  type NextActionItem,
  type NextActionSourceType,
  type NextActionStatus
} from "../../domain/nextActions";
import { Metric } from "../common/Metric";

const sourceTypes: Array<NextActionSourceType | "all"> = ["all", "thought", "project", "blocking_question"];
const statuses: Array<NextActionStatus | "all"> = ["all", "available", "blocked", "completed"];

function universeLabel(universes: Universe[], universeId: string | undefined) {
  if (!universeId) return "No universe";
  return universes.find((universe) => universe.id === universeId)?.name ?? universeId;
}

function sourceLabel(sourceType: NextActionSourceType) {
  return sourceType;
}

function NextActionCard({
  item,
  universes,
  onViewSource,
  onComplete
}: {
  item: NextActionItem;
  universes: Universe[];
  onViewSource: (item: NextActionItem) => void;
  onComplete: (item: NextActionItem) => void;
}) {
  return (
    <article className="card next-action-card">
      <div className="line">
        <strong>{item.title}</strong>
        <span className={`badge next-action-${item.status}`}>{item.status}</span>
      </div>
      <p>{item.actionText}</p>
      <div className="chips">
        <span>{sourceLabel(item.sourceType)}</span>
        <span>{universeLabel(universes, item.universeId)}</span>
        {item.sourceStatus && <span>{item.sourceStatus}</span>}
      </div>
      {item.reason && <p className="muted">{item.reason}</p>}
      <div className="actions">
        <button className="ghost" onClick={() => onViewSource(item)}>View Source</button>
        <button onClick={() => onComplete(item)}>Complete Action</button>
      </div>
    </article>
  );
}

export function NextActionCenter({
  state,
  universes,
  onCompleteNextAction,
  onViewSource
}: {
  state: AppState;
  universes: Universe[];
  onCompleteNextAction: (item: NextActionItem) => { ok: boolean; error?: string };
  onSetNextActionForSource?: (
    sourceType: NextActionSourceType,
    sourceId: string,
    nextAction: string
  ) => { ok: boolean; error?: string };
  onViewSource: (item: NextActionItem) => void;
}) {
  const [searchText, setSearchText] = useState("");
  const [sourceType, setSourceType] = useState<NextActionSourceType | "all">("all");
  const [universeId, setUniverseId] = useState("all");
  const [status, setStatus] = useState<NextActionStatus | "all">("all");
  const [notice, setNotice] = useState("");
  const allActions = useMemo(() => listNextActions(state), [state]);
  const visibleActions = useMemo(
    () => listNextActions(state, { searchText, sourceType, universeId, status }),
    [searchText, sourceType, state, status, universeId]
  );
  const focusAction = visibleActions.find((item) => item.status === "available");
  const availableActions = allActions.filter((item) => item.status === "available");
  const blockedActions = allActions.filter((item) => item.status === "blocked");
  const thoughtActions = allActions.filter((item) => item.sourceType === "thought");
  const projectActions = allActions.filter((item) => item.sourceType === "project");
  const blockingQuestionActions = allActions.filter((item) => item.sourceType === "blocking_question");

  const complete = (item: NextActionItem) => {
    if (!window.confirm("Complete this next action?")) return;

    const result = onCompleteNextAction(item);
    setNotice(result.ok ? "Next action completed." : result.error ?? "Next action could not be completed.");
  };

  return (
    <div className="stack">
      <section className="panel hero">
        <div className="head">
          <div>
            <h2>Next Action Center</h2>
            <p className="muted">Decide what to do next across thoughts, projects, and blocking questions.</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="metrics next-action-metrics">
          <Metric label="Available actions" value={availableActions.length} />
          <Metric label="Blocked actions" value={blockedActions.length} />
          <Metric label="Thought actions" value={thoughtActions.length} />
          <Metric label="Project actions" value={projectActions.length} />
          <Metric label="Blocking questions" value={blockingQuestionActions.length} />
        </div>
      </section>

      <section className="panel form">
        <div className="list-controls">
          <label>
            Search
            <input
              aria-label="Search next actions"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search next actions"
            />
          </label>
          <label>
            Source filter
            <select
              aria-label="Source filter"
              value={sourceType}
              onChange={(event) => setSourceType(event.target.value as NextActionSourceType | "all")}
            >
              {sourceTypes.map((item) => (
                <option key={item} value={item}>{item === "all" ? "All sources" : item}</option>
              ))}
            </select>
          </label>
          <label>
            Universe filter
            <select
              aria-label="Universe filter"
              value={universeId}
              onChange={(event) => setUniverseId(event.target.value)}
            >
              <option value="all">All universes</option>
              {universes.map((universe) => (
                <option key={universe.id} value={universe.id}>{universe.name}</option>
              ))}
            </select>
          </label>
          <label>
            Status filter
            <select
              aria-label="Status filter"
              value={status}
              onChange={(event) => setStatus(event.target.value as NextActionStatus | "all")}
            >
              {statuses.map((item) => (
                <option key={item} value={item}>{item === "all" ? "All statuses" : item}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="panel stack">
        <div className="head">
          <div>
            <h2>Focus Mode</h2>
            <p className="muted">Pick the first available action from the current view.</p>
          </div>
        </div>
        {notice && <div className={notice.includes("could not") ? "warn" : "notice"}>{notice}</div>}
        {focusAction ? (
          <div className="focus-action">
            <div>
              <strong>{focusAction.title}</strong>
              <p>{focusAction.actionText}</p>
              <div className="chips">
                <span>{sourceLabel(focusAction.sourceType)}</span>
                <span>{universeLabel(universes, focusAction.universeId)}</span>
                {focusAction.sourceStatus && <span>{focusAction.sourceStatus}</span>}
              </div>
            </div>
            <div className="actions">
              <button className="ghost" onClick={() => onViewSource(focusAction)}>View Source</button>
              <button onClick={() => complete(focusAction)}>Complete Action</button>
            </div>
          </div>
        ) : (
          <div className="notice">No available next action.</div>
        )}
      </section>

      <section className="panel stack">
        <div className="head">
          <div>
            <h2>Actions</h2>
            <p className="muted">{visibleActions.length} shown</p>
          </div>
        </div>
        {visibleActions.length === 0 ? (
          <div className="notice">No next actions match the current filters.</div>
        ) : (
          <div className="cards">
            {visibleActions.map((item) => (
              <NextActionCard
                key={item.id}
                item={item}
                universes={universes}
                onViewSource={onViewSource}
                onComplete={complete}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
