import { buildDomainIndex } from "./domainIndex";
import { buildProjectReadinessReports, type ProjectReadinessFinding } from "./projectReadinessReport";
import {
  buildProjectRelationshipContext,
  buildThoughtRelationshipContext,
  type RelationshipContextFinding
} from "./relationshipContext";
import type { AppState } from "./types";
import {
  validateAppStateInvariants,
  type AppStateInvariantWarning
} from "./validation/appStateInvariants";

export type AppHealthSeverity = "info" | "warning" | "error";

export type AppHealthFindingCode =
  | "duplicate_id"
  | "orphan_relationship"
  | "ambiguous_relationship_endpoint"
  | "direct_ref_drift"
  | "invalid_ai_patch_target"
  | "readiness_drift"
  | "stale_handoff"
  | "invalid_universe_ref"
  | "invalid_project_ref"
  | "invalid_linked_thought_id"
  | "invalid_source_thought_id"
  | "invalid_relationship_endpoint"
  | "invariant_warning";

export interface AppHealthTarget {
  type:
    | "appState"
    | "universe"
    | "thought"
    | "project"
    | "relationship"
    | "aiInsight"
    | "blockingQuestion"
    | "decisionRecord"
    | "missing"
    | "unsupported";
  id: string;
}

export interface AppHealthFinding {
  code: AppHealthFindingCode;
  severity: AppHealthSeverity;
  target: AppHealthTarget;
  reason: string;
  evidenceIds: string[];
  source: "app_state_invariant" | "relationship_context" | "project_readiness";
  sourceCode: string;
}

export interface AppHealthReport {
  target: {
    type: "appState";
    id: "current";
    valid: true;
  };
  summary: {
    totalFindings: number;
    bySeverity: Record<AppHealthSeverity, number>;
    byCode: Partial<Record<AppHealthFindingCode, number>>;
  };
  invariantWarnings: AppStateInvariantWarning[];
  findings: AppHealthFinding[];
}

const severityRank: Record<AppHealthSeverity, number> = {
  info: 0,
  warning: 1,
  error: 2
};

const relationshipDirectRefDriftCodes = new Set<RelationshipContextFinding["code"]>([
  "thought_project_missing_reverse_link",
  "project_linked_thought_missing_forward_link",
  "project_linked_thought_mismatched_forward_link",
  "graph_project_membership_without_direct_membership",
  "direct_project_membership_without_graph_edge",
  "graph_universe_membership_without_direct_ref",
  "source_thought_not_linked_thought"
]);

function normalizeEvidenceIds(values: readonly (string | undefined)[]) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort();
}

function finding(input: {
  code: AppHealthFindingCode;
  severity: AppHealthSeverity;
  target: AppHealthTarget;
  reason: string;
  evidenceIds: readonly (string | undefined)[];
  source: AppHealthFinding["source"];
  sourceCode: string;
}): AppHealthFinding {
  return {
    ...input,
    evidenceIds: normalizeEvidenceIds(input.evidenceIds)
  };
}

function compareFindings(a: AppHealthFinding, b: AppHealthFinding) {
  return severityRank[b.severity] - severityRank[a.severity] ||
    a.code.localeCompare(b.code) ||
    a.target.type.localeCompare(b.target.type) ||
    a.target.id.localeCompare(b.target.id) ||
    a.evidenceIds.join("|").localeCompare(b.evidenceIds.join("|")) ||
    a.source.localeCompare(b.source) ||
    a.sourceCode.localeCompare(b.sourceCode);
}

function uniqueSortedFindings(findings: AppHealthFinding[]) {
  const byKey = new Map<string, AppHealthFinding>();

  for (const item of findings) {
    const key = `${item.code}|${item.target.type}|${item.target.id}`;
    const current = byKey.get(key);

    if (!current) {
      byKey.set(key, item);
      continue;
    }

    const severity = severityRank[item.severity] > severityRank[current.severity]
      ? item.severity
      : current.severity;
    const preferred = severity === item.severity && severityRank[item.severity] > severityRank[current.severity]
      ? item
      : current;

    byKey.set(key, {
      ...preferred,
      severity,
      evidenceIds: normalizeEvidenceIds([...current.evidenceIds, ...item.evidenceIds]),
      reason: current.reason === item.reason ? current.reason : `${current.reason} ${item.reason}`,
      source: current.source === item.source ? current.source : "app_state_invariant",
      sourceCode: current.sourceCode === item.sourceCode ? current.sourceCode : `${current.sourceCode}|${item.sourceCode}`
    });
  }

  return [...byKey.values()].sort(compareFindings);
}

function targetFromEntity(entityType: string | undefined, entityId: string | undefined, fallbackId: string): AppHealthTarget {
  const id = entityId || fallbackId;

  if (entityType === "universe" || entityType === "universes") return { type: "universe", id };
  if (entityType === "thought" || entityType === "thoughts") return { type: "thought", id };
  if (entityType === "project" || entityType === "projects") return { type: "project", id };
  if (entityType === "relationship" || entityType === "relationships") return { type: "relationship", id };
  if (entityType === "ai_insight" || entityType === "aiInsights") return { type: "aiInsight", id };
  if (entityType === "blocking_question" || entityType === "blockingQuestions") return { type: "blockingQuestion", id };
  if (entityType === "decision_record" || entityType === "decisionRecords") return { type: "decisionRecord", id };

  return { type: "appState", id };
}

function invariantCode(warning: AppStateInvariantWarning): AppHealthFindingCode {
  if (warning.code === "duplicate_id") return "duplicate_id";
  if (warning.code === "missing_relationship_endpoint") return "orphan_relationship";
  if (warning.code === "ambiguous_relationship_endpoint") return "ambiguous_relationship_endpoint";
  if (warning.code === "thought_project_reference_drift") return "direct_ref_drift";
  if (warning.code === "ai_insight_target_missing" || warning.code === "invalid_patch_target_type") {
    return "invalid_ai_patch_target";
  }
  if (warning.code === "readiness_drift") return "readiness_drift";
  if (warning.code === "invalid_handoff_ready") return "stale_handoff";
  if (warning.code === "missing_reference") {
    if (warning.field === "universeId" || warning.field === "linkedUniverseIds") return "invalid_universe_ref";
    if (warning.field === "projectId" || warning.field === "linkedProjectIds") return "invalid_project_ref";
    if (warning.field === "linkedThoughtIds") return "invalid_linked_thought_id";
    if (warning.field === "sourceThoughtId") return "invalid_source_thought_id";
  }
  if (warning.code === "invalid_enum" && warning.entityType === "relationship") return "invalid_relationship_endpoint";

  return "invariant_warning";
}

function findingFromInvariant(warning: AppStateInvariantWarning): AppHealthFinding {
  const code = invariantCode(warning);

  return finding({
    code,
    severity: warning.severity,
    target: targetFromEntity(warning.entityType, warning.entityId, warning.field ?? warning.code),
    reason: warning.message,
    evidenceIds: [warning.entityType, warning.entityId, warning.field, warning.code],
    source: "app_state_invariant",
    sourceCode: warning.code
  });
}

function targetFromRelationshipFinding(item: RelationshipContextFinding): AppHealthTarget {
  if (item.target.type === "thought") return { type: "thought", id: item.target.id };
  if (item.target.type === "project") return { type: "project", id: item.target.id };
  if (item.target.type === "universe") return { type: "universe", id: item.target.id };
  if (item.target.type === "relationship") return { type: "relationship", id: item.target.id };
  if (item.target.type === "blockingQuestion") return { type: "blockingQuestion", id: item.target.id };
  if (item.target.type === "decisionRecord") return { type: "decisionRecord", id: item.target.id };
  if (item.target.type === "missing") return { type: "missing", id: item.target.id };

  return { type: "unsupported", id: item.target.id };
}

function relationshipCode(item: RelationshipContextFinding): AppHealthFindingCode {
  if (item.code === "orphan_relationship_endpoint") return "orphan_relationship";
  if (item.code === "invalid_thought_universe_id" || item.code === "invalid_project_universe_id") {
    return "invalid_universe_ref";
  }
  if (item.code === "invalid_thought_project_id") return "invalid_project_ref";
  if (item.code === "invalid_project_source_thought_id") return "invalid_source_thought_id";
  if (item.code === "invalid_project_linked_thought_id") return "invalid_linked_thought_id";
  if (relationshipDirectRefDriftCodes.has(item.code)) return "direct_ref_drift";

  return "invariant_warning";
}

function findingFromRelationshipContext(item: RelationshipContextFinding): AppHealthFinding {
  return finding({
    code: relationshipCode(item),
    severity: item.severity,
    target: targetFromRelationshipFinding(item),
    reason: item.reason,
    evidenceIds: item.evidenceIds,
    source: "relationship_context",
    sourceCode: item.code
  });
}

function targetFromProjectReadinessFinding(item: ProjectReadinessFinding): AppHealthTarget {
  if (item.target.type === "project") return { type: "project", id: item.target.id };
  if (item.target.type === "thought") return { type: "thought", id: item.target.id };
  if (item.target.type === "universe") return { type: "universe", id: item.target.id };
  if (item.target.type === "relationship") return { type: "relationship", id: item.target.id };
  if (item.target.type === "aiInsight") return { type: "aiInsight", id: item.target.id };
  if (item.target.type === "blockingQuestion") return { type: "blockingQuestion", id: item.target.id };
  if (item.target.type === "decisionRecord") return { type: "decisionRecord", id: item.target.id };
  if (item.target.type === "missing") return { type: "missing", id: item.target.id };

  return { type: "unsupported", id: item.target.id };
}

function projectReadinessHealthCode(item: ProjectReadinessFinding): AppHealthFindingCode | undefined {
  if (item.code === "readiness_drift" || item.code === "stored_readiness_missing") return "readiness_drift";
  if (item.code === "stale_handoff" || item.code === "lifecycle_drift") return "stale_handoff";

  return undefined;
}

function findingFromProjectReadiness(item: ProjectReadinessFinding): AppHealthFinding | undefined {
  const code = projectReadinessHealthCode(item);
  if (!code) return undefined;

  return finding({
    code,
    severity: item.severity,
    target: targetFromProjectReadinessFinding(item),
    reason: item.reason,
    evidenceIds: item.evidenceIds,
    source: "project_readiness",
    sourceCode: item.code
  });
}

function relationshipContextFindings(state: AppState): AppHealthFinding[] {
  return [
    ...state.thoughts.flatMap((thought) => buildThoughtRelationshipContext(state, thought.id).findings),
    ...state.projects.flatMap((project) => buildProjectRelationshipContext(state, project.id).findings)
  ].map(findingFromRelationshipContext);
}

function projectReadinessFindings(state: AppState): AppHealthFinding[] {
  return buildProjectReadinessReports(state)
    .flatMap((report) => report.findings)
    .map(findingFromProjectReadiness)
    .filter((item): item is AppHealthFinding => Boolean(item));
}

function summary(findings: readonly AppHealthFinding[]): AppHealthReport["summary"] {
  const bySeverity: Record<AppHealthSeverity, number> = {
    info: 0,
    warning: 0,
    error: 0
  };
  const byCode: Partial<Record<AppHealthFindingCode, number>> = {};

  for (const item of findings) {
    bySeverity[item.severity] += 1;
    byCode[item.code] = (byCode[item.code] ?? 0) + 1;
  }

  return {
    totalFindings: findings.length,
    bySeverity,
    byCode
  };
}

export function buildAppHealthReport(state: AppState): AppHealthReport {
  // DomainIndex is built here to exercise the same deterministic id semantics
  // used by downstream reports, without repairing or saving any state.
  buildDomainIndex(state);

  const invariantWarnings = validateAppStateInvariants(state);
  const findings = uniqueSortedFindings([
    ...invariantWarnings.map(findingFromInvariant),
    ...relationshipContextFindings(state),
    ...projectReadinessFindings(state)
  ]);

  return {
    target: { type: "appState", id: "current", valid: true },
    summary: summary(findings),
    invariantWarnings,
    findings
  };
}
