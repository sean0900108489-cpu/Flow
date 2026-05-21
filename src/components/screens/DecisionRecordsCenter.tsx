import { useMemo, useState } from "react";
import type { AppState, DecisionRecord, DecisionRecordStatus } from "../../domain/types";
import {
  listDecisionRecords,
  type DecisionRecordActionResult,
  type DecisionRecordInput,
  type DecisionRecordPatch
} from "../../domain/decisionRecords";
import { Metric } from "../common/Metric";

const statuses: Array<DecisionRecordStatus | "all"> = ["all", "proposed", "accepted", "superseded", "archived"];

function actionMessage(result: { ok: boolean; error?: string }, fallback: string) {
  return result.ok ? "" : result.error ?? fallback;
}

function linkedCountLabel(label: string, count: number) {
  return `${label}: ${count}`;
}

function sourceQuestionLabel(state: AppState, sourceBlockingQuestionId: string | undefined) {
  if (!sourceBlockingQuestionId) return "";

  return state.blockingQuestions?.find((question) => question.id === sourceBlockingQuestionId)?.question ??
    sourceBlockingQuestionId;
}

function hasResolution(question: NonNullable<AppState["blockingQuestions"]>[number]) {
  return Boolean(question.finalResolution?.trim() || question.proposedResolution?.trim());
}

function DecisionRecordCard({
  state,
  record,
  onUpdateDecisionRecord,
  onAcceptDecisionRecord,
  onSupersedeDecisionRecord,
  onArchiveDecisionRecord,
  onDeleteDecisionRecord,
  onError
}: {
  state: AppState;
  record: DecisionRecord;
  onUpdateDecisionRecord: (decisionRecordId: string, patch: DecisionRecordPatch) => DecisionRecordActionResult;
  onAcceptDecisionRecord: (decisionRecordId: string) => DecisionRecordActionResult;
  onSupersedeDecisionRecord: (decisionRecordId: string) => DecisionRecordActionResult;
  onArchiveDecisionRecord: (decisionRecordId: string) => DecisionRecordActionResult;
  onDeleteDecisionRecord: (decisionRecordId: string) => DecisionRecordActionResult;
  onError: (message: string) => void;
}) {
  const [title, setTitle] = useState(record.title);
  const [decision, setDecision] = useState(record.decision);
  const [rationale, setRationale] = useState(record.rationale ?? "");
  const [consequences, setConsequences] = useState(record.consequences ?? "");
  const [status, setStatus] = useState<DecisionRecordStatus>(record.status);

  const applyResult = (result: DecisionRecordActionResult) => {
    onError(actionMessage(result, "Decision record action failed."));
    return result.ok;
  };

  const save = () => {
    applyResult(onUpdateDecisionRecord(record.id, { title, decision, rationale, consequences, status }));
  };

  const accept = () => {
    if (applyResult(onAcceptDecisionRecord(record.id))) {
      setStatus("accepted");
    }
  };

  const supersede = () => {
    if (applyResult(onSupersedeDecisionRecord(record.id))) {
      setStatus("superseded");
    }
  };

  const archive = () => {
    if (applyResult(onArchiveDecisionRecord(record.id))) {
      setStatus("archived");
    }
  };

  const deleteRecord = () => {
    if (!window.confirm("Delete this decision record?")) return;
    applyResult(onDeleteDecisionRecord(record.id));
  };

  const sourceQuestion = sourceQuestionLabel(state, record.sourceBlockingQuestionId);

  return (
    <article className="card decision-record-card">
      <div className="line">
        <strong>{record.title}</strong>
        <span className={`badge decision-status-${record.status}`}>{record.status}</span>
      </div>
      <p>{record.decision}</p>
      {record.rationale && (
        <div className="mini-list">
          <strong>Rationale</strong>
          <p>{record.rationale}</p>
        </div>
      )}
      {record.consequences && (
        <div className="mini-list">
          <strong>Consequences</strong>
          <p>{record.consequences}</p>
        </div>
      )}
      {sourceQuestion && (
        <div className="mini-list">
          <strong>Source blocking question</strong>
          <p>{sourceQuestion}</p>
        </div>
      )}
      <div className="chips">
        <span>{linkedCountLabel("Linked thoughts", record.linkedThoughtIds?.length ?? 0)}</span>
        <span>{linkedCountLabel("Linked projects", record.linkedProjectIds?.length ?? 0)}</span>
        <span>{linkedCountLabel("Linked universes", record.linkedUniverseIds?.length ?? 0)}</span>
      </div>
      <label>
        Title
        <input value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label>
        Decision
        <textarea value={decision} onChange={(event) => setDecision(event.target.value)} />
      </label>
      <label>
        Rationale
        <textarea value={rationale} onChange={(event) => setRationale(event.target.value)} />
      </label>
      <label>
        Consequences
        <textarea value={consequences} onChange={(event) => setConsequences(event.target.value)} />
      </label>
      <label>
        Status
        <select value={status} onChange={(event) => setStatus(event.target.value as DecisionRecordStatus)}>
          <option value="proposed">proposed</option>
          <option value="accepted">accepted</option>
          <option value="superseded">superseded</option>
          <option value="archived">archived</option>
        </select>
      </label>
      <div className="actions">
        <button className="ghost" onClick={save}>Save Decision</button>
        <button className="restore" onClick={accept}>Accept</button>
        <button className="ghost" onClick={supersede}>Supersede</button>
        <button className="ghost" onClick={archive}>Archive</button>
        <button className="danger" onClick={deleteRecord}>Delete</button>
      </div>
    </article>
  );
}

export function DecisionRecordsCenter({
  state,
  onCreateDecisionRecord,
  onUpdateDecisionRecord,
  onAcceptDecisionRecord,
  onSupersedeDecisionRecord,
  onArchiveDecisionRecord,
  onDeleteDecisionRecord,
  onCreateDecisionFromBlockingQuestion
}: {
  state: AppState;
  onCreateDecisionRecord: (input: DecisionRecordInput) => DecisionRecordActionResult;
  onUpdateDecisionRecord: (decisionRecordId: string, patch: DecisionRecordPatch) => DecisionRecordActionResult;
  onAcceptDecisionRecord: (decisionRecordId: string) => DecisionRecordActionResult;
  onSupersedeDecisionRecord: (decisionRecordId: string) => DecisionRecordActionResult;
  onArchiveDecisionRecord: (decisionRecordId: string) => DecisionRecordActionResult;
  onDeleteDecisionRecord: (decisionRecordId: string) => DecisionRecordActionResult;
  onCreateDecisionFromBlockingQuestion: (blockingQuestionId: string) => DecisionRecordActionResult;
}) {
  const [searchText, setSearchText] = useState("");
  const [status, setStatus] = useState<DecisionRecordStatus | "all">("all");
  const [universeId, setUniverseId] = useState<string | "all">("all");
  const [newTitle, setNewTitle] = useState("");
  const [newDecision, setNewDecision] = useState("");
  const [newRationale, setNewRationale] = useState("");
  const [newConsequences, setNewConsequences] = useState("");
  const [newStatus, setNewStatus] = useState<DecisionRecordStatus>("proposed");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const allRecords = useMemo(() => listDecisionRecords(state), [state]);
  const visibleRecords = useMemo(
    () => listDecisionRecords(state, { searchText, status, universeId }),
    [searchText, state, status, universeId]
  );
  const resolvableQuestions = useMemo(
    () => (state.blockingQuestions ?? []).filter(hasResolution),
    [state.blockingQuestions]
  );

  const countByStatus = (item: DecisionRecordStatus) =>
    allRecords.filter((record) => record.status === item).length;

  const applyResult = (result: DecisionRecordActionResult, successMessage = "") => {
    if (!result.ok) {
      setError(result.error ?? "Decision record action failed.");
      setNotice("");
      return false;
    }

    setError("");
    setNotice(successMessage);
    return true;
  };

  const create = () => {
    const input: DecisionRecordInput = {
      title: newTitle,
      decision: newDecision,
      rationale: newRationale,
      consequences: newConsequences,
      status: newStatus,
      linkedUniverseIds: universeId === "all" ? [] : [universeId]
    };

    if (applyResult(onCreateDecisionRecord(input), "Decision record created.")) {
      setNewTitle("");
      setNewDecision("");
      setNewRationale("");
      setNewConsequences("");
      setNewStatus("proposed");
    }
  };

  const createFromQuestion = (blockingQuestionId: string) => {
    applyResult(onCreateDecisionFromBlockingQuestion(blockingQuestionId), "Decision record created from blocking question.");
  };

  return (
    <div className="stack">
      <section className="panel hero">
        <div className="head">
          <div>
            <h2>Decision Records Center</h2>
            <p className="muted">Record accepted product and architecture decisions with rationale and consequences.</p>
          </div>
        </div>
        <div className="metrics decision-record-metrics">
          <Metric label="Proposed decisions" value={countByStatus("proposed")} />
          <Metric label="Accepted decisions" value={countByStatus("accepted")} />
          <Metric label="Superseded decisions" value={countByStatus("superseded")} />
          <Metric label="Archived decisions" value={countByStatus("archived")} />
        </div>
      </section>

      <section className="panel form">
        <div className="list-controls">
          <label>
            Search
            <input
              aria-label="Search decision records"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search decision records"
            />
          </label>
          <label>
            Status filter
            <select
              aria-label="Decision status filter"
              value={status}
              onChange={(event) => setStatus(event.target.value as DecisionRecordStatus | "all")}
            >
              {statuses.map((item) => (
                <option key={item} value={item}>{item === "all" ? "All statuses" : item}</option>
              ))}
            </select>
          </label>
          <label>
            Universe filter
            <select
              aria-label="Decision universe filter"
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

      <section className="panel form">
        <h2>Create Decision</h2>
        {error && <div className="warn">{error}</div>}
        {notice && <div className="notice">{notice}</div>}
        <label>
          Title
          <input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} />
        </label>
        <label>
          Decision
          <textarea value={newDecision} onChange={(event) => setNewDecision(event.target.value)} />
        </label>
        <label>
          Rationale
          <textarea value={newRationale} onChange={(event) => setNewRationale(event.target.value)} />
        </label>
        <label>
          Consequences
          <textarea value={newConsequences} onChange={(event) => setNewConsequences(event.target.value)} />
        </label>
        <label>
          Status
          <select value={newStatus} onChange={(event) => setNewStatus(event.target.value as DecisionRecordStatus)}>
            <option value="proposed">proposed</option>
            <option value="accepted">accepted</option>
            <option value="superseded">superseded</option>
            <option value="archived">archived</option>
          </select>
        </label>
        <div className="actions">
          <button onClick={create}>Create Decision Record</button>
        </div>
      </section>

      <section className="panel stack">
        <div className="head">
          <div>
            <h2>Decision Records</h2>
            <p className="muted">{visibleRecords.length} shown</p>
          </div>
        </div>
        {visibleRecords.length === 0 ? (
          <div className="notice">No decision records match the current filters.</div>
        ) : (
          <div className="cards">
            {visibleRecords.map((record) => (
              <DecisionRecordCard
                key={record.id}
                state={state}
                record={record}
                onUpdateDecisionRecord={onUpdateDecisionRecord}
                onAcceptDecisionRecord={onAcceptDecisionRecord}
                onSupersedeDecisionRecord={onSupersedeDecisionRecord}
                onArchiveDecisionRecord={onArchiveDecisionRecord}
                onDeleteDecisionRecord={onDeleteDecisionRecord}
                onError={setError}
              />
            ))}
          </div>
        )}
      </section>

      <section className="panel stack">
        <div className="head">
          <div>
            <h2>Create from Blocking Question</h2>
            <p className="muted">Convert resolved or drafted resolutions into explicit user-owned decisions.</p>
          </div>
        </div>
        {resolvableQuestions.length === 0 ? (
          <div className="notice">No blocking questions with resolutions are available.</div>
        ) : (
          <div className="cards">
            {resolvableQuestions.map((question) => (
              <article className="card decision-source-question-card" key={question.id}>
                <div className="line">
                  <strong>{question.question}</strong>
                  <span className={`badge question-status-${question.status}`}>{question.status}</span>
                </div>
                <p>{question.finalResolution || question.proposedResolution}</p>
                <div className="actions">
                  <button className="ghost" onClick={() => createFromQuestion(question.id)}>
                    Create Decision From Question
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
