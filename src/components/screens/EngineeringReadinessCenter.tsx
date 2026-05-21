import { useEffect, useMemo, useState } from "react";
import {
  calculateEngineeringReadiness,
  type EngineeringReadinessPatch
} from "../../domain/engineeringReadiness";
import type {
  AppState,
  EngineeringReadinessConfidence,
  EngineeringReadinessCriterionStatus,
  EngineeringReadinessOverallStatus,
  EngineeringReadinessTargetPhase
} from "../../domain/types";
import { Metric } from "../common/Metric";

const confidenceOptions: EngineeringReadinessConfidence[] = ["low", "medium", "high"];
const targetPhaseOptions: EngineeringReadinessTargetPhase[] = ["exploration", "prototype", "engineering"];

function statusLabel(status: EngineeringReadinessOverallStatus) {
  return {
    not_ready: "Not Ready",
    partially_ready: "Partially Ready",
    ready_to_prototype: "Ready to Prototype",
    ready_for_engineering: "Ready for Engineering"
  }[status];
}

function criterionStatusLabel(status: EngineeringReadinessCriterionStatus) {
  return {
    met: "met",
    partial: "partial",
    unmet: "unmet",
    blocked: "blocked"
  }[status];
}

function formatDate(value: string | undefined) {
  return value ? value.slice(0, 10) : "Not reviewed";
}

export function EngineeringReadinessCenter({
  state,
  onUpdateAssessment,
  onOpenDecisionCenter,
  onOpenReviewQueue
}: {
  state: AppState;
  onUpdateAssessment: (patch: EngineeringReadinessPatch) => { ok: boolean; error?: string };
  onOpenDecisionCenter: () => void;
  onOpenReviewQueue: () => void;
}) {
  const summary = useMemo(() => calculateEngineeringReadiness(state), [state]);
  const [note, setNote] = useState(summary.assessment.note);
  const [manualConfidence, setManualConfidence] = useState<EngineeringReadinessConfidence>(
    summary.assessment.manualConfidence
  );
  const [targetPhase, setTargetPhase] = useState<EngineeringReadinessTargetPhase>(
    summary.assessment.targetPhase
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    setNote(summary.assessment.note);
    setManualConfidence(summary.assessment.manualConfidence);
    setTargetPhase(summary.assessment.targetPhase);
  }, [summary.assessment.manualConfidence, summary.assessment.note, summary.assessment.targetPhase]);

  const save = () => {
    const result = onUpdateAssessment({
      note,
      manualConfidence,
      targetPhase,
      lastReviewedAt: new Date().toISOString()
    });

    setMessage(result.ok ? "Readiness assessment saved." : result.error ?? "Readiness assessment could not be saved.");
  };

  return (
    <div className="stack engineering-readiness-center">
      <section className="panel hero">
        <div className="head">
          <div>
            <h2>Engineering Readiness Center</h2>
            <p className="muted">Judge when the current system is clear enough to enter engineering work.</p>
          </div>
          <span className={`badge readiness-status-${summary.overallStatus}`}>
            {statusLabel(summary.overallStatus)}
          </span>
        </div>
        <div className="metrics engineering-readiness-metrics">
          <Metric label="Readiness score" value={`${summary.score}%`} />
          <Metric label="Status" value={statusLabel(summary.overallStatus)} />
          <Metric label="Manual confidence" value={summary.assessment.manualConfidence} />
          <Metric label="Target phase" value={summary.assessment.targetPhase} />
          <Metric label="Open blockers" value={summary.openBlockingCount} />
          <Metric label="Review items" value={summary.pendingReviewCount} />
        </div>
        <div className="mini-list readiness-next-action">
          <strong>Suggested next action</strong>
          <p>{summary.suggestedNextAction}</p>
        </div>
        <div className="actions">
          <button className="ghost" onClick={onOpenDecisionCenter}>Open Decision Center</button>
          <button className="ghost" onClick={onOpenReviewQueue}>Open Review Queue</button>
        </div>
      </section>

      <section className="panel">
        <div className="head">
          <div>
            <h2>Criteria Checklist</h2>
            <p className="muted">Readiness criteria are calculated from AppState, decisions, and review queue health.</p>
          </div>
        </div>
        <div className="cards readiness-criteria-grid">
          {summary.criteria.map((criterion) => (
            <article key={criterion.id} className="card readiness-criterion-card">
              <div className="line">
                <strong>{criterion.title}</strong>
                <span className={`badge readiness-criterion-${criterion.status}`}>
                  {criterionStatusLabel(criterion.status)}
                </span>
              </div>
              <p>{criterion.explanation}</p>
              {criterion.relatedBlockers.length > 0 && (
                <div className="mini-list">
                  <strong>Related blockers</strong>
                  <ul>
                    {criterion.relatedBlockers.map((blocker) => (
                      <li key={blocker}>{blocker}</li>
                    ))}
                  </ul>
                </div>
              )}
              {criterion.relatedDecisions.length > 0 && (
                <div className="chips">
                  {criterion.relatedDecisions.map((decision) => (
                    <span key={decision}>{decision}</span>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="panel stack">
        <div className="head">
          <div>
            <h2>Blocking Decisions</h2>
            <p className="muted">
              {summary.highImpactUnresolvedCount} high impact unresolved decision(s), {summary.decidedCount} decided.
            </p>
          </div>
        </div>
        {summary.unresolvedHighImpactDecisions.length === 0 ? (
          <div className="notice">No high impact decision is currently blocking readiness.</div>
        ) : (
          <div className="cards">
            {summary.unresolvedHighImpactDecisions.map((question) => (
              <article key={question.id} className="card readiness-blocker-card">
                <div className="line">
                  <strong>{question.question}</strong>
                  <span className={`badge question-status-${question.status}`}>{question.status}</span>
                </div>
                <div className="chips">
                  <span className={`decision-impact-${question.impactLevel ?? "medium"}`}>
                    Impact: {question.impactLevel ?? "medium"}
                  </span>
                  {question.preferredOptionId && <span>Preferred option captured</span>}
                </div>
                <p>{question.decisionNote || question.proposedResolution || question.context}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel stack">
        <div className="head">
          <div>
            <h2>Review Queue Signal</h2>
            <p className="muted">{summary.reviewBlockerCount} major review blocker(s) detected.</p>
          </div>
        </div>
        {summary.reviewItemsNeedingAttention.length === 0 ? (
          <div className="notice">No review item needs attention.</div>
        ) : (
          <div className="cards">
            {summary.reviewItemsNeedingAttention.map((item) => (
              <article key={item.id} className="card readiness-review-card">
                <div className="line">
                  <strong>{item.title}</strong>
                  <span className="badge">{item.status}</span>
                </div>
                <p>{item.subtitle}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel form readiness-note-editor">
        <div className="head">
          <div>
            <h2>Readiness Note</h2>
            <p className="muted">
              Last reviewed: {formatDate(summary.assessment.lastReviewedAt)} · Updated: {formatDate(summary.assessment.updatedAt)}
            </p>
          </div>
        </div>
        {message && <div className={message.includes("saved") ? "notice" : "warn"}>{message}</div>}
        <label>
          Readiness note
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Write the current readiness assessment."
          />
        </label>
        <div className="grid two">
          <label>
            Manual confidence
            <select
              aria-label="Manual confidence"
              value={manualConfidence}
              onChange={(event) => setManualConfidence(event.target.value as EngineeringReadinessConfidence)}
            >
              {confidenceOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <label>
            Target phase
            <select
              aria-label="Target phase"
              value={targetPhase}
              onChange={(event) => setTargetPhase(event.target.value as EngineeringReadinessTargetPhase)}
            >
              {targetPhaseOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>
        {summary.warnings.length > 0 && (
          <div className="mini-list warn-lite">
            <strong>Warnings</strong>
            <ul>
              {summary.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="actions">
          <button onClick={save}>Save Readiness Assessment</button>
        </div>
      </section>
    </div>
  );
}
