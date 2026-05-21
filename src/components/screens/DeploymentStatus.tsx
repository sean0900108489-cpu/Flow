import type { AppState } from "../../domain/types";
import { calculateProductionReadinessSummary } from "../../domain/productionReadiness";
import { STORAGE_KEY } from "../../services/storage";
import { Metric } from "../common/Metric";

function runtimeValue(value: string | undefined, fallback: string) {
  return value && value.trim() ? value : fallback;
}

export function DeploymentStatus({ state }: { state: AppState }) {
  const summary = calculateProductionReadinessSummary(state);
  const version = runtimeValue(
    typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : undefined,
    "0.1.0"
  );
  const buildTimestamp = runtimeValue(
    typeof __APP_BUILD_TIMESTAMP__ === "string" ? __APP_BUILD_TIMESTAMP__ : undefined,
    "development"
  );

  return (
    <section className="deployment-status grid">
      <div className="panel hero">
        <div className="head">
          <div>
            <h2>Deployment Status</h2>
            <p className="muted">Todo Thought Universe is configured as a local-first production Vite app.</p>
          </div>
          <span className={`badge ${summary.ready ? "readiness-status-ready_for_engineering" : "readiness-status-partially_ready"}`}>
            {summary.ready ? "production ready" : "needs review"}
          </span>
        </div>
        <div className="metrics deployment-metrics">
          <Metric label="Ready checks" value={`${summary.readyCount}/${summary.totalCount}`} />
          <Metric label="Version" value={version} />
          <Metric label="Storage" value={summary.storageMode} />
          <Metric label="Mode" value={summary.localFirstMode ? "local-first" : "remote"} />
        </div>
      </div>

      <div className="grid two">
        <div className="panel">
          <h2>App Info</h2>
          <div className="mini-list">
            <strong>App name</strong>
            <p>Todo Thought Universe</p>
          </div>
          <div className="mini-list">
            <strong>Current version</strong>
            <p>{version}</p>
          </div>
          <div className="mini-list">
            <strong>Build timestamp</strong>
            <p>{buildTimestamp}</p>
          </div>
          <div className="mini-list">
            <strong>Storage mode</strong>
            <p>{STORAGE_KEY}</p>
          </div>
          <div className="mini-list">
            <strong>Import/export support</strong>
            <p>{summary.importExportSupport}</p>
          </div>
        </div>

        <div className="panel">
          <h2>Retained Production Data</h2>
          <div className="metrics deployment-data-metrics">
            <Metric label="Blockers" value={summary.retainedData.blockingQuestions} />
            <Metric label="Decisions" value={summary.retainedData.decisionRecords} />
            <Metric label="Readiness" value={summary.retainedData.engineeringReadiness ? "yes" : "no"} />
            <Metric label="Next action" value={summary.retainedData.nextActionState ? "yes" : "no"} />
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="head">
          <div>
            <h2>Production Readiness Summary</h2>
            <p className="muted">Build, persistence, import/export, and workflow centers are checked from normalized AppState.</p>
          </div>
        </div>
        <div className="cards">
          {summary.items.map((item) => (
            <div className="card deployment-readiness-card" key={item.id}>
              <div className="line">
                <strong>{item.label}</strong>
                <span className={`badge ${item.ready ? "readiness-criterion-met" : "readiness-criterion-partial"}`}>
                  {item.ready ? "ready" : "review"}
                </span>
              </div>
              <p>{item.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
