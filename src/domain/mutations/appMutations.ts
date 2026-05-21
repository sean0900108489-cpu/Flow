import type { AppState, ProjectStatus, ThoughtItem, ThoughtStatus, ThoughtType } from "../types";
import { removeRelationshipsForNode } from "../relationships/relationshipGraph";
import { id, now } from "../utils";
import { removeDeletedNodeReferences } from "./referenceCleanup";

export interface SafeMutationResult {
  state: AppState;
  ok: boolean;
  error?: string;
}

export interface ThoughtMutationResult extends SafeMutationResult {
  thoughtId?: string;
}

export interface ProjectMutationResult extends SafeMutationResult {
  projectId?: string;
}

export type CreateThoughtInput = Pick<ThoughtItem, "title" | "content" | "type" | "universeId">;

export type ThoughtMutationPatch = Partial<Pick<
  ThoughtItem,
  "title" | "content" | "type" | "status" | "universeId" | "why" | "outcome" | "nextAction"
>>;

function text(value: string | undefined) {
  return value?.trim() ?? "";
}

function updateThoughtStatus(state: AppState, thoughtId: string, status: ThoughtStatus): ThoughtMutationResult {
  const thought = state.thoughts.find((item) => item.id === thoughtId);

  if (!thought) {
    return { state, ok: false, error: "Thought not found." };
  }

  return {
    state: {
      ...state,
      thoughts: state.thoughts.map((item) =>
        item.id === thoughtId ? { ...item, status, updatedAt: now() } : item
      )
    },
    ok: true,
    thoughtId
  };
}

function updateProjectStatus(state: AppState, projectId: string, status: ProjectStatus): ProjectMutationResult {
  const project = state.projects.find((item) => item.id === projectId);

  if (!project) {
    return { state, ok: false, error: "Project not found." };
  }

  return {
    state: {
      ...state,
      projects: state.projects.map((item) =>
        item.id === projectId ? { ...item, status, updatedAt: now() } : item
      )
    },
    ok: true,
    projectId
  };
}

export function createThought(state: AppState, input: CreateThoughtInput): ThoughtMutationResult {
  const createdAt = now();
  const item: ThoughtItem = {
    id: id("thought"),
    title: text(input.title) || "未命名想法",
    content: input.content,
    type: input.type as ThoughtType,
    status: "inbox",
    universeId: input.universeId,
    why: "",
    outcome: "",
    nextAction: "",
    createdAt,
    updatedAt: createdAt
  };

  return {
    state: {
      ...state,
      thoughts: [item, ...state.thoughts]
    },
    ok: true,
    thoughtId: item.id
  };
}

export function updateThought(state: AppState, thoughtId: string, patch: ThoughtMutationPatch): ThoughtMutationResult {
  const thought = state.thoughts.find((item) => item.id === thoughtId);

  if (!thought) {
    return { state, ok: false, error: "Thought not found." };
  }

  if (patch.title !== undefined && !text(patch.title)) {
    return { state, ok: false, error: "Thought title is required." };
  }

  return {
    state: {
      ...state,
      thoughts: state.thoughts.map((item) =>
        item.id === thoughtId ? { ...item, ...patch, updatedAt: now() } : item
      )
    },
    ok: true,
    thoughtId
  };
}

export function archiveThought(state: AppState, thoughtId: string): ThoughtMutationResult {
  return updateThoughtStatus(state, thoughtId, "archived");
}

export function restoreThought(state: AppState, thoughtId: string): ThoughtMutationResult {
  const thought = state.thoughts.find((item) => item.id === thoughtId);

  if (!thought) {
    return { state, ok: false, error: "Thought not found." };
  }

  return updateThoughtStatus(state, thoughtId, thought.status === "archived" ? "inbox" : thought.status);
}

export function deleteThought(state: AppState, thoughtId: string): ThoughtMutationResult {
  const thought = state.thoughts.find((item) => item.id === thoughtId);

  if (!thought) {
    return { state, ok: false, error: "Thought not found." };
  }

  const relationshipCleanup = removeRelationshipsForNode(state, { id: thoughtId, type: "thought" });
  const referenceCleanup = removeDeletedNodeReferences(relationshipCleanup.state, { id: thoughtId, type: "thought" });

  return {
    state: {
      ...referenceCleanup,
      thoughts: referenceCleanup.thoughts.filter((item) => item.id !== thoughtId)
    },
    ok: true,
    thoughtId
  };
}

export function archiveProject(state: AppState, projectId: string): ProjectMutationResult {
  return updateProjectStatus(state, projectId, "archived");
}

export function restoreProject(state: AppState, projectId: string): ProjectMutationResult {
  const project = state.projects.find((item) => item.id === projectId);

  if (!project) {
    return { state, ok: false, error: "Project not found." };
  }

  return updateProjectStatus(state, projectId, "active");
}

export function deleteProject(state: AppState, projectId: string): ProjectMutationResult {
  const project = state.projects.find((item) => item.id === projectId);

  if (!project) {
    return { state, ok: false, error: "Project not found." };
  }

  const relationshipCleanup = removeRelationshipsForNode(state, { id: projectId, type: "project" });
  const referenceCleanup = removeDeletedNodeReferences(relationshipCleanup.state, { id: projectId, type: "project" });

  return {
    state: {
      ...referenceCleanup,
      projects: referenceCleanup.projects.filter((item) => item.id !== projectId)
    },
    ok: true,
    projectId
  };
}
