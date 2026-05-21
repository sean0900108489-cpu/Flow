import { useMemo, useState } from "react";
import type { AppState, Relationship, RelationshipNodeType } from "../../domain/types";
import {
  getRelationshipImpact,
  listOrphanItems,
  listRelationshipEdges,
  listRelationshipNodes,
  type CreateRelationshipSafeInput,
  type CreateRelationshipSafeResult,
  type RelationshipExplorerEdge,
  type RelationshipImpactSummary,
  type RelationshipNode
} from "../../domain/relationshipExplorer";
import { EmptyState } from "../common/EmptyState";
import { Metric } from "../common/Metric";

const nodeTypes: RelationshipNodeType[] = ["thought", "project", "universe", "blocking_question", "decision_record"];
const relationshipTypes: Relationship["type"][] = [
  "related_to",
  "belongs_to",
  "depends_on",
  "supports",
  "blocks",
  "evolves_into"
];

function nodeTypeLabel(type: RelationshipNodeType) {
  return type;
}

function edgeLabel(edge: RelationshipExplorerEdge) {
  return `${edge.source.title} ${edge.type} ${edge.target.title}`;
}

function typeOptions() {
  return nodeTypes.map((type) => (
    <option key={type} value={type}>{nodeTypeLabel(type)}</option>
  ));
}

function relationshipTypeOptions() {
  return relationshipTypes.map((type) => (
    <option key={type} value={type}>{type}</option>
  ));
}

function EdgeList({
  title,
  edges,
  empty
}: {
  title: string;
  edges: RelationshipExplorerEdge[];
  empty: string;
}) {
  return (
    <div className="mini-list impact-group">
      <strong>{title}</strong>
      {edges.length === 0 ? (
        <p>{empty}</p>
      ) : (
        <ul>
          {edges.map((edge) => (
            <li key={edge.id}>{edgeLabel(edge)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RelationshipCard({
  edge,
  onViewRelationshipNode
}: {
  edge: RelationshipExplorerEdge;
  onViewRelationshipNode: (node: RelationshipNode) => void;
}) {
  return (
    <article className="card relationship-explorer-card">
      <div className="line">
        <strong>{edge.source.title}</strong>
        <span className="badge">{edge.source.type}</span>
      </div>
      <div className="relationship-arrow">
        <span>{edge.type}</span>
      </div>
      <div className="line">
        <strong>{edge.target.title}</strong>
        <span className="badge">{edge.target.type}</span>
      </div>
      <p>{edge.description || "No description yet."}</p>
      <div className="actions">
        <button className="ghost" onClick={() => onViewRelationshipNode(edge.source)}>View Source</button>
        <button className="ghost" onClick={() => onViewRelationshipNode(edge.target)}>View Target</button>
      </div>
    </article>
  );
}

function ImpactMap({ summary }: { summary?: RelationshipImpactSummary }) {
  if (!summary) {
    return <div className="notice">Select a node to inspect its impact.</div>;
  }

  return (
    <div className="stack">
      <div className="line">
        <strong>{summary.node.title}</strong>
        <span className="badge">{summary.node.type}</span>
      </div>
      <div className="grid two">
        <EdgeList title="Incoming relationships" edges={summary.incoming} empty="No incoming relationships." />
        <EdgeList title="Outgoing relationships" edges={summary.outgoing} empty="No outgoing relationships." />
        <EdgeList title="Blocked by" edges={summary.blockers} empty="No blockers." />
        <EdgeList title="Blocks" edges={summary.blocks} empty="This node does not block anything." />
        <EdgeList title="Dependencies" edges={summary.dependencies} empty="No dependencies." />
        <EdgeList title="Supports" edges={summary.supports} empty="No supports." />
        <EdgeList title="Related" edges={summary.related} empty="No related relationships." />
      </div>
    </div>
  );
}

export function RelationshipExplorer({
  state,
  onCreateRelationshipSafe,
  onViewRelationshipNode
}: {
  state: AppState;
  onCreateRelationshipSafe: (input: CreateRelationshipSafeInput) => CreateRelationshipSafeResult;
  onViewRelationshipNode: (node: RelationshipNode) => void;
}) {
  const [searchText, setSearchText] = useState("");
  const [type, setType] = useState<Relationship["type"] | "all">("all");
  const [sourceTypeFilter, setSourceTypeFilter] = useState<RelationshipNodeType | "all">("all");
  const [targetTypeFilter, setTargetTypeFilter] = useState<RelationshipNodeType | "all">("all");
  const [universeId, setUniverseId] = useState<string | "all">("all");
  const [sourceType, setSourceType] = useState<RelationshipNodeType>("thought");
  const [targetType, setTargetType] = useState<RelationshipNodeType>("project");
  const [relationshipType, setRelationshipType] = useState<Relationship["type"]>("related_to");
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [description, setDescription] = useState("");
  const [selectedNodeType, setSelectedNodeType] = useState<RelationshipNodeType>("project");
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const nodes = useMemo(() => listRelationshipNodes(state), [state]);
  const allEdges = useMemo(() => listRelationshipEdges(state), [state]);
  const visibleEdges = useMemo(
    () => listRelationshipEdges(state, {
      searchText,
      type,
      sourceType: sourceTypeFilter,
      targetType: targetTypeFilter,
      universeId
    }),
    [searchText, sourceTypeFilter, state, targetTypeFilter, type, universeId]
  );
  const orphans = useMemo(() => listOrphanItems(state), [state]);
  const nodesByType = useMemo(() => {
    return nodeTypes.reduce((grouped, itemType) => {
      grouped[itemType] = nodes.filter((node) => node.type === itemType);
      return grouped;
    }, {} as Record<RelationshipNodeType, RelationshipNode[]>);
  }, [nodes]);

  const sourceNodes = nodesByType[sourceType] ?? [];
  const targetNodes = nodesByType[targetType] ?? [];
  const selectedNodes = nodesByType[selectedNodeType] ?? [];
  const safeSourceId = sourceId || sourceNodes[0]?.id || "";
  const safeTargetId = targetId || targetNodes[0]?.id || "";
  const safeSelectedNodeId = selectedNodeId || selectedNodes[0]?.id || "";
  const impact = safeSelectedNodeId ? getRelationshipImpact(state, safeSelectedNodeId, selectedNodeType) : undefined;

  const setCreateSourceType = (nextType: RelationshipNodeType) => {
    setSourceType(nextType);
    setSourceId(nodesByType[nextType]?.[0]?.id ?? "");
  };

  const setCreateTargetType = (nextType: RelationshipNodeType) => {
    setTargetType(nextType);
    setTargetId(nodesByType[nextType]?.[0]?.id ?? "");
  };

  const setImpactNodeType = (nextType: RelationshipNodeType) => {
    setSelectedNodeType(nextType);
    setSelectedNodeId(nodesByType[nextType]?.[0]?.id ?? "");
  };

  const create = () => {
    const result = onCreateRelationshipSafe({
      sourceType,
      sourceId: safeSourceId,
      type: relationshipType,
      targetType,
      targetId: safeTargetId,
      description
    });

    if (!result.ok) {
      setError(result.error ?? "Relationship could not be created.");
      setNotice("");
      return;
    }

    setError("");
    setNotice("Relationship created.");
    setDescription("");
    setSelectedNodeType(targetType);
    setSelectedNodeId(safeTargetId);
  };

  const blockingCount = allEdges.filter((edge) => edge.type === "blocks").length;
  const dependencyCount = allEdges.filter((edge) => edge.type === "depends_on").length;

  return (
    <div className="stack relationship-explorer">
      <section className="panel hero">
        <div className="head">
          <div>
            <h2>Relationship Explorer</h2>
            <p className="muted">Explore how thoughts, projects, universes, blockers, and decisions affect each other.</p>
          </div>
        </div>
        <div className="metrics relationship-explorer-metrics">
          <Metric label="Total relationships" value={allEdges.length} />
          <Metric label="Blocking relationships" value={blockingCount} />
          <Metric label="Dependency relationships" value={dependencyCount} />
          <Metric label="Orphan thoughts" value={orphans.thoughts.length} />
          <Metric label="Orphan projects" value={orphans.projects.length} />
        </div>
      </section>

      <section className="panel form">
        <div className="list-controls">
          <label>
            Search
            <input
              aria-label="Search relationships"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search relationships"
            />
          </label>
          <label>
            Type filter
            <select
              aria-label="Relationship type filter"
              value={type}
              onChange={(event) => setType(event.target.value as Relationship["type"] | "all")}
            >
              <option value="all">All relationship types</option>
              {relationshipTypeOptions()}
            </select>
          </label>
          <label>
            Source type filter
            <select
              aria-label="Source type filter"
              value={sourceTypeFilter}
              onChange={(event) => setSourceTypeFilter(event.target.value as RelationshipNodeType | "all")}
            >
              <option value="all">All source types</option>
              {typeOptions()}
            </select>
          </label>
          <label>
            Target type filter
            <select
              aria-label="Target type filter"
              value={targetTypeFilter}
              onChange={(event) => setTargetTypeFilter(event.target.value as RelationshipNodeType | "all")}
            >
              <option value="all">All target types</option>
              {typeOptions()}
            </select>
          </label>
          <label>
            Universe filter
            <select
              aria-label="Relationship universe filter"
              value={universeId}
              onChange={(event) => setUniverseId(event.target.value)}
            >
              <option value="all">All universes</option>
              {state.universes.map((universe) => (
                <option key={universe.id} value={universe.id}>{universe.name}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="panel form">
        <h2>Create Relationship</h2>
        {error && <div className="warn">{error}</div>}
        {notice && <div className="notice">{notice}</div>}
        <div className="row relationship-create-row">
          <label>
            Source type
            <select
              aria-label="Source type"
              value={sourceType}
              onChange={(event) => setCreateSourceType(event.target.value as RelationshipNodeType)}
            >
              {typeOptions()}
            </select>
          </label>
          <label>
            Source
            <select
              aria-label="Source"
              value={safeSourceId}
              onChange={(event) => setSourceId(event.target.value)}
            >
              {sourceNodes.map((node) => (
                <option key={node.id} value={node.id}>{node.title}</option>
              ))}
            </select>
          </label>
          <label>
            Relationship type
            <select
              aria-label="Relationship type"
              value={relationshipType}
              onChange={(event) => setRelationshipType(event.target.value as Relationship["type"])}
            >
              {relationshipTypeOptions()}
            </select>
          </label>
          <label>
            Target type
            <select
              aria-label="Target type"
              value={targetType}
              onChange={(event) => setCreateTargetType(event.target.value as RelationshipNodeType)}
            >
              {typeOptions()}
            </select>
          </label>
          <label>
            Target
            <select
              aria-label="Target"
              value={safeTargetId}
              onChange={(event) => setTargetId(event.target.value)}
            >
              {targetNodes.map((node) => (
                <option key={node.id} value={node.id}>{node.title}</option>
              ))}
            </select>
          </label>
          <label>
            Description
            <input
              aria-label="Description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
        </div>
        <div className="actions">
          <button onClick={create}>Create Relationship</button>
        </div>
      </section>

      <section className="panel stack">
        <div className="head">
          <div>
            <h2>Impact Map</h2>
            <p className="muted">Inspect incoming, outgoing, blocking, dependency, support, and related links.</p>
          </div>
        </div>
        <div className="list-controls">
          <label>
            Select node type
            <select
              aria-label="Select node type"
              value={selectedNodeType}
              onChange={(event) => setImpactNodeType(event.target.value as RelationshipNodeType)}
            >
              {typeOptions()}
            </select>
          </label>
          <label>
            Select node
            <select
              aria-label="Select node"
              value={safeSelectedNodeId}
              onChange={(event) => setSelectedNodeId(event.target.value)}
            >
              {selectedNodes.map((node) => (
                <option key={node.id} value={node.id}>{node.title}</option>
              ))}
            </select>
          </label>
        </div>
        {impact?.ok === false && <div className="warn">{impact.error}</div>}
        <ImpactMap summary={impact?.ok ? impact.summary : undefined} />
      </section>

      <section className="panel stack">
        <div className="head">
          <div>
            <h2>Relationships</h2>
            <p className="muted">{visibleEdges.length} shown</p>
          </div>
        </div>
        {visibleEdges.length === 0 ? (
          <EmptyState>No relationships match the current filters.</EmptyState>
        ) : (
          <div className="cards">
            {visibleEdges.map((edge) => (
              <RelationshipCard
                key={edge.id}
                edge={edge}
                onViewRelationshipNode={onViewRelationshipNode}
              />
            ))}
          </div>
        )}
      </section>

      <section className="panel stack">
        <div className="head">
          <h2>Orphan thoughts</h2>
        </div>
        {orphans.thoughts.length === 0 ? (
          <EmptyState>No orphan thoughts.</EmptyState>
        ) : (
          <div className="cards">
            {orphans.thoughts.map((item) => (
              <article className="card orphan-card" key={item.id}>
                <strong>{item.title}</strong>
                <p>{item.content || "No content yet."}</p>
                <button className="ghost" onClick={() => onViewRelationshipNode({
                  id: item.id,
                  type: "thought",
                  title: item.title,
                  status: item.status,
                  universeId: item.universeId
                })}>
                  View
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel stack">
        <div className="head">
          <h2>Orphan projects</h2>
        </div>
        {orphans.projects.length === 0 ? (
          <EmptyState>No orphan projects.</EmptyState>
        ) : (
          <div className="cards">
            {orphans.projects.map((item) => (
              <article className="card orphan-card" key={item.id}>
                <strong>{item.name}</strong>
                <p>{item.intent || "No intent yet."}</p>
                <button className="ghost" onClick={() => onViewRelationshipNode({
                  id: item.id,
                  type: "project",
                  title: item.name,
                  status: item.status,
                  universeId: item.universeId
                })}>
                  View
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
