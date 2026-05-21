import { useMemo, useState } from "react";
import type { AppState, BlockingQuestion } from "../../domain/types";
import { getBlockingQuestionSummary } from "../../domain/blockingQuestions";
import {
  getReviewQueueCounts,
  searchReviewQueue,
  type ReviewQueueItem,
  type ReviewQueueItemType
} from "../../domain/reviewQueue";
import type { DecisionRecordActionResult } from "../../domain/decisionRecords";
import { Metric } from "../common/Metric";

const reviewTypes: Array<ReviewQueueItemType | "all"> = [
  "all",
  "ai_insight",
  "decision_record",
  "blocking_question",
  "handoff_candidate"
];

const statusOptions = [
  "all",
  "draft",
  "proposed",
  "open",
  "in_review",
  "ready_for_engineering"
];

function typeLabel(type: ReviewQueueItemType | "all") {
  return {
    all: "All types",
    ai_insight: "AI drafts",
    decision_record: "Decision records",
    blocking_question: "Blocking questions",
    handoff_candidate: "Handoff candidates"
  }[type];
}

function actionError(result: { ok: boolean; error?: string }, fallback: string) {
  return result.ok ? "" : result.error ?? fallback;
}

function statusClass(status: string) {
  return `review-status-${status.replace(/_/g, "-")}`;
}

function ReviewQueueCard({
  item,
  onAcceptAiInsight,
  onRejectAiInsight,
  onAcceptDecisionRecord,
  onRejectDecisionRecord,
  onResolveBlockingQuestion,
  onUpdateBlockingQuestion,
  onMarkProjectHandoffReady,
  onOpenReviewItem,
  onError,
  onNotice
}: {
  item: ReviewQueueItem;
  onAcceptAiInsight: (id: string) => void;
  onRejectAiInsight: (id: string) => void;
  onAcceptDecisionRecord: (decisionRecordId: string) => DecisionRecordActionResult;
  onRejectDecisionRecord: (decisionRecordId: string) => DecisionRecordActionResult;
  onResolveBlockingQuestion: (questionId: string, finalResolution: string) => { ok: boolean; error?: string };
  onUpdateBlockingQuestion: (questionId: string, patch: Partial<BlockingQuestion>) => { ok: boolean; error?: string };
  onMarkProjectHandoffReady: (projectId: string) => { ok: boolean; error?: string };
  onOpenReviewItem: (item: ReviewQueueItem) => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
}) {
  const applyResult = (result: { ok: boolean; error?: string }, successMessage: string, fallback: string) => {
    const message = actionError(result, fallback);
    onError(message);
    onNotice(message ? "" : successMessage);
    return result.ok;
  };

  const accept = () => {
    if (item.type === "ai_insight") {
      onAcceptAiInsight(item.sourceId);
      onError("");
      onNotice("AI draft accepted.");
      return;
    }

    if (item.type === "decision_record") {
      applyResult(onAcceptDecisionRecord(item.sourceId), "Decision accepted.", "Decision could not be accepted.");
    }
  };

  const reject = () => {
    if (item.type === "ai_insight") {
      onRejectAiInsight(item.sourceId);
      onError("");
      onNotice("AI draft rejected.");
      return;
    }

    if (item.type === "decision_record") {
      applyResult(
        onRejectDecisionRecord(item.sourceId),
        "Decision moved out of proposed review.",
        "Decision could not be rejected."
      );
    }
  };

  const markReviewed = () => {
    if (item.type === "blocking_question") {
      if (item.reviewResolution) {
        applyResult(
          onResolveBlockingQuestion(item.sourceId, item.reviewResolution),
          "Blocking question resolved.",
          "Blocking question could not be resolved."
        );
        return;
      }

      applyResult(
        onUpdateBlockingQuestion(item.sourceId, { status: "in_review" }),
        "Blocking question marked in review.",
        "Blocking question could not be marked reviewed."
      );
      return;
    }

    if (item.type === "handoff_candidate") {
      applyResult(
        onMarkProjectHandoffReady(item.sourceId),
        "Project marked handoff ready.",
        "Project could not be marked handoff ready."
      );
    }
  };

  return (
    <article className={`card review-queue-card review-queue-${item.type}`}>
      <div className="line">
        <strong>{item.title}</strong>
        <span className={`badge ${statusClass(item.status)}`}>{item.status}</span>
      </div>
      <div className="chips">
        <span>{typeLabel(item.type)}</span>
        {item.universeId && <span>{item.universeId}</span>}
      </div>
      <p>{item.subtitle}</p>
      {item.body && <pre className="review-queue-body">{item.body}</pre>}
      <div className="actions">
        {(item.type === "ai_insight" || item.type === "decision_record") && (
          <button onClick={accept}>Accept</button>
        )}
        {(item.type === "ai_insight" || item.type === "decision_record") && (
          <button className="ghost" onClick={reject}>Reject</button>
        )}
        {(item.type === "blocking_question" || item.type === "handoff_candidate") && (
          <button className="restore" onClick={markReviewed}>Mark Reviewed</button>
        )}
        <button className="ghost" onClick={() => onOpenReviewItem(item)}>Open Source</button>
      </div>
    </article>
  );
}

export function ReviewQueueCenter({
  state,
  onSetAiInsight,
  onAcceptDecisionRecord,
  onRejectDecisionRecord,
  onResolveBlockingQuestion,
  onUpdateBlockingQuestion,
  onMarkProjectHandoffReady,
  onOpenReviewItem,
  onOpenDecisionCenter
}: {
  state: AppState;
  onSetAiInsight: (id: string, status: "accepted" | "rejected") => void;
  onAcceptDecisionRecord: (decisionRecordId: string) => DecisionRecordActionResult;
  onRejectDecisionRecord: (decisionRecordId: string) => DecisionRecordActionResult;
  onResolveBlockingQuestion: (questionId: string, finalResolution: string) => { ok: boolean; error?: string };
  onUpdateBlockingQuestion: (questionId: string, patch: Partial<BlockingQuestion>) => { ok: boolean; error?: string };
  onMarkProjectHandoffReady: (projectId: string) => { ok: boolean; error?: string };
  onOpenReviewItem: (item: ReviewQueueItem) => void;
  onOpenDecisionCenter: () => void;
}) {
  const [searchText, setSearchText] = useState("");
  const [type, setType] = useState<ReviewQueueItemType | "all">("all");
  const [status, setStatus] = useState("all");
  const [universeId, setUniverseId] = useState("all");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const allItems = useMemo(() => searchReviewQueue(state), [state]);
  const visibleItems = useMemo(
    () => searchReviewQueue(state, { searchText, type, status, universeId }),
    [searchText, state, status, type, universeId]
  );
  const counts = getReviewQueueCounts(allItems);
  const decisionSummary = useMemo(() => getBlockingQuestionSummary(state), [state]);

  return (
    <div className="stack">
      <section className="panel hero">
        <div className="head">
          <div>
            <h2>Review Queue Center</h2>
            <p className="muted">Review AI drafts, proposed decisions, blockers, and handoff-ready projects.</p>
          </div>
        </div>
        <div className="metrics review-queue-metrics">
          <Metric label="Total pending" value={counts.total} />
          <Metric label="AI drafts" value={counts.aiDrafts} />
          <Metric label="Decisions" value={counts.proposedDecisions} />
          <Metric label="Blockers" value={counts.blockingQuestions} />
          <Metric label="Handoff" value={counts.handoffCandidates} />
          <Metric label="Open decisions" value={decisionSummary.openCount} />
        </div>
        <div className="actions review-queue-decision-link">
          <button className="ghost" onClick={onOpenDecisionCenter}>Open Decision Center</button>
        </div>
      </section>

      <section className="panel form">
        <div className="list-controls">
          <label>
            Search
            <input
              aria-label="Search review queue"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search review queue"
            />
          </label>
          <label>
            Type filter
            <select
              aria-label="Review type filter"
              value={type}
              onChange={(event) => setType(event.target.value as ReviewQueueItemType | "all")}
            >
              {reviewTypes.map((item) => (
                <option key={item} value={item}>{typeLabel(item)}</option>
              ))}
            </select>
          </label>
          <label>
            Status filter
            <select
              aria-label="Review status filter"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {statusOptions.map((item) => (
                <option key={item} value={item}>{item === "all" ? "All statuses" : item}</option>
              ))}
            </select>
          </label>
          <label>
            Universe filter
            <select
              aria-label="Review universe filter"
              value={universeId}
              onChange={(event) => setUniverseId(event.target.value)}
            >
              <option value="all">All universes</option>
              {state.universes.map((universe) => (
                <option key={universe.id} value={universe.id}>{universe.name}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="panel stack">
        <div className="head">
          <div>
            <h2>Queue Items</h2>
            <p className="muted">{visibleItems.length} shown</p>
          </div>
        </div>
        {error && <div className="warn">{error}</div>}
        {notice && <div className="notice">{notice}</div>}
        {visibleItems.length === 0 ? (
          <div className="notice">No review queue items match the current filters.</div>
        ) : (
          <div className="cards">
            {visibleItems.map((item) => (
              <ReviewQueueCard
                key={item.id}
                item={item}
                onAcceptAiInsight={(id) => onSetAiInsight(id, "accepted")}
                onRejectAiInsight={(id) => onSetAiInsight(id, "rejected")}
                onAcceptDecisionRecord={onAcceptDecisionRecord}
                onRejectDecisionRecord={onRejectDecisionRecord}
                onResolveBlockingQuestion={onResolveBlockingQuestion}
                onUpdateBlockingQuestion={onUpdateBlockingQuestion}
                onMarkProjectHandoffReady={onMarkProjectHandoffReady}
                onOpenReviewItem={onOpenReviewItem}
                onError={setError}
                onNotice={setNotice}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
