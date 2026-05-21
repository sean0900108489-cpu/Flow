import type { AppState, Project, Relationship, RelationshipNodeType, ThoughtItem } from "../types";
import { id } from "../utils";

export type RelationshipGraphNode = {
  id: string;
  type: RelationshipNodeType;
  title: string;
  status?: string;
  universeId?: string;
};

export type RelationshipEndpointStatus = "resolved" | "missing" | "ambiguous";

export type RelationshipEndpointResolution = {
  id: string;
  explicitType?: RelationshipNodeType;
  status: RelationshipEndpointStatus;
  node?: RelationshipGraphNode;
  candidates: RelationshipGraphNode[];
};

export type RelationshipGraphEdge = {
  id: string;
  type: Relationship["type"];
  source: RelationshipGraphNode;
  target: RelationshipGraphNode;
  sourceStatus: RelationshipEndpointStatus;
  targetStatus: RelationshipEndpointStatus;
  description?: string;
  relationship: Relationship;
};

export type RelationshipHealthWarning = {
  relationshipId: string;
  endpoint: "source" | "target";
  status: Exclude<RelationshipEndpointStatus, "resolved">;
  message: string;
};

export type RelationshipEndpointRepairResult = {
  state: AppState;
  repairedRelationshipIds: string[];
  orphanRelationshipIds: string[];
  warnings: RelationshipHealthWarning[];
};

export type RelationshipNodeRef = {
  id: string;
  type: RelationshipNodeType;
};

export type CreateRelationshipInput = {
  sourceType: RelationshipNodeType;
  sourceId: string;
  targetType: RelationshipNodeType;
  targetId: string;
  type: Relationship["type"];
  description?: string;
  idPrefix?: string;
};

export type CreateRelationshipResult = {
  state: AppState;
  ok: boolean;
  relationshipId?: string;
  error?: string;
};

export type RemoveRelationshipsResult = {
  state: AppState;
  removedRelationships: Relationship[];
};

export const relationshipNodeTypes: RelationshipNodeType[] = [
  "thought",
  "project",
  "universe",
  "blocking_question",
  "decision_record"
];

export const relationshipTypes: Relationship["type"][] = [
  "related_to",
  "belongs_to",
  "depends_on",
  "supports",
  "blocks",
  "evolves_into"
];

function clean(value: string | undefined) {
  return value?.trim() ?? "";
}

function firstValue(values: string[] | undefined) {
  return values?.find((value) => clean(value));
}

function compareNodes(a: RelationshipGraphNode, b: RelationshipGraphNode) {
  return a.type.localeCompare(b.type) ||
    a.title.localeCompare(b.title) ||
    a.id.localeCompare(b.id);
}

function thoughtNode(thought: ThoughtItem): RelationshipGraphNode {
  return {
    id: thought.id,
    type: "thought",
    title: clean(thought.title) || "Untitled thought",
    status: thought.status,
    universeId: thought.universeId
  };
}

function projectNode(project: Project): RelationshipGraphNode {
  return {
    id: project.id,
    type: "project",
    title: clean(project.name) || "Untitled project",
    status: project.status,
    universeId: project.universeId
  };
}

export function listRelationshipGraphNodes(state: AppState): RelationshipGraphNode[] {
  return [
    ...state.thoughts.map(thoughtNode),
    ...state.projects.map(projectNode),
    ...state.universes.map((universe) => ({
      id: universe.id,
      type: "universe" as const,
      title: clean(universe.name) || "Untitled universe",
      status: universe.status ?? "active",
      universeId: universe.id
    })),
    ...(state.blockingQuestions ?? []).map((question) => ({
      id: question.id,
      type: "blocking_question" as const,
      title: clean(question.question) || "Untitled blocking question",
      status: question.status,
      universeId: firstValue(question.linkedUniverseIds)
    })),
    ...(state.decisionRecords ?? []).map((record) => ({
      id: record.id,
      type: "decision_record" as const,
      title: clean(record.title) || "Untitled decision record",
      status: record.status,
      universeId: firstValue(record.linkedUniverseIds)
    }))
  ].sort(compareNodes);
}

export function findRelationshipGraphNodesById(state: AppState, nodeId: string): RelationshipGraphNode[] {
  return listRelationshipGraphNodes(state).filter((node) => node.id === nodeId);
}

export function resolveRelationshipNode(
  state: AppState,
  nodeId: string,
  explicitType?: RelationshipNodeType
): RelationshipGraphNode | undefined {
  if (explicitType) {
    return listRelationshipGraphNodes(state).find((node) => node.id === nodeId && node.type === explicitType);
  }

  for (const type of relationshipNodeTypes) {
    const node = listRelationshipGraphNodes(state).find((candidate) =>
      candidate.id === nodeId && candidate.type === type
    );

    if (node) return node;
  }

  return undefined;
}

export function resolveRelationshipEndpoint(
  state: AppState,
  nodeId: string,
  explicitType?: RelationshipNodeType
): RelationshipEndpointResolution {
  const candidates = explicitType
    ? listRelationshipGraphNodes(state).filter((node) => node.id === nodeId && node.type === explicitType)
    : findRelationshipGraphNodesById(state, nodeId);

  if (candidates.length === 0) {
    return { id: nodeId, explicitType, status: "missing", candidates: [] };
  }

  if (candidates.length > 1 && !explicitType) {
    return { id: nodeId, explicitType, status: "ambiguous", candidates };
  }

  return {
    id: nodeId,
    explicitType,
    status: "resolved",
    node: candidates[0],
    candidates
  };
}

function missingNode(idValue: string, explicitType?: RelationshipNodeType): RelationshipGraphNode {
  return {
    id: idValue,
    type: explicitType ?? "thought",
    title: "Missing node",
    status: "missing"
  };
}

export function relationshipToGraphEdge(state: AppState, relationship: Relationship): RelationshipGraphEdge {
  const sourceResolution = resolveRelationshipEndpoint(state, relationship.sourceId, relationship.sourceType);
  const targetResolution = resolveRelationshipEndpoint(state, relationship.targetId, relationship.targetType);

  return {
    id: relationship.id,
    type: relationship.type,
    source: sourceResolution.node ?? missingNode(relationship.sourceId, relationship.sourceType),
    target: targetResolution.node ?? missingNode(relationship.targetId, relationship.targetType),
    sourceStatus: sourceResolution.status,
    targetStatus: targetResolution.status,
    description: relationship.description,
    relationship
  };
}

export function listRelationshipGraphEdges(state: AppState): RelationshipGraphEdge[] {
  return state.relationships.map((relationship) => relationshipToGraphEdge(state, relationship));
}

export function isSupportedRelationshipType(value: string): value is Relationship["type"] {
  return relationshipTypes.includes(value as Relationship["type"]);
}

function endpointMatchesNode(endpointId: string, endpointType: RelationshipNodeType | undefined, node: RelationshipNodeRef) {
  if (endpointId !== node.id) return false;

  return endpointType === undefined || endpointType === node.type;
}

export function relationshipTouchesNode(relationship: Relationship, node: RelationshipNodeRef) {
  return endpointMatchesNode(relationship.sourceId, relationship.sourceType, node) ||
    endpointMatchesNode(relationship.targetId, relationship.targetType, node);
}

export function relationshipTargetsNode(relationship: Relationship, node: RelationshipNodeRef) {
  return endpointMatchesNode(relationship.targetId, relationship.targetType, node);
}

export function relationshipSourcesNode(relationship: Relationship, node: RelationshipNodeRef) {
  return endpointMatchesNode(relationship.sourceId, relationship.sourceType, node);
}

export function listRelationshipsTouchingNode(state: AppState, node: RelationshipNodeRef) {
  return state.relationships.filter((relationship) => relationshipTouchesNode(relationship, node));
}

export function listRelationshipsTouchingAnyNode(state: AppState, nodes: RelationshipNodeRef[]) {
  return state.relationships.filter((relationship) =>
    nodes.some((node) => relationshipTouchesNode(relationship, node))
  );
}

export function createTypedRelationship(
  state: AppState,
  input: CreateRelationshipInput
): CreateRelationshipResult {
  if (!isSupportedRelationshipType(input.type)) {
    return { state, ok: false, error: "Invalid relationship type." };
  }

  const source = resolveRelationshipEndpoint(state, input.sourceId, input.sourceType);
  const target = resolveRelationshipEndpoint(state, input.targetId, input.targetType);

  if (source.status !== "resolved") {
    return { state, ok: false, error: "Source node not found." };
  }

  if (target.status !== "resolved") {
    return { state, ok: false, error: "Target node not found." };
  }

  if (input.sourceId === input.targetId && input.sourceType === input.targetType) {
    return { state, ok: false, error: "Source and target must be different." };
  }

  const isDuplicate = state.relationships.some((relationship) =>
    relationship.sourceId === input.sourceId &&
    relationship.targetId === input.targetId &&
    relationship.type === input.type &&
    (relationship.sourceType ?? source.node?.type) === input.sourceType &&
    (relationship.targetType ?? target.node?.type) === input.targetType
  );

  if (isDuplicate) {
    return { state, ok: false, error: "Relationship already exists." };
  }

  const relationshipId = id(input.idPrefix ?? "relationship");
  const relationship: Relationship = {
    id: relationshipId,
    sourceId: input.sourceId,
    sourceType: input.sourceType,
    targetId: input.targetId,
    targetType: input.targetType,
    type: input.type,
    description: clean(input.description)
  };

  return {
    state: {
      ...state,
      relationships: [relationship, ...state.relationships]
    },
    ok: true,
    relationshipId
  };
}

function endpointWarning(
  relationship: Relationship,
  endpoint: "source" | "target",
  status: Exclude<RelationshipEndpointStatus, "resolved">
): RelationshipHealthWarning {
  const endpointId = endpoint === "source" ? relationship.sourceId : relationship.targetId;

  return {
    relationshipId: relationship.id,
    endpoint,
    status,
    message: `Relationship ${relationship.id} has ${status} ${endpoint} endpoint: ${endpointId}.`
  };
}

export function repairRelationshipEndpointTypes(state: AppState): RelationshipEndpointRepairResult {
  const warnings: RelationshipHealthWarning[] = [];
  const repairedRelationshipIds: string[] = [];
  const orphanRelationshipIds: string[] = [];
  const relationships = state.relationships.map((relationship) => {
    const source = resolveRelationshipEndpoint(state, relationship.sourceId, relationship.sourceType);
    const target = resolveRelationshipEndpoint(state, relationship.targetId, relationship.targetType);

    if (source.status !== "resolved") {
      warnings.push(endpointWarning(relationship, "source", source.status));
    }

    if (target.status !== "resolved") {
      warnings.push(endpointWarning(relationship, "target", target.status));
    }

    if (source.status !== "resolved" || target.status !== "resolved") {
      orphanRelationshipIds.push(relationship.id);
      return relationship;
    }

    if (!source.node || !target.node) return relationship;

    const repaired: Relationship = {
      ...relationship,
      sourceType: relationship.sourceType ?? source.node.type,
      targetType: relationship.targetType ?? target.node.type
    };

    if (repaired.sourceType !== relationship.sourceType || repaired.targetType !== relationship.targetType) {
      repairedRelationshipIds.push(relationship.id);
    }

    return repaired;
  });

  return {
    state: {
      ...state,
      relationships
    },
    repairedRelationshipIds,
    orphanRelationshipIds,
    warnings
  };
}

export function listOrphanRelationships(state: AppState) {
  return state.relationships.filter((relationship) => {
    const source = resolveRelationshipEndpoint(state, relationship.sourceId, relationship.sourceType);
    const target = resolveRelationshipEndpoint(state, relationship.targetId, relationship.targetType);

    return source.status !== "resolved" || target.status !== "resolved";
  });
}

export function removeRelationshipsForNode(
  state: AppState,
  node: RelationshipNodeRef
): RemoveRelationshipsResult {
  const removedRelationships = state.relationships.filter((relationship) => relationshipTouchesNode(relationship, node));

  return {
    state: {
      ...state,
      relationships: state.relationships.filter((relationship) => !relationshipTouchesNode(relationship, node))
    },
    removedRelationships
  };
}
