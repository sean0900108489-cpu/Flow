import { readiness } from "../readiness";
import { relationshipTargetsNode } from "../relationships/relationshipGraph";
import type { AppState, Project, ProjectLifecycleStatus, Readiness, Relationship } from "../types";
import { blockingQuestionAffectsProjectHandoff } from "./questionDecisionSemantics";

export interface ProjectContentReadiness {
  score: number;
  value: Readiness;
  missing: string[];
}

export function projectLifecycleStatus(project: Pick<Project, "lifecycleStatus">): ProjectLifecycleStatus {
  return project.lifecycleStatus ?? "planning";
}

export function isProjectArchived(project: Pick<Project, "status">) {
  return project.status === "archived";
}

export function isProjectActive(project: Pick<Project, "status">) {
  return !isProjectArchived(project);
}

export function isProjectLifecycleBlocked(project: Pick<Project, "lifecycleStatus">) {
  return projectLifecycleStatus(project) === "blocked";
}

export function isProjectLifecycleHandoffReady(project: Pick<Project, "lifecycleStatus">) {
  return projectLifecycleStatus(project) === "handoff_ready";
}

export function isProjectReadyForEngineering(project: Pick<Project, "readiness">) {
  return project.readiness === "ready_for_engineering";
}

export function getProjectContentReadiness(project: Project): ProjectContentReadiness {
  return readiness(project);
}

export function hasBlockingRelationshipToProject(project: Pick<Project, "id">, relationships: Relationship[]) {
  return relationships.some((relationship) =>
    relationship.type === "blocks" &&
    relationshipTargetsNode(relationship, { id: project.id, type: "project" })
  );
}

export function getProjectUnresolvedHandoffQuestions(project: Pick<Project, "id">, state: AppState) {
  return (state.blockingQuestions ?? []).filter((question) =>
    blockingQuestionAffectsProjectHandoff(question, project.id)
  );
}

export function isProjectBlocked(project: Project, state?: AppState) {
  if (isProjectLifecycleBlocked(project)) return true;

  if (!state) return false;

  return hasBlockingRelationshipToProject(project, state.relationships) ||
    getProjectUnresolvedHandoffQuestions(project, state).length > 0;
}

export function canProjectEnterEngineeringHandoff(project: Project, state?: AppState) {
  return isProjectActive(project) &&
    !isProjectBlocked(project, state) &&
    getProjectContentReadiness(project).value === "ready_for_engineering";
}

export function shouldProjectAppearInHandoffReviewQueue(
  project: Project,
  contentReadiness: ProjectContentReadiness = getProjectContentReadiness(project)
) {
  return isProjectActive(project) &&
    !isProjectLifecycleHandoffReady(project) &&
    contentReadiness.value === "ready_for_engineering";
}

export function shouldProjectAppearInNextAction(project: Pick<Project, "status" | "nextAction">) {
  return isProjectActive(project) && project.nextAction.trim().length > 0;
}
