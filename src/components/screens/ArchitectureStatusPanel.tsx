import { useMemo } from "react";
import { buildAIPlanningContext } from "../../domain/aiPlanningContext";
import { buildAppHealthReport } from "../../domain/appHealthReport";
import { getBackendContract } from "../../domain/backendContract";
import { buildDerivedReviewQueue } from "../../domain/derivedReviewQueue";
import { buildEngineeringHandoffPackage } from "../../domain/engineeringHandoffPackage";
import type { AppState } from "../../domain/types";
import { Metric } from "../common/Metric";
import { HandoffPackageExportPanel } from "./HandoffPackageExportPanel";
import { ReviewHealthDrillDownPanel } from "./ReviewHealthDrillDownPanel";

function targetLabel(target: { type: string; id: string }) {
  return `${target.type}:${target.id}`;
}

function topCodeEntries(byCode: object, limit = 6) {
  return Object.entries(byCode as Record<string, number | undefined>)
    .filter(([, count]) => Boolean(count))
    .sort(([codeA, countA], [codeB, countB]) =>
      (countB ?? 0) - (countA ?? 0) || codeA.localeCompare(codeB)
    )
    .slice(0, limit);
}

function sectionCount(value: object) {
  return Object.keys(value).length;
}

export function ArchitectureStatusPanel({
  state,
  projectId
}: {
  state: AppState;
  projectId?: string;
}) {
  const {
    appHealth,
    backendContract,
    handoffPackage,
    planningContext,
    reviewItems,
    topHealthCodes
  } = useMemo(() => {
    const appHealthReport = buildAppHealthReport(state);
    const derivedReviewItems = buildDerivedReviewQueue(state);
    const selectedProjectId = projectId ?? state.projects[0]?.id ?? "";

    return {
      appHealth: appHealthReport,
      backendContract: getBackendContract(),
      handoffPackage: selectedProjectId
        ? buildEngineeringHandoffPackage(state, selectedProjectId)
        : undefined,
      planningContext: buildAIPlanningContext(
        state,
        selectedProjectId ? { type: "project", id: selectedProjectId } : { type: "app" },
        {
          maxReviewItems: 6,
          maxAppHealthFindings: 6,
          maxReports: 6,
          maxRelationshipContexts: 6
        }
      ),
      reviewItems: derivedReviewItems,
      topHealthCodes: topCodeEntries(appHealthReport.summary.byCode)
    };
  }, [projectId, state]);

  const handoffAcceptanceSections = handoffPackage
    ? sectionCount(handoffPackage.acceptanceTestPlan)
    : 0;
  const visibleReviewItems = reviewItems.slice(0, 6);
  const visibleSuggestedCommands = handoffPackage?.suggestedCommands.slice(0, 4) ?? [];

  return (
    <div className="architecture-status grid">
      <section className="panel hero stack">
        <div className="head">
          <div>
            <h2>Architecture / Health / Handoff Debug Panel</h2>
            <p className="muted">
              Read-only domain reports and design-only backend metadata from the current local AppState.
            </p>
          </div>
          <span className="badge">read-only</span>
        </div>
        <div className="notice">
          Confirmed command entry must use executeDomainCommand. Suggested command metadata is visible here only as
          requires human confirmation.
        </div>
      </section>

      <section className="panel stack">
        <div className="head">
          <div>
            <h2>AppHealthReport Summary</h2>
            <p className="muted">Findings are surfaced without repair, normalize-save, or mutation.</p>
          </div>
        </div>
        <div className="metrics deployment-data-metrics">
          <Metric label="Findings" value={appHealth.summary.totalFindings} />
          <Metric label="Errors" value={appHealth.summary.bySeverity.error} />
          <Metric label="Warnings" value={appHealth.summary.bySeverity.warning} />
          <Metric label="Info" value={appHealth.summary.bySeverity.info} />
        </div>
        <div className="chips">
          {topHealthCodes.length === 0 ? (
            <span>no findings</span>
          ) : (
            topHealthCodes.map(([code, count]) => <span key={code}>{code}: {count}</span>)
          )}
        </div>
        <div className="mini-list">
          <strong>Top findings</strong>
          {appHealth.findings.length === 0 ? (
            <p>No app health findings.</p>
          ) : (
            <ul>
              {appHealth.findings.slice(0, 5).map((finding) => (
                <li key={`${finding.code}:${targetLabel(finding.target)}`}>
                  {finding.severity} · {finding.code} · {targetLabel(finding.target)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="panel stack">
        <div className="head">
          <div>
            <h2>Derived Review Queue Summary</h2>
            <p className="muted">Review items are derived metadata, not persisted ReviewItem state.</p>
          </div>
          <span className="badge">{reviewItems.length} items</span>
        </div>
        {visibleReviewItems.length === 0 ? (
          <div className="notice">No derived review items.</div>
        ) : (
          <div className="cards">
            {visibleReviewItems.map((item) => (
              <article className="card" key={item.id}>
                <div className="line">
                  <strong>{item.sourceCode}</strong>
                  <span className="badge">{item.severity}</span>
                </div>
                <p>{item.reason}</p>
                <div className="chips">
                  <span>{targetLabel(item.target)}</span>
                  <span>requiresHumanConfirmation: {String(item.requiresHumanConfirmation)}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <ReviewHealthDrillDownPanel state={state} reviewItems={reviewItems} appHealth={appHealth} />

      <HandoffPackageExportPanel state={state} projectId={projectId} />

      <section className="panel stack">
        <div className="head">
          <div>
            <h2>Backend Contract Metadata</h2>
            <p className="muted">{backendContract.localFirstStrategy}</p>
          </div>
          <span className="badge">{backendContract.schemaVersion}</span>
        </div>
        <div className="cards">
          {backendContract.endpoints.map((endpoint) => (
            <article className="card" key={endpoint.id}>
              <div className="line">
                <strong>{endpoint.id}</strong>
                <span className="badge">{endpoint.method}</span>
              </div>
              <p>{endpoint.purpose}</p>
              <div className="mini-list">
                <strong>Safety</strong>
                <ul>{endpoint.safetyRules.slice(0, 3).map((rule) => <li key={rule}>{rule}</li>)}</ul>
              </div>
            </article>
          ))}
        </div>
        <div className="chips">
          {backendContract.excludedFeatures.map((feature) => <span key={feature}>{feature}</span>)}
        </div>
      </section>

      <section className="panel stack">
        <div className="head">
          <div>
            <h2>HandoffPackage Summary</h2>
            <p className="muted">
              Package preview is read-only and does not mark handoff_ready, execute commands, or mutate state.
            </p>
          </div>
          <span className="badge">{handoffPackage?.valid ? "valid" : "invalid"}</span>
        </div>
        {handoffPackage ? (
          <>
            <div className="metrics deployment-data-metrics">
              <Metric label="Modules" value={handoffPackage.requiredSoftwarePlan.modules.length} />
              <Metric label="Tasks" value={handoffPackage.codexTaskPlan.tasks.length} />
              <Metric label="Tests" value={handoffAcceptanceSections} />
              <Metric label="Blockers" value={handoffPackage.blockers.length} />
            </div>
            <div className="chips">
              <span>project {handoffPackage.projectId}</span>
              <span>readiness {handoffPackage.readinessReport.storedReadiness ?? "unknown"}</span>
              <span>lifecycle {handoffPackage.readinessReport.lifecycleStatus}</span>
            </div>
            <div className="mini-list">
              <strong>Safety notes</strong>
              <ul>
                <li>ready_for_engineering does not imply handoff_ready</li>
                <li>package does not execute commands</li>
                <li>package does not mutate state</li>
              </ul>
            </div>
            <div className="mini-list">
              <strong>Suggested command visibility</strong>
              <ul>
                {visibleSuggestedCommands.map((command) => (
                  <li key={command.id}>
                    {command.commandType} · requires human confirmation: {String(command.requiresHumanConfirmation)}
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <div className="notice">No selected project is available for handoff package preview.</div>
        )}
      </section>

      <section className="panel stack">
        <div className="head">
          <div>
            <h2>AIPlanningContext Safety Summary</h2>
            <p className="muted">
              Scope target: {planningContext.target.type}
              {planningContext.target.id ? `:${planningContext.target.id}` : ""}.
            </p>
          </div>
          <span className="badge">{planningContext.allowedCommands.length} allowed commands</span>
        </div>
        <div className="mini-list">
          <strong>Safety rules</strong>
          <ul>{planningContext.safetyRules.slice(0, 6).map((rule) => <li key={rule}>{rule}</li>)}</ul>
        </div>
        <div className="notice">
          AI output is draft only. Commands require human confirmation. Suggested command metadata is not executable by
          itself.
        </div>
        <div className="mini-list">
          <strong>Command entry guard status</strong>
          <ul>
            <li>Review Queue and AI Planning Panel draft review routes through executeDomainCommand.</li>
            <li>Engineering handoff ready action routes through executeDomainCommand.</li>
            <li>CommandResult ok:false is shown as an error and state is not saved.</li>
            <li>No full command editor is implemented in this phase.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
