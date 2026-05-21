import { useEffect, useMemo, useState } from "react";
import type { AppState, NextActionConfidence, NextActionFocusMode, Universe } from "../../domain/types";
import {
  calculateNextActionSummary,
  listNextActions,
  type NextActionItem,
  type NextActionSourceType,
  type NextActionStatePatch,
  type NextActionStatus
} from "../../domain/nextActions";
import { Metric } from "../common/Metric";

const sourceTypes: Array<NextActionSourceType | "all"> = [
  "all",
  "blocking_question",
  "engineering_readiness",
  "review_queue",
  "thought",
  "project",
  "system"
];
const statuses: Array<NextActionStatus | "all"> = ["all", "available", "blocked", "completed"];
const confidenceOptions: NextActionConfidence[] = ["low", "medium", "high"];
const focusModes: NextActionFocusMode[] = ["explore", "decide", "build", "review"];

function universeLabel(universes: Universe[], universeId: string | undefined) {
  if (!universeId) return "No universe";
  return universes.find((universe) => universe.id === universeId)?.name ?? universeId;
}

function sourceLabel(sourceType: NextActionSourceType) {
  return {
    thought: "Thought",
    project: "Project",
    blocking_question: "Decision",
    review_queue: "Review",
    engineering_readiness: "Readiness",
    system: "System"
  }[sourceType];
}

function actionTypeLabel(actionType: NextActionItem["actionType"]) {
  return {
    decide: "Decide",
    review: "Review",
    clarify: "Clarify",
    prototype: "Prototype",
    implement: "Implement",
    organize: "Organize",
    "follow-up": "Follow-up"
  }[actionType];
}

function applyResult(result: { ok: boolean; error?: string }, success: string, fallback: string) {
  return result.ok ? success : result.error ?? fallback;
}

function ActionCard({
  item,
  universes,
  onViewSource,
  onPin,
  onDismiss,
  primary = false
}: {
  item: NextActionItem;
  universes: Universe[];
  onViewSource: (item: NextActionItem) => void;
  onPin: (item: NextActionItem) => void;
  onDismiss: (item: NextActionItem) => void;
  primary?: boolean;
}) {
  return (
    <article className={`card next-action-card ${primary ? "next-action-primary" : ""}`}>
      <div className="line">
        <strong>{item.title}</strong>
        <span className={`badge next-action-priority-${item.priority}`}>{item.priority}</span>
      </div>
      <p>{item.description}</p>
      <div className="mini-list">
        <strong>Suggested next action</strong>
        <p>{item.actionText}</p>
      </div>
      <div className="chips">
        <span className={`next-action-${item.status}`}>{item.status}</span>
        <span>{actionTypeLabel(item.actionType)}</span>
        <span>{sourceLabel(item.sourceType)}</span>
        <span>{universeLabel(universes, item.universeId)}</span>
        {item.sourceStatus && <span>{item.sourceStatus}</span>}
        <span>{item.confidence}% confidence</span>
      </div>
      <div className="mini-list">
        <strong>Reason</strong>
        <p>{item.reason}</p>
      </div>
      {item.blockers.length > 0 && (
        <div className="mini-list warn-lite">
          <strong>Blockers</strong>
          <ul>
            {item.blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="actions">
        <button onClick={() => onPin(item)}>{primary ? "Pin Top Action" : "Pin Focus"}</button>
        <button className="ghost" onClick={() => onDismiss(item)}>{primary ? "Dismiss Top Action" : "Dismiss"}</button>
        <button className="ghost" onClick={() => onViewSource(item)}>View Source</button>
      </div>
    </article>
  );
}

export function NextActionCenter({
  state,
  universes,
  onUpdateNextActionState,
  onPinNextAction,
  onDismissNextAction,
  onClearDismissedNextActions,
  onClearFocusNextAction,
  onViewSource,
  onOpenDecisionCenter,
  onOpenReviewQueue,
  onOpenEngineeringReadiness
}: {
  state: AppState;
  universes: Universe[];
  onCompleteNextAction?: (item: NextActionItem) => { ok: boolean; error?: string };
  onSetNextActionForSource?: (
    sourceType: NextActionSourceType,
    sourceId: string,
    nextAction: string
  ) => { ok: boolean; error?: string };
  onUpdateNextActionState: (patch: NextActionStatePatch) => { ok: boolean; error?: string };
  onPinNextAction: (actionId: string) => { ok: boolean; error?: string };
  onDismissNextAction: (actionId: string) => { ok: boolean; error?: string };
  onClearDismissedNextActions: () => { ok: boolean; error?: string };
  onClearFocusNextAction: () => { ok: boolean; error?: string };
  onViewSource: (item: NextActionItem) => void;
  onOpenDecisionCenter: () => void;
  onOpenReviewQueue: () => void;
  onOpenEngineeringReadiness: () => void;
}) {
  const summary = useMemo(() => calculateNextActionSummary(state), [state]);
  const [searchText, setSearchText] = useState("");
  const [sourceType, setSourceType] = useState<NextActionSourceType | "all">("all");
  const [universeId, setUniverseId] = useState("all");
  const [status, setStatus] = useState<NextActionStatus | "all">("all");
  const [manualNote, setManualNote] = useState(summary.nextActionState.manualNote);
  const [manualConfidence, setManualConfidence] = useState<NextActionConfidence>(summary.nextActionState.manualConfidence);
  const [focusMode, setFocusMode] = useState<NextActionFocusMode>(summary.nextActionState.focusMode);
  const [notice, setNotice] = useState("");
  const visibleActions = useMemo(
    () => listNextActions(state, { searchText, sourceType, universeId, status }),
    [searchText, sourceType, state, status, universeId]
  );

  useEffect(() => {
    setManualNote(summary.nextActionState.manualNote);
    setManualConfidence(summary.nextActionState.manualConfidence);
    setFocusMode(summary.nextActionState.focusMode);
  }, [
    summary.nextActionState.focusMode,
    summary.nextActionState.manualConfidence,
    summary.nextActionState.manualNote
  ]);

  const pin = (item: NextActionItem) => {
    setNotice(applyResult(onPinNextAction(item.id), "Focus action pinned.", "Focus action could not be pinned."));
  };

  const dismiss = (item: NextActionItem) => {
    setNotice(applyResult(onDismissNextAction(item.id), "Next action dismissed.", "Next action could not be dismissed."));
  };

  const saveSettings = () => {
    setNotice(
      applyResult(
        onUpdateNextActionState({
          manualNote,
          manualConfidence,
          focusMode,
          lastReviewedAt: new Date().toISOString()
        }),
        "Next action settings saved.",
        "Next action settings could not be saved."
      )
    );
  };

  const clearDismissed = () => {
    setNotice(applyResult(onClearDismissedNextActions(), "Dismissed actions cleared.", "Dismissed actions could not be cleared."));
  };

  const clearFocus = () => {
    setNotice(applyResult(onClearFocusNextAction(), "Focus action cleared.", "Focus action could not be cleared."));
  };

  return (
    <div className="stack next-action-center">
      <section className="panel hero">
        <div className="head">
          <div>
            <h2>Next Action Center</h2>
            <p className="muted">Choose the next move across decisions, review, readiness, thoughts, and projects.</p>
          </div>
          <div className="chips">
            <span>{summary.priority} priority</span>
            <span>{summary.confidence}% confidence</span>
            <span>{summary.nextActionState.focusMode} mode</span>
          </div>
        </div>
      </section>

      {notice && <div className={notice.includes("could not") ? "warn" : "notice"}>{notice}</div>}

      <section className="panel stack" aria-label="Top Recommended Action">
        <div className="head">
          <div>
            <h2>Top Recommended Action</h2>
            <p className="muted">{summary.suggestedNextActionText}</p>
          </div>
          <div className="actions">
            <button className="ghost" onClick={onOpenDecisionCenter}>Open Decision Center</button>
            <button className="ghost" onClick={onOpenReviewQueue}>Open Review Queue</button>
            <button className="ghost" onClick={onOpenEngineeringReadiness}>Open Engineering Readiness</button>
          </div>
        </div>
        {summary.topAction ? (
          <ActionCard
            item={summary.topAction}
            universes={universes}
            onViewSource={onViewSource}
            onPin={pin}
            onDismiss={dismiss}
            primary
          />
        ) : (
          <div className="notice">No recommended action is currently available.</div>
        )}
      </section>

      <section className="panel stack" aria-label="System Signals Summary">
        <div className="head">
          <div>
            <h2>System Signals Summary</h2>
            <p className="muted">Signals used to decide the next action.</p>
          </div>
        </div>
        <div className="metrics next-action-metrics">
          <Metric label="Open decisions" value={summary.signals.openBlockingDecisionCount} />
          <Metric label="High blockers" value={summary.signals.highBlockingUnresolvedDecisionCount} />
          <Metric label="Decided" value={summary.signals.decidedDecisionCount} />
          <Metric label="Readiness score" value={`${summary.signals.readinessScore}%`} />
          <Metric label="Pending review" value={summary.signals.pendingReviewCount} />
          <Metric label="Dismissed" value={summary.signals.dismissedActionCount} />
        </div>
        <div className="chips">
          <span className={`readiness-status-${summary.signals.readinessStatus}`}>{summary.signals.readinessStatus}</span>
          <span>{summary.signals.reviewBlockerCount} review blockers</span>
          <span>{summary.nextActionState.savedActionIds.length} pinned history</span>
        </div>
      </section>

      <section className="panel stack" aria-label="Focus Action">
        <div className="head">
          <div>
            <h2>Focus Action</h2>
            <p className="muted">The action the user pinned as the current focus.</p>
          </div>
          <button className="ghost" onClick={clearFocus}>Clear Focus</button>
        </div>
        {summary.focusAction ? (
          <div className="focus-action">
            <div>
              <strong>{summary.focusAction.title}</strong>
              <p>{summary.focusAction.actionText}</p>
              <div className="chips">
                <span>{summary.focusAction.priority}</span>
                <span>{actionTypeLabel(summary.focusAction.actionType)}</span>
                <span>{sourceLabel(summary.focusAction.sourceType)}</span>
              </div>
            </div>
            <div className="actions">
              <button className="ghost" onClick={() => onViewSource(summary.focusAction!)}>View Source</button>
              <button className="ghost" onClick={clearFocus}>Clear Focus</button>
            </div>
          </div>
        ) : (
          <div className="notice">No focus action pinned yet.</div>
        )}
      </section>

      <section className="panel form" aria-label="Manual Settings">
        <div className="head">
          <div>
            <h2>Manual Next Action Note</h2>
            <p className="muted">Save the human reading of what should happen next.</p>
          </div>
        </div>
        <label>
          Manual next action note
          <textarea
            aria-label="Manual next action note"
            value={manualNote}
            onChange={(event) => setManualNote(event.target.value)}
            placeholder="Write the human next action note"
          />
        </label>
        <div className="row">
          <label>
            Manual confidence
            <select
              aria-label="Manual confidence"
              value={manualConfidence}
              onChange={(event) => setManualConfidence(event.target.value as NextActionConfidence)}
            >
              {confidenceOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <label>
            Focus mode
            <select
              aria-label="Focus mode"
              value={focusMode}
              onChange={(event) => setFocusMode(event.target.value as NextActionFocusMode)}
            >
              {focusModes.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <div className="actions end">
            <button onClick={saveSettings}>Save Next Action Settings</button>
          </div>
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
                <option key={item} value={item}>{item === "all" ? "All sources" : sourceLabel(item)}</option>
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

      <section className="panel stack" aria-label="Recommended Actions List">
        <div className="head">
          <div>
            <h2>Recommended Actions List</h2>
            <p className="muted">{visibleActions.length} visible, {summary.dismissedActions.length} dismissed</p>
          </div>
          <button className="ghost" onClick={clearDismissed}>Clear Dismissed Actions</button>
        </div>
        {visibleActions.length === 0 ? (
          <div className="notice">No next actions match the current filters.</div>
        ) : (
          <div className="cards">
            {visibleActions.map((item) => (
              <ActionCard
                key={item.id}
                item={item}
                universes={universes}
                onViewSource={onViewSource}
                onPin={pin}
                onDismiss={dismiss}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
