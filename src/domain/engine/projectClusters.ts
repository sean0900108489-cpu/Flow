import {
  buildAppHealthReport,
  type AppHealthFinding
} from "../appHealthReport";
import {
  buildDomainIndex,
  type DomainIndex,
  type DomainNodeType
} from "../domainIndex";
import {
  buildProjectRelationshipContext,
  type RelationshipContextFinding
} from "../relationshipContext";
import {
  buildThoughtProgressionReports,
  type ThoughtProgressionCommandDraft
} from "../thoughtProgressionReport";
import type {
  AppState,
  Project,
  Relationship,
  RelationshipNodeType,
  ThoughtItem
} from "../types";

export type ProjectClusterKind =
  | "existing_project"
  | "universe_cluster"
  | "relationship_cluster"
  | "project_candidate_cluster"
  | "orphan_or_warning_cluster";

export type ProjectClusterConfidence = "high" | "medium" | "low";
export type ProjectClusterSeverity = "info" | "warning" | "error";

export interface ProjectClusterTarget {
  type: string;
  id: string;
}

export interface ProjectClusterWarning {
  code: string;
  severity: ProjectClusterSeverity;
  target: ProjectClusterTarget;
  reason: string;
  evidenceIds: string[];
  source?: string;
}

export interface ProjectClusterSuggestedCommand {
  id: string;
  commandType: string;
  label: string;
  reason: string;
  target: ProjectClusterTarget;
  requiresHumanConfirmation: true;
  payloadPreview?: unknown;
}

export interface ProjectCluster {
  id: string;
  kind: ProjectClusterKind;
  title: string;
  summary: string;
  primaryProjectId?: string;
  thoughtIds: string[];
  projectIds: string[];
  universeIds: string[];
  relationshipIds: string[];
  confidence: ProjectClusterConfidence;
  reasons: string[];
  warnings: ProjectClusterWarning[];
  suggestedCommands: ProjectClusterSuggestedCommand[];
  evidence: unknown[];
}

export interface BuildProjectClustersOptions {
  includeUniverseClusters?: boolean;
  includeRelationshipClusters?: boolean;
  includeProjectCandidateClusters?: boolean;
  includeWarningClusters?: boolean;
  limit?: number;
}

interface ClusterDraft extends ProjectCluster {
  rank: number;
}

type ClusterNodeType = "thought" | "project" | "universe";

interface ClusterNodeRef {
  type: ClusterNodeType;
  id: string;
}

const clusterNodeTypes = new Set<DomainNodeType>(["thought", "project", "universe"]);

const kindRank: Record<ProjectClusterKind, number> = {
  existing_project: 10,
  project_candidate_cluster: 20,
  relationship_cluster: 30,
  universe_cluster: 40,
  orphan_or_warning_cluster: 50
};

function uniqueSortedStrings(values: readonly (string | undefined)[]) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
    .sort((a, b) => a.localeCompare(b));
}

function normalizeEvidence(values: readonly unknown[]) {
  return [...values]
    .filter((value) => value !== undefined && value !== "")
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

function clusterTargetKey(target: ProjectClusterTarget) {
  return `${target.type}:${target.id}`;
}

function warningFromRelationshipFinding(finding: RelationshipContextFinding): ProjectClusterWarning {
  return {
    code: finding.code,
    severity: finding.severity,
    target: finding.target,
    reason: finding.reason,
    evidenceIds: uniqueSortedStrings(finding.evidenceIds),
    source: "relationship_context"
  };
}

function warningFromAppHealth(finding: AppHealthFinding): ProjectClusterWarning {
  return {
    code: finding.code,
    severity: finding.severity,
    target: finding.target,
    reason: finding.reason,
    evidenceIds: uniqueSortedStrings(finding.evidenceIds),
    source: finding.source
  };
}

function compareWarnings(a: ProjectClusterWarning, b: ProjectClusterWarning) {
  return a.severity.localeCompare(b.severity) ||
    a.code.localeCompare(b.code) ||
    a.target.type.localeCompare(b.target.type) ||
    a.target.id.localeCompare(b.target.id) ||
    a.evidenceIds.join("|").localeCompare(b.evidenceIds.join("|"));
}

function warningClusterIds(
  state: AppState,
  finding: AppHealthFinding
): Pick<ProjectCluster, "thoughtIds" | "projectIds" | "universeIds" | "relationshipIds"> {
  const evidenceIds = new Set(finding.evidenceIds);
  const thoughtIds = new Set<string>();
  const projectIds = new Set<string>();
  const universeIds = new Set<string>();
  const relationshipIds = new Set<string>();

  if (finding.target.type === "thought") thoughtIds.add(finding.target.id);
  if (finding.target.type === "project") projectIds.add(finding.target.id);
  if (finding.target.type === "universe") universeIds.add(finding.target.id);
  if (finding.target.type === "relationship") relationshipIds.add(finding.target.id);

  for (const thought of state.thoughts) {
    if (evidenceIds.has(thought.id)) thoughtIds.add(thought.id);
  }
  for (const project of state.projects) {
    if (evidenceIds.has(project.id)) projectIds.add(project.id);
  }
  for (const universe of state.universes) {
    if (evidenceIds.has(universe.id)) universeIds.add(universe.id);
  }
  for (const relationship of state.relationships) {
    if (evidenceIds.has(relationship.id)) relationshipIds.add(relationship.id);
  }

  return {
    thoughtIds: uniqueSortedStrings([...thoughtIds]),
    projectIds: uniqueSortedStrings([...projectIds]),
    universeIds: uniqueSortedStrings([...universeIds]),
    relationshipIds: uniqueSortedStrings([...relationshipIds])
  };
}

function suggestedFromThoughtDraft(command: ThoughtProgressionCommandDraft): ProjectClusterSuggestedCommand {
  return {
    id: command.id,
    commandType: command.commandType,
    label: command.label,
    reason: command.reason,
    target: command.target,
    requiresHumanConfirmation: true,
    ...(command.payloadPreview !== undefined ? { payloadPreview: command.payloadPreview } : {})
  };
}

function directThoughtIdsForProject(state: AppState, project: Readonly<Project>) {
  return uniqueSortedStrings([
    ...state.thoughts
      .filter((thought) => thought.projectId === project.id)
      .map((thought) => thought.id),
    ...(project.linkedThoughtIds ?? [])
  ]);
}

function relationshipWarningsForProject(state: AppState, projectId: string) {
  const context = buildProjectRelationshipContext(state, projectId);
  if (context.targetType !== "project") return [];

  return context.findings
    .filter((finding) => finding.severity !== "info")
    .map(warningFromRelationshipFinding)
    .sort(compareWarnings);
}

function existingProjectCluster(state: AppState, project: Readonly<Project>): ClusterDraft {
  const thoughtIds = directThoughtIdsForProject(state, project);
  const reasons = uniqueSortedStrings([
    "existing_project",
    ...(state.thoughts.some((thought) => thought.projectId === project.id) ? ["Thought.projectId"] : []),
    ...((project.linkedThoughtIds ?? []).length > 0 ? ["Project.linkedThoughtIds"] : []),
    ...(project.sourceThoughtId ? ["Project.sourceThoughtId:provenance"] : [])
  ]);
  const warnings = relationshipWarningsForProject(state, project.id);
  const evidence = normalizeEvidence([
    {
      source: "direct_membership",
      projectId: project.id,
      thoughtIds
    },
    project.sourceThoughtId
      ? {
          source: "Project.sourceThoughtId",
          role: "provenance",
          projectId: project.id,
          thoughtId: project.sourceThoughtId
        }
      : undefined,
    ...warnings.map((warning) => ({
      source: warning.source,
      code: warning.code,
      evidenceIds: warning.evidenceIds
    }))
  ]);

  return {
    id: `project-cluster:existing-project:${project.id}`,
    kind: "existing_project",
    title: `Existing project cluster: ${project.name}`,
    summary: "Direct project membership uses Thought.projectId and Project.linkedThoughtIds only; sourceThoughtId is provenance evidence.",
    primaryProjectId: project.id,
    thoughtIds,
    projectIds: [project.id],
    universeIds: uniqueSortedStrings([project.universeId]),
    relationshipIds: [],
    confidence: warnings.length > 0 ? "medium" : thoughtIds.length > 0 ? "high" : "medium",
    reasons,
    warnings,
    suggestedCommands: [],
    evidence,
    rank: kindRank.existing_project
  };
}

function existingProjectClusters(state: AppState): ClusterDraft[] {
  return [...state.projects]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((project) => existingProjectCluster(state, project));
}

function universeClusters(state: AppState): ClusterDraft[] {
  return [...state.universes]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((universe) => {
      const thoughtIds = uniqueSortedStrings(
        state.thoughts.filter((thought) => thought.universeId === universe.id).map((thought) => thought.id)
      );
      const projectIds = uniqueSortedStrings(
        state.projects.filter((project) => project.universeId === universe.id).map((project) => project.id)
      );

      return {
        id: `project-cluster:universe:${universe.id}`,
        kind: "universe_cluster" as const,
        title: `Universe cluster: ${universe.name}`,
        summary: "Shared universeId explains a loose planning group without creating projects or links.",
        thoughtIds,
        projectIds,
        universeIds: [universe.id],
        relationshipIds: [],
        confidence: thoughtIds.length > 0 && projectIds.length > 0 ? "medium" as const : "low" as const,
        reasons: ["shared_universeId"],
        warnings: [],
        suggestedCommands: [],
        evidence: normalizeEvidence([
          {
            source: "universeId",
            universeId: universe.id,
            thoughtIds,
            projectIds
          }
        ]),
        rank: kindRank.universe_cluster
      };
    })
    .filter((cluster) => cluster.thoughtIds.length > 0 || cluster.projectIds.length > 0);
}

function explicitTypeToClusterNodeType(type: RelationshipNodeType): ClusterNodeType | undefined {
  if (type === "thought" || type === "project" || type === "universe") return type;
  return undefined;
}

function hasIndexedNode(index: Readonly<DomainIndex>, node: ClusterNodeRef) {
  if (node.type === "thought") return Object.prototype.hasOwnProperty.call(index.thoughtById, node.id);
  if (node.type === "project") return Object.prototype.hasOwnProperty.call(index.projectById, node.id);

  return Object.prototype.hasOwnProperty.call(index.universeById, node.id);
}

function resolveRelationshipEndpoint(
  index: Readonly<DomainIndex>,
  id: string,
  explicitType?: RelationshipNodeType
): ClusterNodeRef | undefined {
  const explicitClusterType = explicitType ? explicitTypeToClusterNodeType(explicitType) : undefined;
  if (explicitClusterType) {
    const node = { id, type: explicitClusterType };
    return hasIndexedNode(index, node) ? node : undefined;
  }

  if (explicitType) return undefined;

  const node = index.resolveNode(id);
  if (!node || !clusterNodeTypes.has(node.type)) return undefined;

  return { id, type: node.type as ClusterNodeType };
}

function nodeKey(node: ClusterNodeRef) {
  return `${node.type}:${node.id}`;
}

function relationshipEvidence(relationship: Readonly<Relationship>) {
  return {
    source: "relationship_graph",
    relationshipId: relationship.id,
    relationshipType: relationship.type,
    sourceId: relationship.sourceId,
    sourceType: relationship.sourceType,
    targetId: relationship.targetId,
    targetType: relationship.targetType
  };
}

function relationshipClusters(state: AppState): ClusterDraft[] {
  const index = buildDomainIndex(state);
  const adjacency = new Map<string, Set<string>>();
  const nodeRefs = new Map<string, ClusterNodeRef>();
  const relationshipIdsByNode = new Map<string, Set<string>>();
  const relationshipsById = new Map(state.relationships.map((relationship) => [relationship.id, relationship]));

  for (const relationship of [...state.relationships].sort((a, b) => a.id.localeCompare(b.id))) {
    const source = resolveRelationshipEndpoint(index, relationship.sourceId, relationship.sourceType);
    const target = resolveRelationshipEndpoint(index, relationship.targetId, relationship.targetType);
    if (!source || !target) continue;

    const sourceKey = nodeKey(source);
    const targetKey = nodeKey(target);
    nodeRefs.set(sourceKey, source);
    nodeRefs.set(targetKey, target);
    adjacency.set(sourceKey, adjacency.get(sourceKey) ?? new Set());
    adjacency.set(targetKey, adjacency.get(targetKey) ?? new Set());
    adjacency.get(sourceKey)?.add(targetKey);
    adjacency.get(targetKey)?.add(sourceKey);
    relationshipIdsByNode.set(sourceKey, relationshipIdsByNode.get(sourceKey) ?? new Set());
    relationshipIdsByNode.set(targetKey, relationshipIdsByNode.get(targetKey) ?? new Set());
    relationshipIdsByNode.get(sourceKey)?.add(relationship.id);
    relationshipIdsByNode.get(targetKey)?.add(relationship.id);
  }

  const visited = new Set<string>();
  const clusters: ClusterDraft[] = [];

  for (const start of [...adjacency.keys()].sort((a, b) => a.localeCompare(b))) {
    if (visited.has(start)) continue;

    const stack = [start];
    const component = new Set<string>();
    visited.add(start);

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) continue;
      component.add(current);

      for (const next of adjacency.get(current) ?? []) {
        if (visited.has(next)) continue;
        visited.add(next);
        stack.push(next);
      }
    }

    const nodes = [...component].sort((a, b) => a.localeCompare(b));
    const relationshipIds = uniqueSortedStrings(
      nodes.flatMap((key) => [...(relationshipIdsByNode.get(key) ?? [])])
    );
    const thoughtIds = uniqueSortedStrings(nodes.map((key) => nodeRefs.get(key)).filter((node) => node?.type === "thought").map((node) => node?.id));
    const projectIds = uniqueSortedStrings(nodes.map((key) => nodeRefs.get(key)).filter((node) => node?.type === "project").map((node) => node?.id));
    const universeIds = uniqueSortedStrings(nodes.map((key) => nodeRefs.get(key)).filter((node) => node?.type === "universe").map((node) => node?.id));

    if (thoughtIds.length === 0 && projectIds.length === 0) continue;

    clusters.push({
      id: `project-cluster:relationship:${nodes.join("~")}`,
      kind: "relationship_cluster",
      title: `Relationship graph cluster: ${[...projectIds, ...thoughtIds].join(", ")}`,
      summary: "Relationship graph connected components explain proximity without creating direct project membership.",
      thoughtIds,
      projectIds,
      universeIds,
      relationshipIds,
      confidence: relationshipIds.length > 0 ? "medium" : "low",
      reasons: ["relationship_graph_connected_component"],
      warnings: [],
      suggestedCommands: [],
      evidence: normalizeEvidence(relationshipIds.map((relationshipId) => {
        const relationship = relationshipsById.get(relationshipId);
        return relationship ? relationshipEvidence(relationship) : relationshipId;
      })),
      rank: kindRank.relationship_cluster
    });
  }

  return clusters;
}

function projectCandidateClusters(state: AppState): ClusterDraft[] {
  return buildThoughtProgressionReports(state)
    .filter((report) => report.thought && (report.canPromoteToProject || report.findings.some((finding) => finding.code === "promotion_candidate")))
    .map((report) => {
      const thought = report.thought as Readonly<ThoughtItem>;
      const promotionCommands = report.suggestedCommands
        .filter((command) => command.commandType === "promote_thought_to_project")
        .map(suggestedFromThoughtDraft);
      const warnings = report.findings
        .filter((finding) => finding.severity !== "info")
        .map((finding): ProjectClusterWarning => ({
          code: finding.code,
          severity: finding.severity,
          target: finding.target,
          reason: finding.reason,
          evidenceIds: uniqueSortedStrings(finding.evidenceIds),
          source: "thought_progression"
        }))
        .sort(compareWarnings);

      return {
        id: `project-cluster:candidate:${thought.id}`,
        kind: "project_candidate_cluster" as const,
        title: `Project candidate: ${thought.title}`,
        summary: "ThoughtProgressionReport marks this thought as project-shaped without creating a project.",
        thoughtIds: [thought.id],
        projectIds: [],
        universeIds: uniqueSortedStrings([thought.universeId]),
        relationshipIds: uniqueSortedStrings(
          report.relationships.blockers
            .concat(report.relationships.dependencies)
            .map((item) => item.relationship.id)
        ),
        confidence: warnings.length > 0 ? "medium" as const : "high" as const,
        reasons: ["thought_progression:promotion_candidate"],
        warnings,
        suggestedCommands: promotionCommands,
        evidence: normalizeEvidence([
          {
            source: "ThoughtProgressionReport",
            thoughtId: thought.id,
            semanticRole: report.semanticRole,
            recommendedNextStage: report.recommendedNextStage
          },
          ...report.findings.map((finding) => ({
            code: finding.code,
            evidenceIds: finding.evidenceIds
          }))
        ]),
        rank: kindRank.project_candidate_cluster
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function warningClusters(state: AppState): ClusterDraft[] {
  return buildAppHealthReport(state).findings
    .filter((finding) => finding.severity !== "info")
    .map((finding) => {
      const ids = warningClusterIds(state, finding);

      return {
        id: `project-cluster:warning:${finding.code}:${finding.target.type}:${finding.target.id}`,
        kind: "orphan_or_warning_cluster" as const,
        title: `Warning cluster: ${finding.code}`,
        summary: finding.reason,
        ...ids,
        confidence: "low" as const,
        reasons: uniqueSortedStrings([finding.code, finding.sourceCode]),
        warnings: [warningFromAppHealth(finding)],
        suggestedCommands: [],
        evidence: normalizeEvidence(finding.evidenceIds),
        rank: kindRank.orphan_or_warning_cluster
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function compareClusters(a: ClusterDraft, b: ClusterDraft) {
  return a.rank - b.rank ||
    a.kind.localeCompare(b.kind) ||
    a.id.localeCompare(b.id);
}

function uniqueClusters(clusters: readonly ClusterDraft[]) {
  const byId = new Map<string, ClusterDraft>();

  for (const cluster of clusters) {
    if (!byId.has(cluster.id)) byId.set(cluster.id, cluster);
  }

  return [...byId.values()];
}

function finalizeCluster(cluster: ClusterDraft): ProjectCluster {
  const { rank, ...rest } = cluster;
  return rest;
}

export function buildProjectClusters(
  state: AppState,
  options: BuildProjectClustersOptions = {}
): ProjectCluster[] {
  const clusters = uniqueClusters([
    ...existingProjectClusters(state),
    ...(options.includeProjectCandidateClusters === false ? [] : projectCandidateClusters(state)),
    ...(options.includeRelationshipClusters === false ? [] : relationshipClusters(state)),
    ...(options.includeUniverseClusters === false ? [] : universeClusters(state)),
    ...(options.includeWarningClusters === false ? [] : warningClusters(state))
  ])
    .sort(compareClusters)
    .map(finalizeCluster);

  if (options.limit !== undefined) return clusters.slice(0, Math.max(0, options.limit));

  return clusters;
}
