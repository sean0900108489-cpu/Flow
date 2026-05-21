import { evaluateProjectHandoff } from "./engineeringHandoff";
import { listNextActions, type NextActionItem } from "./nextActions";
import { listThoughtsForTriage } from "./thoughtTriage";
import type { AppState, BlockingQuestion, DecisionRecord, Project, Relationship, ThoughtItem, Universe } from "./types";
import { universeStatus } from "./universeActions";
import { now } from "./utils";

export type UniverseHealthLabel = "healthy" | "needs_attention" | "blocked";

export interface UniverseOverview {
  universeId: string;
  universeName: string;
  universeStatus?: string;
  summary: {
    activeThoughts: number;
    archivedThoughts: number;
    activeProjects: number;
    archivedProjects: number;
    nextActions: number;
    blockingQuestions: number;
    needsTriage: number;
    handoffReadyProjects: number;
    relationships: number;
  };
  thoughts: ThoughtItem[];
  projects: Project[];
  relationships: Relationship[];
  blockingQuestions: BlockingQuestion[];
  decisionRecords: DecisionRecord[];
  nextActions: NextActionItem[];
  health: {
    score: number;
    label: UniverseHealthLabel;
    reasons: string[];
  };
}

export type UniverseOverviewResult =
  | { ok: true; overview: UniverseOverview }
  | { ok: false; error: string };

export interface UniversePackage {
  kind: "UniversePackage";
  version: "0.1";
  universe: Universe;
  summary: UniverseOverview["summary"];
  thoughts: ThoughtItem[];
  projects: Project[];
  relationships: Relationship[];
  blockingQuestions: BlockingQuestion[];
  decisionRecords: DecisionRecord[];
  nextActions: NextActionItem[];
  health: UniverseOverview["health"];
  generatedAt: string;
}

function questions(state: AppState) {
  return state.blockingQuestions ?? [];
}

function decisions(state: AppState) {
  return state.decisionRecords ?? [];
}

function hasAnyLink(candidateIds: string[] | undefined, ids: Set<string>) {
  return candidateIds?.some((candidateId) => ids.has(candidateId)) ?? false;
}

function universeThoughts(state: AppState, universeId: string) {
  return state.thoughts.filter((thought) => thought.universeId === universeId);
}

function universeProjects(state: AppState, universeId: string, thoughts: ThoughtItem[]) {
  const thoughtIds = new Set(thoughts.map((thought) => thought.id));

  return state.projects.filter((project) =>
    project.universeId === universeId ||
    (project.sourceThoughtId ? thoughtIds.has(project.sourceThoughtId) : false) ||
    hasAnyLink(project.linkedThoughtIds, thoughtIds)
  );
}

function universeRelationships(
  state: AppState,
  universeId: string,
  thoughts: ThoughtItem[],
  projects: Project[]
) {
  const ids = new Set([
    universeId,
    ...thoughts.map((thought) => thought.id),
    ...projects.map((project) => project.id)
  ]);

  return state.relationships.filter((relationship) =>
    ids.has(relationship.sourceId) || ids.has(relationship.targetId)
  );
}

function universeBlockingQuestions(
  state: AppState,
  universeId: string,
  thoughts: ThoughtItem[],
  projects: Project[]
) {
  const thoughtIds = new Set(thoughts.map((thought) => thought.id));
  const projectIds = new Set(projects.map((project) => project.id));

  return questions(state).filter((question) =>
    question.linkedUniverseIds?.includes(universeId) ||
    hasAnyLink(question.linkedThoughtIds, thoughtIds) ||
    hasAnyLink(question.linkedProjectIds, projectIds)
  );
}

function universeDecisionRecords(state: AppState, universeId: string) {
  return decisions(state).filter((decision) => decision.linkedUniverseIds?.includes(universeId));
}

function universeNextActions(state: AppState, universeId: string, blockingQuestions: BlockingQuestion[]) {
  const blockingQuestionIds = new Set(blockingQuestions.map((question) => question.id));

  return listNextActions(state).filter((item) =>
    item.universeId === universeId ||
    (item.sourceType === "blocking_question" && blockingQuestionIds.has(item.sourceId))
  );
}

function universeNeedsTriage(state: AppState, universeId: string) {
  return listThoughtsForTriage(state, { universeId })
    .filter((item) => item.stage !== "ready")
    .length;
}

function isHandoffReady(project: Project, state: AppState) {
  return project.lifecycleStatus === "handoff_ready" || evaluateProjectHandoff(project, state).readiness === "ready";
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, score));
}

function healthForUniverse(
  universe: Universe,
  summary: UniverseOverview["summary"],
  blockingQuestions: BlockingQuestion[],
  nextActions: NextActionItem[]
): UniverseOverview["health"] {
  const reasons: string[] = [];
  const openBlockers = blockingQuestions.filter((question) =>
    question.status === "open" || question.status === "in_review"
  );
  let score = 100;

  if (openBlockers.length > 0) {
    score -= Math.min(40, openBlockers.length * 18);
    reasons.push(`${openBlockers.length} unresolved blocking question${openBlockers.length === 1 ? "" : "s"}.`);
  }

  if (summary.needsTriage > 0) {
    score -= Math.min(30, summary.needsTriage * 10);
    reasons.push(`${summary.needsTriage} thought${summary.needsTriage === 1 ? "" : "s"} need triage.`);
  }

  if (summary.activeProjects > 0 && nextActions.length === 0) {
    score -= 20;
    reasons.push("Active projects have no next actions.");
  }

  if (universeStatus(universe) === "archived") {
    score -= 35;
    reasons.push("Universe is archived.");
  }

  const normalizedScore = clampScore(score);
  let label: UniverseHealthLabel =
    normalizedScore >= 75 ? "healthy" : normalizedScore >= 40 ? "needs_attention" : "blocked";

  if (universeStatus(universe) === "archived" && label === "healthy") {
    label = "needs_attention";
  }

  return {
    score: normalizedScore,
    label,
    reasons: reasons.length > 0 ? reasons : ["Universe has active structure and current next actions."]
  };
}

export function getUniverseOverview(state: AppState, universeId: string): UniverseOverviewResult {
  const universe = state.universes.find((candidate) => candidate.id === universeId);

  if (!universe) {
    return { ok: false, error: "Universe not found." };
  }

  const thoughts = universeThoughts(state, universeId);
  const projects = universeProjects(state, universeId, thoughts);
  const relationships = universeRelationships(state, universeId, thoughts, projects);
  const blockingQuestions = universeBlockingQuestions(state, universeId, thoughts, projects);
  const decisionRecords = universeDecisionRecords(state, universeId);
  const nextActions = universeNextActions(state, universeId, blockingQuestions);
  const needsTriage = universeNeedsTriage(state, universeId);
  const activeProjects = projects.filter((project) => project.status !== "archived");
  const summary: UniverseOverview["summary"] = {
    activeThoughts: thoughts.filter((thought) => thought.status !== "archived").length,
    archivedThoughts: thoughts.filter((thought) => thought.status === "archived").length,
    activeProjects: activeProjects.length,
    archivedProjects: projects.filter((project) => project.status === "archived").length,
    nextActions: nextActions.length,
    blockingQuestions: blockingQuestions.length,
    needsTriage,
    handoffReadyProjects: activeProjects.filter((project) => isHandoffReady(project, state)).length,
    relationships: relationships.length
  };

  return {
    ok: true,
    overview: {
      universeId: universe.id,
      universeName: universe.name,
      universeStatus: universeStatus(universe),
      summary,
      thoughts,
      projects,
      relationships,
      blockingQuestions,
      decisionRecords,
      nextActions,
      health: healthForUniverse(universe, summary, blockingQuestions, nextActions)
    }
  };
}

export function listUniverseOverviews(state: AppState) {
  return state.universes
    .map((universe) => getUniverseOverview(state, universe.id))
    .filter((result): result is { ok: true; overview: UniverseOverview } => result.ok)
    .map((result) => result.overview);
}

export function buildUniversePackage(state: AppState, universeId: string): UniversePackage {
  const universe = state.universes.find((candidate) => candidate.id === universeId);
  const result = getUniverseOverview(state, universeId);

  if (!universe || !result.ok) {
    throw new Error(result.ok ? "Universe not found." : result.error);
  }

  return {
    kind: "UniversePackage",
    version: "0.1",
    universe,
    summary: result.overview.summary,
    thoughts: result.overview.thoughts,
    projects: result.overview.projects,
    relationships: result.overview.relationships,
    blockingQuestions: result.overview.blockingQuestions,
    decisionRecords: result.overview.decisionRecords,
    nextActions: result.overview.nextActions,
    health: result.overview.health,
    generatedAt: now()
  };
}
