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
import { useI18n } from "../../i18n";
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
type Translate = (key: string, values?: Record<string, number | string>) => string;

function nodeTypeLabel(type: RelationshipNodeType, t: Translate) {
  return t(type);
}

function edgeLabel(edge: RelationshipExplorerEdge, t: Translate) {
  return `${edge.source.title} ${t(edge.type)} ${edge.target.title}`;
}

function typeOptions(t: Translate) {
  return nodeTypes.map((type) => (
    <option key={type} value={type}>{nodeTypeLabel(type, t)}</option>
  ));
}

function relationshipTypeOptions(t: Translate) {
  return relationshipTypes.map((type) => (
    <option key={type} value={type}>{t(type)}</option>
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
  const { t } = useI18n();

  return (
    <div className="mini-list impact-group">
      <strong>{t(title)}</strong>
      {edges.length === 0 ? (
        <p>{t(empty)}</p>
      ) : (
        <ul>
          {edges.map((edge) => (
            <li key={edge.id}>{edgeLabel(edge, t)}</li>
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
  const { t } = useI18n();

  return (
    <article className="card relationship-explorer-card">
      <div className="line">
        <strong>{edge.source.title}</strong>
        <span className="badge">{t(edge.source.type)}</span>
      </div>
      <div className="relationship-arrow">
        <span>{t(edge.type)}</span>
      </div>
      <div className="line">
        <strong>{edge.target.title}</strong>
        <span className="badge">{t(edge.target.type)}</span>
      </div>
      <p>{edge.description || t("No description yet.")}</p>
      <div className="actions">
        <button className="ghost" onClick={() => onViewRelationshipNode(edge.source)}>{t("View Source")}</button>
        <button className="ghost" onClick={() => onViewRelationshipNode(edge.target)}>{t("View Target")}</button>
      </div>
    </article>
  );
}

function ImpactMap({ summary }: { summary?: RelationshipImpactSummary }) {
  const { t } = useI18n();

  if (!summary) {
    return <div className="notice">{t("Select a node to inspect its impact.")}</div>;
  }

  return (
    <div className="stack">
      <div className="line">
        <strong>{summary.node.title}</strong>
        <span className="badge">{t(summary.node.type)}</span>
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
  const { t } = useI18n();
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
      setError(result.error ?? t("Relationship could not be created."));
      setNotice("");
      return;
    }

    setError("");
    setNotice(t("Relationship created."));
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
            <h2>{t("Relationship Explorer")}</h2>
            <p className="muted">{t("Explore how thoughts, projects, universes, blockers, and decisions affect each other.")}</p>
          </div>
        </div>
        <div className="metrics relationship-explorer-metrics">
          <Metric label={t("Total relationships")} value={allEdges.length} />
          <Metric label={t("Blocking relationships")} value={blockingCount} />
          <Metric label={t("Dependency relationships")} value={dependencyCount} />
          <Metric label={t("Orphan thoughts")} value={orphans.thoughts.length} />
          <Metric label={t("Orphan projects")} value={orphans.projects.length} />
        </div>
      </section>

      <section className="panel form">
        <div className="list-controls">
          <label>
            {t("Search")}
            <input
              aria-label={t("Search relationships")}
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={t("Search relationships")}
            />
          </label>
          <label>
            {t("Type filter")}
            <select
              aria-label={t("Relationship type filter")}
              value={type}
              onChange={(event) => setType(event.target.value as Relationship["type"] | "all")}
            >
              <option value="all">{t("All relationship types")}</option>
              {relationshipTypeOptions(t)}
            </select>
          </label>
          <label>
            {t("Source type filter")}
            <select
              aria-label={t("Source type filter")}
              value={sourceTypeFilter}
              onChange={(event) => setSourceTypeFilter(event.target.value as RelationshipNodeType | "all")}
            >
              <option value="all">{t("All source types")}</option>
              {typeOptions(t)}
            </select>
          </label>
          <label>
            {t("Target type filter")}
            <select
              aria-label={t("Target type filter")}
              value={targetTypeFilter}
              onChange={(event) => setTargetTypeFilter(event.target.value as RelationshipNodeType | "all")}
            >
              <option value="all">{t("All target types")}</option>
              {typeOptions(t)}
            </select>
          </label>
          <label>
            {t("Universe filter")}
            <select
              aria-label={t("Relationship universe filter")}
              value={universeId}
              onChange={(event) => setUniverseId(event.target.value)}
            >
              <option value="all">{t("All universes")}</option>
              {state.universes.map((universe) => (
                <option key={universe.id} value={universe.id}>{universe.name}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="panel form">
        <h2>{t("Create Relationship")}</h2>
        {error && <div className="warn">{error}</div>}
        {notice && <div className="notice">{notice}</div>}
        <div className="row relationship-create-row">
          <label>
            {t("Source type")}
            <select
              aria-label={t("Source type")}
              value={sourceType}
              onChange={(event) => setCreateSourceType(event.target.value as RelationshipNodeType)}
            >
              {typeOptions(t)}
            </select>
          </label>
          <label>
            {t("Source")}
            <select
              aria-label={t("Source")}
              value={safeSourceId}
              onChange={(event) => setSourceId(event.target.value)}
            >
              {sourceNodes.map((node) => (
                <option key={node.id} value={node.id}>{node.title}</option>
              ))}
            </select>
          </label>
          <label>
            {t("Relationship type")}
            <select
              aria-label={t("Relationship type")}
              value={relationshipType}
              onChange={(event) => setRelationshipType(event.target.value as Relationship["type"])}
            >
              {relationshipTypeOptions(t)}
            </select>
          </label>
          <label>
            {t("Target type")}
            <select
              aria-label={t("Target type")}
              value={targetType}
              onChange={(event) => setCreateTargetType(event.target.value as RelationshipNodeType)}
            >
              {typeOptions(t)}
            </select>
          </label>
          <label>
            {t("Target")}
            <select
              aria-label={t("Target")}
              value={safeTargetId}
              onChange={(event) => setTargetId(event.target.value)}
            >
              {targetNodes.map((node) => (
                <option key={node.id} value={node.id}>{node.title}</option>
              ))}
            </select>
          </label>
          <label>
            {t("Description")}
            <input
              aria-label={t("Description")}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
        </div>
        <div className="actions">
          <button onClick={create}>{t("Create Relationship")}</button>
        </div>
      </section>

      <section className="panel stack">
        <div className="head">
          <div>
            <h2>{t("Impact Map")}</h2>
            <p className="muted">{t("Inspect incoming, outgoing, blocking, dependency, support, and related links.")}</p>
          </div>
        </div>
        <div className="list-controls">
          <label>
            {t("Select node type")}
            <select
              aria-label={t("Select node type")}
              value={selectedNodeType}
              onChange={(event) => setImpactNodeType(event.target.value as RelationshipNodeType)}
            >
              {typeOptions(t)}
            </select>
          </label>
          <label>
            {t("Select node")}
            <select
              aria-label={t("Select node")}
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
            <h2>{t("Relationships")}</h2>
            <p className="muted">{t("{count} shown", { count: visibleEdges.length })}</p>
          </div>
        </div>
        {visibleEdges.length === 0 ? (
          <EmptyState>{t("No relationships match the current filters.")}</EmptyState>
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
          <h2>{t("Orphan thoughts")}</h2>
        </div>
        {orphans.thoughts.length === 0 ? (
          <EmptyState>{t("No orphan thoughts.")}</EmptyState>
        ) : (
          <div className="cards">
            {orphans.thoughts.map((item) => (
              <article className="card orphan-card" key={item.id}>
                <strong>{item.title}</strong>
                <p>{item.content || t("No content yet.")}</p>
                <button className="ghost" onClick={() => onViewRelationshipNode({
                  id: item.id,
                  type: "thought",
                  title: item.title,
                  status: item.status,
                  universeId: item.universeId
                })}>
                  {t("View")}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel stack">
        <div className="head">
          <h2>{t("Orphan projects")}</h2>
        </div>
        {orphans.projects.length === 0 ? (
          <EmptyState>{t("No orphan projects.")}</EmptyState>
        ) : (
          <div className="cards">
            {orphans.projects.map((item) => (
              <article className="card orphan-card" key={item.id}>
                <strong>{item.name}</strong>
                <p>{item.intent || t("No intent yet.")}</p>
                <button className="ghost" onClick={() => onViewRelationshipNode({
                  id: item.id,
                  type: "project",
                  title: item.name,
                  status: item.status,
                  universeId: item.universeId
                })}>
                  {t("View")}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
