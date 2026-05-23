import {
  buildDomainIndex,
  type DomainEntityById,
  type DomainIndex,
  type DomainNode,
  type DomainNodeType
} from "./domainIndex";
import { relationshipTouchesNode } from "./relationships/relationshipGraph";
import type {
  AppState,
  Project,
  Relationship,
  RelationshipNodeType,
  ThoughtItem,
  Universe
} from "./types";

type EntityWithId = { id: string };
type RelationshipEndpointDomainType = Exclude<DomainNodeType, "relationship" | "aiInsight">;
type ContextTargetType = "thought" | "project" | "missing" | "unsupported";

export type RelationshipContextSeverity = "info" | "warning" | "error";

export type RelationshipContextFindingCode =
  | "target_missing"
  | "target_unsupported"
  | "orphan_relationship_endpoint"
  | "invalid_thought_project_id"
  | "invalid_thought_universe_id"
  | "invalid_project_universe_id"
  | "invalid_project_source_thought_id"
  | "invalid_project_linked_thought_id"
  | "thought_project_missing_reverse_link"
  | "project_linked_thought_missing_forward_link"
  | "project_linked_thought_mismatched_forward_link"
  | "graph_project_membership_without_direct_membership"
  | "direct_project_membership_without_graph_edge"
  | "graph_universe_membership_without_direct_ref"
  | "source_thought_not_linked_thought";

export interface RelationshipContextFinding {
  code: RelationshipContextFindingCode;
  severity: RelationshipContextSeverity;
  target: {
    type: ContextTargetType | DomainNodeType;
    id: string;
  };
  reason: string;
  evidenceIds: string[];
}

export interface RelationshipEntityRef<T extends EntityWithId> {
  id: string;
  entity?: Readonly<T>;
  valid: boolean;
}

export interface RelationshipEndpointContext {
  role: "source" | "target";
  id: string;
  explicitType?: RelationshipNodeType;
  resolvedType?: RelationshipEndpointDomainType;
  status: "resolved" | "missing";
}

export interface GraphRelationshipContext {
  relationship: Readonly<Relationship>;
  direction: "incoming" | "outgoing" | "self";
  source: RelationshipEndpointContext;
  target: RelationshipEndpointContext;
  otherEndpoint?: RelationshipEndpointContext;
  hasOrphanEndpoint: boolean;
}

export interface ThoughtDirectMembershipRefs {
  universe?: RelationshipEntityRef<Universe>;
  project?: RelationshipEntityRef<Project> & {
    active: boolean;
    projectHasLinkedThought: boolean;
  };
}

export interface ProjectDirectMembershipRefs {
  universe?: RelationshipEntityRef<Universe>;
  linkedThoughts: Array<RelationshipEntityRef<ThoughtItem>>;
}

export interface RelationshipContextProvenanceRefs {
  sourceThought?: RelationshipEntityRef<ThoughtItem>;
  sourceProjects: Array<RelationshipEntityRef<Project>>;
}

interface BaseRelationshipContext {
  targetId: string;
  targetType: ContextTargetType;
  graphRelationships: GraphRelationshipContext[];
  blockersAndDependencies: GraphRelationshipContext[];
  findings: RelationshipContextFinding[];
}

export interface ThoughtRelationshipContext extends BaseRelationshipContext {
  targetType: "thought";
  target: Readonly<ThoughtItem>;
  directMembershipRefs: ThoughtDirectMembershipRefs;
  provenanceRefs: RelationshipContextProvenanceRefs;
  graphProjectMemberships: GraphRelationshipContext[];
  graphOnlyProjectMemberships: GraphRelationshipContext[];
}

export interface ProjectRelationshipContext extends BaseRelationshipContext {
  targetType: "project";
  target: Readonly<Project>;
  directMembershipRefs: ProjectDirectMembershipRefs;
  provenanceRefs: RelationshipContextProvenanceRefs;
  graphProjectMemberships: GraphRelationshipContext[];
}

export interface InvalidRelationshipContext extends BaseRelationshipContext {
  targetType: "missing" | "unsupported";
  target?: DomainNode;
  directMembershipRefs: Record<string, never>;
  provenanceRefs: RelationshipContextProvenanceRefs;
}

export type RelationshipContext =
  | ThoughtRelationshipContext
  | ProjectRelationshipContext
  | InvalidRelationshipContext;

const endpointDomainTypes: RelationshipEndpointDomainType[] = [
  "thought",
  "project",
  "universe",
  "blockingQuestion",
  "decisionRecord"
];

const relationshipTypeByDomainType: Record<RelationshipEndpointDomainType, RelationshipNodeType> = {
  thought: "thought",
  project: "project",
  universe: "universe",
  blockingQuestion: "blocking_question",
  decisionRecord: "decision_record"
};

function getById<T extends EntityWithId>(
  byId: DomainEntityById<T>,
  id: string | undefined
): Readonly<T> | undefined {
  return id && Object.prototype.hasOwnProperty.call(byId, id) ? byId[id] : undefined;
}

function entityRef<T extends EntityWithId>(
  id: string | undefined,
  entity: Readonly<T> | undefined
): RelationshipEntityRef<T> | undefined {
  if (id === undefined) return undefined;

  return {
    id,
    entity,
    valid: Boolean(entity)
  };
}

function finding(
  code: RelationshipContextFindingCode,
  severity: RelationshipContextSeverity,
  target: RelationshipContextFinding["target"],
  reason: string,
  evidenceIds: string[]
): RelationshipContextFinding {
  return {
    code,
    severity,
    target,
    reason,
    evidenceIds: [...evidenceIds].sort()
  };
}

function compareFindings(a: RelationshipContextFinding, b: RelationshipContextFinding) {
  return a.code.localeCompare(b.code) ||
    a.severity.localeCompare(b.severity) ||
    a.target.type.localeCompare(b.target.type) ||
    a.target.id.localeCompare(b.target.id) ||
    a.evidenceIds.join("|").localeCompare(b.evidenceIds.join("|"));
}

function uniqueSortedFindings(findings: RelationshipContextFinding[]) {
  const byKey = new Map<string, RelationshipContextFinding>();

  for (const item of findings) {
    const key = `${item.code}|${item.severity}|${item.target.type}|${item.target.id}|${item.evidenceIds.join("|")}`;
    if (!byKey.has(key)) byKey.set(key, item);
  }

  return [...byKey.values()].sort(compareFindings);
}

function compareRelationshipContexts(a: GraphRelationshipContext, b: GraphRelationshipContext) {
  return a.relationship.type.localeCompare(b.relationship.type) ||
    a.relationship.id.localeCompare(b.relationship.id);
}

function canBeRelationshipEndpoint(node: DomainNode | undefined): node is DomainNode & {
  type: RelationshipEndpointDomainType;
} {
  return Boolean(node && endpointDomainTypes.includes(node.type as RelationshipEndpointDomainType));
}

function resolveExplicitEndpoint(
  index: Readonly<DomainIndex>,
  id: string,
  type: RelationshipNodeType
): DomainNode | undefined {
  if (type === "thought") {
    const entity = getById(index.thoughtById, id);
    return entity ? { id, type: "thought", entity } : undefined;
  }

  if (type === "project") {
    const entity = getById(index.projectById, id);
    return entity ? { id, type: "project", entity } : undefined;
  }

  if (type === "universe") {
    const entity = getById(index.universeById, id);
    return entity ? { id, type: "universe", entity } : undefined;
  }

  if (type === "blocking_question") {
    const entity = getById(index.blockingQuestionById, id);
    return entity ? { id, type: "blockingQuestion", entity } : undefined;
  }

  const entity = getById(index.decisionRecordById, id);
  return entity ? { id, type: "decisionRecord", entity } : undefined;
}

function resolveEndpoint(index: Readonly<DomainIndex>, id: string, explicitType?: RelationshipNodeType) {
  const node = explicitType
    ? resolveExplicitEndpoint(index, id, explicitType)
    : index.resolveNode(id);

  return canBeRelationshipEndpoint(node) ? node : undefined;
}

function endpointContext(
  index: Readonly<DomainIndex>,
  relationship: Readonly<Relationship>,
  role: "source" | "target"
): RelationshipEndpointContext {
  const id = role === "source" ? relationship.sourceId : relationship.targetId;
  const explicitType = role === "source" ? relationship.sourceType : relationship.targetType;
  const node = resolveEndpoint(index, id, explicitType);

  return {
    role,
    id,
    explicitType,
    resolvedType: node?.type,
    status: node ? "resolved" : "missing"
  };
}

function endpointMatches(
  id: string,
  explicitType: RelationshipNodeType | undefined,
  targetId: string,
  targetType: RelationshipEndpointDomainType
) {
  return id === targetId && (explicitType === undefined || explicitType === relationshipTypeByDomainType[targetType]);
}

function graphRelationshipContext(
  index: Readonly<DomainIndex>,
  relationship: Readonly<Relationship>,
  targetId: string,
  targetType: RelationshipEndpointDomainType
): GraphRelationshipContext {
  const source = endpointContext(index, relationship, "source");
  const target = endpointContext(index, relationship, "target");
  const touchesSource = endpointMatches(relationship.sourceId, relationship.sourceType, targetId, targetType);
  const touchesTarget = endpointMatches(relationship.targetId, relationship.targetType, targetId, targetType);
  const direction = touchesSource && touchesTarget ? "self" : touchesSource ? "outgoing" : "incoming";
  const otherEndpoint = direction === "outgoing" ? target : direction === "incoming" ? source : undefined;

  return {
    relationship,
    direction,
    source,
    target,
    otherEndpoint,
    hasOrphanEndpoint: source.status === "missing" || target.status === "missing"
  };
}

function graphRelationshipsForTarget(
  state: AppState,
  index: Readonly<DomainIndex>,
  targetId: string,
  targetType: "thought" | "project"
) {
  return state.relationships
    .filter((relationship) => relationshipTouchesNode(relationship, { id: targetId, type: targetType }))
    .map((relationship) => graphRelationshipContext(index, relationship, targetId, targetType))
    .sort(compareRelationshipContexts);
}

function orphanRelationshipFindings(graphRelationships: GraphRelationshipContext[]) {
  return graphRelationships.flatMap((item) => {
    const findings: RelationshipContextFinding[] = [];

    if (item.source.status === "missing") {
      findings.push(finding(
        "orphan_relationship_endpoint",
        "warning",
        { type: "relationship", id: item.relationship.id },
        `Relationship ${item.relationship.id} has a missing source endpoint.`,
        [item.relationship.id, item.source.id]
      ));
    }

    if (item.target.status === "missing") {
      findings.push(finding(
        "orphan_relationship_endpoint",
        "warning",
        { type: "relationship", id: item.relationship.id },
        `Relationship ${item.relationship.id} has a missing target endpoint.`,
        [item.relationship.id, item.target.id]
      ));
    }

    return findings;
  });
}

function isProjectMembershipRelationship(relationship: Readonly<Relationship>) {
  return relationship.type === "belongs_to" || relationship.type === "related_to";
}

function contextConnectsProject(context: GraphRelationshipContext) {
  return isProjectMembershipRelationship(context.relationship) &&
    context.otherEndpoint?.resolvedType === "project";
}

function contextConnectsUniverseByBelongsTo(context: GraphRelationshipContext) {
  return context.relationship.type === "belongs_to" &&
    context.otherEndpoint?.resolvedType === "universe";
}

function hasRelationshipEndpoint(
  relationship: Readonly<Relationship>,
  id: string,
  type: RelationshipEndpointDomainType
) {
  return endpointMatches(relationship.sourceId, relationship.sourceType, id, type) ||
    endpointMatches(relationship.targetId, relationship.targetType, id, type);
}

function hasGraphProjectMembershipEdge(state: AppState, thoughtId: string, projectId: string) {
  return state.relationships.some((relationship) =>
    isProjectMembershipRelationship(relationship) &&
    hasRelationshipEndpoint(relationship, thoughtId, "thought") &&
    hasRelationshipEndpoint(relationship, projectId, "project")
  );
}

function projectDirectlyMentionsThought(project: Readonly<Project>, thoughtId: string) {
  return (project.linkedThoughtIds ?? []).includes(thoughtId);
}

function projectHasDirectThoughtMembership(
  thought: Readonly<ThoughtItem>,
  project: Readonly<Project>
) {
  return thought.projectId === project.id || projectDirectlyMentionsThought(project, thought.id);
}

function graphOnlyProjectMemberships(
  index: Readonly<DomainIndex>,
  graphMemberships: GraphRelationshipContext[],
  thought: Readonly<ThoughtItem>
) {
  return graphMemberships.filter((context) => {
    const projectId = context.otherEndpoint?.id;
    const project = getById(index.projectById, projectId);

    return project ? !projectHasDirectThoughtMembership(thought, project) : false;
  });
}

function blockersAndDependencies(graphRelationships: GraphRelationshipContext[]) {
  return graphRelationships.filter((context) =>
    context.relationship.type === "blocks" || context.relationship.type === "depends_on"
  );
}

function graphUniverseDriftFindings(
  graphRelationships: GraphRelationshipContext[],
  target: { id: string; type: "thought" | "project"; universeId: string }
) {
  return graphRelationships
    .filter(contextConnectsUniverseByBelongsTo)
    .filter((context) => context.otherEndpoint?.id !== target.universeId)
    .map((context) => finding(
      "graph_universe_membership_without_direct_ref",
      "warning",
      { type: target.type, id: target.id },
      "A graph belongs_to universe relationship does not replace or match the direct universeId ref.",
      [target.id, target.universeId, context.otherEndpoint?.id ?? "", context.relationship.id].filter(Boolean)
    ));
}

function thoughtDirectRefFindings(
  index: Readonly<DomainIndex>,
  state: AppState,
  thought: Readonly<ThoughtItem>,
  graphMemberships: GraphRelationshipContext[]
) {
  const findings: RelationshipContextFinding[] = [];
  const universe = getById(index.universeById, thought.universeId);
  const project = getById(index.projectById, thought.projectId);

  if (!universe) {
    findings.push(finding(
      "invalid_thought_universe_id",
      "warning",
      { type: "thought", id: thought.id },
      "Thought.universeId does not resolve to a universe.",
      [thought.id, thought.universeId].filter(Boolean)
    ));
  }

  if (thought.projectId && !project) {
    findings.push(finding(
      "invalid_thought_project_id",
      "warning",
      { type: "thought", id: thought.id },
      "Thought.projectId does not resolve to a project.",
      [thought.id, thought.projectId]
    ));
  }

  if (project && !projectDirectlyMentionsThought(project, thought.id)) {
    findings.push(finding(
      "thought_project_missing_reverse_link",
      "warning",
      { type: "thought", id: thought.id },
      "Thought.projectId points at a project whose linkedThoughtIds does not include the thought.",
      [thought.id, project.id]
    ));
  }

  for (const candidate of state.projects) {
    if (!projectDirectlyMentionsThought(candidate, thought.id)) continue;

    if (!thought.projectId) {
      findings.push(finding(
        "project_linked_thought_missing_forward_link",
        "warning",
        { type: "project", id: candidate.id },
        "Project.linkedThoughtIds includes the thought, but Thought.projectId is missing.",
        [candidate.id, thought.id]
      ));
    } else if (thought.projectId !== candidate.id) {
      findings.push(finding(
        "project_linked_thought_mismatched_forward_link",
        "warning",
        { type: "project", id: candidate.id },
        "Project.linkedThoughtIds includes the thought, but Thought.projectId points at a different project.",
        [candidate.id, thought.id, thought.projectId]
      ));
    }
  }

  for (const context of graphMemberships) {
    const projectId = context.otherEndpoint?.id;
    const graphProject = getById(index.projectById, projectId);
    if (!graphProject || projectHasDirectThoughtMembership(thought, graphProject)) continue;

    findings.push(finding(
      "graph_project_membership_without_direct_membership",
      "warning",
      { type: "thought", id: thought.id },
      "A graph project membership edge exists without matching direct project membership refs.",
      [thought.id, graphProject.id, context.relationship.id]
    ));
  }

  if (project && !hasGraphProjectMembershipEdge(state, thought.id, project.id)) {
    findings.push(finding(
      "direct_project_membership_without_graph_edge",
      "warning",
      { type: "thought", id: thought.id },
      "A direct Thought.projectId membership exists without a graph belongs_to or related_to project edge.",
      [thought.id, project.id]
    ));
  }

  return findings;
}

function sourceProjectFindings(thought: Readonly<ThoughtItem>, sourceProjects: Readonly<Project>[]) {
  return sourceProjects
    .filter((project) => !projectDirectlyMentionsThought(project, thought.id))
    .map((project) => finding(
      "source_thought_not_linked_thought",
      "info",
      { type: "project", id: project.id },
      "Project.sourceThoughtId is provenance and is not treated as a linkedThoughtIds substitute.",
      [project.id, thought.id]
    ));
}

function buildThoughtContext(
  state: AppState,
  index: Readonly<DomainIndex>,
  thought: Readonly<ThoughtItem>
): ThoughtRelationshipContext {
  const graphRelationships = graphRelationshipsForTarget(state, index, thought.id, "thought");
  const graphProjectMemberships = graphRelationships.filter(contextConnectsProject);
  const directUniverse = getById(index.universeById, thought.universeId);
  const directProject = getById(index.projectById, thought.projectId);
  const sourceProjects = state.projects
    .filter((project) => project.sourceThoughtId === thought.id)
    .sort((a, b) => a.id.localeCompare(b.id));
  const directMembershipRefs: ThoughtDirectMembershipRefs = {
    universe: entityRef(thought.universeId, directUniverse),
    project: thought.projectId === undefined
      ? undefined
      : {
          id: thought.projectId,
          entity: directProject,
          valid: Boolean(directProject),
          active: Boolean(directProject && projectDirectlyMentionsThought(directProject, thought.id)),
          projectHasLinkedThought: Boolean(directProject && projectDirectlyMentionsThought(directProject, thought.id))
        }
  };
  const provenanceRefs: RelationshipContextProvenanceRefs = {
    sourceProjects: sourceProjects.map((project) => ({ id: project.id, entity: project, valid: true }))
  };
  const findings = uniqueSortedFindings([
    ...orphanRelationshipFindings(graphRelationships),
    ...thoughtDirectRefFindings(index, state, thought, graphProjectMemberships),
    ...graphUniverseDriftFindings(graphRelationships, { id: thought.id, type: "thought", universeId: thought.universeId }),
    ...sourceProjectFindings(thought, sourceProjects)
  ]);

  return {
    targetId: thought.id,
    targetType: "thought",
    target: thought,
    graphRelationships,
    directMembershipRefs,
    provenanceRefs,
    blockersAndDependencies: blockersAndDependencies(graphRelationships),
    graphProjectMemberships,
    graphOnlyProjectMemberships: graphOnlyProjectMemberships(index, graphProjectMemberships, thought),
    findings
  };
}

function projectDirectRefFindings(
  index: Readonly<DomainIndex>,
  state: AppState,
  project: Readonly<Project>,
  graphMemberships: GraphRelationshipContext[]
) {
  const findings: RelationshipContextFinding[] = [];
  const universe = getById(index.universeById, project.universeId);

  if (!universe) {
    findings.push(finding(
      "invalid_project_universe_id",
      "warning",
      { type: "project", id: project.id },
      "Project.universeId does not resolve to a universe.",
      [project.id, project.universeId].filter(Boolean)
    ));
  }

  if (project.sourceThoughtId && !getById(index.thoughtById, project.sourceThoughtId)) {
    findings.push(finding(
      "invalid_project_source_thought_id",
      "warning",
      { type: "project", id: project.id },
      "Project.sourceThoughtId does not resolve to a thought.",
      [project.id, project.sourceThoughtId]
    ));
  }

  for (const thoughtId of project.linkedThoughtIds ?? []) {
    const thought = getById(index.thoughtById, thoughtId);

    if (!thought) {
      findings.push(finding(
        "invalid_project_linked_thought_id",
        "warning",
        { type: "project", id: project.id },
        "Project.linkedThoughtIds contains an id that does not resolve to a thought.",
        [project.id, thoughtId]
      ));
      continue;
    }

    if (!thought.projectId) {
      findings.push(finding(
        "project_linked_thought_missing_forward_link",
        "warning",
        { type: "project", id: project.id },
        "Project.linkedThoughtIds includes a thought whose Thought.projectId is missing.",
        [project.id, thought.id]
      ));
    } else if (thought.projectId !== project.id) {
      findings.push(finding(
        "project_linked_thought_mismatched_forward_link",
        "warning",
        { type: "project", id: project.id },
        "Project.linkedThoughtIds includes a thought whose Thought.projectId points elsewhere.",
        [project.id, thought.id, thought.projectId]
      ));
    }

    if (!hasGraphProjectMembershipEdge(state, thought.id, project.id)) {
      findings.push(finding(
        "direct_project_membership_without_graph_edge",
        "warning",
        { type: "project", id: project.id },
        "A direct Project.linkedThoughtIds membership exists without a graph belongs_to or related_to project edge.",
        [project.id, thought.id]
      ));
    }
  }

  for (const thought of state.thoughts) {
    if (thought.projectId !== project.id || projectDirectlyMentionsThought(project, thought.id)) continue;

    findings.push(finding(
      "thought_project_missing_reverse_link",
      "warning",
      { type: "thought", id: thought.id },
      "Thought.projectId points at the project, but Project.linkedThoughtIds lacks the thought.",
      [thought.id, project.id]
    ));

    if (!hasGraphProjectMembershipEdge(state, thought.id, project.id)) {
      findings.push(finding(
        "direct_project_membership_without_graph_edge",
        "warning",
        { type: "project", id: project.id },
        "A direct Thought.projectId membership exists without a graph belongs_to or related_to project edge.",
        [project.id, thought.id]
      ));
    }
  }

  for (const context of graphMemberships) {
    const thoughtId = context.otherEndpoint?.id;
    const thought = getById(index.thoughtById, thoughtId);
    if (!thought || projectHasDirectThoughtMembership(thought, project)) continue;

    findings.push(finding(
      "graph_project_membership_without_direct_membership",
      "warning",
      { type: "project", id: project.id },
      "A graph project membership edge exists without matching direct project membership refs.",
      [project.id, thought.id, context.relationship.id]
    ));
  }

  const validSourceThought = getById(index.thoughtById, project.sourceThoughtId);
  if (validSourceThought && !projectDirectlyMentionsThought(project, validSourceThought.id)) {
    findings.push(finding(
      "source_thought_not_linked_thought",
      "info",
      { type: "project", id: project.id },
      "Project.sourceThoughtId is provenance and is not treated as a linkedThoughtIds substitute.",
      [project.id, validSourceThought.id]
    ));
  }

  return findings;
}

function buildProjectContext(
  state: AppState,
  index: Readonly<DomainIndex>,
  project: Readonly<Project>
): ProjectRelationshipContext {
  const graphRelationships = graphRelationshipsForTarget(state, index, project.id, "project");
  const graphProjectMemberships = graphRelationships.filter((context) =>
    isProjectMembershipRelationship(context.relationship) && context.otherEndpoint?.resolvedType === "thought"
  );
  const directUniverse = getById(index.universeById, project.universeId);
  const sourceThought = getById(index.thoughtById, project.sourceThoughtId);
  const linkedThoughts = (project.linkedThoughtIds ?? []).map((thoughtId) => {
    const thought = getById(index.thoughtById, thoughtId);
    return {
      id: thoughtId,
      entity: thought,
      valid: Boolean(thought)
    };
  });
  const directMembershipRefs: ProjectDirectMembershipRefs = {
    universe: entityRef(project.universeId, directUniverse),
    linkedThoughts
  };
  const provenanceRefs: RelationshipContextProvenanceRefs = {
    sourceThought: entityRef(project.sourceThoughtId, sourceThought),
    sourceProjects: []
  };
  const findings = uniqueSortedFindings([
    ...orphanRelationshipFindings(graphRelationships),
    ...projectDirectRefFindings(index, state, project, graphProjectMemberships),
    ...graphUniverseDriftFindings(graphRelationships, { id: project.id, type: "project", universeId: project.universeId })
  ]);

  return {
    targetId: project.id,
    targetType: "project",
    target: project,
    graphRelationships,
    directMembershipRefs,
    provenanceRefs,
    blockersAndDependencies: blockersAndDependencies(graphRelationships),
    graphProjectMemberships,
    findings
  };
}

function invalidContext(
  targetId: string,
  targetType: "missing" | "unsupported",
  target: DomainNode | undefined
): InvalidRelationshipContext {
  return {
    targetId,
    targetType,
    target,
    graphRelationships: [],
    directMembershipRefs: {},
    provenanceRefs: { sourceProjects: [] },
    blockersAndDependencies: [],
    findings: [
      finding(
        targetType === "missing" ? "target_missing" : "target_unsupported",
        targetType === "missing" ? "error" : "warning",
        { type: targetType, id: targetId },
        targetType === "missing"
          ? "RelationshipContext target id does not resolve to a domain entity."
          : "RelationshipContext currently supports thought and project targets only.",
        [targetId].filter(Boolean)
      )
    ]
  };
}

export function buildRelationshipContext(state: AppState, targetId: string): RelationshipContext {
  const index = buildDomainIndex(state);
  const thought = getById(index.thoughtById, targetId);
  if (thought) return buildThoughtContext(state, index, thought);

  const project = getById(index.projectById, targetId);
  if (project) return buildProjectContext(state, index, project);

  const target = index.resolveNode(targetId);
  return invalidContext(targetId, target ? "unsupported" : "missing", target);
}

export function buildThoughtRelationshipContext(
  state: AppState,
  thoughtId: string
): ThoughtRelationshipContext | InvalidRelationshipContext {
  const context = buildRelationshipContext(state, thoughtId);
  return context.targetType === "thought" ? context : invalidContext(thoughtId, "missing", undefined);
}

export function buildProjectRelationshipContext(
  state: AppState,
  projectId: string
): ProjectRelationshipContext | InvalidRelationshipContext {
  const context = buildRelationshipContext(state, projectId);
  return context.targetType === "project" ? context : invalidContext(projectId, "missing", undefined);
}
