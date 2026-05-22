import type { AppState, Universe, UniverseStatus } from "./types";
import { isUniverseActive as isUniverseSemanticallyActive } from "./semantics/statusSemantics";
import { removeRelationshipsForNode } from "./relationships/relationshipGraph";
import { removeDeletedNodeReferences } from "./mutations/referenceCleanup";
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
export const universeNotFoundError = "universe_not_found";
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
  return isUniverseSemanticallyActive(universe);
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
    return fail(state, universeNotFoundError);
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
    return fail(state, universeNotFoundError);
  }

  const isInUse =
    state.thoughts.some((thought) => thought.universeId === universeId) ||
    state.projects.some((project) => project.universeId === universeId) ||
    state.blockingQuestions?.some((question) => question.linkedUniverseIds?.includes(universeId)) ||
    state.decisionRecords?.some((record) => record.linkedUniverseIds?.includes(universeId));

  if (mode === "blockIfInUse" && isInUse) {
    return fail(state, universeInUseError);
  }

  const relationshipCleanup = removeRelationshipsForNode(state, { id: universeId, type: "universe" });
  const referenceCleanup = mode === "detach"
    ? removeDeletedNodeReferences(relationshipCleanup.state, { id: universeId, type: "universe" })
    : relationshipCleanup.state;

  return ok({
    ...referenceCleanup,
    universes: referenceCleanup.universes.filter((item) => item.id !== universeId)
  });
}
