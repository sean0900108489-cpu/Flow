import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  buildEngineeringHandoffPackageExport,
  formatEngineeringHandoffPackageExportJson,
  formatEngineeringHandoffPackageMarkdown,
  type EngineeringHandoffPackageExport
} from "../../domain/engineeringHandoffExport";
import type { AppState } from "../../domain/types";
import { Metric } from "../common/Metric";

type ExportBuildResult =
  | { exportPackage: EngineeringHandoffPackageExport; error?: never }
  | { exportPackage?: never; error: string }
  | { exportPackage?: never; error?: never };

function clean(value: string | undefined) {
  return value?.trim() ?? "";
}

function label(value: unknown, fallback = "unavailable") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function projectLabel(exportPackage: EngineeringHandoffPackageExport) {
  return exportPackage.package.engineeringFlowInput.projectName ||
    exportPackage.package.readinessReport.project?.name ||
    exportPackage.projectId;
}

function slug(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return normalized || "engineering-handoff-package";
}

function downloadText(filename: string, mimeType: string, text: string) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function TextList({
  items,
  empty
}: {
  items: readonly string[];
  empty: string;
}) {
  if (items.length === 0) return <p>{empty}</p>;

  return (
    <ul>
      {items.map((item, index) => <li key={`${item}:${index}`}>{item}</li>)}
    </ul>
  );
}

function PackageSection({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <details className="handoff-export-section" open>
      <summary>
        <strong>{title}</strong>
      </summary>
      <div className="handoff-export-section-body">{children}</div>
    </details>
  );
}

export function HandoffPackageExportPanel({
  state,
  projectId
}: {
  state: AppState;
  projectId?: string;
}) {
  const initialProjectId = projectId ?? state.projects[0]?.id ?? "";
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId);
  const [notice, setNotice] = useState("");
  const selectedProjectExists = state.projects.some((project) => project.id === selectedProjectId);
  const effectiveProjectId = selectedProjectExists ? selectedProjectId : initialProjectId;
  const buildResult = useMemo<ExportBuildResult>(() => {
    if (!effectiveProjectId) return {};

    try {
      return {
        exportPackage: buildEngineeringHandoffPackageExport(state, effectiveProjectId)
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unable to build EngineeringHandoffPackage export."
      };
    }
  }, [effectiveProjectId, state]);

  if (state.projects.length === 0) {
    return (
      <section className="panel stack handoff-export-panel">
        <div className="head">
          <div>
            <h2>EngineeringHandoffPackage Export</h2>
            <p className="muted">Preview and export a read-only engineering draft package.</p>
          </div>
          <span className="badge">read-only</span>
        </div>
        <div className="notice">
          No projects are available for EngineeringHandoffPackage export.
        </div>
      </section>
    );
  }

  if (buildResult.error) {
    return (
      <section className="panel stack handoff-export-panel">
        <div className="head">
          <div>
            <h2>EngineeringHandoffPackage Export</h2>
            <p className="muted">Preview and export a read-only engineering draft package.</p>
          </div>
          <span className="badge">error</span>
        </div>
        <label>
          Project selector
          <select value={effectiveProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>
            {state.projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name} ({project.id})
              </option>
            ))}
          </select>
        </label>
        <div className="warn">Package builder error: {buildResult.error}</div>
      </section>
    );
  }

  const exportPackage = buildResult.exportPackage;

  if (!exportPackage) {
    return null;
  }

  const handoffPackage = exportPackage.package;
  const report = handoffPackage.readinessReport;
  const flowInput = handoffPackage.engineeringFlowInput;
  const projectName = projectLabel(exportPackage);
  const json = formatEngineeringHandoffPackageExportJson(exportPackage);
  const markdown = formatEngineeringHandoffPackageMarkdown(exportPackage);
  const filenameBase = slug(`${projectName}-${handoffPackage.projectId}`);
  const isHandoffReady = report.lifecycleStatus === "handoff_ready";
  const hasDraftRisk = !report.canGenerateEngineeringDraft ||
    !report.canMarkHandoffReady ||
    handoffPackage.blockers.length > 0 ||
    report.pendingAiDrafts.length > 0 ||
    report.blockingQuestions.unresolved.length > 0 ||
    report.proposedDecisions.length > 0 ||
    report.relationshipHealth.warnings.length > 0;

  const copyText = async (text: string, message: string) => {
    await navigator.clipboard.writeText(text);
    setNotice(message);
  };

  return (
    <section className="panel stack handoff-export-panel">
      <div className="head">
        <div>
          <h2>EngineeringHandoffPackage Export</h2>
          <p className="muted">Preview and export the selected project as a read-only engineering draft.</p>
        </div>
        <span className="badge">{exportPackage.schema}</span>
      </div>

      <div className="notice">
        This handoff package is a read-only engineering draft export. Generating or exporting it does not mutate
        AppState. It does not mark the project as handoff_ready. handoff_ready requires explicit user confirmation
        through the command layer.
      </div>

      <div className="grid two handoff-export-controls">
        <label>
          Project selector
          <select value={effectiveProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>
            {state.projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name} ({project.id})
              </option>
            ))}
          </select>
        </label>
        <div className="actions handoff-export-actions">
          <button className="ghost" onClick={() => copyText(json, "EngineeringHandoffPackage JSON copied.")}>
            Copy JSON
          </button>
          <button
            className="ghost"
            onClick={() =>
              downloadText(`${filenameBase}.engineering-handoff-package.json`, "application/json", json)}
          >
            Download JSON
          </button>
          <button className="ghost" onClick={() => copyText(markdown, "EngineeringHandoffPackage Markdown copied.")}>
            Copy Markdown
          </button>
          <button
            className="ghost"
            onClick={() =>
              downloadText(`${filenameBase}.engineering-handoff-package.md`, "text/markdown", markdown)}
          >
            Download Markdown
          </button>
        </div>
      </div>

      {notice && <div className="notice app-notice">{notice}</div>}

      {hasDraftRisk && !isHandoffReady && (
        <div className="warn">
          Draft package may be incomplete. This project is not handoff_ready. Resolve blockers and confirm handoff
          readiness before formal engineering handoff.
        </div>
      )}

      {isHandoffReady && hasDraftRisk && (
        <div className="warn">
          This project is already marked handoff_ready, but current draft signals may need review before reuse.
        </div>
      )}

      <div className="metrics deployment-data-metrics">
        <Metric label="Stored readiness" value={label(report.storedReadiness)} />
        <Metric label="Computed readiness" value={label(report.computedReadiness?.value)} />
        <Metric label="canGenerateEngineeringDraft" value={label(report.canGenerateEngineeringDraft)} />
        <Metric label="canMarkHandoffReady" value={label(report.canMarkHandoffReady)} />
      </div>

      <div className="mini-list">
        <strong>Handoff readiness summary</strong>
        <ul>
          <li>Project: {projectName} ({handoffPackage.projectId})</li>
          <li>Lifecycle status: {label(report.lifecycleStatus)}</li>
          <li>Preflight passed: {label(report.handoffPreflight.passed)}</li>
          <li>Blockers / warnings: {handoffPackage.blockers.length}</li>
          <li>Exported at: {exportPackage.exportedAt}</li>
        </ul>
      </div>

      <div className="notice">
        Engineering draft export does not mark the project as handoff_ready. handoff_ready requires explicit confirmed
        command flow.
      </div>

      <div className="handoff-export-preview stack">
        <PackageSection title="EngineeringFlowInput">
          <div className="grid two">
            <div className="mini-list">
              <strong>Project identity</strong>
              <ul>
                <li>id: {flowInput.projectIdentity.id}</li>
                <li>name: {label(flowInput.projectName)}</li>
                <li>intent: {label(flowInput.projectIntent)}</li>
                <li>next action: {label(flowInput.projectIdentity.nextAction)}</li>
              </ul>
            </div>
            <div className="mini-list">
              <strong>Context counts</strong>
              <ul>
                <li>linked thoughts: {flowInput.linkedThoughts.length}</li>
                <li>blockers: {flowInput.relevantBlockers.length}</li>
                <li>decisions: {flowInput.relevantDecisions.length}</li>
                <li>AI insights: {flowInput.aiInsights.length}</li>
              </ul>
            </div>
          </div>
        </PackageSection>

        <PackageSection title="RequiredSoftwarePlan">
          <p>{handoffPackage.requiredSoftwarePlan.summary}</p>
          <div className="cards">
            {handoffPackage.requiredSoftwarePlan.modules.length === 0 ? (
              <div className="mini-list">No required software modules.</div>
            ) : (
              handoffPackage.requiredSoftwarePlan.modules.map((module) => (
                <article className="card handoff-export-card" key={module.id}>
                  <div className="line">
                    <strong>{module.name}</strong>
                    <span className="badge">{module.riskLevel}</span>
                  </div>
                  <p>{module.responsibility}</p>
                  <div className="chips">
                    <span>{module.id}</span>
                    <span>{module.dependencies.length} dependencies</span>
                    <span>{module.testingResponsibilities.length} tests</span>
                  </div>
                </article>
              ))
            )}
          </div>
        </PackageSection>

        <PackageSection title="ProjectEvolutionPlan">
          <div className="grid two">
            <div className="mini-list">
              <strong>Next milestones</strong>
              <TextList items={handoffPackage.projectEvolutionPlan.nextMilestones} empty="No milestones listed." />
            </div>
            <div className="mini-list">
              <strong>Suggested implementation sequence</strong>
              <TextList
                items={handoffPackage.projectEvolutionPlan.suggestedImplementationSequence}
                empty="No implementation sequence listed."
              />
            </div>
          </div>
        </PackageSection>

        <PackageSection title="ConstraintCodex / Limiter">
          <div className="grid two">
            <div className="mini-list">
              <strong>Hard constraints</strong>
              <TextList items={handoffPackage.constraintCodex.hardConstraints} empty="No hard constraints listed." />
            </div>
            <div className="mini-list">
              <strong>Handoff limitations</strong>
              <TextList
                items={handoffPackage.constraintCodex.handoffLimitations}
                empty="No handoff limitations listed."
              />
            </div>
            <div className="mini-list">
              <strong>Forbidden actions</strong>
              <TextList items={handoffPackage.constraintCodex.forbiddenActions} empty="No forbidden actions listed." />
            </div>
            <div className="mini-list">
              <strong>AI limitations</strong>
              <TextList items={handoffPackage.constraintCodex.aiLimitations} empty="No AI limitations listed." />
            </div>
          </div>
        </PackageSection>

        <PackageSection title="BackendDesignPlan">
          <div className="mini-list">
            <strong>Local-first assumption</strong>
            <p>{handoffPackage.backendDesignPlan.localFirstAssumption}</p>
          </div>
          <div className="cards">
            {handoffPackage.backendDesignPlan.futureEndpointCandidates.length === 0 ? (
              <div className="mini-list">No backend endpoint candidates.</div>
            ) : (
              handoffPackage.backendDesignPlan.futureEndpointCandidates.map((endpoint) => (
                <article className="card handoff-export-card" key={`${endpoint.method}:${endpoint.path}`}>
                  <div className="line">
                    <strong>{endpoint.path}</strong>
                    <span className="badge">{endpoint.method}</span>
                  </div>
                  <p>{endpoint.purpose}</p>
                </article>
              ))
            )}
          </div>
        </PackageSection>

        <PackageSection title="CodexTaskPlan">
          <div className="cards">
            {handoffPackage.codexTaskPlan.tasks.length === 0 ? (
              <div className="mini-list">No Codex tasks listed.</div>
            ) : (
              handoffPackage.codexTaskPlan.tasks.map((task) => (
                <article className="card handoff-export-card" key={task.id}>
                  <div className="line">
                    <strong>{task.title}</strong>
                    <span className="badge">{task.requiresHumanConfirmation ? "confirm" : "read-only"}</span>
                  </div>
                  <p>{task.objective}</p>
                  <div className="chips">
                    <span>{task.id}</span>
                    <span>{task.acceptanceCriteria.length} acceptance criteria</span>
                  </div>
                </article>
              ))
            )}
          </div>
        </PackageSection>

        <PackageSection title="AcceptanceTestPlan">
          <div className="grid two">
            {Object.entries(handoffPackage.acceptanceTestPlan).map(([section, tests]) => (
              <div className="mini-list" key={section}>
                <strong>{section}</strong>
                <TextList items={tests} empty="No tests listed." />
              </div>
            ))}
          </div>
        </PackageSection>

        <PackageSection title="Blockers / Warnings">
          {handoffPackage.blockers.length === 0 ? (
            <p>No blockers or warnings reported.</p>
          ) : (
            <div className="cards">
              {handoffPackage.blockers.map((blocker) => (
                <article className="card handoff-export-card" key={blocker.id}>
                  <div className="line">
                    <strong>{blocker.source}</strong>
                    <span className={`badge review-severity-${clean(blocker.severity) || "warning"}`}>
                      {blocker.severity}
                    </span>
                  </div>
                  <p>{blocker.reason}</p>
                  <div className="chips">
                    {blocker.evidenceIds.map((id) => <span key={id}>{id}</span>)}
                  </div>
                </article>
              ))}
            </div>
          )}
        </PackageSection>
      </div>
    </section>
  );
}
