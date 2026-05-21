import { useMemo, useState } from "react";
import type { AppState, BlockingQuestion, BlockingQuestionStatus } from "../../domain/types";
import { listBlockingQuestions } from "../../domain/blockingQuestions";

const statuses: Array<BlockingQuestionStatus | "all"> = ["all", "open", "in_review", "resolved", "archived"];

function linkedCountLabel(label: string, count: number) {
  return `${label}: ${count}`;
}

function BlockingQuestionCard({
  question,
  onUpdate,
  onResolve,
  onArchive,
  onDelete,
  onError
}: {
  question: BlockingQuestion;
  onUpdate: (questionId: string, patch: Partial<BlockingQuestion>) => { ok: boolean; error?: string };
  onResolve: (questionId: string, finalResolution: string) => { ok: boolean; error?: string };
  onArchive: (questionId: string) => { ok: boolean; error?: string };
  onDelete: (questionId: string) => { ok: boolean; error?: string };
  onError: (message: string) => void;
}) {
  const [proposedResolution, setProposedResolution] = useState(question.proposedResolution ?? "");
  const [finalResolution, setFinalResolution] = useState(question.finalResolution ?? "");
  const [status, setStatus] = useState<BlockingQuestionStatus>(question.status);

  const applyResult = (result: { ok: boolean; error?: string }) => {
    onError(result.ok ? "" : result.error ?? "Blocking question action failed.");
    return result.ok;
  };

  const save = () => {
    applyResult(onUpdate(question.id, { proposedResolution, finalResolution, status }));
  };

  const resolve = () => {
    if (applyResult(onResolve(question.id, finalResolution))) {
      setStatus("resolved");
    }
  };

  const archive = () => {
    if (applyResult(onArchive(question.id))) {
      setStatus("archived");
    }
  };

  const deleteQuestion = () => {
    if (!window.confirm("Delete this blocking question?")) return;
    applyResult(onDelete(question.id));
  };

  return (
    <article className="card blocking-question-card">
      <div className="line">
        <strong>{question.question}</strong>
        <span className={`badge question-status-${question.status}`}>{question.status}</span>
      </div>
      {question.context && <p>{question.context}</p>}
      {question.proposedResolution && (
        <div className="mini-list">
          <strong>Proposed resolution</strong>
          <p>{question.proposedResolution}</p>
        </div>
      )}
      {question.finalResolution && (
        <div className="mini-list">
          <strong>Final resolution</strong>
          <p>{question.finalResolution}</p>
        </div>
      )}
      <div className="chips">
        <span>{linkedCountLabel("Linked thoughts", question.linkedThoughtIds?.length ?? 0)}</span>
        <span>{linkedCountLabel("Linked projects", question.linkedProjectIds?.length ?? 0)}</span>
        <span>{linkedCountLabel("Linked universes", question.linkedUniverseIds?.length ?? 0)}</span>
      </div>
      <label>
        Proposed resolution
        <textarea value={proposedResolution} onChange={(event) => setProposedResolution(event.target.value)} />
      </label>
      <label>
        Final resolution
        <textarea value={finalResolution} onChange={(event) => setFinalResolution(event.target.value)} />
      </label>
      <label>
        Status
        <select value={status} onChange={(event) => setStatus(event.target.value as BlockingQuestionStatus)}>
          <option value="open">open</option>
          <option value="in_review">in_review</option>
          <option value="resolved">resolved</option>
          <option value="archived">archived</option>
        </select>
      </label>
      <div className="actions">
        <button className="ghost" onClick={save}>Save</button>
        <button className="restore" onClick={resolve}>Resolve</button>
        <button className="ghost" onClick={archive}>Archive</button>
        <button className="danger" onClick={deleteQuestion}>Delete</button>
      </div>
    </article>
  );
}

export function BlockingQuestionsCenter({
  state,
  onCreate,
  onUpdate,
  onResolve,
  onArchive,
  onDelete
}: {
  state: AppState;
  onCreate: (input: { question: string; context?: string }) => { ok: boolean; error?: string };
  onUpdate: (questionId: string, patch: Partial<BlockingQuestion>) => { ok: boolean; error?: string };
  onResolve: (questionId: string, finalResolution: string) => { ok: boolean; error?: string };
  onArchive: (questionId: string) => { ok: boolean; error?: string };
  onDelete: (questionId: string) => { ok: boolean; error?: string };
}) {
  const [searchText, setSearchText] = useState("");
  const [status, setStatus] = useState<BlockingQuestionStatus | "all">("all");
  const [newQuestion, setNewQuestion] = useState("");
  const [newContext, setNewContext] = useState("");
  const [error, setError] = useState("");
  const visibleQuestions = useMemo(
    () => listBlockingQuestions(state, { searchText, status }),
    [searchText, state, status]
  );

  const create = () => {
    const result = onCreate({ question: newQuestion, context: newContext });

    if (!result.ok) {
      setError(result.error ?? "Blocking question action failed.");
      return;
    }

    setError("");
    setNewQuestion("");
    setNewContext("");
  };

  return (
    <div className="stack">
      <section className="panel hero">
        <div className="head">
          <div>
            <h2>Blocking Questions Center</h2>
            <p className="muted">Track unresolved product and architecture questions before they block execution.</p>
          </div>
        </div>
      </section>

      <section className="panel form">
        <div className="list-controls">
          <label>
            Search
            <input
              aria-label="Search blocking questions"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search blocking questions"
            />
          </label>
          <label>
            Status filter
            <select
              aria-label="Status filter"
              value={status}
              onChange={(event) => setStatus(event.target.value as BlockingQuestionStatus | "all")}
            >
              {statuses.map((item) => (
                <option key={item} value={item}>{item === "all" ? "All statuses" : item}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="panel form">
        <h2>Create Blocking Question</h2>
        {error && <div className="warn">{error}</div>}
        <label>
          Question
          <input value={newQuestion} onChange={(event) => setNewQuestion(event.target.value)} />
        </label>
        <label>
          Context
          <textarea value={newContext} onChange={(event) => setNewContext(event.target.value)} />
        </label>
        <div className="actions">
          <button onClick={create}>Create Blocking Question</button>
        </div>
      </section>

      <section className="panel stack">
        <div className="head">
          <div>
            <h2>Questions</h2>
            <p className="muted">{visibleQuestions.length} shown</p>
          </div>
        </div>
        {visibleQuestions.length === 0 ? (
          <div className="notice">No blocking questions match the current filters.</div>
        ) : (
          <div className="cards">
            {visibleQuestions.map((question) => (
              <BlockingQuestionCard
                key={question.id}
                question={question}
                onUpdate={onUpdate}
                onResolve={onResolve}
                onArchive={onArchive}
                onDelete={onDelete}
                onError={setError}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
