import type { AppState, Project, Relationship, RelationshipNodeType, ThoughtItem } from "./types";
import { id } from "./utils";

export type { RelationshipNodeType };

export type RelationshipNode = {
  id: string;
  type: RelationshipNodeType;
  title: string;
  status?: string;
  universeId?: string;
};

export type RelationshipExplorerEdge = {
  id: string;
  type: string;
  source: RelationshipNode;
  target: RelationshipNode;
  description?: string;
};

export type RelationshipImpactSummary = {
  node: RelationshipNode;
  incoming: RelationshipExplorerEdge[];
  outgoing: RelationshipExplorerEdge[];
  blockers: RelationshipExplorerEdge[];
  blocks: RelationshipExplorerEdge[];
  dependencies: RelationshipExplorerEdge[];
  supports: RelationshipExplorerEdge[];
  related: RelationshipExplorerEdge[];
};

export type RelationshipImpactResult =
  | { ok: true; summary: RelationshipImpactSummary }
  | { ok: false; error: string };

export type CreateRelationshipSafeInput = {
  sourceType: RelationshipNodeType;
  sourceId: string;
  targetType: RelationshipNodeType;
  targetId: string;
  type: Relationship["type"];
  description?: string;
};

export type CreateRelationshipSafeResult = {
  state: AppState;
  ok: boolean;
  relationshipId?: string;
  error?: string;
};

export type RelationshipListOptions = {
  searchText?: string;
  type?: Relationship["type"] | "all";
  sourceType?: RelationshipNodeType | "all";
  targetType?: RelationshipNodeType | "all";
  universeId?: string | "all";
};

const nodeTypes: RelationshipNodeType[] = ["thought", "project", "universe", "blocking_question", "decision_record"];
const relationshipTypes: Relationship["type"][] = [
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

function compareNodes(a: RelationshipNode, b: RelationshipNode) {
  return a.type.localeCompare(b.type) ||
    a.title.localeCompare(b.title) ||
    a.id.localeCompare(b.id);
}

function compareEdges(a: RelationshipExplorerEdge, b: RelationshipExplorerEdge) {
  return a.type.localeCompare(b.type) ||
    a.source.title.localeCompare(b.source.title) ||
    a.target.title.localeCompare(b.target.title) ||
    a.id.localeCompare(b.id);
}

function thoughtNode(thought: ThoughtItem): RelationshipNode {
  return {
    id: thought.id,
    type: "thought",
    title: clean(thought.title) || "Untitled thought",
    status: thought.status,
    universeId: thought.universeId
  };
}

function projectNode(project: Project): RelationshipNode {
  return {
    id: project.id,
    type: "project",
    title: clean(project.name) || "Untitled project",
    status: project.status,
    universeId: project.universeId
  };
}

export function listRelationshipNodes(state: AppState): RelationshipNode[] {
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

export function resolveRelationshipNode(
  state: AppState,
  nodeId: string,
  explicitType?: RelationshipNodeType
): RelationshipNode | undefined {
  const finders: Record<RelationshipNodeType, () => RelationshipNode | undefined> = {
    thought: () => {
      const thought = state.thoughts.find((item) => item.id === nodeId);
      return thought ? thoughtNode(thought) : undefined;
    },
    project: () => {
      const project = state.projects.find((item) => item.id === nodeId);
      return project ? projectNode(project) : undefined;
    },
    universe: () => {
      const universe = state.universes.find((item) => item.id === nodeId);
      return universe
        ? {
            id: universe.id,
            type: "universe",
            title: clean(universe.name) || "Untitled universe",
            status: universe.status ?? "active",
            universeId: universe.id
          }
        : undefined;
    },
    blocking_question: () => {
      const question = (state.blockingQuestions ?? []).find((item) => item.id === nodeId);
      return question
        ? {
            id: question.id,
            type: "blocking_question",
            title: clean(question.question) || "Untitled blocking question",
            status: question.status,
            universeId: firstValue(question.linkedUniverseIds)
          }
        : undefined;
    },
    decision_record: () => {
      const record = (state.decisionRecords ?? []).find((item) => item.id === nodeId);
      return record
        ? {
            id: record.id,
            type: "decision_record",
            title: clean(record.title) || "Untitled decision record",
            status: record.status,
            universeId: firstValue(record.linkedUniverseIds)
          }
        : undefined;
    }
  };

  if (explicitType) return finders[explicitType]();

  for (const type of nodeTypes) {
    const node = finders[type]();
    if (node) return node;
  }

  return undefined;
}

function missingNode(idValue: string, explicitType?: RelationshipNodeType): RelationshipNode {
  return {
    id: idValue,
    type: explicitType ?? "thought",
    title: "Missing node",
    status: "missing"
  };
}

function toEdge(state: AppState, relationship: Relationship): RelationshipExplorerEdge {
  const source = resolveRelationshipNode(state, relationship.sourceId, relationship.sourceType) ??
    missingNode(relationship.sourceId, relationship.sourceType);
  const target = resolveRelationshipNode(state, relationship.targetId, relationship.targetType) ??
    missingNode(relationship.targetId, relationship.targetType);

  return {
    id: relationship.id,
    type: relationship.type,
    source,
    target,
    description: relationship.description
  };
}

function nodeMatchesUniverse(state: AppState, node: RelationshipNode, universeId: string) {
  if (node.universeId === universeId || node.id === universeId) return true;

  if (node.type === "blocking_question") {
    return (state.blockingQuestions ?? [])
      .find((question) => question.id === node.id)
      ?.linkedUniverseIds?.includes(universeId) ?? false;
  }

  if (node.type === "decision_record") {
    return (state.decisionRecords ?? [])
      .find((record) => record.id === node.id)
      ?.linkedUniverseIds?.includes(universeId) ?? false;
  }

  return false;
}

export function listRelationshipEdges(
  state: AppState,
  options: RelationshipListOptions = {}
): RelationshipExplorerEdge[] {
  const searchText = clean(options.searchText).toLowerCase();
  const type = options.type ?? "all";
  const sourceType = options.sourceType ?? "all";
  const targetType = options.targetType ?? "all";
  const universeId = options.universeId ?? "all";

  return state.relationships
    .map((relationship) => toEdge(state, relationship))
    .filter((edge) => type === "all" || edge.type === type)
    .filter((edge) => sourceType === "all" || edge.source.type === sourceType)
    .filter((edge) => targetType === "all" || edge.target.type === targetType)
    .filter((edge) =>
      universeId === "all" ||
      nodeMatchesUniverse(state, edge.source, universeId) ||
      nodeMatchesUniverse(state, edge.target, universeId)
    )
    .filter((edge) => {
      if (!searchText) return true;

      return [
        edge.source.title,
        edge.target.title,
        edge.type,
        edge.description ?? ""
      ].join(" ").toLowerCase().includes(searchText);
    })
    .sort(compareEdges);
}

function isSameNode(edgeNode: RelationshipNode, node: RelationshipNode) {
  return edgeNode.id === node.id && edgeNode.type === node.type;
}

export function getRelationshipImpact(
  state: AppState,
  nodeId: string,
  nodeType?: RelationshipNodeType
): RelationshipImpactResult {
  const node = resolveRelationshipNode(state, nodeId, nodeType);

  if (!node) {
    return { ok: false, error: "Relationship node not found." };
  }

  const edges = listRelationshipEdges(state);
  const incoming = edges.filter((edge) => isSameNode(edge.target, node));
  const outgoing = edges.filter((edge) => isSameNode(edge.source, node));
  const connected = [...incoming, ...outgoing];

  return {
    ok: true,
    summary: {
      node,
      incoming,
      outgoing,
      blockers: incoming.filter((edge) => edge.type === "blocks"),
      blocks: outgoing.filter((edge) => edge.type === "blocks"),
      dependencies: connected.filter((edge) => edge.type === "depends_on"),
      supports: connected.filter((edge) => edge.type === "supports"),
      related: connected.filter((edge) => edge.type === "related_to")
    }
  };
}

export function listOrphanItems(state: AppState): { thoughts: ThoughtItem[]; projects: Project[] } {
  const linkedIds = new Set(state.relationships.flatMap((relationship) => [
    relationship.sourceId,
    relationship.targetId
  ]));

  return {
    thoughts: state.thoughts.filter((thought) =>
      thought.status !== "archived" && !linkedIds.has(thought.id)
    ),
    projects: state.projects.filter((project) =>
      project.status !== "archived" && !linkedIds.has(project.id)
    )
  };
}

function isSupportedRelationshipType(value: string): value is Relationship["type"] {
  return relationshipTypes.includes(value as Relationship["type"]);
}

export function createRelationshipSafe(
  state: AppState,
  input: CreateRelationshipSafeInput
): CreateRelationshipSafeResult {
  if (!isSupportedRelationshipType(input.type)) {
    return { state, ok: false, error: "Invalid relationship type." };
  }

  const source = resolveRelationshipNode(state, input.sourceId, input.sourceType);
  const target = resolveRelationshipNode(state, input.targetId, input.targetType);

  if (!source) {
    return { state, ok: false, error: "Source node not found." };
  }

  if (!target) {
    return { state, ok: false, error: "Target node not found." };
  }

  if (input.sourceId === input.targetId && input.sourceType === input.targetType) {
    return { state, ok: false, error: "Source and target must be different." };
  }

  const isDuplicate = state.relationships.some((relationship) =>
    relationship.sourceId === input.sourceId &&
    relationship.targetId === input.targetId &&
    relationship.type === input.type &&
    (relationship.sourceType ?? source.type) === input.sourceType &&
    (relationship.targetType ?? target.type) === input.targetType
  );

  if (isDuplicate) {
    return { state, ok: false, error: "Relationship already exists." };
  }

  const relationshipId = id("relationship");
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
