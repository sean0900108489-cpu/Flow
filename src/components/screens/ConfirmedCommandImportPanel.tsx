import { useState } from "react";
import {
  dryRunCommandImport,
  type CommandDryRunResult
} from "../../domain/commands/commandDryRun";
import {
  validateCommandImport,
  type CommandImportIssue,
  type CommandImportValidationResult
} from "../../domain/commands/commandImport";
import {
  applyConfirmedCommandImport,
  type ConfirmedCommandApplyResult
} from "../../domain/commands/confirmedCommandImport";
import type { AppState } from "../../domain/types";
import { useI18n } from "../../i18n";
import { Metric } from "../common/Metric";

function issueKey(issue: CommandImportIssue, index: number) {
  return `${issue.code}:${issue.commandId ?? "payload"}:${issue.path ?? index}`;
}

function IssueList({
  title,
  issues
}: {
  title: string;
  issues: CommandImportIssue[];
}) {
  if (issues.length === 0) return null;

  return (
    <div className="mini-list">
      <strong>{title}</strong>
      <ul>
        {issues.map((issue, index) => (
          <li key={issueKey(issue, index)}>
            {issue.code}
            {issue.commandId ? ` · ${issue.commandId}` : ""}
            {issue.path ? ` · ${issue.path}` : ""}: {issue.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ConfirmedCommandImportPanel({
  state,
  onApply
}: {
  state: AppState;
  onApply?: (nextState: AppState, message: string) => void;
}) {
  const { t } = useI18n();
  const [rawCommands, setRawCommands] = useState("");
  const [validation, setValidation] = useState<CommandImportValidationResult>();
  const [dryRun, setDryRun] = useState<CommandDryRunResult>();
  const [applyResult, setApplyResult] = useState<ConfirmedCommandApplyResult>();

  const validate = () => {
    const result = validateCommandImport(rawCommands);
    setValidation(result);
    setDryRun(undefined);
    setApplyResult(undefined);
  };

  const runDryRun = () => {
    if (!validation?.ok) return;

    const result = dryRunCommandImport(state, validation.commands);
    setDryRun(result);
    setApplyResult(undefined);
  };

  const apply = () => {
    if (!validation?.ok || !dryRun?.ok) return;
    if (typeof window !== "undefined" && !window.confirm(t("Apply imported commands through executeDomainCommand?"))) {
      return;
    }

    const result = applyConfirmedCommandImport(
      state,
      validation.commands,
      { confirmed: true, actorId: "local-command-import" }
    );
    setApplyResult(result);

    if (result.ok) {
      onApply?.(
        result.state,
        t("Applied {count} imported command(s).", { count: result.appliedCount })
      );
    }
  };

  return (
    <section className="panel stack command-import-panel">
      <div className="head">
        <div>
          <h2>{t("Confirmed Command Import")}</h2>
          <p className="muted">{t("Validation / Dry Run / Apply for external command JSON.")}</p>
        </div>
        <span className="badge">{t("guarded apply")}</span>
      </div>

      <div className="notice">
        {t("Imported commands are not trusted. Validate and Dry Run are read-only. Apply requires confirmation and uses the domain command layer. Failed batches are atomic and will not partially apply.")}
      </div>

      <label>
        {t("Command JSON")}
        <textarea
          className="command-import-textarea"
          value={rawCommands}
          onChange={(event) => {
            setRawCommands(event.target.value);
            setValidation(undefined);
            setDryRun(undefined);
            setApplyResult(undefined);
          }}
          placeholder='{"id":"cmd-1","type":"thought.classify","target":{"type":"thought","id":"t-1"},"payload":{"type":"task"},"source":"ai","confirmedByUser":false}'
        />
      </label>

      <div className="actions">
        <button onClick={validate} disabled={!rawCommands.trim()}>{t("Validate")}</button>
        <button className="ghost" onClick={runDryRun} disabled={!validation?.ok}>{t("Dry Run")}</button>
        <button className="restore" onClick={apply} disabled={!dryRun?.ok || !onApply}>{t("Apply")}</button>
      </div>

      {!validation && (
        <div className="mini-list">
          <strong>{t("Initial state")}</strong>
          <p>{t("Commands are drafts until validated, dry-run, and confirmed. Dry Run does not mutate AppState.")}</p>
        </div>
      )}

      {validation && (
        <div className="grid two">
          <div className="mini-list stack">
            <div className="line">
              <h2>{t("Validation")}</h2>
              <span className={`badge ${validation.ok ? "readiness-criterion-met" : "readiness-criterion-blocked"}`}>
                {validation.ok ? t("ok") : t("failed")}
              </span>
            </div>
            <div className="metrics deployment-data-metrics command-import-metrics">
              <Metric label="Commands" value={validation.sourceSummary.commandCount} />
              <Metric label="Accepted" value={validation.commands.length} />
              <Metric label="Errors" value={validation.errors.length} />
              <Metric label="Warnings" value={validation.warnings.length} />
            </div>
            <div className="chips">
              <span>{t("format")} {validation.sourceSummary.format}</span>
            </div>
            <IssueList title="Errors" issues={validation.errors} />
            <IssueList title="Warnings" issues={validation.warnings} />
          </div>

          {dryRun && (
            <div className="mini-list stack">
              <div className="line">
                <h2>{t("Dry Run")}</h2>
                <span className={`badge ${dryRun.ok ? "readiness-criterion-met" : "readiness-criterion-blocked"}`}>
                  {dryRun.ok ? t("ok") : t("blocked")}
                </span>
              </div>
              <div className="metrics deployment-data-metrics command-import-metrics">
                <Metric label="Commands" value={dryRun.aggregate.commandCount} />
                <Metric label="Executable" value={dryRun.aggregate.executableCount} />
                <Metric label="Blocked" value={dryRun.aggregate.blockedCount} />
                <Metric label="Warnings" value={dryRun.aggregate.warningCount} />
              </div>
            </div>
          )}
        </div>
      )}

      {dryRun && (
        <div className="cards">
          {dryRun.results.map((result, index) => (
            <article className="card command-import-result-card" key={result.commandId ?? index}>
              <div className="line">
                <strong>{result.commandType}</strong>
                <span className={`badge ${result.ok ? "readiness-criterion-met" : "readiness-criterion-blocked"}`}>
                  {result.ok ? t("would run") : t("blocked")}
                </span>
              </div>
              <p>{result.preview.summary}</p>
              <div className="mini-list">
                <strong>{t("Affected entities")}</strong>
                {result.preview.affectedEntities.length === 0 ? (
                  <p>{t("No target entity declared.")}</p>
                ) : (
                  <ul>
                    {result.preview.affectedEntities.map((entity) => (
                      <li key={`${entity.type}:${entity.id}:${entity.label ?? ""}`}>
                        {entity.type}:{entity.id}{entity.label ? ` · ${entity.label}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="mini-list">
                <strong>{t("Expected changes")}</strong>
                <ul>{result.preview.expectedChanges.map((change) => <li key={change}>{change}</li>)}</ul>
              </div>
              <IssueList title="Errors" issues={result.errors} />
              <IssueList title="Warnings" issues={result.warnings} />
            </article>
          ))}
        </div>
      )}

      {applyResult && (
        <div className={`notice ${applyResult.ok ? "" : "warn-lite"}`}>
          {t("Apply")} {applyResult.ok ? t("completed") : t("failed")} · {t("applied {count} commands", { count: applyResult.appliedCount })}
          {applyResult.errors.length > 0 ? ` · ${applyResult.errors[0].message}` : ""}
        </div>
      )}
    </section>
  );
}
