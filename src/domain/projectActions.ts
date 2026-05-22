import { readiness as projectReadiness } from "./readiness";
import {
  linkThoughtToProjectReference,
  unlinkThoughtFromProjectReferences
} from "./projectThoughtLinks";
import { createTypedRelationship } from "./relationships/relationshipGraph";
import { id, now } from "./utils";
import type {
  AppState,
  Project,
  ProjectLifecycleStatus,
  ProjectStatus,
  Readiness
} from "./types";

export interface ProjectActionResult {
  state: AppState;
  ok: boolean;
  projectId?: string;
  error?: string;
}

export interface CreateProjectInput {
  title: string;
  description?: string;
  universeId?: string;
  nextAction?: string;
  linkedThoughtIds?: string[];
}

export interface ProjectDetailsPatch {
  title?: string;
  name?: string;
  description?: string;
  intent?: string;
  universeId?: string;
  nextAction?: string;
  status?: ProjectStatus;
  lifecycleStatus?: ProjectLifecycleStatus;
  readiness?: Readiness;
  linkedThoughtIds?: string[];
  users?: string[];
  features?: string[];
  screens?: string[];
  dataObjects?: string[];
  flowSteps?: string[];
  unknowns?: string[];
}

const unique = (items: string[] = []) => Array.from(new Set(items.filter(Boolean)));

function withComputedReadiness(project: Project, explicitReadiness?: Readiness): Project {
  return {
    ...project,
    readiness: explicitReadiness ?? projectReadiness(project).value
  };
}

export function createProject(state: AppState, input: CreateProjectInput): ProjectActionResult {
  const title = input.title.trim();

  if (!title) {
    return { state, ok: false, error: "Project title is required." };
  }

  const timestamp = now();
  const projectId = id("project");
  const linkedThoughtIds = unique(input.linkedThoughtIds);
  const project: Project = withComputedReadiness({
    id: projectId,
    linkedThoughtIds,
    universeId: input.universeId ?? "",
    status: "active",
    lifecycleStatus: "planning",
    name: title,
    intent: input.description?.trim() ?? "",
    users: [],
    features: [],
    screens: [],
    dataObjects: ["ThoughtItem", "Project"],
    flowSteps: [],
    unknowns: [],
    nextAction: input.nextAction?.trim() ?? "",
    readiness: "not_ready",
    createdAt: timestamp,
    updatedAt: timestamp
  });

  let nextState: AppState = {
    ...state,
    projects: [project, ...state.projects]
  };

  linkedThoughtIds.forEach((thoughtId) => {
    const linkResult = linkThoughtToProjectReference(nextState, projectId, thoughtId);
    if (linkResult.ok) {
      nextState = linkResult.state;
    }
  });

  return {
    state: nextState,
    ok: true,
    projectId
  };
}

export function updateProjectDetails(
  state: AppState,
  projectId: string,
  patch: ProjectDetailsPatch
): ProjectActionResult {
  const project = state.projects.find((item) => item.id === projectId);

  if (!project) {
    return { state, ok: false, error: "Project not found." };
  }

  const nextName = patch.title ?? patch.name;

  if (nextName !== undefined && !nextName.trim()) {
    return { state, ok: false, error: "Project title is required." };
  }

  if (patch.lifecycleStatus === "handoff_ready" && project.lifecycleStatus !== "handoff_ready") {
    return {
      state,
      ok: false,
      error: "Use the guarded handoff action to mark a project handoff_ready."
    };
  }

  const nextIntent = patch.description ?? patch.intent;
  const nextLinkedThoughtIds = patch.linkedThoughtIds !== undefined
    ? unique(patch.linkedThoughtIds)
    : undefined;
  const mappedPatch: Partial<Project> = {
    ...(nextName !== undefined ? { name: nextName.trim() } : {}),
    ...(nextIntent !== undefined ? { intent: nextIntent } : {}),
    ...(patch.universeId !== undefined ? { universeId: patch.universeId } : {}),
    ...(patch.nextAction !== undefined ? { nextAction: patch.nextAction } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.lifecycleStatus !== undefined ? { lifecycleStatus: patch.lifecycleStatus } : {}),
    ...(nextLinkedThoughtIds !== undefined ? { linkedThoughtIds: nextLinkedThoughtIds } : {}),
    ...(patch.users !== undefined ? { users: unique(patch.users) } : {}),
    ...(patch.features !== undefined ? { features: unique(patch.features) } : {}),
    ...(patch.screens !== undefined ? { screens: unique(patch.screens) } : {}),
    ...(patch.dataObjects !== undefined ? { dataObjects: unique(patch.dataObjects) } : {}),
    ...(patch.flowSteps !== undefined ? { flowSteps: unique(patch.flowSteps) } : {}),
    ...(patch.unknowns !== undefined ? { unknowns: unique(patch.unknowns) } : {})
  };

  const updatedProject = withComputedReadiness(
    { ...project, ...mappedPatch, updatedAt: now() },
    patch.readiness
  );
  let nextState: AppState = {
    ...state,
    projects: state.projects.map((item) => item.id === projectId ? updatedProject : item)
  };

  if (nextLinkedThoughtIds !== undefined) {
    const nextLinkedThoughtIdSet = new Set(nextLinkedThoughtIds);
    const existingThoughtIds = new Set(state.thoughts.map((thought) => thought.id));
    const thoughtIdsToUnlink = state.thoughts
      .filter((thought) => thought.projectId === projectId && !nextLinkedThoughtIdSet.has(thought.id))
      .map((thought) => thought.id);

    thoughtIdsToUnlink.forEach((thoughtId) => {
      const unlinkResult = unlinkThoughtFromProjectReferences(nextState, thoughtId);
      if (unlinkResult.ok) {
        nextState = unlinkResult.state;
      }
    });

    nextLinkedThoughtIds.forEach((thoughtId) => {
      if (!existingThoughtIds.has(thoughtId)) return;

      const linkResult = linkThoughtToProjectReference(nextState, projectId, thoughtId);
      if (linkResult.ok) {
        nextState = linkResult.state;
      }
    });
  }

  return {
    state: nextState,
    ok: true,
    projectId
  };
}

export function linkThoughtToProject(state: AppState, projectId: string, thoughtId: string): ProjectActionResult {
  const result = linkThoughtToProjectReference(state, projectId, thoughtId);

  return result.ok
    ? { state: result.state, ok: true, projectId }
    : { state: result.state, ok: false, error: result.error };
}

export function unlinkThoughtFromProject(state: AppState, projectId: string, thoughtId: string): ProjectActionResult {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) {
    return { state, ok: false, error: "Project not found." };
  }

  const result = unlinkThoughtFromProjectReferences(state, thoughtId);

  return result.ok
    ? { state: result.state, ok: true, projectId }
    : { state: result.state, ok: false, error: result.error };
}

export function promoteThoughtToProject(
  state: AppState,
  thoughtId: string,
  input: { title?: string; description?: string; nextAction?: string } = {}
): ProjectActionResult {
  const thought = state.thoughts.find((item) => item.id === thoughtId);

  if (!thought) {
    return { state, ok: false, error: "Thought not found." };
  }

  const result = createProject(state, {
    title: input.title ?? thought.title,
    description: input.description ?? (thought.content || thought.outcome || ""),
    universeId: thought.universeId,
    nextAction: input.nextAction ?? thought.nextAction,
    linkedThoughtIds: [thoughtId]
  });

  if (!result.ok || !result.projectId) {
    return result;
  }

  const promotedState: AppState = {
    ...result.state,
    thoughts: result.state.thoughts.map((item) =>
      item.id === thoughtId
        ? { ...item, type: "project", status: "active", updatedAt: now() }
        : item
    ),
    projects: result.state.projects.map((project) =>
      project.id === result.projectId
        ? { ...project, sourceThoughtId: thoughtId, updatedAt: now() }
        : project
    )
  };
  const relationshipResult = createTypedRelationship(promotedState, {
    sourceId: thoughtId,
    sourceType: "thought",
    targetId: result.projectId,
    targetType: "project",
    type: "evolves_into",
    description: "ThoughtItem promoted to Project.",
    idPrefix: "rel"
  });

  return {
    state: relationshipResult.ok ? relationshipResult.state : promotedState,
    ok: true,
    projectId: result.projectId
  };
}
