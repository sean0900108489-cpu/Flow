import type { AppState, Project, Relationship, RelationshipNodeType, ThoughtItem } from "./types";
import {
  createTypedRelationship,
  listRelationshipGraphEdges,
  listRelationshipGraphNodes,
  listRelationshipsTouchingNode,
  resolveRelationshipNode,
  type RelationshipGraphEdge,
  type RelationshipGraphNode
} from "./relationships/relationshipGraph";
import { isProjectArchived } from "./semantics/projectSemantics";
import { isThoughtArchived } from "./semantics/statusSemantics";

export type { RelationshipNodeType };
export { resolveRelationshipNode };

export type RelationshipNode = RelationshipGraphNode;
export type RelationshipExplorerEdge = RelationshipGraphEdge;

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

function clean(value: string | undefined) {
  return value?.trim() ?? "";
}

function compareEdges(a: RelationshipExplorerEdge, b: RelationshipExplorerEdge) {
  return a.type.localeCompare(b.type) ||
    a.source.title.localeCompare(b.source.title) ||
    a.target.title.localeCompare(b.target.title) ||
    a.id.localeCompare(b.id);
}

export function listRelationshipNodes(state: AppState): RelationshipNode[] {
  return listRelationshipGraphNodes(state);
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

  return listRelationshipGraphEdges(state)
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
  return {
    thoughts: state.thoughts.filter((thought) =>
      !isThoughtArchived(thought) && listRelationshipsTouchingNode(state, { id: thought.id, type: "thought" }).length === 0
    ),
    projects: state.projects.filter((project) =>
      !isProjectArchived(project) && listRelationshipsTouchingNode(state, { id: project.id, type: "project" }).length === 0
    )
  };
}

export function createRelationshipSafe(
  state: AppState,
  input: CreateRelationshipSafeInput
): CreateRelationshipSafeResult {
  return createTypedRelationship(state, input);
}
