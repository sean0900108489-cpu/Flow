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
import { useI18n } from "../../i18n";
import { Metric } from "../common/Metric";

const confidenceOptions: EngineeringReadinessConfidence[] = ["low", "medium", "high"];
const targetPhaseOptions: EngineeringReadinessTargetPhase[] = ["exploration", "prototype", "engineering"];

type Translate = (key: string, values?: Record<string, number | string>) => string;

function statusLabel(status: EngineeringReadinessOverallStatus, t: Translate) {
  return t({
    not_ready: "Not Ready",
    partially_ready: "Partially Ready",
    ready_to_prototype: "Ready to Prototype",
    ready_for_engineering: "Ready for Engineering"
  }[status]);
}

function criterionStatusLabel(status: EngineeringReadinessCriterionStatus, t: Translate) {
  return t({
    met: "met",
    partial: "partial",
    unmet: "unmet",
    blocked: "blocked"
  }[status]);
}

function formatDate(value: string | undefined, t: Translate) {
  return value ? value.slice(0, 10) : t("Not reviewed");
}

function translateReadinessText(value: string, t: Translate) {
  const dynamicPatterns: Array<[RegExp, string, string]> = [
    [/^Choose a preferred option for: (.+)$/, "Choose a preferred option for: {question}", "question"],
    [/^Resolve the remaining high impact decision: (.+)$/, "Resolve the remaining high impact decision: {question}", "question"],
    [/^Clear Review Queue blocker: (.+)$/, "Clear Review Queue blocker: {title}", "title"],
    [/^Decided: (.+)$/, "Decided: {value}", "value"],
    [/^Preferred option on file: (.+)$/, "Preferred option on file: {option}", "option"],
    [/^(\d+) review item\(s\) remain, but no major unresolved review blocker is detected\.$/, "{count} review item(s) remain, but no major unresolved review blocker is detected.", "count"],
    [/^(\d+) review queue item\(s\) still need attention\.$/, "{count} review queue item(s) still need attention.", "count"],
    [/^(\d+) relationship\(s\) have unresolved endpoints\.$/, "{count} relationship(s) have unresolved endpoints.", "count"]
  ];

  for (const [pattern, key, valueKey] of dynamicPatterns) {
    const match = value.match(pattern);

    if (match) return t(key, { [valueKey]: match[1] });
  }

  return t(value);
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
  const { t } = useI18n();
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
            <h2>{t("Engineering Readiness Center")}</h2>
            <p className="muted">{t("Judge when the current system is clear enough to enter engineering work.")}</p>
          </div>
          <span className={`badge readiness-status-${summary.overallStatus}`}>
            {statusLabel(summary.overallStatus, t)}
          </span>
        </div>
        <div className="metrics engineering-readiness-metrics">
          <Metric label={t("Readiness score")} value={`${summary.score}%`} />
          <Metric label={t("Status")} value={statusLabel(summary.overallStatus, t)} />
          <Metric label={t("Manual confidence")} value={t(summary.assessment.manualConfidence)} />
          <Metric label={t("Target phase")} value={t(summary.assessment.targetPhase)} />
          <Metric label={t("Open blockers")} value={summary.openBlockingCount} />
          <Metric label={t("Review items")} value={summary.pendingReviewCount} />
        </div>
        <div className="mini-list readiness-next-action">
          <strong>{t("Suggested next action")}</strong>
          <p>{translateReadinessText(summary.suggestedNextAction, t)}</p>
        </div>
        <div className="actions">
          <button className="ghost" onClick={onOpenDecisionCenter}>{t("Open Decision Center")}</button>
          <button className="ghost" onClick={onOpenReviewQueue}>{t("Open Review Queue")}</button>
        </div>
      </section>

      <section className="panel">
        <div className="head">
          <div>
            <h2>{t("Criteria Checklist")}</h2>
            <p className="muted">{t("Readiness criteria are calculated from AppState, decisions, and review queue health.")}</p>
          </div>
        </div>
        <div className="cards readiness-criteria-grid">
          {summary.criteria.map((criterion) => (
            <article key={criterion.id} className="card readiness-criterion-card">
              <div className="line">
                <strong>{t(criterion.title)}</strong>
                <span className={`badge readiness-criterion-${criterion.status}`}>
                  {criterionStatusLabel(criterion.status, t)}
                </span>
              </div>
              <p>{translateReadinessText(criterion.explanation, t)}</p>
              {criterion.relatedBlockers.length > 0 && (
                <div className="mini-list">
                  <strong>{t("Related blockers")}</strong>
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
            <h2>{t("Blocking Decisions")}</h2>
            <p className="muted">
              {t("{high} high impact unresolved decision(s), {decided} decided.", {
                high: summary.highImpactUnresolvedCount,
                decided: summary.decidedCount
              })}
            </p>
          </div>
        </div>
        {summary.unresolvedHighImpactDecisions.length === 0 ? (
          <div className="notice">{t("No high impact decision is currently blocking readiness.")}</div>
        ) : (
          <div className="cards">
            {summary.unresolvedHighImpactDecisions.map((question) => (
              <article key={question.id} className="card readiness-blocker-card">
                <div className="line">
                  <strong>{question.question}</strong>
                  <span className={`badge question-status-${question.status}`}>{t(question.status)}</span>
                </div>
                <div className="chips">
                  <span className={`decision-impact-${question.impactLevel ?? "medium"}`}>
                    {t("Impact: {impact}", { impact: t(question.impactLevel ?? "medium") })}
                  </span>
                  {question.preferredOptionId && <span>{t("Preferred option captured")}</span>}
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
            <h2>{t("Review Queue Signal")}</h2>
            <p className="muted">{t("{count} major review blocker(s) detected.", { count: summary.reviewBlockerCount })}</p>
          </div>
        </div>
        {summary.reviewItemsNeedingAttention.length === 0 ? (
          <div className="notice">{t("No review item needs attention.")}</div>
        ) : (
          <div className="cards">
            {summary.reviewItemsNeedingAttention.map((item) => (
              <article key={item.id} className="card readiness-review-card">
                <div className="line">
                  <strong>{item.title}</strong>
                  <span className="badge">{t(item.status)}</span>
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
            <h2>{t("Readiness Note")}</h2>
            <p className="muted">
              {t("Last reviewed: {lastReviewed} · Updated: {updated}", {
                lastReviewed: formatDate(summary.assessment.lastReviewedAt, t),
                updated: formatDate(summary.assessment.updatedAt, t)
              })}
            </p>
          </div>
        </div>
        {message && <div className={message.includes("saved") ? "notice" : "warn"}>{t(message)}</div>}
        <label>
          {t("Readiness note")}
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t("Write the current readiness assessment.")}
          />
        </label>
        <div className="grid two">
          <label>
            {t("Manual confidence")}
            <select
              aria-label={t("Manual confidence")}
              value={manualConfidence}
              onChange={(event) => setManualConfidence(event.target.value as EngineeringReadinessConfidence)}
            >
              {confidenceOptions.map((option) => (
                <option key={option} value={option}>{t(option)}</option>
              ))}
            </select>
          </label>
          <label>
            {t("Target phase")}
            <select
              aria-label={t("Target phase")}
              value={targetPhase}
              onChange={(event) => setTargetPhase(event.target.value as EngineeringReadinessTargetPhase)}
            >
              {targetPhaseOptions.map((option) => (
                <option key={option} value={option}>{t(option)}</option>
              ))}
            </select>
          </label>
        </div>
        {summary.warnings.length > 0 && (
          <div className="mini-list warn-lite">
            <strong>{t("Warnings")}</strong>
            <ul>
              {summary.warnings.map((warning) => (
                <li key={warning}>{translateReadinessText(warning, t)}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="actions">
          <button onClick={save}>{t("Save Readiness Assessment")}</button>
        </div>
      </section>
    </div>
  );
}
