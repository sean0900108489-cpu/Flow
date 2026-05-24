import { useState } from "react";
import type { AppState } from "../../domain/types";
import type { AppStateInvariantWarning } from "../../domain/validation/appStateInvariants";
import { useI18n } from "../../i18n";
import { downloadJson, parseAppStateJson, stringifyAppState } from "../../services/appStateTransfer";

function optionalDetail(warning: AppStateInvariantWarning, key: "target" | "evidence") {
  const value = (warning as unknown as Record<string, unknown>)[key];

  if (value === undefined) return "";

  return typeof value === "string" ? value : JSON.stringify(value);
}

function warningTarget(warning: AppStateInvariantWarning) {
  const entity = [warning.entityType, warning.entityId].filter(Boolean).join(":");
  const field = warning.field ? `field:${warning.field}` : "";

  return [entity, field].filter(Boolean).join(" / ");
}

export function AppStateImportWarningDetails({
  warnings
}: {
  warnings: AppStateInvariantWarning[];
}) {
  const { t } = useI18n();

  if (warnings.length === 0) return null;

  return (
    <div className="notice import-warning-details">
      <strong>{t("Import warning details")}</strong>
      <ul>
        {warnings.map((warning, index) => {
          const target = optionalDetail(warning, "target") || warningTarget(warning);
          const evidence = optionalDetail(warning, "evidence");

          return (
            <li key={`${warning.code}:${warning.entityType ?? "app"}:${warning.entityId ?? index}:${warning.field ?? "state"}`}>
              <code>{warning.code}</code>
              <span> severity:{warning.severity}</span>
              {target && <span> target:{target}</span>}
              {evidence && <span> evidence:{evidence}</span>}
              <span> message:{warning.message}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AppStateTransfer({
  state,
  onImport
}: {
  state: AppState;
  onImport: (state: AppState) => void;
}) {
  const { t } = useI18n();
  const [importText, setImportText] = useState("");
  const [message, setMessage] = useState("");
  const [importWarnings, setImportWarnings] = useState<AppStateInvariantWarning[]>([]);
  const json = stringifyAppState(state);

  const copy = async () => {
    await navigator.clipboard.writeText(json);
    setMessage(t("Copied full App State JSON."));
  };

  const download = () => {
    downloadJson("todo-thought-universe-app-state.json", json);
    setMessage(t("Downloaded full App State JSON."));
  };

  const runImport = () => {
    const result = parseAppStateJson(importText);

    if (!result.ok || !result.state) {
      setMessage(t("Import failed: {error}", { error: result.error ?? "Invalid app state." }));
      setImportWarnings([]);
      return;
    }

    const warningCount = result.warnings?.length ?? 0;

    setImportText("");
    onImport(result.state);
    setImportWarnings(result.warnings ?? []);
    setMessage(warningCount
      ? t("Import completed with {count} invariant warning(s).", { count: warningCount })
      : t("Import completed with no invariant warnings.")
    );
  };

  return (
    <section className="panel">
      <div className="head">
        <div>
          <h2>{t("App State Transfer")}</h2>
          <p className="muted">{t("App State Transfer description")}</p>
        </div>
        <div className="actions">
          <button className="ghost" onClick={copy}>{t("Copy App State")}</button>
          <button onClick={download}>{t("Export App State")}</button>
        </div>
      </div>

      {message && <div className="notice">{message}</div>}
      <AppStateImportWarningDetails warnings={importWarnings} />

      <div className="form">
        <label>
          {t("Import App State JSON")}
          <textarea
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            placeholder={t("Paste todo-thought-universe app state JSON here. Required collections are validated and migrations/defaults are applied before import.")}
          />
        </label>
        <button onClick={runImport}>{t("Import and overwrite current data")}</button>
      </div>

      <h3>{t("Current App State JSON")}</h3>
      <pre className="json">{json}</pre>
    </section>
  );
}
