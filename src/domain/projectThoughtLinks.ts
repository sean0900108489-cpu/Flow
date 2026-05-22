import type { AppState, Project, ThoughtItem } from "./types";
import { now } from "./utils";

export interface ProjectThoughtLinkResult {
  state: AppState;
  ok: boolean;
  thoughtId?: string;
  projectId?: string;
  error?: string;
  changed?: boolean;
}

const unique = (items: string[] = []) => Array.from(new Set(items.filter(Boolean)));

function equalIds(a: string[] = [], b: string[] = []) {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function withProjectLinks(project: Project, linkedThoughtIds: string[], timestamp: string) {
  const current = project.linkedThoughtIds ?? [];
  if (equalIds(current, linkedThoughtIds)) return project;

  return {
    ...project,
    linkedThoughtIds,
    updatedAt: timestamp
  };
}

function withThoughtProject(thought: ThoughtItem, projectId: string | undefined, timestamp: string) {
  if (thought.projectId === projectId) return thought;

  return {
    ...thought,
    projectId,
    updatedAt: timestamp
  };
}

export function linkThoughtToProjectReference(
  state: AppState,
  projectId: string,
  thoughtId: string
): ProjectThoughtLinkResult {
  const project = state.projects.find((item) => item.id === projectId);
  const thought = state.thoughts.find((item) => item.id === thoughtId);

  if (!project) {
    return { state, ok: false, error: "Project not found.", projectId, thoughtId };
  }

  if (!thought) {
    return { state, ok: false, error: "Thought not found.", projectId, thoughtId };
  }

  const timestamp = now();
  let changed = false;
  const thoughts = state.thoughts.map((item) => {
    const next = item.id === thoughtId ? withThoughtProject(item, projectId, timestamp) : item;
    if (next !== item) changed = true;
    return next;
  });
  const projects = state.projects.map((item) => {
    if (item.id === projectId) {
      const next = withProjectLinks(item, unique([...(item.linkedThoughtIds ?? []), thoughtId]), timestamp);
      if (next !== item) changed = true;
      return next;
    }

    if (item.linkedThoughtIds?.includes(thoughtId)) {
      const next = withProjectLinks(
        item,
        unique(item.linkedThoughtIds.filter((id) => id !== thoughtId)),
        timestamp
      );
      if (next !== item) changed = true;
      return next;
    }

    return item;
  });

  return {
    state: { ...state, thoughts, projects },
    ok: true,
    projectId,
    thoughtId,
    changed
  };
}

export function unlinkThoughtFromProjectReferences(
  state: AppState,
  thoughtId: string
): ProjectThoughtLinkResult {
  const thought = state.thoughts.find((item) => item.id === thoughtId);

  if (!thought) {
    return { state, ok: false, error: "Thought not found.", thoughtId };
  }

  const timestamp = now();
  let changed = false;
  const thoughts = state.thoughts.map((item) => {
    const next = item.id === thoughtId ? withThoughtProject(item, undefined, timestamp) : item;
    if (next !== item) changed = true;
    return next;
  });
  const projects = state.projects.map((project) => {
    if (!project.linkedThoughtIds?.includes(thoughtId)) return project;

    const next = withProjectLinks(
      project,
      unique(project.linkedThoughtIds.filter((id) => id !== thoughtId)),
      timestamp
    );
    if (next !== project) changed = true;
    return next;
  });

  return {
    state: { ...state, thoughts, projects },
    ok: true,
    thoughtId,
    projectId: thought.projectId,
    changed
  };
}

export function cleanupProjectThoughtReferences(state: AppState): ProjectThoughtLinkResult {
  const timestamp = now();
  const thoughtIds = new Set(state.thoughts.map((thought) => thought.id));
  const projectIds = new Set(state.projects.map((project) => project.id));
  let changed = false;

  const thoughts = state.thoughts.map((thought) => {
    if (!thought.projectId || projectIds.has(thought.projectId)) return thought;

    changed = true;
    return withThoughtProject(thought, undefined, timestamp);
  });
  const projects = state.projects.map((project) => {
    const currentLinkedThoughtIds = project.linkedThoughtIds ?? [];
    const linkedThoughtIds = unique(currentLinkedThoughtIds.filter((id) => thoughtIds.has(id)));
    const sourceThoughtIdMissing = project.sourceThoughtId !== undefined && !thoughtIds.has(project.sourceThoughtId);
    const linkedChanged = !equalIds(currentLinkedThoughtIds, linkedThoughtIds);

    if (!linkedChanged && !sourceThoughtIdMissing) return project;

    changed = true;
    return {
      ...project,
      ...(linkedChanged ? { linkedThoughtIds } : {}),
      ...(sourceThoughtIdMissing ? { sourceThoughtId: undefined } : {}),
      updatedAt: timestamp
    };
  });

  return {
    state: changed ? { ...state, thoughts, projects } : state,
    ok: true,
    changed
  };
}
