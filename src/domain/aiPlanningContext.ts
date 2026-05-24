import {
  buildAppHealthReport,
  type AppHealthFinding,
  type AppHealthReport
} from "./appHealthReport";
import {
  getAllowedDomainCommandSchema,
  type DomainCommandSchemaEntry
} from "./commandLayer";
import { buildDerivedReviewQueue, type DerivedReviewItem } from "./derivedReviewQueue";
import { buildDomainIndex } from "./domainIndex";
import {
  buildProjectReadinessReport,
  buildProjectReadinessReports,
  type ProjectReadinessReport
} from "./projectReadinessReport";
import {
  buildProjectRelationshipContext,
  buildRelationshipContext,
  buildThoughtRelationshipContext,
  type RelationshipContext
} from "./relationshipContext";
import {
  listCanonicalStatusSemantics,
  type CanonicalStatusSemanticsEntry
} from "./semantics/canonicalStatusSemantics";
import {
  buildThoughtProgressionReport,
  buildThoughtProgressionReports,
  type ThoughtProgressionReport
} from "./thoughtProgressionReport";
import type { AppState } from "./types";

export type AIPlanningScope =
  | { type: "app" }
  | { type: "thought"; id: string }
  | { type: "project"; id: string }
  | { type: "universe"; id: string };

export interface AIPlanningContextLimits {
  maxReports: number;
  maxRelationshipContexts: number;
  maxReviewItems: number;
  maxAppHealthFindings: number;
  maxCanonicalStatusEntries: number;
}

export interface AIPlanningContextTruncation {
  thoughtReports: boolean;
  projectReports: boolean;
  relationshipContexts: boolean;
  reviewItems: boolean;
  appHealthFindings: boolean;
  canonicalStatusSemantics: boolean;
}

export interface AIPlanningTarget {
  type: AIPlanningScope["type"];
  id?: string;
  valid: boolean;
  reason?: string;
}

export interface AIPlanningThoughtSummary {
  id: string;
  title?: string;
  type?: string;
  status?: string;
  universeId?: string;
  projectId?: string;
  recommendedNextStage: string;
  findingCodes: string[];
  suggestedCommandTypes: string[];
}

export interface AIPlanningProjectSummary {
  id: string;
  name?: string;
  status?: string;
  lifecycleStatus?: string;
  readiness?: string;
  effectiveStage?: string;
  universeId?: string;
  canGenerateEngineeringDraft: boolean;
  canMarkHandoffReady: boolean;
  findingCodes: string[];
  suggestedCommandTypes: string[];
}

export interface AIPlanningContext {
  scope: AIPlanningScope;
  target: AIPlanningTarget;
  limits: AIPlanningContextLimits;
  truncated: AIPlanningContextTruncation;
  summaries: {
    thoughts: AIPlanningThoughtSummary[];
    projects: AIPlanningProjectSummary[];
  };
  thoughtReports: ThoughtProgressionReport[];
  projectReports: ProjectReadinessReport[];
  relationshipContexts: RelationshipContext[];
  reviewItems: DerivedReviewItem[];
  appHealth: {
    summary: AppHealthReport["summary"];
    findings: AppHealthFinding[];
  };
  canonicalStatusSemantics: {
    entries: readonly CanonicalStatusSemanticsEntry[];
    summary: {
      totalEntries: number;
      includedEntries: number;
    };
  };
  allowedCommands: readonly DomainCommandSchemaEntry[];
  safetyRules: readonly string[];
  limitations: readonly string[];
}

export const defaultAIPlanningContextLimits: AIPlanningContextLimits = {
  maxReports: 25,
  maxRelationshipContexts: 25,
  maxReviewItems: 25,
  maxAppHealthFindings: 25,
  maxCanonicalStatusEntries: 100
};

export const aiPlanningSafetyRules = [
  "AI planning output is draft only.",
  "AIPlanningContext cannot mutate AppState.",
  "AI cannot call mutation owners directly.",
  "AI cannot bypass executeDomainCommand.",
  "AI commands require human confirmation.",
  "Suggested command draft metadata is not executable by itself.",
  "handoff_ready cannot be set by generic update.",
  "Relationship commands do not modify direct refs.",
  "Direct membership commands do not modify graph edges.",
  "Failures must be atomic in Command Layer."
] as const;

export const aiPlanningLimitations = [
  "AI can propose commands, but cannot execute commands.",
  "User confirmation is required before executeDomainCommand can mutate state."
] as const;

function sortIds(ids: Iterable<string>) {
  return [...new Set(ids)].filter(Boolean).sort((a, b) => a.localeCompare(b));
}

function bounded<T>(items: readonly T[], limit: number) {
  return {
    items: items.slice(0, limit),
    truncated: items.length > limit
  };
}

function compareRelationshipContext(a: RelationshipContext, b: RelationshipContext) {
  return a.targetType.localeCompare(b.targetType) ||
    a.targetId.localeCompare(b.targetId);
}

function summarizeThought(report: ThoughtProgressionReport): AIPlanningThoughtSummary {
  return {
    id: report.target.id,
    title: report.thought?.title,
    type: report.thought?.type,
    status: report.thought?.status,
    universeId: report.thought?.universeId,
    projectId: report.thought?.projectId,
    recommendedNextStage: report.recommendedNextStage,
    findingCodes: sortIds(report.findings.map((finding) => finding.code)),
    suggestedCommandTypes: sortIds(report.suggestedCommands.map((command) => command.commandType))
  };
}

function summarizeProject(report: ProjectReadinessReport): AIPlanningProjectSummary {
  return {
    id: report.target.id,
    name: report.project?.name,
    status: report.project?.status,
    lifecycleStatus: report.lifecycleStatus,
    readiness: report.storedReadiness,
    effectiveStage: report.effectiveStage?.stage,
    universeId: report.project?.universeId,
    canGenerateEngineeringDraft: report.canGenerateEngineeringDraft,
    canMarkHandoffReady: report.canMarkHandoffReady,
    findingCodes: sortIds(report.findings.map((finding) => finding.code)),
    suggestedCommandTypes: sortIds(report.suggestedCommands.map((command) => command.commandType))
  };
}

function targetForScope(state: AppState, scope: AIPlanningScope): AIPlanningTarget {
  if (scope.type === "app") {
    return { type: "app", valid: true };
  }

  const index = buildDomainIndex(state);
  if (scope.type === "thought") {
    return {
      type: "thought",
      id: scope.id,
      valid: Boolean(index.thoughtById[scope.id]),
      ...(!index.thoughtById[scope.id] ? { reason: "Thought target was not found." } : {})
    };
  }

  if (scope.type === "project") {
    return {
      type: "project",
      id: scope.id,
      valid: Boolean(index.projectById[scope.id]),
      ...(!index.projectById[scope.id] ? { reason: "Project target was not found." } : {})
    };
  }

  return {
    type: "universe",
    id: scope.id,
    valid: Boolean(index.universeById[scope.id]),
    ...(!index.universeById[scope.id] ? { reason: "Universe target was not found." } : {})
  };
}

function projectIdsFromThoughtScope(state: AppState, thoughtId: string) {
  const context = buildThoughtRelationshipContext(state, thoughtId);
  const graphProjectIds = context.graphRelationships.flatMap((relationship) => [
    relationship.source.resolvedType === "project" ? relationship.source.id : undefined,
    relationship.target.resolvedType === "project" ? relationship.target.id : undefined
  ]);
  const thought = buildDomainIndex(state).thoughtById[thoughtId];
  const directlyMentioningProjects = state.projects
    .filter((project) =>
      project.sourceThoughtId === thoughtId ||
      (project.linkedThoughtIds ?? []).includes(thoughtId)
    )
    .map((project) => project.id);

  return sortIds([
    thought?.projectId,
    ...directlyMentioningProjects,
    ...graphProjectIds
  ].filter((id): id is string => Boolean(id)));
}

function thoughtIdsFromProjectScope(state: AppState, projectId: string) {
  const context = buildProjectRelationshipContext(state, projectId);
  const graphThoughtIds = context.graphRelationships.flatMap((relationship) => [
    relationship.source.resolvedType === "thought" ? relationship.source.id : undefined,
    relationship.target.resolvedType === "thought" ? relationship.target.id : undefined
  ]);
  const project = buildDomainIndex(state).projectById[projectId];

  return sortIds([
    project?.sourceThoughtId,
    ...(project?.linkedThoughtIds ?? []),
    ...graphThoughtIds
  ].filter((id): id is string => Boolean(id)));
}

function idsForScope(state: AppState, scope: AIPlanningScope) {
  if (scope.type === "app") {
    return {
      thoughtIds: sortIds(state.thoughts.map((thought) => thought.id)),
      projectIds: sortIds(state.projects.map((project) => project.id)),
      relevantIds: new Set<string>()
    };
  }

  if (scope.type === "thought") {
    const projectIds = projectIdsFromThoughtScope(state, scope.id);
    const relevantIds = new Set([scope.id, ...projectIds]);

    return {
      thoughtIds: [scope.id],
      projectIds,
      relevantIds
    };
  }

  if (scope.type === "project") {
    const thoughtIds = thoughtIdsFromProjectScope(state, scope.id);
    const relevantIds = new Set([scope.id, ...thoughtIds]);

    return {
      thoughtIds,
      projectIds: [scope.id],
      relevantIds
    };
  }

  const thoughtIds = sortIds(
    state.thoughts
      .filter((thought) => thought.universeId === scope.id)
      .map((thought) => thought.id)
  );
  const projectIds = sortIds(
    state.projects
      .filter((project) => project.universeId === scope.id)
      .map((project) => project.id)
  );

  return {
    thoughtIds,
    projectIds,
    relevantIds: new Set([scope.id, ...thoughtIds, ...projectIds])
  };
}

function buildThoughtReports(state: AppState, scope: AIPlanningScope, thoughtIds: readonly string[]) {
  if (scope.type === "app") {
    return buildThoughtProgressionReports(state)
      .sort((a, b) => a.target.id.localeCompare(b.target.id));
  }

  return sortIds(thoughtIds)
    .map((id) => buildThoughtProgressionReport(state, id));
}

function buildProjectReports(state: AppState, scope: AIPlanningScope, projectIds: readonly string[]) {
  if (scope.type === "app") {
    return buildProjectReadinessReports(state)
      .sort((a, b) => a.target.id.localeCompare(b.target.id));
  }

  return sortIds(projectIds)
    .map((id) => buildProjectReadinessReport(state, id));
}

function buildRelationshipContexts(
  state: AppState,
  scope: AIPlanningScope,
  thoughtIds: readonly string[],
  projectIds: readonly string[]
) {
  if (scope.type === "thought" || scope.type === "project") {
    return [buildRelationshipContext(state, scope.id)].sort(compareRelationshipContext);
  }

  const contexts = [
    ...sortIds(thoughtIds).map((id) => buildThoughtRelationshipContext(state, id)),
    ...sortIds(projectIds).map((id) => buildProjectRelationshipContext(state, id))
  ];

  return contexts.sort(compareRelationshipContext);
}

function reviewItemMatchesScope(item: DerivedReviewItem, relevantIds: Set<string>) {
  if (relevantIds.size === 0) return true;
  if (relevantIds.has(item.target.id)) return true;
  if (item.evidence.some((value) => typeof value === "string" && relevantIds.has(value))) return true;

  return item.suggestedCommands.some((command) =>
    relevantIds.has(command.target.id)
  );
}

function appHealthFindingMatchesScope(finding: AppHealthFinding, relevantIds: Set<string>) {
  if (relevantIds.size === 0) return true;
  if (relevantIds.has(finding.target.id)) return true;

  return finding.evidenceIds.some((id) => relevantIds.has(id));
}

export function buildAIPlanningContext(
  state: AppState,
  scope: AIPlanningScope,
  limits: Partial<AIPlanningContextLimits> = {}
): AIPlanningContext {
  const resolvedLimits = {
    ...defaultAIPlanningContextLimits,
    ...limits
  };
  const target = targetForScope(state, scope);
  const { thoughtIds, projectIds, relevantIds } = idsForScope(state, scope);
  const scopedThoughtIds = scope.type === "thought"
    ? [scope.id]
    : target.valid
      ? thoughtIds
      : [];
  const scopedProjectIds = scope.type === "project"
    ? [scope.id]
    : target.valid
      ? projectIds
      : [];
  const allThoughtReports = buildThoughtReports(state, scope, scopedThoughtIds);
  const allProjectReports = buildProjectReports(state, scope, scopedProjectIds);
  const allRelationshipContexts = target.valid || scope.type === "thought" || scope.type === "project"
    ? buildRelationshipContexts(state, scope, scopedThoughtIds, scopedProjectIds)
    : [];
  const allReviewItems = buildDerivedReviewQueue(state)
    .filter((item) => reviewItemMatchesScope(item, relevantIds));
  const appHealthReport = buildAppHealthReport(state);
  const allHealthFindings = appHealthReport.findings
    .filter((finding) => appHealthFindingMatchesScope(finding, relevantIds));
  const canonicalEntries = listCanonicalStatusSemantics();

  const thoughtReports = bounded(allThoughtReports, resolvedLimits.maxReports);
  const projectReports = bounded(allProjectReports, resolvedLimits.maxReports);
  const relationshipContexts = bounded(allRelationshipContexts, resolvedLimits.maxRelationshipContexts);
  const reviewItems = bounded(allReviewItems, resolvedLimits.maxReviewItems);
  const appHealthFindings = bounded(allHealthFindings, resolvedLimits.maxAppHealthFindings);
  const canonicalStatusSemantics = bounded(canonicalEntries, resolvedLimits.maxCanonicalStatusEntries);

  return {
    scope,
    target,
    limits: resolvedLimits,
    truncated: {
      thoughtReports: thoughtReports.truncated,
      projectReports: projectReports.truncated,
      relationshipContexts: relationshipContexts.truncated,
      reviewItems: reviewItems.truncated,
      appHealthFindings: appHealthFindings.truncated,
      canonicalStatusSemantics: canonicalStatusSemantics.truncated
    },
    summaries: {
      thoughts: thoughtReports.items.map(summarizeThought),
      projects: projectReports.items.map(summarizeProject)
    },
    thoughtReports: thoughtReports.items,
    projectReports: projectReports.items,
    relationshipContexts: relationshipContexts.items,
    reviewItems: reviewItems.items,
    appHealth: {
      summary: appHealthReport.summary,
      findings: appHealthFindings.items
    },
    canonicalStatusSemantics: {
      entries: canonicalStatusSemantics.items,
      summary: {
        totalEntries: canonicalEntries.length,
        includedEntries: canonicalStatusSemantics.items.length
      }
    },
    allowedCommands: getAllowedDomainCommandSchema(),
    safetyRules: aiPlanningSafetyRules,
    limitations: aiPlanningLimitations
  };
}
