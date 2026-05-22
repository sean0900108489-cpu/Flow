import type { AIInsight, AppState, Project, ThoughtItem, ThoughtType } from "../types";
import { readiness } from "../readiness";
import { now } from "../utils";

export type ApplyAiPatchErrorCode =
  | "invalid_patch"
  | "invalid_value"
  | "no_allowed_changes"
  | "target_missing"
  | "unsupported_target_type"
  | "insight_missing";

export interface ApplyAiPatchResult {
  state: AppState;
  applied: boolean;
  warnings: string[];
  error?: ApplyAiPatchErrorCode;
}

export interface SetAiInsightStatusResult extends ApplyAiPatchResult {
  statusChanged: boolean;
}

const thoughtTypes: readonly ThoughtType[] = ["inspiration", "task", "project", "goal", "question", "note"];
const allowedThoughtKeys = ["title", "content", "type", "universeId", "projectId", "why", "outcome", "nextAction"] as const;
const allowedProjectKeys = ["name", "title", "intent", "nextAction", "universeId", "sourceThoughtId"] as const;

type ThoughtPatchKey = (typeof allowedThoughtKeys)[number];
type ProjectPatchKey = (typeof allowedProjectKeys)[number];

type PatchValidation<TPatch extends object> = {
  patch: TPatch;
  warnings: string[];
  error?: ApplyAiPatchErrorCode;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(
  state: AppState,
  error: ApplyAiPatchErrorCode,
  warnings: string[] = []
): ApplyAiPatchResult {
  return { state, applied: false, warnings, error };
}

function ok(state: AppState, warnings: string[]): ApplyAiPatchResult {
  return { state, applied: true, warnings };
}

function hasOwn(source: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(source, key);
}

function disallowedWarnings(source: Record<string, unknown>, allowedKeys: readonly string[]) {
  const allowed = new Set<string>(allowedKeys);
  return Object.keys(source)
    .filter((key) => !allowed.has(key))
    .map((key) => `disallowed_field:${key}`);
}

function validateStringField(
  source: Record<string, unknown>,
  key: string,
  options: { nonEmpty?: boolean } = {}
): { value?: string; error?: ApplyAiPatchErrorCode; warning?: string } {
  if (!hasOwn(source, key)) return {};

  const value = source[key];
  if (typeof value !== "string") {
    return { error: "invalid_value", warning: `invalid_value:${key}:must_be_string` };
  }

  if (options.nonEmpty && !value.trim()) {
    return { error: "invalid_value", warning: `invalid_value:${key}:must_be_non_empty` };
  }

  return { value };
}

function assignStringField<TPatch extends Record<string, unknown>>(
  source: Record<string, unknown>,
  patch: TPatch,
  key: keyof TPatch & string,
  warnings: string[],
  options: { nonEmpty?: boolean } = {}
) {
  const result = validateStringField(source, key, options);
  if (result.warning) warnings.push(result.warning);
  if (result.error) return result.error;
  if (result.value !== undefined) patch[key] = result.value as TPatch[typeof key];
  return undefined;
}

function entityExists(collection: Array<{ id: string }>, id: string) {
  return collection.some((item) => item.id === id);
}

function validateThoughtPatch(
  state: AppState,
  source: unknown
): PatchValidation<Partial<Pick<ThoughtItem, ThoughtPatchKey>>> {
  if (!isRecord(source)) {
    return { patch: {}, warnings: ["invalid_patch:operation.patch_must_be_object"], error: "invalid_patch" };
  }

  const warnings = disallowedWarnings(source, allowedThoughtKeys);
  const patch: Partial<Pick<ThoughtItem, ThoughtPatchKey>> = {};

  for (const key of ["title", "content", "why", "outcome", "nextAction"] as const) {
    const error = assignStringField(source, patch, key, warnings, { nonEmpty: key === "title" });
    if (error) return { patch: {}, warnings, error };
  }

  if (hasOwn(source, "type")) {
    const type = source.type;
    if (typeof type !== "string" || !thoughtTypes.includes(type as ThoughtType)) {
      return {
        patch: {},
        warnings: [...warnings, "invalid_value:type:unknown_thought_type"],
        error: "invalid_value"
      };
    }
    patch.type = type as ThoughtType;
  }

  if (hasOwn(source, "universeId")) {
    const universeId = source.universeId;
    if (typeof universeId !== "string" || !universeId.trim()) {
      return {
        patch: {},
        warnings: [...warnings, "invalid_value:universeId:must_be_non_empty_string"],
        error: "invalid_value"
      };
    }
    if (!entityExists(state.universes, universeId)) {
      return {
        patch: {},
        warnings: [...warnings, `missing_reference:universeId:${universeId}`],
        error: "invalid_value"
      };
    }
    patch.universeId = universeId;
  }

  if (hasOwn(source, "projectId")) {
    const projectId = source.projectId;
    if (typeof projectId !== "string" || !projectId.trim()) {
      return {
        patch: {},
        warnings: [...warnings, "invalid_value:projectId:must_be_non_empty_string"],
        error: "invalid_value"
      };
    }

    const project = state.projects.find((item) => item.id === projectId);
    if (!project) {
      return {
        patch: {},
        warnings: [...warnings, `missing_reference:projectId:${projectId}`],
        error: "invalid_value"
      };
    }

    if (project.status === "archived") {
      return {
        patch: {},
        warnings: [...warnings, `invalid_value:projectId:${projectId}:project_archived`],
        error: "invalid_value"
      };
    }

    patch.projectId = projectId;
  }

  return { patch, warnings };
}

function validateProjectPatch(
  state: AppState,
  source: unknown
): PatchValidation<Partial<Pick<Project, Exclude<ProjectPatchKey, "title">>>> {
  if (!isRecord(source)) {
    return { patch: {}, warnings: ["invalid_patch:operation.patch_must_be_object"], error: "invalid_patch" };
  }

  const warnings = disallowedWarnings(source, allowedProjectKeys);
  const patch: Partial<Pick<Project, Exclude<ProjectPatchKey, "title">>> = {};

  const nameKey = hasOwn(source, "name") ? "name" : hasOwn(source, "title") ? "title" : undefined;
  if (nameKey) {
    const name = validateStringField(source, nameKey, { nonEmpty: true });
    if (name.warning) warnings.push(name.warning);
    if (name.error) return { patch: {}, warnings, error: name.error };
    if (name.value !== undefined) patch.name = name.value;
  }

  for (const key of ["intent", "nextAction"] as const) {
    const error = assignStringField(source, patch, key, warnings);
    if (error) return { patch: {}, warnings, error };
  }

  if (hasOwn(source, "universeId")) {
    const universeId = source.universeId;
    if (typeof universeId !== "string" || !universeId.trim()) {
      return {
        patch: {},
        warnings: [...warnings, "invalid_value:universeId:must_be_non_empty_string"],
        error: "invalid_value"
      };
    }
    if (!entityExists(state.universes, universeId)) {
      return {
        patch: {},
        warnings: [...warnings, `missing_reference:universeId:${universeId}`],
        error: "invalid_value"
      };
    }
    patch.universeId = universeId;
  }

  if (hasOwn(source, "sourceThoughtId")) {
    const sourceThoughtId = source.sourceThoughtId;
    if (typeof sourceThoughtId !== "string" || !sourceThoughtId.trim()) {
      return {
        patch: {},
        warnings: [...warnings, "invalid_value:sourceThoughtId:must_be_non_empty_string"],
        error: "invalid_value"
      };
    }
    if (!entityExists(state.thoughts, sourceThoughtId)) {
      return {
        patch: {},
        warnings: [...warnings, `missing_reference:sourceThoughtId:${sourceThoughtId}`],
        error: "invalid_value"
      };
    }
    patch.sourceThoughtId = sourceThoughtId;
  }

  return { patch, warnings };
}

function changedPatch<T extends object>(target: T, patch: Partial<T>) {
  const changed: Partial<T> = {};

  for (const key of Object.keys(patch) as Array<keyof T>) {
    if (patch[key] !== target[key]) {
      changed[key] = patch[key];
    }
  }

  return changed;
}

function hasPatch(value: object) {
  return Object.keys(value).length > 0;
}

export function applyAiInsightPatch(state: AppState, insight: AIInsight): ApplyAiPatchResult {
  if (!insight.patch || !Array.isArray(insight.patch.operations)) {
    return fail(state, "invalid_patch", ["invalid_patch:missing_operations"]);
  }

  const targetType = insight.patch.targetType;
  const targetId = insight.patch.targetId;

  if (targetType !== "thought" && targetType !== "project") {
    return fail(state, "unsupported_target_type", [`unsupported_target_type:${String(targetType)}`]);
  }

  if (typeof targetId !== "string" || !targetId.trim()) {
    return fail(state, "target_missing", ["target_missing:empty_targetId"]);
  }

  if (targetType === "thought") {
    const thought = state.thoughts.find((item) => item.id === targetId);
    if (!thought) {
      return fail(state, "target_missing", [`target_missing:thought:${targetId}`]);
    }

    let warnings: string[] = [];
    const patch: Partial<ThoughtItem> = {};

    for (const operation of insight.patch.operations as unknown[]) {
      if (!isRecord(operation)) {
        warnings.push("invalid_operation:must_be_object");
        continue;
      }

      if (operation.type !== "updateThought" || operation.thoughtId !== targetId) {
        warnings.push("ignored_operation:target_mismatch");
        continue;
      }

      const result = validateThoughtPatch(state, operation.patch);
      warnings = [...warnings, ...result.warnings];
      if (result.error) return fail(state, result.error, warnings);
      Object.assign(patch, result.patch);
    }

    const changed = changedPatch(thought, patch);
    if (!hasPatch(changed)) {
      return fail(state, "no_allowed_changes", warnings.length ? warnings : ["no_allowed_changes:thought"]);
    }

    return ok(
      {
        ...state,
        thoughts: state.thoughts.map((item) =>
          item.id === targetId ? { ...item, ...changed, updatedAt: now() } : item
        )
      },
      warnings
    );
  }

  const project = state.projects.find((item) => item.id === targetId);
  if (!project) {
    return fail(state, "target_missing", [`target_missing:project:${targetId}`]);
  }

  let warnings: string[] = [];
  const patch: Partial<Project> = {};

  for (const operation of insight.patch.operations as unknown[]) {
    if (!isRecord(operation)) {
      warnings.push("invalid_operation:must_be_object");
      continue;
    }

    if (operation.type !== "updateProject" || operation.projectId !== targetId) {
      warnings.push("ignored_operation:target_mismatch");
      continue;
    }

    const result = validateProjectPatch(state, operation.patch);
    warnings = [...warnings, ...result.warnings];
    if (result.error) return fail(state, result.error, warnings);
    Object.assign(patch, result.patch);
  }

  const changed = changedPatch(project, patch);
  if (!hasPatch(changed)) {
    return fail(state, "no_allowed_changes", warnings.length ? warnings : ["no_allowed_changes:project"]);
  }

  return ok(
    {
      ...state,
      projects: state.projects.map((item) => {
        if (item.id !== targetId) return item;

        const patched = { ...item, ...changed, updatedAt: now() };
        return { ...patched, readiness: readiness(patched).value };
      })
    },
    warnings
  );
}

export function applyAiInsightPatchState(state: AppState, insight: AIInsight): AppState {
  return applyAiInsightPatch(state, insight).state;
}

function updateAiInsightStatus(state: AppState, aiId: string, status: AIInsight["status"]) {
  return {
    ...state,
    aiInsights: state.aiInsights.map((insight) => insight.id === aiId ? { ...insight, status } : insight)
  };
}

export function setAiInsightStatus(
  state: AppState,
  aiId: string,
  status: "accepted" | "rejected"
): SetAiInsightStatusResult {
  const insight = state.aiInsights.find((item) => item.id === aiId);

  if (!insight) {
    return { ...fail(state, "insight_missing", [`insight_missing:${aiId}`]), statusChanged: false };
  }

  if (status === "rejected") {
    return {
      state: updateAiInsightStatus(state, aiId, "rejected"),
      applied: false,
      statusChanged: true,
      warnings: []
    };
  }

  if (!insight.patch) {
    return {
      state: updateAiInsightStatus(state, aiId, "accepted"),
      applied: false,
      statusChanged: true,
      warnings: []
    };
  }

  const result = applyAiInsightPatch(state, insight);
  if (!result.applied) {
    return { ...result, statusChanged: false };
  }

  return {
    ...result,
    state: updateAiInsightStatus(result.state, aiId, "accepted"),
    statusChanged: true
  };
}
