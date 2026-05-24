import { useMemo, useState } from "react";
import type {
  AppState,
  BlockingQuestion,
  BlockingQuestionImpactLevel,
  BlockingQuestionStatus
} from "../../domain/types";
import {
  getBlockingQuestionSummary,
  listBlockingQuestions
} from "../../domain/blockingQuestions";
import { useI18n } from "../../i18n";
import { Metric } from "../common/Metric";

const statuses: Array<BlockingQuestionStatus | "all"> = ["all", "open", "in_review", "resolved", "archived"];
const editableStatuses: BlockingQuestionStatus[] = ["open", "in_review", "resolved", "archived"];
const impactLevels: BlockingQuestionImpactLevel[] = ["low", "medium", "high", "blocking"];
type Translate = (key: string, values?: Record<string, number | string>) => string;

function statusLabel(status: BlockingQuestionStatus | "all", t: Translate) {
  return t({
    all: "All statuses",
    open: "open",
    in_review: "exploring",
    resolved: "decided",
    archived: "archived"
  }[status]);
}

function linkedCountLabel(label: string, count: number, t: Translate) {
  return t(`${label}: {count}`, { count });
}

function preferredOptionLabel(question: BlockingQuestion) {
  return question.possibleOptions?.find((option) => option.id === question.preferredOptionId)?.label;
}

function BlockingQuestionCard({
  question,
  onUpdate,
  onResolve,
  onArchive,
  onDelete,
  onCreateDecisionFromBlockingQuestion,
  onOpenDecisionRecords,
  onError
}: {
  question: BlockingQuestion;
  onUpdate: (questionId: string, patch: Partial<BlockingQuestion>) => { ok: boolean; error?: string };
  onResolve: (questionId: string, finalResolution: string) => { ok: boolean; error?: string };
  onArchive: (questionId: string) => { ok: boolean; error?: string };
  onDelete: (questionId: string) => { ok: boolean; error?: string };
  onCreateDecisionFromBlockingQuestion: (questionId: string) => { ok: boolean; error?: string };
  onOpenDecisionRecords: () => void;
  onError: (message: string) => void;
}) {
  const { t } = useI18n();
  const [proposedResolution, setProposedResolution] = useState(question.proposedResolution ?? "");
  const [finalResolution, setFinalResolution] = useState(question.finalResolution ?? "");
  const [status, setStatus] = useState<BlockingQuestionStatus>(question.status);
  const [impactLevel, setImpactLevel] = useState<BlockingQuestionImpactLevel>(question.impactLevel ?? "medium");
  const [decisionNote, setDecisionNote] = useState(question.decisionNote ?? "");
  const [preferredOptionId, setPreferredOptionId] = useState(question.preferredOptionId ?? "");
  const preferredLabel = preferredOptionLabel(question);

  const applyResult = (result: { ok: boolean; error?: string }) => {
    onError(result.ok ? "" : result.error ?? t("Blocking question action failed."));
    return result.ok;
  };

  const save = () => {
    applyResult(onUpdate(question.id, {
      proposedResolution,
      finalResolution,
      status,
      impactLevel,
      decisionNote,
      preferredOptionId
    }));
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
    if (!window.confirm(t("Delete this blocking question?"))) return;
    applyResult(onDelete(question.id));
  };

  const createDecision = () => {
    if (applyResult(onCreateDecisionFromBlockingQuestion(question.id))) {
      onOpenDecisionRecords();
    }
  };

  const canCreateDecision = Boolean(question.finalResolution?.trim() || question.proposedResolution?.trim());

  return (
    <article className="card blocking-question-card">
      <div className="line">
        <strong>{question.question}</strong>
        <span className={`badge question-status-${question.status}`}>{t(question.status)}</span>
      </div>
      {question.context && <p>{question.context}</p>}
      <div className="chips">
        <span className={`decision-impact-${question.impactLevel ?? "medium"}`}>
          {t("Impact: {impact}", { impact: t(question.impactLevel ?? "medium") })}
        </span>
        {preferredLabel && <span>{t("Preferred: {label}", { label: preferredLabel })}</span>}
        <span>{t("Updated: {date}", { date: question.updatedAt.slice(0, 10) })}</span>
      </div>
      {question.decisionNote && (
        <div className="mini-list">
          <strong>{t("Decision note")}</strong>
          <p>{question.decisionNote}</p>
        </div>
      )}
      {question.possibleOptions && question.possibleOptions.length > 0 && (
        <div className="mini-list">
          <strong>{t("Possible options")}</strong>
          <ul>
            {question.possibleOptions.map((option) => (
              <li key={option.id}>
                <strong>{option.label}</strong>
                {option.id === question.preferredOptionId && ` ${t("(preferred)")}`}
                {option.description && <span> - {option.description}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {question.proposedResolution && (
        <div className="mini-list">
          <strong>{t("Proposed resolution")}</strong>
          <p>{question.proposedResolution}</p>
        </div>
      )}
      {question.finalResolution && (
        <div className="mini-list">
          <strong>{t("Final resolution")}</strong>
          <p>{question.finalResolution}</p>
        </div>
      )}
      <div className="chips">
        <span>{linkedCountLabel("Linked thoughts", question.linkedThoughtIds?.length ?? 0, t)}</span>
        <span>{linkedCountLabel("Linked projects", question.linkedProjectIds?.length ?? 0, t)}</span>
        <span>{linkedCountLabel("Linked universes", question.linkedUniverseIds?.length ?? 0, t)}</span>
      </div>
      <label>
        {t("Decision note / current thinking")}
        <textarea
          value={decisionNote}
          onChange={(event) => setDecisionNote(event.target.value)}
          placeholder={t("Write the current decision thinking.")}
        />
      </label>
      <label>
        {t("Preferred option")}
        <select
          aria-label={t("Preferred option")}
          value={preferredOptionId}
          onChange={(event) => setPreferredOptionId(event.target.value)}
        >
          <option value="">{t("No preferred option")}</option>
          {(question.possibleOptions ?? []).map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
      </label>
      <label>
        {t("Proposed resolution")}
        <textarea value={proposedResolution} onChange={(event) => setProposedResolution(event.target.value)} />
      </label>
      <label>
        {t("Final resolution")}
        <textarea value={finalResolution} onChange={(event) => setFinalResolution(event.target.value)} />
      </label>
      <label>
        {t("Status")}
        <select value={status} onChange={(event) => setStatus(event.target.value as BlockingQuestionStatus)}>
          {editableStatuses.map((item) => (
            <option key={item} value={item}>{statusLabel(item, t)}</option>
          ))}
        </select>
      </label>
      <label>
        {t("Impact level")}
        <select
          aria-label={t("Impact level")}
          value={impactLevel}
          onChange={(event) => setImpactLevel(event.target.value as BlockingQuestionImpactLevel)}
        >
          {impactLevels.map((item) => (
            <option key={item} value={item}>{t(item)}</option>
          ))}
        </select>
      </label>
      <div className="actions">
        <button className="ghost" onClick={save}>{t("Save")}</button>
        <button className="restore" onClick={resolve}>{t("Resolve")}</button>
        {canCreateDecision && (
          <button className="ghost" onClick={createDecision}>{t("Create Decision Record")}</button>
        )}
        <button className="ghost" onClick={archive}>{t("Archive")}</button>
        <button className="danger" onClick={deleteQuestion}>{t("Delete")}</button>
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
  onDelete,
  onCreateDecisionFromBlockingQuestion,
  onOpenDecisionRecords
}: {
  state: AppState;
  onCreate: (input: { question: string; context?: string }) => { ok: boolean; error?: string };
  onUpdate: (questionId: string, patch: Partial<BlockingQuestion>) => { ok: boolean; error?: string };
  onResolve: (questionId: string, finalResolution: string) => { ok: boolean; error?: string };
  onArchive: (questionId: string) => { ok: boolean; error?: string };
  onDelete: (questionId: string) => { ok: boolean; error?: string };
  onCreateDecisionFromBlockingQuestion: (questionId: string) => { ok: boolean; error?: string };
  onOpenDecisionRecords: () => void;
}) {
  const { t } = useI18n();
  const [searchText, setSearchText] = useState("");
  const [status, setStatus] = useState<BlockingQuestionStatus | "all">("all");
  const [newQuestion, setNewQuestion] = useState("");
  const [newContext, setNewContext] = useState("");
  const [error, setError] = useState("");
  const visibleQuestions = useMemo(
    () => listBlockingQuestions(state, { searchText, status }),
    [searchText, state, status]
  );
  const summary = useMemo(() => getBlockingQuestionSummary(state), [state]);

  const create = () => {
    const result = onCreate({ question: newQuestion, context: newContext });

    if (!result.ok) {
      setError(result.error ?? t("Blocking question action failed."));
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
            <h2>{t("Decision Center")}</h2>
            <p className="muted">{t("Track blocking questions, current options, and decisions before engineering handoff.")}</p>
          </div>
        </div>
        <div className="metrics decision-center-metrics">
          <Metric label={t("Open blockers")} value={summary.openCount} />
          <Metric label={t("Decided")} value={summary.decidedCount} />
          <Metric label={t("Core decided")} value={summary.allCoreDecided ? t("Yes") : t("No")} />
          <Metric label={t("Unresolved")} value={summary.unresolvedCount} />
        </div>
      </section>

      <section className="panel decision-summary-card">
        <div className="head">
          <div>
            <h2>{t("Decision Summary")}</h2>
            <p className="muted">{t(summary.readinessMessage)}</p>
          </div>
        </div>
        <div className="grid two">
          <div className="mini-list">
            <strong>{t("Highest impact unresolved question")}</strong>
            <p>{summary.highestImpactUnresolved?.question ?? t("No unresolved blocking question.")}</p>
          </div>
          <div className="mini-list">
            <strong>{t("Suggested next decision")}</strong>
            <p>{summary.suggestedNextDecision?.question ?? t("Review engineering readiness as the next phase.")}</p>
          </div>
        </div>
      </section>

      <section className="panel form">
        <div className="list-controls">
          <label>
            {t("Search")}
            <input
              aria-label={t("Search blocking questions")}
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={t("Search blocking questions")}
            />
          </label>
          <label>
            {t("Status filter")}
            <select
              aria-label={t("Status filter")}
              value={status}
              onChange={(event) => setStatus(event.target.value as BlockingQuestionStatus | "all")}
            >
              {statuses.map((item) => (
                <option key={item} value={item}>{statusLabel(item, t)}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="panel form">
        <h2>{t("Create Blocking Question")}</h2>
        {error && <div className="warn">{error}</div>}
        <label>
          {t("Question")}
          <input value={newQuestion} onChange={(event) => setNewQuestion(event.target.value)} />
        </label>
        <label>
          {t("Context")}
          <textarea value={newContext} onChange={(event) => setNewContext(event.target.value)} />
        </label>
        <div className="actions">
          <button onClick={create}>{t("Create Blocking Question")}</button>
        </div>
      </section>

      <section className="panel stack">
        <div className="head">
          <div>
            <h2>{t("Questions")}</h2>
            <p className="muted">{t("{count} shown", { count: visibleQuestions.length })}</p>
          </div>
        </div>
        {visibleQuestions.length === 0 ? (
          <div className="notice">{t("No blocking questions match the current filters.")}</div>
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
                onCreateDecisionFromBlockingQuestion={onCreateDecisionFromBlockingQuestion}
                onOpenDecisionRecords={onOpenDecisionRecords}
                onError={setError}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
