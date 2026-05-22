import { readiness as projectReadiness } from "./readiness";
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

function setThoughtProjectId(state: AppState, thoughtIds: string[], projectId?: string) {
  if (thoughtIds.length === 0) return state.thoughts;
  const ids = new Set(thoughtIds);

  return state.thoughts.map((thought) =>
    ids.has(thought.id)
      ? { ...thought, projectId, updatedAt: now() }
      : thought
  );
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

  return {
    state: {
      ...state,
      projects: [project, ...state.projects],
      thoughts: setThoughtProjectId(state, linkedThoughtIds, projectId)
    },
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
  const mappedPatch: Partial<Project> = {
    ...(nextName !== undefined ? { name: nextName.trim() } : {}),
    ...(nextIntent !== undefined ? { intent: nextIntent } : {}),
    ...(patch.universeId !== undefined ? { universeId: patch.universeId } : {}),
    ...(patch.nextAction !== undefined ? { nextAction: patch.nextAction } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.lifecycleStatus !== undefined ? { lifecycleStatus: patch.lifecycleStatus } : {}),
    ...(patch.linkedThoughtIds !== undefined ? { linkedThoughtIds: unique(patch.linkedThoughtIds) } : {}),
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
  const linkedThoughtIds = updatedProject.linkedThoughtIds ?? [];

  return {
    state: {
      ...state,
      projects: state.projects.map((item) => item.id === projectId ? updatedProject : item),
      thoughts: patch.linkedThoughtIds !== undefined
        ? setThoughtProjectId(state, linkedThoughtIds, projectId)
        : state.thoughts
    },
    ok: true,
    projectId
  };
}

export function linkThoughtToProject(state: AppState, projectId: string, thoughtId: string): ProjectActionResult {
  const project = state.projects.find((item) => item.id === projectId);
  const thought = state.thoughts.find((item) => item.id === thoughtId);

  if (!project) {
    return { state, ok: false, error: "Project not found." };
  }

  if (!thought) {
    return { state, ok: false, error: "Thought not found." };
  }

  const linkedThoughtIds = unique([...(project.linkedThoughtIds ?? []), thoughtId]);

  return updateProjectDetails(state, projectId, { linkedThoughtIds });
}

export function unlinkThoughtFromProject(state: AppState, projectId: string, thoughtId: string): ProjectActionResult {
  const project = state.projects.find((item) => item.id === projectId);
  const thought = state.thoughts.find((item) => item.id === thoughtId);

  if (!project) {
    return { state, ok: false, error: "Project not found." };
  }

  if (!thought) {
    return { state, ok: false, error: "Thought not found." };
  }

  const linkedThoughtIds = (project.linkedThoughtIds ?? []).filter((id) => id !== thoughtId);
  const nextState = updateProjectDetails(state, projectId, { linkedThoughtIds }).state;

  return {
    state: {
      ...nextState,
      thoughts: nextState.thoughts.map((item) =>
        item.id === thoughtId && item.projectId === projectId
          ? { ...item, projectId: undefined, updatedAt: now() }
          : item
      )
    },
    ok: true,
    projectId
  };
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
        ? { ...item, type: "project", status: "active", projectId: result.projectId, updatedAt: now() }
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
