import { useState } from "react";
import type { AppState } from "../../domain/types";
import { downloadJson, parseAppStateJson, stringifyAppState } from "../../services/appStateTransfer";

export function AppStateTransfer({
  state,
  onImport
}: {
  state: AppState;
  onImport: (state: AppState) => void;
}) {
  const [importText, setImportText] = useState("");
  const [message, setMessage] = useState("");
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
      return;
    }

    setImportText("");
    onImport(result.state);
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
