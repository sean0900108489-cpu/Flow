import type { AppState, Universe, UniverseStatus } from "./types";
import { id } from "./utils";

export type DeleteUniverseMode = "detach" | "blockIfInUse";

export interface UniverseActionResult {
  state: AppState;
  ok: boolean;
  error?: string;
}

export interface CreateUniverseInput {
  name: string;
  description?: string;
}

export interface UpdateUniversePatch {
  name?: string;
  description?: string;
  status?: UniverseStatus;
}

const emptyNameError = "Universe name cannot be empty.";
export const universeInUseError = "Cannot delete universe while it is in use.";

function ok(state: AppState): UniverseActionResult {
  return { state, ok: true };
}

function fail(state: AppState, error: string): UniverseActionResult {
  return { state, ok: false, error };
}

function normalizeName(name: string) {
  return name.trim();
}

function normalizeDescription(description: string | undefined) {
  return description?.trim() ?? "";
}

export function universeStatus(universe: Universe): UniverseStatus {
  return universe.status ?? "active";
}

export function isUniverseActive(universe: Universe) {
  return universeStatus(universe) === "active";
}

export function universeOptionsForItemUniverseIds(universes: Universe[], itemUniverseIds: string[]) {
  const referencedUniverseIds = new Set(itemUniverseIds.filter(Boolean));

  return universes.filter((universe) => isUniverseActive(universe) || referencedUniverseIds.has(universe.id));
}

export function createUniverse(state: AppState, input: CreateUniverseInput): UniverseActionResult {
  const name = normalizeName(input.name);

  if (!name) {
    return fail(state, emptyNameError);
  }

  const universe: Universe = {
    id: id("universe"),
    name,
    description: normalizeDescription(input.description),
    purpose: "",
    focus: "secondary",
    status: "active"
  };

  return ok({
    ...state,
    universes: [universe, ...state.universes]
  });
}

export function updateUniverse(
  state: AppState,
  universeId: string,
  patch: UpdateUniversePatch
): UniverseActionResult {
  const universe = state.universes.find((item) => item.id === universeId);

  if (!universe) {
    return fail(state, "Universe not found.");
  }

  if (patch.name !== undefined && !normalizeName(patch.name)) {
    return fail(state, emptyNameError);
  }

  return ok({
    ...state,
    universes: state.universes.map((item) => {
      if (item.id !== universeId) return item;

      return {
        ...item,
        ...(patch.name !== undefined ? { name: normalizeName(patch.name) } : {}),
        ...(patch.description !== undefined ? { description: normalizeDescription(patch.description) } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {})
      };
    })
  });
}

export function archiveUniverse(state: AppState, universeId: string): UniverseActionResult {
  return updateUniverse(state, universeId, { status: "archived" });
}

export function restoreUniverse(state: AppState, universeId: string): UniverseActionResult {
  return updateUniverse(state, universeId, { status: "active" });
}

export function deleteUniverse(
  state: AppState,
  universeId: string,
  mode: DeleteUniverseMode
): UniverseActionResult {
  const universe = state.universes.find((item) => item.id === universeId);

  if (!universe) {
    return fail(state, "Universe not found.");
  }

  const isInUse =
    state.thoughts.some((thought) => thought.universeId === universeId) ||
    state.projects.some((project) => project.universeId === universeId);

  if (mode === "blockIfInUse" && isInUse) {
    return fail(state, universeInUseError);
  }

  return ok({
    ...state,
    universes: state.universes.filter((item) => item.id !== universeId),
    thoughts: mode === "detach"
      ? state.thoughts.map((thought) =>
          thought.universeId === universeId ? { ...thought, universeId: "" } : thought
        )
      : state.thoughts,
    projects: mode === "detach"
      ? state.projects.map((project) =>
          project.universeId === universeId ? { ...project, universeId: "" } : project
        )
      : state.projects
  });
}
