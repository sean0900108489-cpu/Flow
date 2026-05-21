import type { AIInsight, AppState, Project, ThoughtItem } from "../types";
import { readiness } from "../readiness";
import { now } from "../utils";

const allowedThoughtKeys = ["title", "content", "type", "universeId", "why", "outcome", "nextAction"] as const;
const allowedProjectKeys = ["name", "intent", "nextAction", "universeId"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickAllowed<T extends object, K extends Extract<keyof T, string>>(
  source: unknown,
  keys: readonly K[]
): Partial<Pick<T, K>> {
  if (!isRecord(source)) return {};

  const next: Partial<Pick<T, K>> = {};

  for (const key of keys) {
    const value = source[key];

    if (value !== undefined) {
      next[key] = value as Pick<T, K>[K];
    }
  }

  return next;
}

function hasPatch(value: object) {
  return Object.keys(value).length > 0;
}

export function applyAiInsightPatch(state: AppState, insight: AIInsight): AppState {
  if (!insight.patch || !Array.isArray(insight.patch.operations)) return state;

  const targetType = insight.patch.targetType;
  const targetId = insight.patch.targetId;
  let nextState = state;
  let changed = false;

  for (const operation of insight.patch.operations as unknown[]) {
    if (!isRecord(operation)) continue;

    if (operation.type === "updateThought" && targetType === "thought" && operation.thoughtId === targetId) {
      const safePatch = pickAllowed<ThoughtItem, (typeof allowedThoughtKeys)[number]>(
        operation.patch,
        allowedThoughtKeys
      );

      if (!hasPatch(safePatch)) continue;

      let operationChanged = false;
      const thoughts = nextState.thoughts.map((thought) => {
        if (thought.id !== targetId) return thought;

        operationChanged = true;
        return { ...thought, ...safePatch, updatedAt: now() };
      });

      if (operationChanged) {
        nextState = { ...nextState, thoughts };
        changed = true;
      }
    }

    if (operation.type === "updateProject" && targetType === "project" && operation.projectId === targetId) {
      const safePatch = pickAllowed<Project, (typeof allowedProjectKeys)[number]>(
        operation.patch,
        allowedProjectKeys
      );

      if (!hasPatch(safePatch)) continue;

      let operationChanged = false;
      const projects = nextState.projects.map((project) => {
        if (project.id !== targetId) return project;

        operationChanged = true;
        const patched = { ...project, ...safePatch, updatedAt: now() };
        return { ...patched, readiness: readiness(patched).value };
      });

      if (operationChanged) {
        nextState = { ...nextState, projects };
        changed = true;
      }
    }
  }

  return changed ? nextState : state;
}
