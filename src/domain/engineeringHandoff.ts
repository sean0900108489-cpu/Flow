import { engineeringInput } from "../services/exportEngineeringInput";
import { now } from "./utils";
import { readiness as projectReadiness } from "./readiness";
import type { AppState, Project, Relationship, ThoughtItem } from "./types";

export type ProjectHandoffReadiness = "ready" | "needs_clarification" | "blocked";

export interface ProjectHandoffStatus {
  projectId: string;
  readiness: ProjectHandoffReadiness;
  score: number;
  missing: string[];
  warnings: string[];
  summary: string;
}

export interface ProjectHandoffPackage {
  kind: "EngineeringFlowInput";
  version: "0.1";
  project: Project;
  engineeringInput: ReturnType<typeof engineeringInput>;
  linkedThoughts: ThoughtItem[];
  relationships: Relationship[];
  readiness: ProjectHandoffStatus;
  generatedAt: string;
}

export interface MarkProjectHandoffReadyResult {
  ok: boolean;
  state: AppState;
  error?: string;
}

const unique = (items: string[]) => Array.from(new Set(items));

function linkedThoughts(project: Project, state: AppState) {
  const linkedThoughtIds = project.linkedThoughtIds ?? [];
  const relatedThoughtIds = state.relationships.flatMap((relationship) => {
    if (relationship.sourceId === project.id) return [relationship.targetId];
    if (relationship.targetId === project.id) return [relationship.sourceId];
    return [];
  });

  return state.thoughts.filter((thought) =>
    linkedThoughtIds.includes(thought.id) ||
    thought.projectId === project.id ||
    thought.id === project.sourceThoughtId ||
    relatedThoughtIds.includes(thought.id)
  );
}

function projectRelationships(project: Project, thoughts: ThoughtItem[], state: AppState) {
  const ids = new Set([project.id, ...thoughts.map((thought) => thought.id)]);

  return state.relationships.filter((relationship) =>
    ids.has(relationship.sourceId) || ids.has(relationship.targetId)
  );
}

function hasBlockingRelationship(project: Project, state: AppState) {
  return state.relationships.some((relationship) =>
    relationship.type === "blocks" && relationship.targetId === project.id
  );
}

export function evaluateProjectHandoff(project: Project, state: AppState): ProjectHandoffStatus {
  const thoughts = linkedThoughts(project, state);
  const existingReadiness = projectReadiness(project);
  const missing: string[] = [...existingReadiness.missing];
  const warnings: string[] = [];

  const hasTitle = project.name.trim().length > 0;
  const hasDescription = project.intent.trim().length > 0 ||
    thoughts.some((thought) => thought.content.trim().length > 0 || thought.outcome.trim().length > 0);
  const hasNextAction = project.nextAction.trim().length > 0;
  const hasUniverse = project.universeId.trim().length > 0 ||
    thoughts.some((thought) => thought.universeId.trim().length > 0);
  const isArchived = project.status === "archived";
  const isLifecycleBlocked = project.lifecycleStatus === "blocked";
  const isBlockedByRelationship = hasBlockingRelationship(project, state);

  if (!hasTitle) missing.push("title");
  if (!hasDescription) missing.push("description");
  if (!hasNextAction) missing.push("nextAction");
  if (!hasUniverse) missing.push("universe");
  if (isArchived) warnings.push("Project is archived.");
  if (isLifecycleBlocked) warnings.push("Project lifecycle is blocked.");
  if (isBlockedByRelationship) warnings.push("Project has a blocking relationship.");

  const handoffChecks = [hasTitle, hasDescription, hasNextAction, hasUniverse, !isArchived, !isBlockedByRelationship, !isLifecycleBlocked];
  const handoffScore = Math.round((handoffChecks.filter(Boolean).length / handoffChecks.length) * 100);
  let score = Math.round((existingReadiness.score + handoffScore) / 2);
  let readiness: ProjectHandoffReadiness = "needs_clarification";

  if (!hasTitle || isArchived || isLifecycleBlocked || isBlockedByRelationship) {
    readiness = "blocked";
    score = Math.min(score, isArchived ? 20 : 45);
  } else if (unique(missing).length === 0 && existingReadiness.value === "ready_for_engineering") {
    readiness = "ready";
    score = 100;
  }

  const summary =
    readiness === "ready"
      ? "Project has enough structure to export a handoff package."
      : readiness === "blocked"
        ? "Project cannot enter engineering handoff until blockers are resolved."
        : "Project needs more clarification before handoff.";

  return {
    projectId: project.id,
    readiness,
    score,
    missing: unique(missing),
    warnings,
    summary
  };
}

export function listProjectHandoffStatuses(state: AppState) {
  return state.projects.map((project) => evaluateProjectHandoff(project, state));
}

export function buildProjectHandoffPackage(projectId: string, state: AppState): ProjectHandoffPackage {
  const project = state.projects.find((item) => item.id === projectId);

  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const universe = state.universes.find((item) => item.id === project.universeId);
  const thoughts = linkedThoughts(project, state);

  return {
    kind: "EngineeringFlowInput",
    version: "0.1",
    project,
    engineeringInput: engineeringInput(project, universe),
    linkedThoughts: thoughts,
    relationships: projectRelationships(project, thoughts, state),
    readiness: evaluateProjectHandoff(project, state),
    generatedAt: now()
  };
}

export function markProjectHandoffReady(state: AppState, projectId: string): MarkProjectHandoffReadyResult {
  const project = state.projects.find((item) => item.id === projectId);

  if (!project) {
    return { ok: false, state, error: "Project not found." };
  }

  const status = evaluateProjectHandoff(project, state);

  if (status.readiness !== "ready") {
    return { ok: false, state, error: "Project is not ready for engineering handoff." };
  }

  return {
    ok: true,
    state: {
      ...state,
      projects: state.projects.map((item) =>
        item.id === projectId
          ? { ...item, lifecycleStatus: "handoff_ready", readiness: "ready_for_engineering", updatedAt: now() }
          : item
      )
    }
  };
}
