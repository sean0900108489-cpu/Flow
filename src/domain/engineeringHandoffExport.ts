import {
  buildEngineeringHandoffPackage,
  type AcceptanceTestPlan,
  type EngineeringHandoffPackage
} from "./engineeringHandoffPackage";
import type { AppState } from "./types";

export interface EngineeringHandoffPackageExportSafety {
  readOnlyExport: true;
  doesNotMarkHandoffReady: true;
  requiresConfirmedCommandForHandoffReady: true;
}

export interface EngineeringHandoffPackageExport {
  schema: "engineering-handoff-package-export/v0";
  exportedAt: string;
  projectId: string;
  package: EngineeringHandoffPackage;
  safety: EngineeringHandoffPackageExportSafety;
}

export interface EngineeringHandoffPackageExportOptions {
  exportedAt?: string;
  generatedAt?: string | null;
}

const exportSchema = "engineering-handoff-package-export/v0" as const;

const exportSafety: EngineeringHandoffPackageExportSafety = {
  readOnlyExport: true,
  doesNotMarkHandoffReady: true,
  requiresConfirmedCommandForHandoffReady: true
};

function fallbackTimestamp() {
  return new Date().toISOString();
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function text(value: unknown, fallback = "unavailable") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function bulletList(values: readonly string[], fallback: string) {
  if (values.length === 0) return `- ${fallback}`;

  return values.map((value) => `- ${value}`).join("\n");
}

function keyedList(entries: Array<[string, unknown]>) {
  return entries.map(([label, value]) => `- ${label}: ${text(value)}`).join("\n");
}

function packageTitle(handoffPackage: EngineeringHandoffPackage) {
  return handoffPackage.engineeringFlowInput.projectName ||
    handoffPackage.readinessReport.project?.name ||
    handoffPackage.projectId;
}

function formatAcceptanceTestPlan(plan: AcceptanceTestPlan) {
  return Object.entries(plan)
    .map(([section, tests]) => [
      `### ${section}`,
      bulletList(tests, "No tests listed.")
    ].join("\n"))
    .join("\n\n");
}

export function buildEngineeringHandoffPackageExport(
  state: AppState,
  projectId: string,
  options: EngineeringHandoffPackageExportOptions = {}
): EngineeringHandoffPackageExport {
  const exportedAt = options.exportedAt ?? fallbackTimestamp();
  const handoffPackage = buildEngineeringHandoffPackage(state, projectId, {
    generatedAt: options.generatedAt ?? exportedAt
  });

  return {
    schema: exportSchema,
    exportedAt,
    projectId,
    package: handoffPackage,
    safety: exportSafety
  };
}

export function formatEngineeringHandoffPackageExportJson(
  exportPackage: EngineeringHandoffPackageExport
) {
  return formatJson(exportPackage);
}

export function formatEngineeringHandoffPackageMarkdown(
  exportPackage: EngineeringHandoffPackageExport
) {
  const handoffPackage = exportPackage.package;
  const report = handoffPackage.readinessReport;
  const flowInput = handoffPackage.engineeringFlowInput;
  const blockersAndWarnings = [
    ...handoffPackage.blockers.map((blocker) =>
      `${blocker.severity} ${blocker.source}: ${blocker.reason}`
    ),
    ...report.handoffPreflight.blockedReasonCodes.map((code) => `preflight: ${code}`)
  ];

  return [
    `# Engineering Handoff Package: ${packageTitle(handoffPackage)}`,
    "",
    "## Safety",
    "- This export is read-only.",
    "- This export does not mark the project as handoff_ready.",
    "- handoff_ready requires explicit confirmed command flow.",
    "",
    "## Readiness Summary",
    keyedList([
      ["Stored readiness", report.storedReadiness],
      ["Computed readiness", report.computedReadiness?.value],
      ["Lifecycle status", report.lifecycleStatus],
      ["canGenerateEngineeringDraft", report.canGenerateEngineeringDraft],
      ["canMarkHandoffReady", report.canMarkHandoffReady],
      ["Preflight passed", report.handoffPreflight.passed]
    ]),
    "",
    "## Blockers / Warnings",
    bulletList(blockersAndWarnings, "No blockers or warnings reported."),
    "",
    "## EngineeringFlowInput",
    keyedList([
      ["Project id", flowInput.projectIdentity.id],
      ["Project title", flowInput.projectName],
      ["Intent", flowInput.projectIntent],
      ["Source thought", flowInput.sourceThought?.title],
      ["Linked thoughts", flowInput.linkedThoughts.length],
      ["Relevant blockers", flowInput.relevantBlockers.length],
      ["Relevant decisions", flowInput.relevantDecisions.length],
      ["AI insights", flowInput.aiInsights.length]
    ]),
    "",
    "## RequiredSoftwarePlan",
    handoffPackage.requiredSoftwarePlan.summary,
    "",
    bulletList(
      handoffPackage.requiredSoftwarePlan.modules.map((module) =>
        `${module.id}: ${module.name} - ${module.responsibility}`
      ),
      "No required software modules."
    ),
    "",
    "## ProjectEvolutionPlan",
    "### Next milestones",
    bulletList(handoffPackage.projectEvolutionPlan.nextMilestones, "No milestones listed."),
    "",
    "### Suggested implementation sequence",
    bulletList(
      handoffPackage.projectEvolutionPlan.suggestedImplementationSequence,
      "No implementation sequence listed."
    ),
    "",
    "## ConstraintCodex / Limiter",
    "### Hard constraints",
    bulletList(handoffPackage.constraintCodex.hardConstraints, "No hard constraints listed."),
    "",
    "### Forbidden actions",
    bulletList(handoffPackage.constraintCodex.forbiddenActions, "No forbidden actions listed."),
    "",
    "### Handoff limitations",
    bulletList(handoffPackage.constraintCodex.handoffLimitations, "No handoff limitations listed."),
    "",
    "## BackendDesignPlan",
    keyedList([
      ["Local-first assumption", handoffPackage.backendDesignPlan.localFirstAssumption],
      [
        "Future endpoint candidates",
        handoffPackage.backendDesignPlan.futureEndpointCandidates
          .map((endpoint) => `${endpoint.method} ${endpoint.path}`)
          .join(", ")
      ],
      [
        "Explicitly not included now",
        handoffPackage.backendDesignPlan.explicitlyNotIncludedNow.join(", ")
      ]
    ]),
    "",
    "## CodexTaskPlan",
    bulletList(
      handoffPackage.codexTaskPlan.tasks.map((task) =>
        `${task.id}: ${task.title} - ${task.objective}`
      ),
      "No Codex tasks listed."
    ),
    "",
    "## AcceptanceTestPlan",
    formatAcceptanceTestPlan(handoffPackage.acceptanceTestPlan)
  ].join("\n");
}
