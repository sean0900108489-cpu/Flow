import { useState } from "react";
import type { AppState } from "../../domain/types";
import type { AppStateInvariantWarning } from "../../domain/validation/appStateInvariants";
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
  if (warnings.length === 0) return null;

  return (
    <div className="notice import-warning-details">
      <strong>Import warning details</strong>
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
  const [importText, setImportText] = useState("");
  const [message, setMessage] = useState("");
  const [importWarnings, setImportWarnings] = useState<AppStateInvariantWarning[]>([]);
  const json = stringifyAppState(state);

  const copy = async () => {
    await navigator.clipboard.writeText(json);
    setMessage("已複製完整 App State JSON。");
  };

  const download = () => {
    downloadJson("todo-thought-universe-app-state.json", json);
    setMessage("已下載完整 App State JSON。");
  };

  const runImport = () => {
    const result = parseAppStateJson(importText);

    if (!result.ok || !result.state) {
      setMessage(`匯入失敗：${result.error ?? "Invalid app state."}`);
      setImportWarnings([]);
      return;
    }

    setImportText("");
    onImport(result.state);
    setImportWarnings(result.warnings ?? []);
    setMessage(result.warnings?.length
      ? `匯入完成，發現 ${result.warnings.length} 個 invariant warning。`
      : "匯入完成，未發現 invariant warning。"
    );
  };

  return (
    <section className="panel">
      <div className="head">
        <div>
          <h2>App State Transfer</h2>
          <p className="muted">
            匯出或匯入完整 local-first app state，包含 universes、thoughts、projects、relationships、aiInsights、
            Decision Center、Review Queue、Engineering Readiness 與 Next Action state。
          </p>
        </div>
        <div className="actions">
          <button className="ghost" onClick={copy}>複製 App State</button>
          <button onClick={download}>下載 App State</button>
        </div>
      </div>

      {message && <div className="notice">{message}</div>}
      <AppStateImportWarningDetails warnings={importWarnings} />

      <div className="form">
        <label>
          匯入 App State JSON
          <textarea
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            placeholder="貼上 todo-thought-universe-app-state.json 內容，匯入前會驗證必要 collections 並套用 migration/defaults..."
          />
        </label>
        <button onClick={runImport}>匯入並覆蓋目前資料</button>
      </div>

      <h3>目前 App State JSON</h3>
      <pre className="json">{json}</pre>
    </section>
  );
}
