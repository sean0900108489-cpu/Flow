import { useMemo, useState } from "react";
import type { AppState } from "../../domain/types";
import {
  buildUniversePackage,
  getUniverseOverview,
  type UniversePackage
} from "../../domain/universeOverview";
import { EmptyState } from "../common/EmptyState";
import { Metric } from "../common/Metric";

function sourceName(state: AppState, id: string) {
  return state.universes.find((universe) => universe.id === id)?.name ??
    state.thoughts.find((thought) => thought.id === id)?.title ??
    state.projects.find((project) => project.id === id)?.name ??
    id;
}

function packageJson(packageData: UniversePackage | undefined) {
  return packageData ? JSON.stringify(packageData, null, 2) : "";
}

export function UniverseDetailCenter({
  state,
  universeId,
  onViewThought,
  onViewProject,
  onOpenNextActionCenter,
  onOpenBlockingQuestions,
  onOpenDecisionRecords,
  onOpenRelationshipExplorer
}: {
  state: AppState;
  universeId: string;
  onViewThought: (thoughtId: string) => void;
  onViewProject: (projectId: string) => void;
  onOpenNextActionCenter: () => void;
  onOpenBlockingQuestions: () => void;
  onOpenDecisionRecords: () => void;
  onOpenRelationshipExplorer: () => void;
}) {
  const [notice, setNotice] = useState("");
  const result = useMemo(() => getUniverseOverview(state, universeId), [state, universeId]);
  const packageData = useMemo(() => {
    if (!result.ok) return undefined;

    return buildUniversePackage(state, universeId);
  }, [result, state, universeId]);
  const json = packageJson(packageData);

  const copyUniverseJson = () => {
    void navigator.clipboard?.writeText(json).catch(() => undefined);
    setNotice("Universe JSON copied");
  };

  const downloadUniverseJson = () => {
    if (!packageData) return;

    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `universe-package-${packageData.universe.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!result.ok || !packageData) {
    return (
      <section className="panel">
        <div className="head">
          <div>
            <h2>Universe Detail Center</h2>
            <p className="muted">Review all thoughts, projects, actions, blockers, and relationships inside this universe.</p>
          </div>
        </div>
        <EmptyState>Select a universe from Universes.</EmptyState>
        {!result.ok && <div className="warn">{result.error}</div>}
      </section>
    );
  }

  const { overview } = result;

  return (
    <div className="stack universe-detail">
      <section className="panel">
        <div className="head">
          <div>
            <h2>Universe Detail Center</h2>
            <div className="line universe-title-line">
              <h3>{overview.universeName}</h3>
              <span className="badge">{overview.universeStatus ?? "active"}</span>
            </div>
            <p className="muted">Review all thoughts, projects, actions, blockers, and relationships inside this universe.</p>
          </div>
          <div className="actions">
            <button className="ghost" onClick={copyUniverseJson}>Copy Universe JSON</button>
            <button className="ghost" onClick={downloadUniverseJson}>Download Universe JSON</button>
          </div>
        </div>

        {notice && <div className="notice">{notice}</div>}

        <div className="metrics universe-detail-metrics">
          <Metric label="Health score" value={overview.health.score} />
          <Metric label="Active thoughts" value={overview.summary.activeThoughts} />
          <Metric label="Active projects" value={overview.summary.activeProjects} />
          <Metric label="Next actions" value={overview.summary.nextActions} />
          <Metric label="Blocking questions" value={overview.summary.blockingQuestions} />
          <Metric label="Needs triage" value={overview.summary.needsTriage} />
          <Metric label="Handoff ready projects" value={overview.summary.handoffReadyProjects} />
          <Metric label="Relationships" value={overview.summary.relationships} />
        </div>

        <div className="card universe-health-card">
          <div className="line">
            <strong>Health summary</strong>
            <span className={`badge universe-health-${overview.health.label}`}>{overview.health.label}</span>
          </div>
          <p>Score: {overview.health.score}</p>
          <div className="mini-list">
            {overview.health.reasons.map((reason) => (
              <p key={reason}>{reason}</p>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="head">
          <h2>Thoughts in this universe</h2>
        </div>
        <div className="cards">
          {overview.thoughts.length === 0 ? (
            <EmptyState>No thoughts in this universe.</EmptyState>
          ) : (
            overview.thoughts.map((thought) => (
              <article className="card universe-thought-card" key={thought.id}>
                <div className="line">
                  <strong>{thought.title || "Untitled Thought"}</strong>
                  <span className="badge">{thought.status}</span>
                </div>
                <div className="chips">
                  <span>{thought.type}</span>
                  <span>{thought.nextAction ? "next action set" : "no next action"}</span>
                </div>
                <p>{thought.nextAction || "No next action set."}</p>
                <div className="actions">
                  <button className="ghost" onClick={() => onViewThought(thought.id)}>View Thought</button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="panel">
        <div className="head">
          <h2>Projects in this universe</h2>
        </div>
        <div className="cards">
          {overview.projects.length === 0 ? (
            <EmptyState>No projects in this universe.</EmptyState>
          ) : (
            overview.projects.map((project) => (
              <article className="card universe-project-card" key={project.id}>
                <div className="line">
                  <strong>{project.name || "Untitled Project"}</strong>
                  <span className="badge">{project.lifecycleStatus ?? project.status}</span>
                </div>
                <p>{project.nextAction || "No next action set."}</p>
                <div className="mini-list">
                  <p>Linked thoughts: {project.linkedThoughtIds?.length ?? 0}</p>
                </div>
                <div className="actions">
                  <button className="ghost" onClick={() => onViewProject(project.id)}>View Project</button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="panel">
        <div className="head">
          <h2>Next actions in this universe</h2>
          <button className="ghost" onClick={onOpenNextActionCenter}>Open Next Action Center</button>
        </div>
        <div className="cards">
          {overview.nextActions.length === 0 ? (
            <EmptyState>No next actions in this universe.</EmptyState>
          ) : (
            overview.nextActions.map((action) => (
              <article className="card universe-next-action-card" key={action.id}>
                <div className="line">
                  <strong>{action.title}</strong>
                  <span className={`badge next-action-${action.status}`}>{action.status}</span>
                </div>
                <div className="chips">
                  <span>{action.sourceType}</span>
                  {action.sourceStatus && <span>{action.sourceStatus}</span>}
                </div>
                <p>{action.actionText}</p>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="panel">
        <div className="head">
          <h2>Blocking questions in this universe</h2>
          <button className="ghost" onClick={onOpenBlockingQuestions}>Open Blocking Questions</button>
        </div>
        <div className="cards">
          {overview.blockingQuestions.length === 0 ? (
            <EmptyState>No blocking questions in this universe.</EmptyState>
          ) : (
            overview.blockingQuestions.map((question) => (
              <article className="card universe-blocking-question-card" key={question.id}>
                <div className="line">
                  <strong>{question.question}</strong>
                  <span className={`badge question-status-${question.status}`}>{question.status}</span>
                </div>
                <p>{question.proposedResolution || "No proposed resolution yet."}</p>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="panel">
        <div className="head">
          <h2>Decision records in this universe</h2>
          <button className="ghost" onClick={onOpenDecisionRecords}>Open Decision Records</button>
        </div>
        <div className="cards">
          {overview.decisionRecords.length === 0 ? (
            <EmptyState>No decision records in this universe.</EmptyState>
          ) : (
            overview.decisionRecords.map((decision) => (
              <article className="card universe-decision-record-card" key={decision.id}>
                <div className="line">
                  <strong>{decision.title}</strong>
                  <span className={`badge decision-status-${decision.status}`}>{decision.status}</span>
                </div>
                <p>{decision.decision}</p>
                <div className="actions">
                  <button className="ghost" onClick={onOpenDecisionRecords}>Open Decision Records</button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="panel">
        <div className="head">
          <h2>Relationships in this universe</h2>
          <button className="ghost" onClick={onOpenRelationshipExplorer}>Open Relationship Explorer</button>
        </div>
        <div className="cards">
          {overview.relationships.length === 0 ? (
            <EmptyState>No relationships in this universe.</EmptyState>
          ) : (
            overview.relationships.map((relationship) => (
              <article className="card universe-relationship-card" key={relationship.id}>
                <div className="line">
                  <strong>{relationship.type}</strong>
                  <span className="badge">{relationship.id}</span>
                </div>
                <p>{sourceName(state, relationship.sourceId)}{" -> "}{sourceName(state, relationship.targetId)}</p>
                <p>{relationship.description || "No description yet."}</p>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="panel">
        <div className="head">
          <h2>Export</h2>
        </div>
        <pre className="json" aria-label="Universe JSON preview">{json}</pre>
      </section>
    </div>
  );
}
