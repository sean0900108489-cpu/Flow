# Architecture Hardening Context

This file is a handoff context for Architecture Hardening Round 1. It is not general product documentation. It is intended to help the next model reason about architecture drift, AppState source-of-truth, mutation authority, relationship ownership, graph integrity, lifecycle/status/readiness semantics, persistence/import/export safety, AI patch boundaries, hidden cross-entity coupling, and dangerous mutation entrypoints.

Scan scope: repo source under `src/`, tests under `src/**/*.test.*` and `tests/`, `package.json`, and architecture notes under `docs/architecture/` plus `docs/safe-mutation-policy.md`. Dependency/build/generated outputs such as `node_modules/`, `dist/`, `playwright-report/`, `.vercel/`, and `test-results/` are not treated as source authority.

Authority note: `docs/architecture/*.md` files explicitly say they are draft coordination scaffolds. Trust source and tests first, then docs.

---

## 0. Executive Summary

- AppState canonical definition is in `src/domain/types.ts`. `src/domain/appState.ts` is the import/save/load normalizer, not the canonical type definition.
- Runtime mutation is actually concentrated in `src/App.tsx`: it owns `useState<AppState>`, the `save(next)` wrapper, import replacement, AI accept/reject handling, and all screen callbacks. Domain modules usually return `{ state, ok }` snapshots; `App.tsx` decides whether to install and persist them.
- Relationship mutation / cleanup is split. Creation is owned by `src/domain/relationships/relationshipGraph.ts#createTypedRelationship` through `src/domain/relationshipExplorer.ts#createRelationshipSafe`, with one special creation path in `src/domain/projectActions.ts#promoteThoughtToProject`. Cleanup is owned by `removeRelationshipsForNode` plus `src/domain/mutations/referenceCleanup.ts#removeDeletedNodeReferences`, called from delete helpers for thoughts, projects, universes, blocking questions, and decision records.
- Status / readiness / lifecycle have semantic overlap. `Project.status`, `Project.lifecycleStatus`, stored `Project.readiness`, computed `readiness(project)`, handoff readiness, engineering readiness, review queue status, blocking question status, decision status, and next action status are related but not governed by one single semantic table.
- Import/export/AI patch main risks: AppState import validates only top-level shape before full replacement; normalization repairs relationship endpoint types only when resolvable and preserves orphans; `save(next)` sets raw runtime state before persistence normalization; AI patches are key-whitelisted but not value-validated and bypass normal thought/project validators.
- Most likely architecture drift hotspots: `src/App.tsx`, `src/domain/types.ts`, `src/domain/appState.ts`, `src/domain/blockingQuestions.ts` duplicate `normalizeAppState`, `src/domain/relationships/relationshipGraph.ts`, `src/domain/mutations/referenceCleanup.ts`, `src/domain/projectActions.ts`, `src/domain/nextActions.ts`, `src/domain/engineeringReadiness.ts`, `src/domain/engineeringHandoff.ts`, `src/services/appStateTransfer.ts`, `src/services/storage.ts`, and `src/domain/mutations/aiPatchMutations.ts`.

---

## 1. Core Files Included

| File path | Why included | Related concern |
| --- | --- | --- |
| `package.json` | Defines verification commands and app shape: Vite/React/TypeScript/Vitest/Playwright. | validation |
| `src/domain/types.ts` | Canonical compile-time AppState, entity, relationship, status, readiness, next action, and AI patch shape. | AppState, relationship, status semantics, persistence, AI patch |
| `src/domain/appState.ts` | Central AppState normalization used by persistence/import/export and production readiness. | AppState, import/export, persistence, validation |
| `src/data/seed.ts` | Fallback/reset AppState and representative legacy-ish seed relationship. | AppState, persistence, relationship, status semantics |
| `src/App.tsx` | Runtime state holder, save/persist coordinator, and UI-to-domain mutation dispatcher. | mutation, persistence, import/export, AI patch |
| `src/services/storage.ts` | localStorage load/save boundary and fallback behavior. | persistence, validation |
| `src/services/appStateTransfer.ts` | Full AppState JSON import/export boundary and shallow validation. | import/export, validation, persistence |
| `src/components/screens/AppStateTransfer.tsx` | User import/export UI that full-replaces current runtime state. | import/export, mutation |
| `src/services/exportEngineeringInput.ts` | Per-project engineering export shape, separate from full AppState export. | import/export, derived state |
| `src/components/screens/Export.tsx` | User engineering export UI. | import/export, derived state |
| `src/domain/mutations/appMutations.ts` | Primary thought/project create/update/archive/restore/delete helper set. | mutation, relationship, status semantics |
| `src/domain/mutations/referenceCleanup.ts` | Cross-entity stale-reference cleanup after deletes. | relationship, graph integrity, mutation |
| `src/domain/mutations/aiPatchMutations.ts` | AI patch application boundary and whitelist. | AI patch, mutation, validation |
| `src/domain/mutations/safeMutationPolicy.ts` | Source-side policy registry for safe mutation expectations. | mutation, relationship, validation |
| `docs/safe-mutation-policy.md` | Human policy document aligned with v0.2.3 safe mutation pass. | mutation, relationship, AI patch |
| `src/domain/relationships/relationshipGraph.ts` | Relationship graph node/edge derivation, endpoint repair, relationship creation/removal. | relationship, graph integrity, mutation, validation |
| `src/domain/relationshipExplorer.ts` | Relationship Explorer domain facade and create entrypoint. | relationship, derived state, mutation |
| `src/domain/projectActions.ts` | Project create/update/link/unlink/promote and project-readiness recompute. | mutation, relationship, status semantics |
| `src/domain/universeActions.ts` | Universe create/update/archive/restore/delete/detach behavior. | mutation, relationship, status semantics |
| `src/domain/blockingQuestions.ts` | Blocking question defaults, normalization, CRUD, and decision summary. | mutation, status semantics, validation |
| `src/domain/decisionRecords.ts` | Decision record CRUD, accept/supersede/archive/delete, source-question resolution. | mutation, relationship, status semantics |
| `src/domain/thoughtTriage.ts` | Thought triage derived stage plus thought patch/status transitions. | mutation, derived state, status semantics |
| `src/domain/readiness.ts` | Computed project content readiness. | derived state, status semantics |
| `src/domain/semantics/statusSemantics.ts` | Thought/universe/AI status semantic helpers. | status semantics, derived state |
| `src/domain/semantics/projectSemantics.ts` | Project status/lifecycle/readiness/blocking semantic helpers. | status semantics, relationship |
| `src/domain/semantics/questionDecisionSemantics.ts` | Blocking question and decision record semantic helpers. | status semantics, derived state |
| `src/domain/engineeringHandoff.ts` | Project handoff readiness, handoff package, lifecycle transition. | status semantics, relationship, mutation, derived state |
| `src/domain/engineeringReadiness.ts` | Derived engineering readiness plus persisted assessment mutation. | status semantics, persistence, derived state |
| `src/domain/reviewQueue.ts` | Derived queue from AI drafts, decisions, blockers, and handoff candidates. | derived state, status semantics |
| `src/domain/nextActions.ts` | Derived next actions plus persisted next action state mutations. | mutation, derived state, status semantics |
| `src/domain/productionReadiness.ts` | Derived production readiness from normalized AppState. | persistence, import/export, derived state |
| `src/domain/universeOverview.ts` | Derived universe package/overview from entity links and relationships. | relationship, derived state |
| `src/domain/globalSearch.ts` | Derived global index, including relationship endpoint resolution. | relationship, derived state |
| `src/services/aiMock.ts` | Deterministic AIInsight patch producer. | AI patch, mutation |
| Key tests under `src/**/*.test.*` | Existing coverage for import/export, storage, relationships, safe mutations, AI patches, semantics, and derived centers. | validation |

Excluded from this context: CSS/styling, layout-only components, common visual controls, and pure navigation rendering unless they are direct mutation/import/export/AI entrypoints.

---

## 2. AppState / Source-of-Truth Context

### `src/domain/types.ts`

summary:
- Defines the canonical compile-time AppState shape and entity interfaces.
- It is the canonical source-of-truth for TypeScript shape, status unions, relationship node types, and AI patch operation types.
- It is not runtime validation and does not enforce graph integrity, linked-id existence, timestamp validity, or cross-field status semantics.
- Ambiguity: some persisted fields are also computed elsewhere, especially `Project.readiness`; relationship endpoint types are optional for legacy compatibility.

```ts
export type ThoughtStatus = "inbox" | "active" | "paused" | "done" | "archived";
export type ProjectStatus = "active" | "archived";
export type ProjectLifecycleStatus = "planning" | "handoff_ready" | "blocked";
export type UniverseStatus = "active" | "archived";
export type Readiness = "not_ready" | "needs_clarification" | "draftable" | "ready_for_engineering";
export type BlockingQuestionStatus = "open" | "in_review" | "resolved" | "archived";
export type DecisionRecordStatus = "proposed" | "accepted" | "superseded" | "archived";
export type RelationshipNodeType = "thought" | "project" | "universe" | "blocking_question" | "decision_record";

export interface Project {
  id: string;
  sourceThoughtId?: string;
  linkedThoughtIds?: string[];
  universeId: string;
  status: ProjectStatus;
  lifecycleStatus?: ProjectLifecycleStatus;
  readiness: Readiness;
  // other descriptive fields omitted here
}

export interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  sourceType?: RelationshipNodeType;
  targetType?: RelationshipNodeType;
  type: "belongs_to" | "depends_on" | "supports" | "blocks" | "evolves_into" | "related_to";
  description: string;
}

export type AIInsightPatchOperation =
  | { type: "updateThought"; thoughtId: string; patch: Partial<ThoughtItem> }
  | { type: "updateProject"; projectId: string; patch: Partial<Project> };

export interface AppState {
  universes: Universe[];
  thoughts: ThoughtItem[];
  projects: Project[];
  relationships: Relationship[];
  aiInsights: AIInsight[];
  blockingQuestions?: BlockingQuestion[];
  decisionRecords?: DecisionRecord[];
  engineeringReadiness?: EngineeringReadinessAssessment;
  nextActionState?: NextActionState;
}
```

### `src/domain/appState.ts`

summary:
- Central normalizer used by storage, transfer, and production readiness.
- Not the canonical AppState definition; it is a compatibility/default repair boundary.
- Normalizes optional additive state, then repairs relationship endpoint types when endpoints resolve.
- Ambiguity: `normalizeAppState` sounds authoritative, but it does not validate entity internals, references, status values, timestamps, duplicate ids, or AI patch values.

```ts
export function normalizeAppState(state: AppState): AppState {
  const normalized = {
    ...state,
    blockingQuestions: normalizeBlockingQuestions(state.blockingQuestions),
    decisionRecords: state.decisionRecords ?? [],
    engineeringReadiness: normalizeEngineeringReadiness(state.engineeringReadiness),
    nextActionState: normalizeNextActionState(state.nextActionState)
  };

  return repairRelationshipEndpointTypes(normalized).state;
}
```

### `src/domain/blockingQuestions.ts`

summary:
- Owns blocking-question defaults and normalization.
- Also exports another function named `normalizeAppState`, but this duplicate only normalizes `blockingQuestions` and `decisionRecords`.
- This exported duplicate is not the central normalizer; current source imports central normalization from `src/domain/appState.ts`.
- Ambiguity: duplicate naming is a drift hazard for future agents and imports.

```ts
export function normalizeBlockingQuestions(blockingQuestions: BlockingQuestion[] | undefined) {
  return blockingQuestions === undefined
    ? defaultBlockingQuestions()
    : blockingQuestions.map(normalizeQuestion);
}

export function normalizeAppState(state: AppState): AppState {
  return {
    ...state,
    blockingQuestions: normalizeBlockingQuestions(state.blockingQuestions),
    decisionRecords: state.decisionRecords ?? []
  };
}
```

### `src/data/seed.ts`

summary:
- Provides initial/fallback/reset AppState.
- Not canonical, but it influences runtime via `fallbackState()` and the Reset Demo button.
- Contains an untyped relationship (`sourceType`/`targetType` absent), so normalizers must tolerate legacy relationship shape.
- Ambiguity: `App.tsx` reset calls `save(seed)`, which sets raw seed in runtime while storage receives normalized JSON.

```ts
export const seed: AppState = {
  universes: [...],
  thoughts: [
    {
      id: "t-1",
      status: "active",
      universeId: "u-thought",
      projectId: "p-1",
      // omitted descriptive fields
    }
  ],
  projects: [
    {
      id: "p-1",
      sourceThoughtId: "t-1",
      linkedThoughtIds: ["t-1"],
      status: "active",
      readiness: "draftable",
      // lifecycleStatus omitted in seed project
    }
  ],
  relationships: [
    {
      id: "r-1",
      sourceId: "t-2",
      targetId: "t-1",
      type: "supports",
      description: "..."
    }
  ],
  aiInsights: [],
  engineeringReadiness: {...},
  nextActionState: {...},
  blockingQuestions: [...]
};
```

### `src/App.tsx`

summary:
- De facto runtime AppState holder and mutation coordinator.
- Calls `loadState()` once to initialize, then `save(next)` for runtime replacement and persistence.
- Not the canonical source-of-truth for shape, but it is the practical runtime source-of-truth while the app is mounted.
- Ambiguity: `save(next)` does not normalize before `setState(next)`, so runtime state and persisted state can diverge if `next` is not already normalized.

```tsx
const [state, setState] = useState<AppState>(() => loadState());

const save = (next: AppState) => {
  setState(next);
  saveState(next);
};

const applySafeMutationResult = (result: SafeMutationResult) => {
  if (!result.ok) {
    setSystemMessage(result.error ?? "Mutation failed.");
    return false;
  }

  setSystemMessage("");
  save(result.state);
  return true;
};
```

### `src/services/storage.ts`

summary:
- Owns localStorage key and load/save persistence boundary.
- Load validates shallow AppState shape, normalizes defaults/relationship endpoint types, or falls back to normalized seed.
- Save serializes normalized state, but the caller's in-memory state is not normalized by this function.
- Ambiguity: invalid field-level data can pass validation and become runtime state.

```ts
export const STORAGE_KEY = "todo-thought-universe:v1";

export function loadState(): AppState {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return fallbackState();

  const result = validateAppState(JSON.parse(raw));
  return result.ok && result.state ? result.state : fallbackState();
}

export function saveState(state: AppState) {
  storage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state), null, 2));
}
```

### `src/services/appStateTransfer.ts`

summary:
- Owns full AppState JSON import/export.
- Validation checks only root object and required/optional collection object types.
- Returns `normalizeAppState(value as AppState)` after shallow checks.
- Ambiguity: import can full-replace runtime state with malformed entity fields, stale linked ids, invalid status strings, duplicate ids, or unsafe AI patch values if top-level shape passes.

```ts
export function validateAppState(value: unknown): AppStateImportResult {
  if (!isRecord(value)) return { ok: false, error: "Imported JSON must be an object." };

  const requiredArrays = ["universes", "thoughts", "projects", "relationships", "aiInsights"] as const;
  for (const key of requiredArrays) {
    if (!Array.isArray(value[key])) {
      return { ok: false, error: `Missing or invalid array: ${key}` };
    }
  }

  if ("nextActionState" in value && value.nextActionState !== undefined && !isRecord(value.nextActionState)) {
    return { ok: false, error: "Invalid object: nextActionState" };
  }

  return { ok: true, state: normalizeAppState(value as unknown as AppState) };
}
```

### `src/domain/relationships/relationshipGraph.ts`

summary:
- Defines derived graph node/edge types and relationship mutation helpers.
- Not canonical AppState, but it is the canonical relationship graph interpretation.
- Repairs legacy endpoint types on normalization when endpoint ids resolve unambiguously.
- Ambiguity: relationship edges are only one relationship mechanism; many other cross-entity links are separate id arrays/fields.

```ts
export type RelationshipGraphNode = {
  id: string;
  type: RelationshipNodeType;
  title: string;
  status?: string;
  universeId?: string;
};

export type RelationshipEndpointStatus = "resolved" | "missing" | "ambiguous";

export function listRelationshipGraphNodes(state: AppState): RelationshipGraphNode[] {
  return [
    ...state.thoughts.map(thoughtNode),
    ...state.projects.map(projectNode),
    ...state.universes.map(...),
    ...(state.blockingQuestions ?? []).map(...),
    ...(state.decisionRecords ?? []).map(...)
  ].sort(compareNodes);
}
```

### `src/domain/engineeringReadiness.ts`

summary:
- Defines persisted `EngineeringReadinessAssessment` defaults/normalization and derived `EngineeringReadinessSummary`.
- Not AppState canonical source-of-truth; it owns one optional AppState subobject's normalization and mutation.
- Ambiguity: readiness summary uses blocking-question defaults, review queue, orphan relationships, and manual assessment, so its status can drift from project-level readiness terms.

```ts
export function normalizeEngineeringReadiness(
  assessment: EngineeringReadinessAssessment | undefined
): EngineeringReadinessAssessment {
  const fallback = defaultEngineeringReadinessAssessment();
  if (!assessment) return fallback;

  return {
    note: clean(assessment.note),
    manualConfidence: isConfidence(assessment.manualConfidence) ? assessment.manualConfidence : fallback.manualConfidence,
    targetPhase: isTargetPhase(assessment.targetPhase) ? assessment.targetPhase : fallback.targetPhase,
    lastReviewedAt: clean(assessment.lastReviewedAt) || undefined,
    updatedAt: clean(assessment.updatedAt) || fallback.updatedAt
  };
}
```

### `src/domain/nextActions.ts`

summary:
- Defines derived `NextActionItem` plus persisted `NextActionState` defaults/normalization and mutations.
- Not AppState canonical source-of-truth; owns one optional AppState subobject's normalizer.
- Ambiguity: next action ids are encoded strings such as `thought:t-1` and `blocking_question:bq-1`; cleanup depends on prefix conventions rather than typed refs.

```ts
export function normalizeNextActionState(state: NextActionState | undefined): NextActionState {
  const fallback = defaultNextActionState();
  if (!state) return fallback;

  return {
    savedActionIds: unique(state.savedActionIds ?? []),
    selectedFocusActionId: text(state.selectedFocusActionId) || undefined,
    dismissedActionIds: unique(state.dismissedActionIds ?? []),
    manualNote: text(state.manualNote),
    manualConfidence: isConfidence(state.manualConfidence) ? state.manualConfidence : fallback.manualConfidence,
    focusMode: isFocusMode(state.focusMode) ? state.focusMode : fallback.focusMode,
    lastReviewedAt: text(state.lastReviewedAt) || undefined,
    updatedAt: text(state.updatedAt) || fallback.updatedAt
  };
}
```

---

## 3. Runtime Mutation Authority Map

### Top-level mutation flow

`src/App.tsx` converts UI intent into domain calls, then persists accepted next AppState snapshots.

```tsx
const applyProjectResult = (result: ProjectActionResult) => {
  if (result.ok) {
    save(result.state);
  }

  return { ok: result.ok, error: result.error, projectId: result.projectId };
};

const handleCreateRelationshipSafe = (input: CreateRelationshipSafeInput): CreateRelationshipSafeResult => {
  const result = createRelationshipSafe(state, input);

  if (result.ok) {
    save(result.state);
  }

  return result;
};
```

### Mutation owner table

| Mutation surface | Primary implementation | Runtime caller | Notes / drift risk |
| --- | --- | --- | --- |
| Create/update/archive/restore/delete thought | `src/domain/mutations/appMutations.ts` | `src/App.tsx`, `ThoughtDetail`, `Capture`, `ArchivedItems` | `updateThought` validates empty title but allows status/universe/type changes without graph validation. |
| Thought triage update / mark triaged | `src/domain/thoughtTriage.ts` | `src/App.tsx`, `ThoughtTriageCenter` | Separate thought mutation path from `appMutations`; can change fields overlapping `updateThought`. |
| Create/update/archive/restore/delete project | Create/update/link/promote in `src/domain/projectActions.ts`; archive/restore/delete in `src/domain/mutations/appMutations.ts` | `src/App.tsx`, `ProjectDetail`, `Projects`, `ArchivedItems` | Project mutation authority is split across two files. |
| Project handoff-ready transition | `src/domain/engineeringHandoff.ts#markProjectHandoffReady` | `src/App.tsx`, `EngineeringHandoffCenter`, `ReviewQueueCenter` | Writes both `lifecycleStatus` and `readiness`. |
| Create/update/archive/restore/delete universe | `src/domain/universeActions.ts` | `src/App.tsx`, `Universes` | Delete has `blockIfInUse` or `detach`; detach clears linked ids to empty strings/arrays. |
| Blocking question CRUD/status | `src/domain/blockingQuestions.ts` | `src/App.tsx`, `BlockingQuestionsCenter`, `ReviewQueueCenter` | `deleteBlockingQuestion` does not first assert existence; link arrays are not id-validated. |
| Decision record CRUD/status | `src/domain/decisionRecords.ts` | `src/App.tsx`, `DecisionRecordsCenter`, `ReviewQueueCenter` | Accepting a decision can resolve source blocking question. |
| Relationship create | `src/domain/relationships/relationshipGraph.ts#createTypedRelationship`, wrapped by `src/domain/relationshipExplorer.ts#createRelationshipSafe` | `src/App.tsx`, `RelationshipExplorer` | Creates graph edge only; does not update `Project.linkedThoughtIds` or `Thought.projectId`. |
| Promotion thought to project | `src/domain/projectActions.ts#promoteThoughtToProject` | `src/App.tsx`, `ThoughtDetail`, `ThoughtTriageCenter` | Creates project, sets thought/project fields, then tries to create `evolves_into` relationship; returns ok even if relationship creation fails. |
| AI insight draft generation | `src/services/aiMock.ts`, inline `App.tsx#ai` | `AIPanel`, `ThoughtDetail`, `ProjectDetail` | Direct `save({...state, aiInsights: [...]})` bypasses domain mutation registry. |
| AI insight accept/reject | `src/App.tsx#acceptAI` and `src/domain/mutations/aiPatchMutations.ts` | `AIPanel`, `ReviewQueueCenter` | Patch applies before insight status change; bypasses normal thought/project validators. |
| Engineering readiness assessment | `src/domain/engineeringReadiness.ts#updateEngineeringReadinessAssessment` | `EngineeringReadinessCenter` | Persists manual assessment; derived summary recomputed elsewhere. |
| Next action state / source actions | `src/domain/nextActions.ts` | `NextActionCenter` | Mutates persisted nextActionState and can directly mutate thought/project nextAction or blocking question status. |
| Full AppState import | `src/services/appStateTransfer.ts`, `AppStateTransfer` screen, `src/App.tsx#onImport` | `AppStateTransfer` | Full runtime replacement after shallow validation. |
| Persistence save/load | `src/services/storage.ts` | `src/App.tsx#save` | Save normalizes only serialized JSON, not runtime `setState`. |

### Dangerous direct writes in `App.tsx`

```tsx
const ai = (targetId: string) => {
  // creates AIInsight inline, not through a domain mutation owner
  save({
    ...state,
    aiInsights: [{ id: id("ai"), createdAt: now(), ...draft }, ...state.aiInsights]
  });
};

const acceptAI = (aiId: string, status: "accepted" | "rejected") => {
  const insight = state.aiInsights.find((x) => x.id === aiId);
  const patchedState = status === "accepted" && insight ? applyAiInsightPatch(state, insight) : state;

  save({
    ...patchedState,
    aiInsights: patchedState.aiInsights.map((x) => x.id === aiId ? { ...x, status } : x)
  });
};

<button className="ghost full" onClick={() => save(seed)}>重置 Demo</button>
```

---

## 4. Relationship Ownership / Graph Integrity

### Relationship graph owner

`src/domain/relationships/relationshipGraph.ts` is the closest thing to a graph authority. It owns:
- supported relationship node types and relationship types
- node derivation from AppState collections
- endpoint resolution: `resolved`, `missing`, `ambiguous`
- typed relationship creation
- legacy endpoint type repair
- relationship removal by typed node

```ts
export const relationshipNodeTypes: RelationshipNodeType[] = [
  "thought",
  "project",
  "universe",
  "blocking_question",
  "decision_record"
];

export function resolveRelationshipEndpoint(
  state: AppState,
  nodeId: string,
  explicitType?: RelationshipNodeType
): RelationshipEndpointResolution {
  const candidates = explicitType
    ? listRelationshipGraphNodes(state).filter((node) => node.id === nodeId && node.type === explicitType)
    : findRelationshipGraphNodesById(state, nodeId);

  if (candidates.length === 0) return { id: nodeId, explicitType, status: "missing", candidates: [] };
  if (candidates.length > 1 && !explicitType) return { id: nodeId, explicitType, status: "ambiguous", candidates };

  return { id: nodeId, explicitType, status: "resolved", node: candidates[0], candidates };
}
```

### Relationship creation

Creation is typed and validates endpoints, duplicate edge, type, and self-link.

```ts
export function createTypedRelationship(
  state: AppState,
  input: CreateRelationshipInput
): CreateRelationshipResult {
  if (!isSupportedRelationshipType(input.type)) {
    return { state, ok: false, error: "Invalid relationship type." };
  }

  const source = resolveRelationshipEndpoint(state, input.sourceId, input.sourceType);
  const target = resolveRelationshipEndpoint(state, input.targetId, input.targetType);

  if (source.status !== "resolved") return { state, ok: false, error: "Source node not found." };
  if (target.status !== "resolved") return { state, ok: false, error: "Target node not found." };
  if (input.sourceId === input.targetId && input.sourceType === input.targetType) {
    return { state, ok: false, error: "Source and target must be different." };
  }

  return {
    state: { ...state, relationships: [relationship, ...state.relationships] },
    ok: true,
    relationshipId
  };
}
```

### Relationship repair and orphan policy

Import/load/save normalization repairs missing endpoint types when both endpoints are resolvable. Orphans are preserved and can be surfaced by warning-capable views.

```ts
export function repairRelationshipEndpointTypes(state: AppState): RelationshipEndpointRepairResult {
  const relationships = state.relationships.map((relationship) => {
    const source = resolveRelationshipEndpoint(state, relationship.sourceId, relationship.sourceType);
    const target = resolveRelationshipEndpoint(state, relationship.targetId, relationship.targetType);

    if (source.status !== "resolved" || target.status !== "resolved") {
      orphanRelationshipIds.push(relationship.id);
      return relationship;
    }

    return {
      ...relationship,
      sourceType: relationship.sourceType ?? source.node.type,
      targetType: relationship.targetType ?? target.node.type
    };
  });

  return { state: { ...state, relationships }, repairedRelationshipIds, orphanRelationshipIds, warnings };
}
```

### Delete cleanup owner

Primary delete helpers call `removeRelationshipsForNode`, then `removeDeletedNodeReferences`.

```ts
export function deleteThought(state: AppState, thoughtId: string): ThoughtMutationResult {
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
```

```ts
export function removeDeletedNodeReferences(state: AppState, node: RelationshipNodeRef): AppState {
  const cleanedState =
    node.type === "thought" ? removeThoughtReferences(state, node.id) :
    node.type === "project" ? removeProjectReferences(state, node.id) :
    node.type === "universe" ? removeUniverseReferences(state, node.id) :
    node.type === "blocking_question" ? removeBlockingQuestionReferences(state, node.id) :
    removeDecisionRecordReferences(state, node.id);

  return removeNextActionReferences(cleanedState, node);
}
```

### Relationship-like fields outside `relationships`

These are not graph edges but act as relationship sources-of-truth in derived views:

| Field | Owner / writer | Cleanup path | Drift concern |
| --- | --- | --- | --- |
| `ThoughtItem.projectId` | `projectActions`, `referenceCleanup`, manual delete cleanup | `removeProjectReferences`, `unlinkThoughtFromProject` | Can drift from `Project.linkedThoughtIds` and `relationships`. |
| `Project.sourceThoughtId` | `promoteThoughtToProject`, `referenceCleanup` | `removeThoughtReferences` | Not guaranteed to have a matching `Relationship`. |
| `Project.linkedThoughtIds` | `createProject`, `updateProjectDetails`, `linkThoughtToProject`, `unlinkThoughtFromProject` | `removeThoughtReferences` | No id validation; no automatic graph edge. |
| `ThoughtItem.universeId`, `Project.universeId` | create/update/detail/import/universe detach | `removeUniverseReferences` | Can be empty or point to missing universe. |
| `BlockingQuestion.linkedThoughtIds/linkedProjectIds/linkedUniverseIds` | blocking question create/update/import/defaults | `referenceCleanup` | No id validation on create/update/import. |
| `DecisionRecord.linkedThoughtIds/linkedProjectIds/linkedUniverseIds` | decision create/update/import/from question | `referenceCleanup` | No id validation. |
| `DecisionRecord.sourceBlockingQuestionId` | decision create/from question/import | `removeBlockingQuestionReferences` | Accepting a decision mutates the source question. |
| `DecisionRecord.supersedesDecisionId` | decision create/update/supersede/import | `removeDecisionRecordReferences` | No id validation except delete cleanup. |
| `AIInsight.targetId` and `patch.targetType/targetId` | AI generation/import | `removeThoughtReferences`, `removeProjectReferences` | Target resolution is inferred in Review Queue; no general target validator. |
| `NextActionState.*ActionIds` | nextActions pin/dismiss/import | `removeNextActionReferences` | Encoded string ids rely on prefix convention. |

### Graph integrity risks for Round 1

- Relationship graph and link arrays are parallel systems. `promoteThoughtToProject` writes both; relationship creation writes only `relationships`; link/unlink writes only project/thought fields.
- `removeRelationshipsForNode` treats an untyped relationship endpoint with a matching id as touching a typed node. This preserves legacy behavior but can over-remove in same-id cross-type scenarios.
- Import preserves orphan relationships by design; downstream views need a clear policy for whether orphans are warnings, invalid state, or repair candidates.
- Relationship endpoint repair can only repair when ids are unique across node types or explicit types exist.
- No general invariant checker currently proves all linked ids point to existing entities.

---

## 5. Status / Readiness / Lifecycle Semantics

### Semantic helper files

| File | What it owns | Concern |
| --- | --- | --- |
| `src/domain/semantics/statusSemantics.ts` | Thought archive/active/paused/inbox, universe active/archive, AI draft review visibility. | Basic status semantics |
| `src/domain/semantics/projectSemantics.ts` | Project archive/active, lifecycle default, lifecycle blocked/handoff-ready, project content readiness, blocker checks, handoff eligibility. | Project lifecycle/readiness |
| `src/domain/semantics/questionDecisionSemantics.ts` | Blocking question unresolved/resolved/high-impact/review visibility, decision accepted/pending/archive visibility, accepted decision source resolution. | Decision/status semantics |
| `src/domain/readiness.ts` | Field-completeness readiness for a single project. | Derived readiness |
| `src/domain/engineeringHandoff.ts` | Handoff readiness and `handoff_ready` lifecycle transition. | Lifecycle/readiness boundary |
| `src/domain/engineeringReadiness.ts` | Whole-app readiness summary from decisions/review/persistence/manual assessment. | Lifecycle/readiness boundary |
| `src/domain/reviewQueue.ts` | Derived review statuses from AI drafts, decisions, blockers, handoff candidates. | Status overlap |
| `src/domain/nextActions.ts` | Derived next action statuses and source mutation effects. | Status overlap |

### Project semantics overlap

```ts
export function projectLifecycleStatus(project: Pick<Project, "lifecycleStatus">): ProjectLifecycleStatus {
  return project.lifecycleStatus ?? "planning";
}

export function isProjectArchived(project: Pick<Project, "status">) {
  return project.status === "archived";
}

export function isProjectLifecycleBlocked(project: Pick<Project, "lifecycleStatus">) {
  return projectLifecycleStatus(project) === "blocked";
}

export function isProjectReadyForEngineering(project: Pick<Project, "readiness">) {
  return project.readiness === "ready_for_engineering";
}

export function canProjectEnterEngineeringHandoff(project: Project, state?: AppState) {
  return isProjectActive(project) &&
    !isProjectBlocked(project, state) &&
    getProjectContentReadiness(project).value === "ready_for_engineering";
}
```

Risk: `Project.readiness` is persisted, but `canProjectEnterEngineeringHandoff` uses computed `getProjectContentReadiness(project).value`, not necessarily the stored value.

```ts
function withComputedReadiness(project: Project, explicitReadiness?: Readiness): Project {
  return {
    ...project,
    readiness: explicitReadiness ?? projectReadiness(project).value
  };
}
```

Risk: `updateProjectDetails` can accept explicit readiness through `patch.readiness`, although current UI does not expose it. Import can set any value at runtime because validation is shallow.

### Handoff semantics

```ts
export function evaluateProjectHandoff(project: Project, state: AppState): ProjectHandoffStatus {
  const existingReadiness = projectReadiness(project);
  const isArchived = isProjectArchived(project);
  const isLifecycleBlocked = isProjectLifecycleBlocked(project);
  const isBlockedByRelationship = hasBlockingRelationshipToProject(project, state.relationships);
  const unresolvedHandoffQuestions = getProjectUnresolvedHandoffQuestions(project, state);

  if (!hasTitle || isArchived || isLifecycleBlocked || isBlockedByRelationship || isBlockedByQuestion) {
    readiness = "blocked";
  } else if (unique(missing).length === 0 && existingReadiness.value === "ready_for_engineering") {
    readiness = "ready";
  }
}

export function markProjectHandoffReady(state: AppState, projectId: string): MarkProjectHandoffReadyResult {
  const status = evaluateProjectHandoff(project, state);
  if (status.readiness !== "ready") {
    return { ok: false, state, error: "Project is not ready for engineering handoff." };
  }

  return {
    ok: true,
    state: {
      ...state,
      projects: state.projects.map((item) =>
        item.id === projectId
          ? { ...item, lifecycleStatus: "handoff_ready", readiness: "ready_for_engineering", updatedAt: now() }
          : item
      )
    }
  };
}
```

Risk: `ProjectDetail` lets the user directly choose `lifecycleStatus`, including `handoff_ready`, without going through `markProjectHandoffReady`.

### Thought semantics

```ts
export function isThoughtArchived(thought: Pick<ThoughtItem, "status">) {
  return isArchivedStatus(thought.status);
}

export function isThoughtActive(thought: Pick<ThoughtItem, "status">) {
  return !isThoughtArchived(thought);
}

export function shouldThoughtAppearInNextAction(thought: Pick<ThoughtItem, "status" | "nextAction">) {
  return isThoughtActive(thought) && thought.nextAction.trim().length > 0;
}
```

Risk: `"done"` is treated as active because only `"archived"` is inactive. A done thought with a non-empty next action can still appear in Next Action.

### Blocking question and decision semantics

```ts
const unresolvedBlockingQuestionStatuses = new Set(["open", "in_review"]);

export function shouldBlockingQuestionAffectEngineeringReadiness(
  question: Pick<BlockingQuestion, "status" | "impactLevel">
) {
  return isBlockingQuestionUnresolved(question) && isHighImpactBlockingQuestion(question);
}

export function shouldDecisionRecordAppearInReviewQueue(record: Pick<DecisionRecord, "status">) {
  return isDecisionRecordPending(record);
}
```

```ts
export function acceptDecisionRecord(state: AppState, decisionRecordId: string) {
  const record = records(state).find((item) => item.id === decisionRecordId);
  const result = updateDecisionRecord(state, decisionRecordId, { status: "accepted" });

  if (!result.ok || !record?.sourceBlockingQuestionId) return result;

  return {
    ...result,
    state: {
      ...result.state,
      blockingQuestions: (result.state.blockingQuestions ?? []).map((question) =>
        question.id === record.sourceBlockingQuestionId && !isBlockingQuestionArchived(question)
          ? { ...question, status: "resolved" as const, finalResolution: ..., updatedAt: now() }
          : question
      )
    }
  };
}
```

Risk: accepting a decision mutates another entity's lifecycle/status. This is intentional but should be documented as relationship-owned behavior.

### Semantic overlap matrix

| Concept | Stored or derived | Current source | Ambiguity |
| --- | --- | --- | --- |
| Thought workflow | Stored `ThoughtItem.status` | `types.ts`, `statusSemantics.ts`, `thoughtTriage.ts`, `appMutations.ts` | `"done"` still active for next actions. |
| Project archive | Stored `Project.status` | `types.ts`, `projectSemantics.ts`, `appMutations.ts`, `ProjectDetail` | User can set directly or via archive helper. |
| Project lifecycle | Stored optional `Project.lifecycleStatus` | `types.ts`, `projectSemantics.ts`, `engineeringHandoff.ts`, `ProjectDetail` | UI can set `handoff_ready` without handoff guard. |
| Project content readiness | Stored `Project.readiness` and computed `readiness(project)` | `types.ts`, `readiness.ts`, `projectActions.ts`, `engineeringHandoff.ts` | Stored value can drift from computed value. |
| Project handoff readiness | Derived `ready/needs_clarification/blocked` | `engineeringHandoff.ts` | Uses computed readiness plus blockers, not just stored readiness. |
| Engineering readiness | Derived overall status plus stored manual assessment | `engineeringReadiness.ts` | Whole-app readiness may be confused with project readiness. |
| Review status | Derived `ReviewQueueItem.status` from source entities | `reviewQueue.ts` | Uses strings from different domains in one filter. |
| Next action status | Derived `available/blocked/completed` plus source status | `nextActions.ts` | Source mutations can change thought/project/question statuses. |
| Universe archive | Stored optional `Universe.status` defaulting active | `types.ts`, `universeActions.ts`, `statusSemantics.ts` | Optional field means absence is active. |

---

## 6. Import / Export / Persistence Safety

### Current flow

```text
loadState()
  -> localStorage[todo-thought-universe:v1]
  -> validateAppState(JSON.parse(raw))
  -> normalizeAppState(...)
  -> React useState initial value

save(next)
  -> setState(next)
  -> saveState(next)
  -> JSON.stringify(normalizeAppState(next))

AppStateTransfer import
  -> parseAppStateJson(importText)
  -> validateAppState(...)
  -> normalizeAppState(...)
  -> App.tsx onImport(nextState)
  -> save(nextState)
```

### `src/components/screens/AppStateTransfer.tsx`

```tsx
const json = stringifyAppState(state);

const runImport = () => {
  const result = parseAppStateJson(importText);

  if (!result.ok || !result.state) {
    setMessage(`匯入失敗：${result.error ?? "Invalid app state."}`);
    return;
  }

  setImportText("");
  onImport(result.state);
};
```

### Full replacement in `src/App.tsx`

```tsx
<AppStateTransfer
  state={state}
  onImport={(nextState) => {
    save(nextState);
    setSelectedThoughtId(nextState.thoughts[0]?.id ?? "");
    setSelectedProjectId(nextState.projects[0]?.id ?? "");
    setSelectedUniverseId(nextState.universes[0]?.id ?? "");
    setSystemMessage("App State imported successfully. Decision, readiness, and next action data were normalized.");
    setScreen("dashboard");
  }}
/>
```

### Import/export risks

- `validateAppState` does not validate entity fields: ids, titles, enum values, timestamps, arrays of strings, duplicate ids, target ids, or patch payloads.
- `normalizeAppState` repairs optional default state and relationship endpoint types; it does not validate cross-entity references.
- Orphan relationships are preserved, which is useful for warnings but means imported state can be graph-invalid by design.
- Full AppState import is a complete replacement of live state.
- `save(next)` sets raw runtime state first; `saveState(next)` normalizes only serialized storage. Runtime and persisted state can differ until reload.
- Full AppState export uses `stringifyAppState`, so export output is normalized even if runtime currently is not.
- Per-project engineering export (`Export` / `engineeringInput`) is derived from selected project and universe only; it is not an AppState backup and does not include relationships, blockers, decisions, or readiness assessment.

### Persistence tests currently cover

- malformed localStorage falls back to normalized seed
- invalid top-level shape falls back to normalized seed
- old AppState without optional `blockingQuestions`, `decisionRecords`, `engineeringReadiness`, or `nextActionState` receives defaults
- save normalizes before serializing
- relationship endpoint type repair on import
- orphan relationship preservation

Round 1 gap to analyze: no field-level schema validation or invariant validation exists for imported entities and linked ids.

---

## 7. AI Patch Mutation Boundary

### Patch shape is broad in types

```ts
export type AIInsightPatchOperation =
  | {
      type: "updateThought";
      thoughtId: string;
      patch: Partial<ThoughtItem>;
    }
  | {
      type: "updateProject";
      projectId: string;
      patch: Partial<Project>;
    };
```

### Runtime whitelist is narrow

```ts
const allowedThoughtKeys = ["title", "content", "type", "universeId", "why", "outcome", "nextAction"] as const;
const allowedProjectKeys = ["name", "intent", "nextAction", "universeId"] as const;

function pickAllowed<T extends object, K extends Extract<keyof T, string>>(
  source: unknown,
  keys: readonly K[]
): Partial<Pick<T, K>> {
  if (!isRecord(source)) return {};

  const next: Partial<Pick<T, K>> = {};
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined) next[key] = value as Pick<T, K>[K];
  }
  return next;
}
```

### Application bypasses normal app mutation helpers

```ts
if (operation.type === "updateThought" && targetType === "thought" && operation.thoughtId === targetId) {
  const safePatch = pickAllowed<ThoughtItem, (typeof allowedThoughtKeys)[number]>(
    operation.patch,
    allowedThoughtKeys
  );

  const thoughts = nextState.thoughts.map((thought) => {
    if (thought.id !== targetId) return thought;
    return { ...thought, ...safePatch, updatedAt: now() };
  });
}

if (operation.type === "updateProject" && targetType === "project" && operation.projectId === targetId) {
  const safePatch = pickAllowed<Project, (typeof allowedProjectKeys)[number]>(
    operation.patch,
    allowedProjectKeys
  );

  const projects = nextState.projects.map((project) => {
    if (project.id !== targetId) return project;
    const patched = { ...project, ...safePatch, updatedAt: now() };
    return { ...patched, readiness: readiness(patched).value };
  });
}
```

### What AI patches cannot directly change

Current runtime whitelist blocks direct mutation of:
- `id`
- `createdAt`
- `updatedAt` except system-generated update
- `status`
- `readiness`
- `lifecycleStatus`
- `sourceThoughtId`
- `linkedThoughtIds`
- `projectId`
- `relationships`
- arrays like `users`, `features`, `screens`, `dataObjects`, `flowSteps`, `unknowns`

### What AI patches can still change

- Thought `title`, `content`, `type`, `universeId`, `why`, `outcome`, `nextAction`
- Project `name`, `intent`, `nextAction`, `universeId`

### AI patch risks

- Value validation is shallow. Imported or future AI patches could set invalid `ThoughtType`, empty `title`, empty `Project.name`, or missing/archived `universeId`.
- AI patch bypasses `appMutations.updateThought` title validation and `projectActions.updateProjectDetails` title validation.
- AI patches can move a thought/project to another universe id without validating that the universe exists or updating relationship/link context.
- AIInsight patches are preserved by import/export; import does not validate operation values beyond top-level AppState arrays.
- `acceptAI` has no result/error channel from `applyAiInsightPatch`; a no-op patch still lets the insight become accepted.

---

## 8. Hidden Cross-Entity Coupling

| Coupling | Files | Why it matters |
| --- | --- | --- |
| Thought to project via `thought.projectId`, `project.sourceThoughtId`, `project.linkedThoughtIds`, and `Relationship(type="evolves_into")` | `types.ts`, `projectActions.ts`, `appMutations.ts`, `engineeringHandoff.ts`, `universeOverview.ts` | Four representations can drift. Promotion writes all/many; relationship create writes only edge; unlink writes fields, not edges. |
| Universe membership via direct `universeId`, linked arrays, relationship edges, and derived universe overview | `universeActions.ts`, `universeOverview.ts`, `relationshipGraph.ts`, `blockingQuestions.ts`, `decisionRecords.ts` | Deleting/detaching a universe clears direct and linked ids but not all possible semantic associations. |
| Blocking question to decision via `sourceBlockingQuestionId` and accept side effect | `decisionRecords.ts`, `blockingQuestions.ts`, `questionDecisionSemantics.ts` | Accepting a decision mutates a blocking question to resolved. |
| Project handoff blocked by relationship edges and linked blocking questions | `projectSemantics.ts`, `engineeringHandoff.ts`, `relationshipGraph.ts`, `questionDecisionSemantics.ts` | Handoff readiness can change because of either graph edges or question linked arrays. |
| Next action ids encode entity refs as strings | `nextActions.ts`, `referenceCleanup.ts` | Cleanup depends on prefixes like `thought:` and `blocking_question:`. No typed ref object exists. |
| AI insight target resolution uses both `targetId` and optional patch target type | `reviewQueue.ts`, `aiPatchMutations.ts`, `aiMock.ts` | Target can be missing, ambiguous, or inconsistent with patch metadata. |
| Stored `Project.readiness` vs computed readiness | `types.ts`, `readiness.ts`, `projectActions.ts`, `engineeringHandoff.ts`, `reviewQueue.ts` | Different views may rely on stored or computed readiness. |
| Core blocking questions are injected into legacy state | `blockingQuestions.ts`, `appState.ts`, `appStateTransfer.ts`, `storage.ts` | Normalization is not just shape repair; it adds domain records. |

Code examples:

```ts
// projectActions.ts
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
  type: "evolves_into"
});
```

```ts
// engineeringHandoff.ts
return state.thoughts.filter((thought) =>
  linkedThoughtIds.includes(thought.id) ||
  thought.projectId === project.id ||
  thought.id === project.sourceThoughtId ||
  relatedThoughtIds.includes(thought.id)
);
```

---

## 9. Dangerous Mutation Entrypoints

| Entrypoint | Why dangerous | Hardening question |
| --- | --- | --- |
| `src/App.tsx#save(next)` | Sets runtime state before normalization; persistence may differ from in-memory state. | Should `save` normalize once and set/persist the same object? |
| `src/App.tsx` Reset Demo button `save(seed)` | Raw seed has legacy untyped relationship; runtime may stay unnormalized until reload. | Should reset use `normalizeAppState(seed)`? |
| `src/components/screens/AppStateTransfer.tsx#runImport` | Full AppState replacement after shallow validation. | Should import produce warnings, invariant report, or partial repair before replacement? |
| `src/services/appStateTransfer.ts#validateAppState` | Only validates top-level arrays/objects. | Should Round 1 add runtime schema/invariant validation for entities and links? |
| `src/domain/mutations/aiPatchMutations.ts#applyAiInsightPatch` | Bypasses normal validators and allows value-unsafe descriptive fields. | Should AI patch reuse domain mutation helpers or a shared validator? |
| `src/App.tsx#acceptAI` | Accepts AI insight even if patch no-ops or target missing. | Should accept return user-visible patch result/warnings? |
| `src/domain/projectActions.ts#promoteThoughtToProject` | Returns ok even if relationship creation fails after project creation. | Should failed relationship creation make promotion fail, warn, or repair? |
| `src/domain/projectActions.ts#updateProjectDetails` | Can accept explicit readiness and linked ids; only current UI limits exposure. | Should readiness be derived-only or guarded? |
| `src/components/screens/ProjectDetail.tsx` lifecycle select | User can set `handoff_ready` directly without `markProjectHandoffReady` checks. | Should lifecycle transition authority be centralized? |
| `src/domain/blockingQuestions.ts#deleteBlockingQuestion` | Does not first verify question exists; still returns ok with filtered state. | Should delete helpers consistently fail on missing entity? |
| `src/domain/decisionRecords.ts#deleteDecisionRecord` | Same missing-entity behavior as blocking question delete. | Should delete helpers consistently fail on missing entity? |
| `src/domain/nextActions.ts#completeNextAction` | Directly mutates thought/project nextAction and blocking question status outside primary domain owners. | Should source mutation be delegated to owners? |
| `src/domain/universeActions.ts#deleteUniverse(..., "detach")` | Clears `universeId` to empty strings; derived views must tolerate no-universe state. | Should no-universe be explicit nullable semantics or a special id? |
| `src/domain/blockingQuestions.ts#normalizeAppState` | Duplicate exported name can be imported accidentally instead of central normalizer. | Should it be renamed or made private? |

---

## 10. Existing Validation / Test Signals

### Useful coverage already present

| Area | Tests |
| --- | --- |
| AppState import/export and legacy compatibility | `src/services/appStateTransfer.test.ts` |
| localStorage fallback and save normalization | `src/services/storage.test.ts` |
| AI patch whitelist and no-op behavior | `src/services/applyAiPatch.test.ts` |
| Relationship graph repair, orphans, duplicate detection, typed removal | `src/domain/relationships/relationshipGraph.test.ts` |
| Thought/project delete cleanup | `src/domain/mutations/appMutations.test.ts` |
| Universe detach/block behavior | `src/domain/universeActions.test.ts` |
| Blocking question and decision CRUD/status side effects | `src/domain/blockingQuestions.test.ts`, `src/domain/decisionRecords.test.ts` |
| Project semantics and status/readiness separation | `src/domain/semantics/statusSemantics.test.ts` |
| Engineering handoff readiness and lifecycle transition | `src/domain/engineeringHandoff.test.ts` |
| Engineering readiness summary | `src/domain/engineeringReadiness.test.ts` |
| Next action derived/mutation behavior | `src/domain/nextActions.test.ts` |
| Derived review/global/universe views | `src/domain/reviewQueue.test.ts`, `src/domain/globalSearch.test.ts`, `src/domain/universeOverview.test.ts` |

### Known coverage gaps to analyze

- No full invariant checker test suite for all AppState references.
- No runtime schema validation tests for invalid entity enum values imported from JSON.
- No test that `App.tsx#save` normalizes runtime state.
- No test for relationship/link-array consistency after manual relationship create or project unlink.
- No test for AI patch invalid allowed values such as empty project name, invalid thought type, or missing universe id.
- No test for direct `ProjectDetail` lifecycle selection bypassing handoff readiness guard.
- Delete behavior is inconsistent: thought/project fail on missing id; blocking question/decision delete currently succeed even if id is absent.

### Verification commands from `package.json`

```json
{
  "build": "tsc -b && vite build",
  "test": "vitest run",
  "e2e": "playwright test",
  "check": "npm run build && npm run test && npm run e2e"
}
```

---

## 11. Architecture Drift Hotspots

Prioritize these files during Round 1:

1. `src/App.tsx`
   - Runtime mutation hub, persistence call site, full import replacement, AI accept/reject.
   - Most likely place for accidental direct state mutation drift.

2. `src/domain/types.ts`
   - Canonical compile-time shape.
   - Any shape change affects persistence/import/export compatibility.

3. `src/domain/appState.ts`
   - Central normalization boundary.
   - Currently partial; likely place to add invariant checking or separate normalize vs validate.

4. `src/domain/blockingQuestions.ts`
   - Duplicate `normalizeAppState`; default domain records injected during normalization.
   - High risk for confusion with central app state normalization.

5. `src/domain/relationships/relationshipGraph.ts` and `src/domain/mutations/referenceCleanup.ts`
   - Graph integrity and deletion cleanup.
   - Relationship edges and id arrays need a clear ownership policy.

6. `src/domain/projectActions.ts`
   - Project mutations, readiness recompute, thought/project backlinking, promotion relationship creation.
   - Central to relationship ownership drift.

7. `src/domain/engineeringHandoff.ts`, `src/domain/engineeringReadiness.ts`, `src/domain/readiness.ts`
   - Multiple readiness concepts that can be confused.
   - Needs semantic boundary clarity.

8. `src/domain/nextActions.ts` and `src/domain/reviewQueue.ts`
   - Derived views with mutation side effects and string-encoded references.
   - Easy place for hidden cross-entity coupling.

9. `src/services/appStateTransfer.ts` and `src/services/storage.ts`
   - Import/export/persistence safety boundary.
   - Must preserve backward compatibility while improving validation.

10. `src/domain/mutations/aiPatchMutations.ts` and `src/services/aiMock.ts`
    - AI mutation boundary.
    - Needs clear distinction between suggested patch, validated mutation, and accepted durable state.

---

## 12. Round 1 Analysis Prompts For The Next LLM

Use these as the next model's architecture hardening checklist:

- Should `src/domain/types.ts` remain the only canonical state shape, or should runtime validators become a second explicit authority?
- Should `normalizeAppState` be split into `migrateLegacyAppState`, `validateAppStateInvariants`, and `normalizeRuntimeAppState`?
- Should `App.tsx#save` normalize before both `setState` and `saveState`?
- Should `Project.readiness` be persisted, derived-only, or persisted with explicit recompute ownership?
- Should `Project.lifecycleStatus = "handoff_ready"` be writable only through `markProjectHandoffReady`?
- Should relationship edges and direct link fields be unified under a single relationship policy, or should their distinct ownership be documented and validated?
- Should import preserve orphans silently, preserve with warnings, or block import when graph integrity fails?
- Should AI patch application reuse normal domain mutation helpers or receive a dedicated validated patch command model?
- Should next action ids become typed refs instead of string prefixes?
- Should missing-entity delete behavior be consistent across all entity types?
- Should duplicate `normalizeAppState` in `blockingQuestions.ts` be renamed or removed from public exports?

Keep changes small. Existing architecture docs explicitly warn against broad rewrites, event sourcing, global workflow engines, or large state-machine conversions.
