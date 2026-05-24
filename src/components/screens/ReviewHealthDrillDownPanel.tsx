import { useMemo, useState } from "react";
import type {
  AppHealthFinding,
  AppHealthReport,
  AppHealthSeverity
} from "../../domain/appHealthReport";
import type {
  DerivedReviewItem,
  DerivedReviewSuggestedCommandDraft
} from "../../domain/derivedReviewQueue";
import type { AppState } from "../../domain/types";
import { useI18n } from "../../i18n";
import { Metric } from "../common/Metric";

type ReviewFilter = "all" | "warnings_errors" | "with_commands" | "requires_confirmation";
type ReviewGroupMode = "severity" | "target_type" | "source";

const reviewFilters: Array<{ value: ReviewFilter; label: string }> = [
  { value: "all", label: "All review items" },
  { value: "warnings_errors", label: "Warnings and errors" },
  { value: "with_commands", label: "With suggested commands" },
  { value: "requires_confirmation", label: "Requires human confirmation" }
];

const reviewGroupModes: Array<{ value: ReviewGroupMode; label: string }> = [
  { value: "severity", label: "Group by severity" },
  { value: "target_type", label: "Group by target type" },
  { value: "source", label: "Group by source" }
];

function targetKey(target: { type: string; id: string }) {
  return `${target.type}:${target.id}`;
}

function entityLabel(state: AppState, target: { type: string; id: string }) {
  if (target.type === "thought") {
    return state.thoughts.find((thought) => thought.id === target.id)?.title;
  }

  if (target.type === "project") {
    return state.projects.find((project) => project.id === target.id)?.name;
  }

  if (target.type === "universe") {
    return state.universes.find((universe) => universe.id === target.id)?.name;
  }

  if (target.type === "relationship") {
    const relationship = state.relationships.find((item) => item.id === target.id);
    return relationship
      ? `${relationship.type} ${relationship.sourceId} -> ${relationship.targetId}`
      : undefined;
  }

  if (target.type === "aiInsight") {
    return state.aiInsights.find((insight) => insight.id === target.id)?.type;
  }

  if (target.type === "blockingQuestion") {
    return state.blockingQuestions?.find((question) => question.id === target.id)?.question;
  }

  if (target.type === "decisionRecord") {
    return state.decisionRecords?.find((record) => record.id === target.id)?.title;
  }

  if (target.type === "appState") {
    return "Current AppState";
  }

  return undefined;
}

function formatInline(value: unknown) {
  if (typeof value === "string") return value;
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  return JSON.stringify(value);
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function formatSuggestedCommandJson(command: DerivedReviewSuggestedCommandDraft) {
  return formatJson({
    schemaVersion: "derived-command-draft/v0",
    id: command.id,
    commandType: command.commandType,
    label: command.label,
    reason: command.reason,
    target: command.target,
    requiresHumanConfirmation: command.requiresHumanConfirmation,
    payloadPreview: command.payloadPreview ?? null,
    safety:
      "Draft only. Copy into Confirmed Command Import to Validate, Dry Run, and Apply with confirmation."
  });
}

function formatSuggestedCommandBundle(commands: readonly DerivedReviewSuggestedCommandDraft[]) {
  return formatJson({
    schemaVersion: "derived-command-draft-bundle/v0",
    commands: commands.map((command) => JSON.parse(formatSuggestedCommandJson(command))),
    safety:
      "Draft only. Copy into Confirmed Command Import to Validate, Dry Run, and Apply with confirmation."
  });
}

export function filterDrillDownReviewItems(
  items: readonly DerivedReviewItem[],
  filter: ReviewFilter
) {
  if (filter === "warnings_errors") return items.filter((item) => item.severity !== "info");
  if (filter === "with_commands") return items.filter((item) => item.suggestedCommands.length > 0);
  if (filter === "requires_confirmation") return items.filter((item) => item.requiresHumanConfirmation);
  return [...items];
}

export function groupDrillDownReviewItems(
  items: readonly DerivedReviewItem[],
  mode: ReviewGroupMode
) {
  const groups = new Map<string, DerivedReviewItem[]>();

  for (const item of items) {
    const key = mode === "severity"
      ? item.severity
      : mode === "target_type"
        ? item.target.type
        : item.source;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return [...groups.entries()]
    .map(([label, groupItems]) => ({ label, items: groupItems }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

type Translate = (key: string, values?: Record<string, number | string>) => string;

function evidenceList(values: readonly unknown[], empty: string, t: Translate) {
  if (values.length === 0) return <p>{t(empty)}</p>;

  return (
    <ul>
      {values.map((value, index) => (
        <li key={`${formatInline(value)}:${index}`}>{formatInline(value)}</li>
      ))}
    </ul>
  );
}

function TargetBlock({
  state,
  target
}: {
  state: AppState;
  target: { type: string; id: string };
}) {
  const { t } = useI18n();
  const label = entityLabel(state, target);

  return (
    <div className="mini-list">
      <strong>{t("Target")}</strong>
      <ul>
        <li>{t("type: {value}", { value: t(target.type) })}</li>
        <li>{t("id: {value}", { value: target.id })}</li>
        <li>{t("label: {value}", { value: label ?? t("No label available") })}</li>
      </ul>
    </div>
  );
}

function SuggestedCommandDrafts({
  commands,
  onCopy
}: {
  commands: readonly DerivedReviewSuggestedCommandDraft[];
  onCopy: (text: string, message: string) => void;
}) {
  const { t } = useI18n();
  if (commands.length === 0) {
    return (
      <div className="mini-list">
        <strong>{t("Suggested commands")}</strong>
        <p>{t("No suggested command drafts for this item.")}</p>
      </div>
    );
  }

  return (
    <div className="mini-list stack">
      <div className="line">
        <strong>{t("Suggested commands")}</strong>
        <button
          className="ghost"
          onClick={() => onCopy(formatSuggestedCommandBundle(commands), "All command drafts copied.")}
        >
          {t("Copy all commands for this item")}
        </button>
      </div>
      {commands.map((command) => (
        <div className="command-draft-preview" key={command.id}>
          <div className="line">
            <div>
              <strong>{command.commandType}</strong>
              <p className="muted">{command.label}</p>
            </div>
            <button
              className="ghost"
              onClick={() => onCopy(formatSuggestedCommandJson(command), "Command draft copied.")}
            >
              {t("Copy command JSON")}
            </button>
          </div>
          <p>{command.reason}</p>
          <div className="chips">
            <span>{targetKey(command.target)}</span>
            <span>{t("requiresHumanConfirmation: {value}", {
              value: t(String(command.requiresHumanConfirmation))
            })}</span>
          </div>
          <pre className="json command-draft-json">{formatSuggestedCommandJson(command)}</pre>
        </div>
      ))}
    </div>
  );
}

function ReviewItemDetails({
  item,
  state,
  onCopy
}: {
  item: DerivedReviewItem;
  state: AppState;
  onCopy: (text: string, message: string) => void;
}) {
  const { t } = useI18n();
  return (
    <details className="review-drilldown-card" open>
      <summary>
        <span>
          <strong>{item.sourceCode}</strong>
          <span className="muted">{item.id}</span>
        </span>
        <span className={`badge review-severity-${item.severity}`}>{t(item.severity)}</span>
      </summary>

      <div className="review-drilldown-body">
        <div className="chips">
          <span>{t("source: {value}", { value: item.source })}</span>
          <span>{t("target: {value}", { value: targetKey(item.target) })}</span>
          <span>{t("requiresHumanConfirmation: {value}", {
            value: t(String(item.requiresHumanConfirmation))
          })}</span>
        </div>

        <div className="grid two">
          <div className="mini-list">
            <strong>{t("Stable id")}</strong>
            <p>{item.id}</p>
          </div>
          <TargetBlock state={state} target={item.target} />
        </div>

        <div className="mini-list">
          <strong>{t("Reason")}</strong>
          <p>{item.reason}</p>
        </div>

        <div className="mini-list">
          <strong>{t("Evidence")}</strong>
          {evidenceList(item.evidence, "No deterministic evidence entries.", t)}
        </div>

        <div className="mini-list">
          <strong>{t("Severity")}</strong>
          <p>{t(item.severity)}</p>
        </div>

        <SuggestedCommandDrafts commands={item.suggestedCommands} onCopy={onCopy} />
      </div>
    </details>
  );
}

function AppHealthIssueDetails({
  finding,
  state
}: {
  finding: AppHealthFinding;
  state: AppState;
}) {
  const { t } = useI18n();
  return (
    <details className="review-drilldown-card health-drilldown-card" open>
      <summary>
        <span>
          <strong>{finding.code}</strong>
          <span className="muted">{targetKey(finding.target)}</span>
        </span>
        <span className={`badge review-severity-${finding.severity}`}>{t(finding.severity)}</span>
      </summary>

      <div className="review-drilldown-body">
        <div className="chips">
          <span>{t("source: {value}", { value: finding.source })}</span>
          <span>{t("sourceCode: {value}", { value: finding.sourceCode })}</span>
        </div>

        <div className="grid two">
          <TargetBlock state={state} target={finding.target} />
          <div className="mini-list">
            <strong>{t("Reason")}</strong>
            <p>{finding.reason}</p>
          </div>
        </div>

        <div className="mini-list">
          <strong>{t("Evidence IDs")}</strong>
          {evidenceList(finding.evidenceIds, "No evidence IDs.", t)}
        </div>
      </div>
    </details>
  );
}

function healthCount(findings: readonly AppHealthFinding[], severity: AppHealthSeverity) {
  return findings.filter((finding) => finding.severity === severity).length;
}

export function ReviewHealthDrillDownPanel({
  state,
  reviewItems,
  appHealth
}: {
  state: AppState;
  reviewItems: readonly DerivedReviewItem[];
  appHealth: AppHealthReport;
}) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [groupMode, setGroupMode] = useState<ReviewGroupMode>("severity");
  const [copyNotice, setCopyNotice] = useState("");

  const filteredReviewItems = useMemo(
    () => filterDrillDownReviewItems(reviewItems, filter),
    [filter, reviewItems]
  );
  const groupedReviewItems = useMemo(
    () => groupDrillDownReviewItems(filteredReviewItems, groupMode),
    [filteredReviewItems, groupMode]
  );

  const copyText = async (text: string, message: string) => {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }

      await navigator.clipboard.writeText(text);
      setCopyNotice(message);
    } catch {
      setCopyNotice("Clipboard unavailable. Select the JSON preview manually.");
    }
  };

  return (
    <section className="panel stack review-health-drilldown">
      <div className="head">
        <div>
          <h2>{t("Review & Health Drill-down")}</h2>
          <p className="muted">
            {t("Expand deterministic review items, health issues, evidence, and draft command metadata.")}
          </p>
        </div>
        <span className="badge">{t("draft-only")}</span>
      </div>

      <div className="notice">
        {t("Suggested commands are drafts only. Copy them into Confirmed Command Import to Validate, Dry Run, and Apply with confirmation.")}
      </div>

      {copyNotice && <div className="notice">{t(copyNotice)}</div>}

      <div className="review-drilldown-controls">
        <label>
          {t("Review filter")}
          <select value={filter} onChange={(event) => setFilter(event.target.value as ReviewFilter)}>
            {reviewFilters.map((item) => (
              <option key={item.value} value={item.value}>{t(item.label)}</option>
            ))}
          </select>
        </label>
        <label>
          {t("Grouping")}
          <select value={groupMode} onChange={(event) => setGroupMode(event.target.value as ReviewGroupMode)}>
            {reviewGroupModes.map((item) => (
              <option key={item.value} value={item.value}>{t(item.label)}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="metrics deployment-data-metrics">
        <Metric label={t("Review items")} value={reviewItems.length} />
        <Metric label={t("Shown")} value={filteredReviewItems.length} />
        <Metric label={t("Health errors")} value={healthCount(appHealth.findings, "error")} />
        <Metric label={t("Health warnings")} value={healthCount(appHealth.findings, "warning")} />
      </div>

      <div className="review-drilldown-section">
        <div className="line">
          <h3>{t("Derived Review Queue Details")}</h3>
          <span className="badge">{t("{count} visible", { count: filteredReviewItems.length })}</span>
        </div>
        {filteredReviewItems.length === 0 ? (
          <div className="notice">{t("No derived review items.")}</div>
        ) : (
          groupedReviewItems.map((group) => (
            <div className="review-drilldown-group" key={group.label}>
              <div className="line">
                <strong>{t(group.label)}</strong>
                <span className="badge">{t("{count} items", { count: group.items.length })}</span>
              </div>
              <div className="cards">
                {group.items.map((item) => (
                  <ReviewItemDetails item={item} state={state} onCopy={copyText} key={item.id} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="review-drilldown-section">
        <div className="line">
          <h3>{t("AppHealth Issue Details")}</h3>
          <span className="badge">{t("{count} findings", { count: appHealth.findings.length })}</span>
        </div>
        {appHealth.findings.length === 0 ? (
          <div className="notice">{t("No app health issues detected.")}</div>
        ) : (
          <div className="cards">
            {appHealth.findings.map((finding) => (
              <AppHealthIssueDetails
                finding={finding}
                state={state}
                key={`${finding.code}:${targetKey(finding.target)}:${finding.sourceCode}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
