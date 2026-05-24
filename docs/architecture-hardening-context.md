# Architecture Hardening Context

Purpose: high-density handoff context for the next LLM working on Post-v0.2.3-rc2 / rc3-rc5 Architecture Hardening Context & Next Planning. This is not general documentation. Treat source and tests as authority, architecture docs as orientation, and this file as a current-state map.

Scan date: 2026-05-22, Australia/Sydney. Source, tests, package metadata, release docs, generated artifacts, tags, branches, remotes, and `.env.local` contents were not modified. `.env.local` content was not read, printed, snapshotted, diffed, staged, committed, or pushed.

Authority rule: source code is final. `docs/architecture/**` and `docs/release/**` are useful context, but several docs conflict with current source/git state and are marked stale below.

Generated/local artifacts excluded from architecture source of truth: `dist/**`, `node_modules/**`, `playwright-report/**`, `test-results/**`, `coverage/**`, `.vite/**`, `*.tsbuildinfo`, OS files, and local env files.

---

## 0. Executive Summary

**Current Release Context**

- Actual app repo root: `/Users/sean/Documents/todolist/todo-thought-universe`. The invocation cwd `/Users/sean/Documents/todolist` is a separate outer git repo with no commits and an untracked `todo-thought-universe/` folder; this report treats the nested app repo as the source of truth.
- Package version and lockfile version are both `0.2.3-rc.2`.
- Local tag `v0.2.3-rc2` exists and points to `70dd9bb0e8895f87999fce25c6cb2c779320a1fe`.
- Requested checkpoint commits exist:
  - `ec15daa chore: untrack generated artifacts`
  - `3f7c914 feat: stabilize thought-project direct reference consistency`
  - `b3b7e98 chore: add local verification gate`
- Actual git history order is `9874e54` UI dock commit, `b3b7e98` verification gate, `3f7c914` direct-ref consistency, `ec15daa` artifact untracking, `70dd9bb` rc2 metadata, then `f47280f` rc2 hardening. The conceptual rc3/rc4/rc5 labels are useful, but the artifact hygiene commit is earlier than rc3/rc4 in this repo history.
- `docs/release/v0.2.3-rc2.md` is stale in places: it says the tag should be applied later and generated outputs remained dirty; current git state shows the local tag exists and generated/local artifact paths are ignored/untracked rather than tracked dirty.

**Current Git / Worktree Context**

- Current branch: `ui/right-ai-chat-dock`.
- Upstream exists: `origin/ui/right-ai-chat-dock`; `git remote -v` shows `origin https://github.com/sean0900108489-cpu/Flow.git` for fetch/push.
- Current `git status --short` before and after this scan is expected to show only `M docs/architecture-hardening-context.md`; the target file was already modified before this command and was refreshed by this command.
- No uncommitted UI source changes were present during this scan. Right AI dock work is committed in `9874e54` and is UI-only/non-domain based on source inspection.
- `.env.local` is a tracked ignored file: `git ls-files -ci --exclude-standard` returns `.env.local`; `git check-ignore --no-index -v .env.local` resolves to `.gitignore:21:.env.*`. This is a secret/process risk. Contents were not read.
- Checked generated/local artifact paths are not tracked: `git ls-files dist node_modules playwright-report test-results tsconfig.tsbuildinfo coverage .vite` returned empty. `git status --ignored=matching` shows ignored local directories/files for `dist/`, `node_modules/`, `playwright-report/`, `test-results/`, and `tsconfig.tsbuildinfo`.

**Implemented Hardening**

- AppState canonical compile-time definition is `src/domain/types.ts`.
- Runtime state holder and mutation coordinator is still `src/App.tsx`.
- Runtime `save(next)` normalizes before both `setState(normalized)` and `saveState(normalized)`.
- Persistence and transfer normalize before use: `src/services/storage.ts`, `src/services/appStateTransfer.ts`, `src/domain/appState.ts`.
- Import is full replace through AppStateTransfer, not merge. Import returns invariant warnings and retains warning-bearing user data.
- Import does not silently delete orphan relationships. Resolvable legacy relationship endpoint types are repaired; orphan/missing/ambiguous endpoints are retained and warned.
- Import does not repair/delete Thought-Project direct-ref drift. Drift is warning-only through `thought_project_reference_drift`.
- AI patch handling is centralized in `src/domain/mutations/aiPatchMutations.ts`, re-exported by `src/services/applyAiPatch.ts`.
- AI patch validation is value/reference based, not only key whitelist based. It rejects invalid enum values, empty required strings, missing universe/project/source thought refs, archived project membership targets, unsupported target types, and no-op/no-allowed-change patches.
- AI accepted/rejected flow is centralized in `setAiInsightStatus`; invalid patches are not marked accepted.
- Imported invalid `AIInsight.patch.targetType` returns `invalid_patch_target_type` warning and does not throw or fail import.
- `handoff_ready` cannot be newly set through general Project Detail/update path; it must go through `markProjectHandoffReady`.
- Missing-id delete guards for thought/project/universe/blocking question/decision record return failure and preserve original state.
- rc3 direct-ref consistency helper exists at `src/domain/projectThoughtLinks.ts`. It owns `Thought.projectId` / `Project.linkedThoughtIds` link, unlink, move, and cleanup semantics.
- `Project.sourceThoughtId` is provenance, not active membership. Membership unlink must not clear it; deleted/missing thought cleanup can clear it.
- rc4 local verification gate exists in `package.json`: `typecheck` and `check`.
- rc5 artifact hygiene is visible: generated/local artifacts are ignored and not tracked in checked paths.

**Tested Hardening**

- Unit tests cover storage normalization, import normalization/warnings, orphan relationship preservation, invalid patch target warning, AI patch value/reference validation, invalid patch atomic failure, accepted/rejected flow, handoff guard, missing-id delete guards, relationship graph repair/removal, direct-ref link/move/unlink/cleanup, sourceThought provenance, and direct-ref invariant warnings.
- E2E tests cover visible handoff behavior, project lifecycle UI behavior, review queue AI accept happy path, review queue handoff candidate marking, relationship explorer behavior, imported linked project display, and import full replacement UI.
- `npm run check` exists but was not executed in this docs-only scan because the script includes `npm run build`, which can write `dist/**` and `tsconfig.tsbuildinfo`, paths the user explicitly asked not to modify. Script composition was verified from package metadata.

**Remaining Risks**

- No complete canonical status semantics table exists in source. There are partial semantic helpers across thought/universe/AI, project, question/decision, review queue, next actions, engineering readiness, and handoff.
- Relationship graph edges (`relationships[]`) and direct project membership refs (`Thought.projectId`, `Project.linkedThoughtIds`) remain separate persisted representations with separate owners.
- Import shape validation is intentionally shallow before TypeScript casting. Many cross-entity invalid states are warnings, not rejections.
- Review Queue invalid AI accept UI feedback remains likely UI-only: the card reports "AI draft accepted." after invoking a void callback, even if `setAiInsightStatus` rejected an invalid patch and left state safe.
- `.env.local` tracked+ignored state is a secret/process risk, not a domain architecture issue.
- No lint gate is configured. `rg --files` found no ESLint/Biome/Oxlint/Prettier config; local verification is currently typecheck + tests + build.

**Suggested Next Hardening Focus**

- Priority 1: make Review Queue AI accept UI feedback reflect `setAiInsightStatus` result without weakening state safety.
- Priority 2: document or slightly narrow the boundary between relationship graph edges and direct Thought-Project membership refs; avoid broad unification.
- Priority 3: add a small canonical status interpretation table around existing semantic helpers.
- Priority 4: handle `.env.local` tracked/ignored secret-process risk separately from domain architecture work.
- Priority 5: decide whether lint remains deferred or add a minimal lint gate as a tooling task only.

Most dangerous places to edit casually: `src/App.tsx`, `src/domain/types.ts`, `src/domain/appState.ts`, `src/services/appStateTransfer.ts`, `src/services/storage.ts`, `src/domain/validation/appStateInvariants.ts`, `src/domain/mutations/aiPatchMutations.ts`, `src/domain/projectThoughtLinks.ts`, `src/domain/projectActions.ts`, `src/domain/mutations/referenceCleanup.ts`, `src/domain/relationships/relationshipGraph.ts`, `src/domain/engineeringHandoff.ts`, package scripts, release metadata, and generated/local artifact tracking.

---

## 1. Core Files Included

| File | Why Included | Related Concern | Source Status |
| ---- | ------------ | --------------- | ------------- |
| `package.json` | Version and scripts. | release metadata, tooling metadata | release metadata, tooling metadata |
| `package-lock.json` | Confirms root package version. | release metadata | release metadata |
| `.gitignore` | rc5 hygiene and `.env.local` ignored pattern. | tooling metadata, release metadata | tooling metadata |
| `src/domain/types.ts` | Canonical compile-time AppState/entity/status/patch shapes. | AppState, direct refs, relationship, status semantics, AI patch | source-of-truth |
| `src/domain/appState.ts` | Central normalizer used by storage, transfer, and runtime save. | AppState, import/export, persistence, validation | validation owner |
| `src/data/seed.ts` | Runtime fallback/reset shape and seeded direct refs/legacy relationship. | AppState, persistence, relationship, direct refs | source-of-truth |
| `src/App.tsx` | Runtime state holder, save wrapper, mutation dispatcher, import replacement, AI status callback, committed AI dock host. | mutation, AppState, persistence, import/export, AI patch, working-tree UI-only | runtime owner |
| `src/services/storage.ts` | localStorage load/save boundary. | persistence, validation | runtime owner |
| `src/services/appStateTransfer.ts` | JSON import/export validation, normalization, invariant warnings. | import/export, validation, persistence | validation owner |
| `src/services/applyAiPatch.ts` | Facade re-export for AI patch mutation module. | AI patch | derived consumer |
| `src/domain/mutations/aiPatchMutations.ts` | AI patch validation/apply/status authority. | AI patch, mutation, validation, direct refs | mutation owner |
| `src/domain/validation/appStateInvariants.ts` | Warning-only invariant checker. | invariant, validation, relationship, direct refs, status semantics | validation owner |
| `src/domain/mutations/appMutations.ts` | Thought/project create/update/archive/restore/delete safety. | mutation, status semantics, relationship cleanup, direct refs | mutation owner |
| `src/domain/mutations/referenceCleanup.ts` | Cross-entity cleanup after deletes. | relationship, direct refs, derived state | mutation owner |
| `src/domain/mutations/safeMutationPolicy.ts` | Source-side policy registry. | mutation, relationship, AI patch | documentation |
| `src/domain/projectThoughtLinks.ts` | rc3 direct Thought-Project reference helper. | direct refs, mutation, validation | mutation owner |
| `src/domain/projectThoughtLinks.test.ts` | Direct-ref link/move/unlink/cleanup coverage. | direct refs | test coverage |
| `src/domain/projectActions.ts` | Project create/update/link/unlink/promote and handoff shortcut guard. | mutation, direct refs, relationship, readiness, lifecycle | mutation owner |
| `src/domain/projectActions.test.ts` | Project action hardening coverage. | mutation, direct refs, lifecycle | test coverage |
| `src/domain/relationships/relationshipGraph.ts` | Typed relationship graph authority. | relationship, validation, derived state | mutation owner |
| `src/domain/relationships/relationshipGraph.test.ts` | Relationship repair/orphan/create/remove coverage. | relationship, invariant | test coverage |
| `src/domain/relationshipExplorer.ts` | UI-facing relationship graph facade and safe create wrapper. | relationship, derived state | derived consumer |
| `src/domain/universeActions.ts` | Universe mutation/delete/detach guard. | mutation, relationship cleanup, status semantics | mutation owner |
| `src/domain/blockingQuestions.ts` | Blocking question defaults/normalization/CRUD/delete. | mutation, status semantics, relationship cleanup | mutation owner |
| `src/domain/decisionRecords.ts` | Decision record CRUD, accept/supersede/delete and source question coupling. | mutation, status semantics, relationship cleanup | mutation owner |
| `src/domain/engineeringHandoff.ts` | Handoff evaluation/package/guarded lifecycle transition. | lifecycle, readiness, relationship, derived state | mutation owner |
| `src/domain/engineeringReadiness.ts` | Derived engineering readiness plus persisted manual assessment. | readiness, review status, derived state | mutation owner |
| `src/domain/readiness.ts` | Project content readiness computation. | readiness, derived state | validation owner |
| `src/domain/reviewQueue.ts` | Derived review queue from AI, decisions, blockers, handoff candidates. | review status, derived state | derived consumer |
| `src/domain/nextActions.ts` | Derived next actions plus persisted preferences and direct source action mutations. | derived state, status semantics, mutation | mutation owner |
| `src/domain/semantics/statusSemantics.ts` | Thought/universe/AI status predicates. | status semantics | validation owner |
| `src/domain/semantics/projectSemantics.ts` | Project lifecycle/readiness/status predicates. | lifecycle, readiness, status semantics | validation owner |
| `src/domain/semantics/questionDecisionSemantics.ts` | Blocking question and decision predicates. | status semantics, review status | validation owner |
| `src/components/screens/AppStateTransfer.tsx` | User import/export UI and full-replace wording. | import/export, persistence | derived consumer |
| `src/components/screens/ProjectDetail.tsx` | Lifecycle select, linked-thought display, unlink action. | lifecycle, readiness, direct refs | derived consumer |
| `src/components/screens/ReviewQueueCenter.tsx` | Review queue actions and known AI accept UI feedback issue. | review status, AI patch, lifecycle | derived consumer |
| `src/components/screens/AIPanel.tsx` | AI accept/reject UI using unified status callback. | AI patch, review status | derived consumer |
| `src/components/layout/AiChatDock.tsx` | Current branch AI chat dock; UI-only/non-domain boundary. | working-tree UI-only | UI-only / non-domain |
| `src/components/layout/Nav.tsx` | Current branch compact sidebar navigation work. | working-tree UI-only | UI-only / non-domain |
| `src/style.css` | Current branch styling for dock/sidebar; no domain source of truth. | working-tree UI-only | UI-only / non-domain |
| `src/services/appStateTransfer.test.ts` | Import/export legacy/default/relationship/AI patch round-trip coverage. | import/export, persistence, relationship, AI patch | test coverage |
| `src/services/storage.test.ts` | Storage load/save normalization coverage. | persistence | test coverage |
| `src/services/applyAiPatch.test.ts` | AI patch validation/status/direct-ref coverage. | AI patch, direct refs | test coverage |
| `src/domain/validation/appStateInvariants.test.ts` | Invariant warning coverage, including direct-ref drift and invalid patch target type. | invariant, validation | test coverage |
| `src/domain/mutations/appMutations.test.ts` | Delete cleanup and missing-id guard coverage. | mutation, relationship, direct refs | test coverage |
| `src/domain/universeActions.test.ts` | Universe delete/missing-id/detach coverage. | mutation, relationship | test coverage |
| `src/domain/blockingQuestions.test.ts` | Question delete/missing-id/default coverage. | mutation, status semantics | test coverage |
| `src/domain/decisionRecords.test.ts` | Decision delete/missing-id/source-question coverage. | mutation, status semantics | test coverage |
| `src/domain/engineeringHandoff.test.ts` | Guarded handoff readiness coverage. | lifecycle, readiness | test coverage |
| `src/domain/semantics/statusSemantics.test.ts` | Partial semantic helper coverage. | status semantics | test coverage |
| `tests/app.spec.ts` | E2E coverage for visible handoff, import, relationship, review flows. | lifecycle, import/export, relationship, review status | test coverage |
| `docs/architecture/**` | Draft coordination scaffolds; source-backed only. | architecture docs | documentation, possible stale doc |
| `docs/release/v0.2.3-rc2.md` | rc2 release context, partly stale against current git/artifact state. | release metadata, architecture docs | release metadata, possible stale doc |
| `docs/architecture-hardening-context.md` | This refreshed handoff context. | architecture docs | documentation |

---

## 2. AppState / Source-of-Truth Context

### `src/domain/types.ts`

summary:

- Canonical compile-time AppState and entity type definition.
- It is not runtime validation by itself.
- It is persisted/imported/exported as the local-first state shape.
- Ambiguity remains because some persisted fields are partly derived or manually cached, especially `Project.readiness`, `engineeringReadiness`, `nextActionState`, and `AIInsight.status`.
- v0.2.3-rc2 clarified normalization/validation around this shape; rc3 clarified direct-ref ownership without moving the canonical type definition.
- Current UI dock branch does not alter this file.

```ts
export type ProjectLifecycleStatus = "planning" | "handoff_ready" | "blocked";
export type Readiness = "not_ready" | "needs_clarification" | "draftable" | "ready_for_engineering";
export type RelationshipNodeType = "thought" | "project" | "universe" | "blocking_question" | "decision_record";

export interface ThoughtItem {
  id: string;
  status: ThoughtStatus;
  universeId: string;
  projectId?: string;
}

export interface Project {
  id: string;
  sourceThoughtId?: string;
  linkedThoughtIds?: string[];
  universeId: string;
  status: ProjectStatus;
  lifecycleStatus?: ProjectLifecycleStatus;
  readiness: Readiness;
}

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

tags: canonical definition, persisted state, status semantics, direct refs, relationship graph.

### `src/domain/appState.ts`

summary:

- Central normalizer for runtime save, import/export, and storage.
- Provides migration/default behavior for optional state.
- Repairs relationship endpoint types only when endpoints resolve.
- Does not repair direct Thought-Project drift and does not delete orphan relationships.
- v0.2.3-rc2 made this path central; rc3 kept direct-ref import drift warning-only.

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

tags: validation owner, normalized state, persisted state.

### `src/App.tsx`

summary:

- Runtime owner of live `AppState`.
- Mutation coordinator: UI callbacks call domain helpers, then `save(result.state)`.
- `save(next)` normalizes before runtime state and persistence, so runtime state and localStorage receive the same normalized object.
- Import is full replace via AppStateTransfer `onImport`.
- AI accepted/rejected status routes through `setAiInsightStatus`.
- Current branch adds `AiChatDock` and `isAiChatDockOpen` UI state; this does not add AppState fields or call domain mutation/AI patch/import/relationship/normalization code.

```ts
const [state, setState] = useState<AppState>(() => loadState());
const [isAiChatDockOpen, setIsAiChatDockOpen] = useState(false);

const save = (next: AppState) => {
  const normalized = normalizeAppState(next);

  setState(normalized);
  saveState(normalized);

  return normalized;
};

const acceptAI = (aiId: string, status: "accepted" | "rejected") => {
  const result = setAiInsightStatus(state, aiId, status);

  if (result.statusChanged) {
    save(result.state);
  }
};
```

tags: runtime owner, mutation coordinator, persistence caller, UI-only branch host.

### `src/services/appStateTransfer.ts`

summary:

- Import/export JSON boundary.
- Validates root object and required arrays, then normalizes and returns invariant warnings.
- Not a full schema validator; many semantic issues are warning-only.
- Export serializes normalized AppState.

```ts
export function validateAppState(value: unknown): AppStateImportResult {
  if (!isRecord(value)) {
    return { ok: false, error: "Imported JSON must be an object." };
  }

  const requiredArrays = ["universes", "thoughts", "projects", "relationships", "aiInsights"] as const;

  for (const key of requiredArrays) {
    if (!Array.isArray(value[key])) {
      return { ok: false, error: `Missing or invalid array: ${key}` };
    }
  }

  const state = normalizeAppState(value as unknown as AppState);

  return {
    ok: true,
    state,
    warnings: validateAppStateInvariants(state)
  };
}

export function stringifyAppState(state: AppState): string {
  return JSON.stringify(normalizeAppState(state), null, 2);
}
```

tags: import/export owner, validation owner, persisted state.

### `src/services/storage.ts`

summary:

- localStorage load/save boundary.
- Loads by parsing and calling `validateAppState`, falling back to normalized seed.
- Saves normalized state.
- Load warnings are not surfaced to UI.

```ts
export function loadState(): AppState {
  const result = validateAppState(JSON.parse(raw));

  return result.ok && result.state ? result.state : fallbackState();
}

export function saveState(state: AppState) {
  storage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state), null, 2));
}
```

tags: persistence owner, validation consumer.

### `src/domain/projectThoughtLinks.ts`

summary:

- rc3 direct-reference mutation owner for `Thought.projectId` and `Project.linkedThoughtIds`.
- Handles link, unlink, move, missing direct-ref cleanup, and missing sourceThought cleanup.
- Does not touch `relationships[]`; direct membership and graph edges remain separate owners.
- Unlink does not clear `Project.sourceThoughtId`.

```ts
export function linkThoughtToProjectReference(state: AppState, projectId: string, thoughtId: string): ProjectThoughtLinkResult {
  // Validates project and thought, sets thought.projectId,
  // adds project.linkedThoughtIds once, and removes stale linkedThoughtIds from other projects.
}

export function unlinkThoughtFromProjectReferences(state: AppState, thoughtId: string): ProjectThoughtLinkResult {
  // Clears thought.projectId and removes the thought from all project.linkedThoughtIds.
  // Does not clear Project.sourceThoughtId.
}

export function cleanupProjectThoughtReferences(state: AppState): ProjectThoughtLinkResult {
  // Clears missing Thought.projectId, missing linkedThoughtIds, and missing sourceThoughtId.
}
```

tags: mutation owner, direct refs, tested.

### `src/domain/validation/appStateInvariants.ts`

summary:

- Warning-only invariant checker.
- Reports duplicate IDs, invalid enums, missing relationships, direct missing refs, direct-ref drift, AI insight target issues, next action ref issues, invalid handoff-ready, and readiness drift.
- Does not mutate and does not reject import by itself.

```ts
function checkThoughtProjectReferenceDrift(warnings: AppStateInvariantWarning[], state: AppState) {
  // Thought.projectId without reciprocal Project.linkedThoughtIds -> thought_project_reference_drift.
  // Project.linkedThoughtIds where thought.projectId points elsewhere -> thought_project_reference_drift.
}

function addAIInsightInvalidPatchTargetTypeWarning(...) {
  warnings.push({
    code: "invalid_patch_target_type",
    severity: "warning",
    entityType: "ai_insight",
    field: "patch.targetType",
    ...
  });
}
```

tags: validation owner, invariant warnings.

### `src/components/layout/AiChatDock.tsx`

summary:

- Committed UI-only component on `ui/right-ai-chat-dock`.
- Uses component/local/session/localStorage state for chat UI, prompt draft, selected model, API base URL, dock open preference, attachments, and session API key.
- Receives derived counts and navigation callbacks from App.
- Does not mutate AppState, apply AI patches, import/export AppState, normalize state, or mutate relationships/direct refs.
- Keep chat history and API/session state out of AppState unless explicitly reviewed later.

```ts
export interface AiChatDockProps {
  isOpen: boolean;
  currentScreenLabel: string;
  selectedProjectTitle?: string;
  selectedThoughtTitle?: string;
  aiDraftCount: number;
  reviewQueueCount: number;
  onOpenChange: (isOpen: boolean) => void;
  onOpenAiPanel: () => void;
  onOpenReviewQueue: () => void;
}
```

tags: UI-only / non-domain, committed branch context.

---

## 3. Mutation Flow Map

| Entrypoint | File | Mutates What | Direct or Indirect | Cross-Entity? | Touches Relationships? | Touches Direct Refs? | Touches Status/Readiness/Lifecycle? | Validation? | Hardening Status | Risk |
| ---------- | ---- | ------------ | ------------------ | ------------- | ---------------------- | ------------------- | ----------------------------------- | ----------- | ---------------- | ---- |
| `save(next)` | `src/App.tsx` | Runtime AppState + localStorage | Direct | Whole-state | Via normalization only | Via caller state only | Via caller state only | `normalizeAppState` | implemented + tested indirectly | Central coordinator can hide bypasses |
| `loadState()` | `src/services/storage.ts` | Restored AppState | Direct restore | Whole-state | Repairs endpoint types | Retains direct drift | Restores semantic fields | `validateAppState` | implemented + tested | Load warnings not surfaced |
| `saveState()` | `src/services/storage.ts` | localStorage snapshot | Direct persistence | Whole-state | Repairs endpoint types | Does not repair direct drift | Persists semantic state | `normalizeAppState` | implemented + tested | Snapshot is durable local source |
| `parseAppStateJson` / `validateAppState` | `src/services/appStateTransfer.ts` | Imported AppState | Direct full replace via App | Whole-state | Repairs resolvable endpoint types; retains orphans | Retains drift with warning | Restores semantic state | shape check + invariants | implemented + tested | Shallow schema validation |
| `stringifyAppState` | `src/services/appStateTransfer.ts` | Export JSON | Direct serialize | Whole-state | Repairs endpoint types in output | No direct-ref repair | Exports persisted semantic state | `normalizeAppState` | implemented + tested | Exports stored manual/semantic fields |
| AppState import UI | `src/components/screens/AppStateTransfer.tsx` + `src/App.tsx` | Replaces current AppState | Direct full replace | Whole-state | Via transfer/save normalization | Retained or caller-provided | Full replace | transfer validation | implemented + tested | Warning details only shown as count |
| `createThought` | `src/domain/mutations/appMutations.ts` | Adds thought | Indirect via App | No | No | No | `Thought.status = inbox` | title fallback | implemented | No reference validation for universeId |
| `updateThought` | `src/domain/mutations/appMutations.ts` | Thought fields except projectId | Indirect | No | No | No | Thought status/type can update | empty title guard | implemented | Does not validate universeId refs |
| `archiveThought` / `restoreThought` | `src/domain/mutations/appMutations.ts` | Thought status | Indirect | No | No | No | `Thought.status` | missing id guard | implemented + tested | Semantics spread through readers |
| `deleteThought` | `src/domain/mutations/appMutations.ts` | Removes thought | Indirect | Yes | Removes graph edges touching thought | Clears project source/linked refs | Removes AI insight targets and next-action ids | missing id guard | implemented + tested | Cleanup distributed |
| `archiveProject` / `restoreProject` | `src/domain/mutations/appMutations.ts` | Project status | Indirect | No | Preserved | Preserved | `Project.status` | missing id guard | implemented + tested | Status/lifecycle/readiness overlap |
| `deleteProject` | `src/domain/mutations/appMutations.ts` | Removes project | Indirect | Yes | Removes graph edges touching project | Clears `thought.projectId` | Removes AI insight targets and next-action ids | missing id guard | implemented + tested | Cleanup distributed |
| `createProject` | `src/domain/projectActions.ts` | Adds project and optional direct links | Indirect | Yes | No | Uses direct-ref helper | lifecycle planning, readiness computed | title guard; link helper endpoint guard | implemented + tested | Invalid initial linked ids ignored |
| `updateProjectDetails` | `src/domain/projectActions.ts` | Project details/direct links/status/lifecycle/readiness | Indirect | Yes when linkedThoughtIds changes | No | Uses direct-ref helper | Blocks new `handoff_ready`; recomputes readiness unless explicit | title guard, handoff guard | implemented + tested | Allows explicit readiness patch |
| `linkThoughtToProject` | `src/domain/projectActions.ts` | Thought.projectId + project linked ids | Indirect | Yes | No | Yes | updatedAt | endpoint guard | implemented + tested | Does not create graph edge |
| `unlinkThoughtFromProject` | `src/domain/projectActions.ts` | Clears direct membership | Indirect | Yes | No | Yes | updatedAt | project/thought guard | implemented + tested | Leaves sourceThoughtId provenance |
| `promoteThoughtToProject` | `src/domain/projectActions.ts` | Project, thought, sourceThoughtId, direct refs, relationship | Indirect | Yes | Creates typed `evolves_into` edge | Yes | Thought type/status; readiness | thought guard + relationship guard | implemented + tested | Multi-representation coupling |
| `createRelationshipSafe` | `src/domain/relationshipExplorer.ts` | Adds relationship edge | Indirect | Yes | Creates graph edge | No | No | endpoint/type/duplicate guard | implemented + tested | Separate from direct refs |
| `removeRelationshipsForNode` | `src/domain/relationships/relationshipGraph.ts` | Removes graph edges touching typed node | Indirect | Yes | Yes | No | No | typed endpoint matching | implemented + tested | Untyped same-id edge behavior needs care |
| `repairRelationshipEndpointTypes` | `src/domain/relationships/relationshipGraph.ts` | Adds endpoint types to resolvable legacy edges | Indirect via normalize | Yes | Repairs relationship metadata | No | No | endpoint resolution | implemented + tested | Orphans retained |
| `deleteUniverse` | `src/domain/universeActions.ts` | Removes universe; detach or block | Indirect | Yes | Removes graph edges | Clears universe refs in detach mode | Universe status via archive/restore | missing id/in-use guard | implemented + tested | Caller chooses detach vs block |
| Blocking question actions | `src/domain/blockingQuestions.ts` | Blocking questions | Indirect | Delete yes | Delete removes graph edges | Clears decision source refs | Question status | missing id guard on delete; enum checks | implemented + tested | Link refs not validated on create/update |
| Decision record actions | `src/domain/decisionRecords.ts` | Decisions; accept can resolve source question | Indirect | Accept/delete yes | Delete removes graph edges | Clears supersedes refs | Decision status; source question status | missing id guard on delete; enum checks | implemented + tested | Accept has hidden source-question coupling |
| `markProjectHandoffReady` | `src/domain/engineeringHandoff.ts` | Project lifecycle/readiness | Indirect | Reads relationships/questions/thought refs | Reads graph edges | Reads direct refs | Sets `handoff_ready` and `ready_for_engineering` | handoff evaluation | implemented + tested | Guard semantics depend on derived readers |
| `updateEngineeringReadinessAssessment` | `src/domain/engineeringReadiness.ts` | Persisted manual assessment | Indirect | No | No | No | Manual confidence/target phase | enum normalization | implemented + tested | Manual state overlaps derived readiness |
| Next action preference actions | `src/domain/nextActions.ts` | Persisted next action ids/preferences | Indirect | No | No | No | Manual confidence/focus mode | normalization | implemented + tested | Stores ids derived from current views |
| `completeNextAction` | `src/domain/nextActions.ts` | Clears thought/project nextAction or marks question in_review | Indirect | Sometimes | No | No | BlockingQuestion.status | source existence guard | implemented + tested | Derived action mutates source records |
| `setNextActionForSource` | `src/domain/nextActions.ts` | Thought/project nextAction | Indirect | No | No | No | No direct status | source/type guard | implemented + tested | Bypasses primary projectActions for project nextAction |
| `applyAiInsightPatch` | `src/domain/mutations/aiPatchMutations.ts` | Targeted thought/project descriptive fields; direct ref membership | Indirect through accept | Yes for Thought.projectId | Cannot create/delete graph edges | Uses direct-ref helper | Cannot directly set status/readiness/lifecycle | value/reference/target validation | implemented + tested | Separate from normal thought/project helpers |
| `setAiInsightStatus` | `src/domain/mutations/aiPatchMutations.ts` | AIInsight.status plus optional patch effect | Indirect via App | Yes if patch does | No graph edge mutation | Yes for Thought.projectId patch | AIInsight status only | apply result gate | implemented + tested | UI callback currently returns void |
| Review Queue AI accept | `src/components/screens/ReviewQueueCenter.tsx` | Calls AI status callback | Indirect | Depends on patch | Depends on patch | Depends on patch | AIInsight.status | no UI-level result | state safety implemented, UI feedback issue | Notice can be misleading |
| Right AI dock | `src/App.tsx`, `src/components/layout/AiChatDock.tsx` | UI/session/localStorage keys only | Direct UI-only | No | No | No | No AppState status | UI checks only | UI-only / non-domain | Do not put chat state into AppState casually |
| `validateAppStateInvariants` | `src/domain/validation/appStateInvariants.ts` | Does not mutate | None | Reads all | Reads graph | Reads direct refs | Reads semantic state | warning-only | implemented + tested | Warnings can be ignored |

### Canonical Mutation Path

- `src/App.tsx` remains the runtime mutation coordinator.
- Domain mutation helpers are the actual authority for most architecture-sensitive mutations.
- Save/persist order is `domain result/import result -> App.save -> normalizeAppState -> setState -> saveState -> normalizeAppState again inside saveState`.
- AI patch does not use regular `updateThought` / `updateProjectDetails`; it has its own guarded boundary. That boundary is not an unsafe bypass because it validates values/references and uses `linkThoughtToProjectReference` for `Thought.projectId`.
- AI patch direct Thought.projectId mutation is guarded and reciprocal.
- Import is full replace, not merge.
- Import order is JSON parse -> shallow root shape validation -> `normalizeAppState` -> `validateAppStateInvariants` warnings -> App `onImport` -> `save` -> runtime state + localStorage.
- `projectThoughtLinks` is the primary owner for `Thought.projectId` / `Project.linkedThoughtIds`.
- `relationshipGraph` remains the owner for `relationships[]`.

Current ambiguity:

- competing mutation paths: `nextActions` mutates `thought.nextAction`, `project.nextAction`, and blocking question status outside primary helpers.
- hidden mutation coupling: decision acceptance can resolve a blocking question; project promotion writes project, thought, direct refs, and relationship.
- mutation bypass: import full-replaces state after shallow validation; invariant warnings are non-blocking.
- missing canonical helper: no single umbrella helper owns every cross-entity mutation; this is acceptable for now but must be respected.
- direct-ref / relationship graph ownership ambiguity: separate persisted representations can drift if future code updates one and assumes the other follows.

---

## 4. Source-of-Truth / Authority Matrix

| State / Concept | Canonical Definition | Runtime Owner | Allowed Mutation Owner | Validation Owner | Derived or Persisted | Current Ambiguity | Risk |
| --------------- | -------------------- | ------------- | ---------------------- | ---------------- | -------------------- | ----------------- | ---- |
| AppState | `src/domain/types.ts` | `src/App.tsx` | Domain helpers + import full replace via App | `appStateTransfer`, `appStateInvariants`, `appState` | Persisted | Runtime owner still top-level App | Central coordinator can accumulate rules |
| Thought | `types.ts` | `App.tsx` | `appMutations`, `thoughtTriage`, `nextActions`, AI patch allowed fields | type unions + invariants | Persisted | Several helpers mutate different fields | Scattered validation |
| Project | `types.ts` | `App.tsx` | `projectActions`, `appMutations`, `engineeringHandoff`, `nextActions`, AI patch allowed fields | type unions + projectSemantics + invariants | Persisted | status/readiness/lifecycle overlap | Contradictory states possible |
| Universe | `types.ts` | `App.tsx` | `universeActions` | type unions + invariants | Persisted | Optional status default active | Delete mode caller-dependent |
| relationship / graph edge | `types.ts` + `relationshipGraph.ts` | `App.tsx` | `relationshipGraph`, `relationshipExplorer`, promotion, delete cleanup | `relationshipGraph`, `appStateInvariants` | Persisted | Separate from direct refs | Orphan edge warning-only |
| direct linked ids | `types.ts` | `App.tsx` | `projectThoughtLinks`, project actions, cleanup | `appStateInvariants` | Persisted | Not graph edges | Drift if raw object patched |
| Thought.projectId | `types.ts` | `App.tsx` | `projectThoughtLinks`, AI patch via helper, delete cleanup | `appStateInvariants` | Persisted | Direct membership only | Drift if helper bypassed |
| Project.linkedThoughtIds | `types.ts` | `App.tsx` | `projectThoughtLinks`, `projectActions`, delete cleanup | `appStateInvariants` | Persisted | Reciprocal direct membership | Drift if helper bypassed |
| Project.sourceThoughtId | `types.ts` | `App.tsx` | promotion, AI project patch, cleanup for missing/deleted thought | `appStateInvariants` | Persisted provenance | Not active membership | Future unlink may clear incorrectly |
| status | Entity type unions | `App.tsx` | Domain-specific helpers | semantic helpers + invariants | Persisted | Same word reused by entities | UI meaning can leak into domain |
| lifecycleStatus | `ProjectLifecycleStatus` | `App.tsx` | `updateProjectDetails` except new handoff_ready; `markProjectHandoffReady` | projectSemantics + invariants | Persisted | Optional default planning | Guard must remain centralized |
| readiness | `Readiness` + `readiness(project)` | `App.tsx` | `projectActions`, `engineeringHandoff`, AI project patch recompute | `readiness`, invariants | Persisted but recomputable | Stored readiness can drift | Warning-only drift |
| review status | Derived item status | `reviewQueue.ts` | Source entity mutations only | reviewQueue + semantic helpers | Derived, not persisted as queue | Queue not canonical | UI feedback can mislead |
| engineering readiness | `EngineeringReadinessAssessment` + derived summary | `App.tsx` | assessment action only for manual fields | `engineeringReadiness` | manual assessment persisted; summary derived | overlaps project readiness | User may treat summary as canonical |
| blocking question status | `types.ts` | `App.tsx` | `blockingQuestions`, decision accept, nextAction complete | questionDecisionSemantics + invariants | Persisted | Multiple mutation owners | Status transitions need clearer semantics |
| decision record status | `types.ts` | `App.tsx` | `decisionRecords` | questionDecisionSemantics + invariants | Persisted | Accept can mutate source question | Hidden coupling |
| import state | JSON + AppState | `AppStateTransfer` then `App.tsx` | import full replace | transfer + invariants | Persisted after save | warnings not blockers | Invalid graph retained |
| normalized state | `normalizeAppState` | `App.tsx` save/storage/transfer | normalizer only | normalizer | Runtime and persisted | Relationship repairs only, not direct drift repair | Users may expect repair |
| invariant warning state | `appStateInvariants.ts` | None | Read-only | `appStateInvariants` | Derived output | Not persisted | Can be ignored |
| AI patch state | `AIInsight.patch` | `App.tsx` | AI mock/import metadata, `setAiInsightStatus` apply | `aiPatchMutations`, invariants | Patch metadata persisted; apply result persisted only on accept | Invalid imported patch can exist as warning | UI must handle apply failure |
| persisted state | localStorage under `todo-thought-universe:v1` | `storage.ts` | App save/import | transfer/normalizer | Persisted | No explicit schema version field | Compatibility risk |
| derived UI state | components/hooks | component | UI only | none | Not persisted except UI localStorage keys | May be confused with AppState | Avoid domain leakage |
| release metadata | package/git/docs | repo | release tasks only | git/package checks | Persisted repo metadata | rc labels not package-bumped after rc2 | Process drift |
| tooling/check scripts | package scripts | package.json | release/tooling tasks | command output | Tooling metadata | check not executed here | False sense of verification |
| AI dock UI/session state | `AiChatDock` component/localStorage/sessionStorage | component | component only | UI checks | UI-local, non-domain | committed UI branch, no domain owner | Do not store chat history in AppState casually |

Who should not mutate directly:

- UI components should not raw-edit `relationships[]`, `Thought.projectId`, `Project.linkedThoughtIds`, `AIInsight.status`, or `Project.lifecycleStatus = "handoff_ready"`.
- Review queue should remain a derived consumer and should not become canonical state.
- Generated artifacts should not be treated as architecture authority.

---

## 5. Relationship / Direct Reference Ownership Matrix

| Relationship Type | Created By | Updated By | Deleted By | Cleanup Owner | Endpoint Integrity Rule | Delete Behavior | Import Behavior | AI Patch Behavior | Current Gap | Risk |
| ----------------- | ---------- | ---------- | ---------- | ------------- | ----------------------- | --------------- | --------------- | ----------------- | ----------- | ---- |
| `relationships[]` graph edge | `createTypedRelationship`, `createRelationshipSafe`, `promoteThoughtToProject` | endpoint type repair only | `removeRelationshipsForNode` during entity delete | `relationshipGraph` | create requires resolved typed endpoints; duplicate rejected | deleting node removes touching typed edges | resolvable endpoint types repaired; orphan/ambiguous retained with warning | AI cannot create/delete edges | separate from direct refs | Future code may assume graph edge creates membership |
| Legacy untyped graph edge | seed/import legacy shape | `repairRelationshipEndpointTypes` if resolvable | same cleanup if touched by endpoint match | `relationshipGraph` | untyped same-id endpoints can be ambiguous | retained unless touched by delete cleanup | repaired if resolvable; missing/ambiguous retained | AI cannot create | ambiguous endpoint semantics | Same id across types can confuse cleanup/readers |
| Thought-Project direct membership | `projectThoughtLinks`, project actions, AI Thought.projectId patch | same helpers | unlink/delete cleanup | `projectThoughtLinks` + `referenceCleanup` | `Thought.projectId` should be reciprocal with one project linkedThoughtIds entry | thought delete removes from projects; project delete clears thought.projectId | drift retained with warning; no repair | AI Thought.projectId uses helper and is atomic | separate from graph | Drift if helper bypassed |
| Project.sourceThoughtId provenance | `promoteThoughtToProject`, AI project patch | AI project patch if valid | thought delete or cleanup when missing | `referenceCleanup`, `cleanupProjectThoughtReferences` | must reference existing thought if present | deleted thought clears matching provenance | missing source warning-only; cleanup helper can clear outside import | AI can set valid sourceThoughtId | provenance vs membership can be confused | Future unlink could erase history |
| BlockingQuestion linked ids | question create/update/defaults | `updateBlockingQuestion` | entity delete cleanup | `referenceCleanup` | invariant warns missing refs | linked entity delete removes matching ids | missing refs warning-only | AI cannot mutate | create/update do not validate endpoints | Invalid refs can persist |
| DecisionRecord linked ids | decision create/update/from question | `updateDecisionRecord` | entity delete cleanup | `referenceCleanup` | invariant warns missing refs | linked entity delete removes matching ids | missing refs warning-only | AI cannot mutate | create/update do not validate endpoints | Invalid refs can persist |
| Decision source question | decision create/from question | limited through create input | `deleteBlockingQuestion` clears | `referenceCleanup` | invariant warns missing source | question delete clears | missing ref warning-only | AI cannot mutate | accept has hidden question coupling | Semantic surprise |
| Decision supersedes link | supersede/create/update | `updateDecisionRecord` | `deleteDecisionRecord` clears reverse refs | `referenceCleanup` | invariant warns missing decision | deleted decision clears dependent refs | missing ref warning-only | AI cannot mutate | no formal decision graph | Status graph ambiguity |
| Universe direct membership | thought/project universeId, linkedUniverseIds | entity/domain updates | `deleteUniverse(detach)` clears | `referenceCleanup` | invariant warns missing universe | blockIfInUse rejects; detach clears | missing ref warning-only | AI can update thought/project universeId after validation | question/decision update lacks endpoint validation | Orphan universe refs warning-only |
| AIInsight target/patch targets | AI mock/import | status mutation only | thought/project delete filters target insights | `referenceCleanup`, invariants | target must exist by inferred/patch target type | deleting target removes matching insights | missing/invalid targets warning-only | invalid apply fails atomic | invalid metadata can persist as draft | UI must surface failure |
| NextAction ids | next action pin/dismiss/focus | next action state actions | delete cleanup removes source action ids | `referenceCleanup`, invariants | encoded `prefix:id`; refs should resolve or be intrinsic | deleted source clears saved/dismissed/focus ids | missing refs warning-only | AI cannot mutate | review queue ids can disappear | Persisted preference ids stale |

### Relationship Cleanup Ownership Rules

- implemented + tested: graph edge cleanup for thought/project/universe/blocking question/decision record deletes goes through `removeRelationshipsForNode`.
- implemented + tested: direct Thought-Project link/move/unlink uses `projectThoughtLinks` in project actions and AI Thought.projectId patches.
- implemented + tested: delete cleanup clears stale direct refs, linked ids, AI insight targets, and next-action references through `referenceCleanup`.
- implemented + tested: `Project.sourceThoughtId` is provenance; membership unlink does not clear it.
- implemented + tested: import preserves orphan relationships and returns invariant warnings.
- implemented + tested: import preserves direct-ref drift and returns `thought_project_reference_drift`.
- inferred: future direct membership changes should use `projectThoughtLinks` even though raw object patches are still possible in TypeScript.
- missing: no single source-owned relationship policy ties graph edges and direct refs into one representation; they remain separate owners.

---

## 6. Status Semantics Matrix

| Field / Concept | Entity | File | Meaning | Allowed Values | Who Sets It | Who Reads It | Derived or Manual | Overlaps With | Guard | Risk |
| --------------- | ------ | ---- | ------- | -------------- | ----------- | ------------ | ----------------- | ------------- | ----- | ---- |
| `Thought.status` | Thought | `types.ts`, `appMutations.ts`, `thoughtTriage.ts` | Inbox/active/pause/done/archive state | `inbox`, `active`, `paused`, `done`, `archived` | thought mutations, triage | list filters, next actions, UI | Manual persisted | next action visibility | enum invariant | Split across helpers |
| `Project.status` | Project | `types.ts`, `appMutations.ts`, `projectActions.ts` | Active vs archived | `active`, `archived` | project mutations/details | dashboards, handoff, review, semantics | Manual persisted | lifecycle/readiness | enum invariant | Archived ready projects possible |
| `Project.lifecycleStatus` | Project | `types.ts`, `projectActions.ts`, `engineeringHandoff.ts` | Planning/blocked/handoff ready lifecycle | `planning`, `handoff_ready`, `blocked` | project details except new handoff_ready; handoff action | ProjectDetail, handoff, review, invariants | Manual persisted with default planning in helpers | status/readiness/handoff | guarded handoff action | Optional field can confuse |
| `Project.readiness` | Project | `types.ts`, `readiness.ts`, `projectActions.ts` | Stored content readiness | `not_ready`, `needs_clarification`, `draftable`, `ready_for_engineering` | projectActions, handoff, AI project patch recompute | UI, review queue, invariants | Persisted but recomputable | engineering readiness, handoff readiness | readiness_drift warning | Stored value can drift |
| `handoff_ready` | Project lifecycle | `engineeringHandoff.ts`, `projectActions.ts` | Passed guarded handoff evaluation | lifecycle value | `markProjectHandoffReady` for new transition | review queue, ProjectDetail, handoff center | Manual persisted after guard | readiness/status | direct update rejected | Future shortcut risk |
| `BlockingQuestion.status` | BlockingQuestion | `blockingQuestions.ts`, `questionDecisionSemantics.ts` | Decision/question lifecycle | `open`, `in_review`, `resolved`, `archived` | question actions, decision accept, nextAction complete | review queue, engineering readiness, handoff blockers | Manual persisted | decision/review | enum invariant | Multiple mutation owners |
| `DecisionRecord.status` | DecisionRecord | `decisionRecords.ts`, `questionDecisionSemantics.ts` | Decision lifecycle | `proposed`, `accepted`, `superseded`, `archived` | decision actions/review queue | review queue, decision center, question resolution | Manual persisted | blocking question resolution | enum invariant | Accept mutates source question |
| EngineeringReadiness overall status | Derived summary | `engineeringReadiness.ts` | Whole app readiness phase | `not_ready`, `partially_ready`, `ready_to_prototype`, `ready_for_engineering` | derived only | readiness UI, next actions | Derived | Project.readiness/handoff | tests | Can be mistaken as persisted |
| EngineeringReadiness assessment | AppState subobject | `engineeringReadiness.ts` | Manual note/confidence/phase | confidence low/medium/high; phase exploration/prototype/engineering | assessment action | readiness summary | Manual persisted | derived readiness | normalization | Manual fields affect derived status |
| ReviewQueue item status | Derived item | `reviewQueue.ts` | Pending review source status | source status string | source entities | ReviewQueue UI/next actions | Derived | lifecycle/readiness/question/decision/AI statuses | semantic helpers | Not canonical |
| `AIInsight.status` | AIInsight | `types.ts`, `aiPatchMutations.ts` | Draft/review decision | `draft`, `accepted`, `rejected` | `setAiInsightStatus` | AI panel, review queue | Manual persisted | review status | accept gated by patch apply | UI notice mismatch risk |
| NextAction item status | Derived item | `nextActions.ts` | Available/blocked/completed recommendation | `available`, `blocked`, `completed` | derived | NextAction UI/dashboard | Derived | source statuses/readiness/review | derived helper | Not canonical |
| NextActionState manual fields | AppState subobject | `nextActions.ts` | Persisted focus/dismissals/preferences | confidence/focus modes | next action actions | next action summary | Manual persisted | derived next actions | normalization + invariants | Persisted derived ids can stale |
| Universe status | Universe | `types.ts`, `universeActions.ts` | Active/archived grouping | `active`, `archived`, optional default active | universe actions | options/filters | Manual persisted optional | none | optional enum invariant | Hidden default |

### Canonical Status Interpretation Table

Current state: no complete canonical status semantics found.

Partial canonical helpers:

| Helper File | Canonicalizes | Limit |
| ----------- | ------------- | ----- |
| `src/domain/semantics/statusSemantics.ts` | Thought archived/active/paused/inbox; universe active/archived; AI draft review visibility. | Does not cover projects/questions/decisions. |
| `src/domain/semantics/projectSemantics.ts` | Project active/archived, lifecycle default, lifecycle blocked/handoff, readiness predicates, handoff review visibility. | Does not own mutation guard. |
| `src/domain/semantics/questionDecisionSemantics.ts` | Blocking question unresolved/resolved/review/next action; decision pending/accepted/review. | Does not include AI/project status details. |
| `src/domain/reviewQueue.ts` | Review queue item construction and pending item rules. | Derived, not canonical state. |
| `src/domain/engineeringReadiness.ts` | App-wide readiness synthesis. | Derived summary with manual assessment overlap. |
| `src/domain/engineeringHandoff.ts` | Project handoff guard semantics. | Project-specific. |

Needs later canonicalization without behavior redesign:

- precedence between `Project.status`, `Project.lifecycleStatus`, stored `Project.readiness`, computed `readiness(project)`, and handoff evaluation.
- whether stored `Project.readiness` is authoritative or cached.
- source of truth for review visibility when AI patch is invalid.
- whether next-action source mutations should route through primary domain helpers.

---

## 7. Runtime vs Derived State Boundary Map

| State | Persisted? | Derived From | Runtime Owner | Can Be Mutated Directly? | Should Be Recomputed? | Current Enforcement | Risk |
| ----- | ---------- | ------------ | ------------- | ------------------------ | --------------------- | ------------------- | ---- |
| AppState root | Yes | N/A | `App.tsx` | Only through `save`/import reset | No | type + normalizer | Full replace import can carry warnings |
| Relationship graph nodes/edges view | No | entities + `relationships[]` | `relationshipGraph.ts` readers | No | Yes | pure readers/tests | Missing nodes visible as derived "Missing node" |
| `relationships[]` | Yes | relationship actions/import | `App.tsx` | Only graph helpers/promotion/delete cleanup | No | helper ownership | Orphans retained |
| Direct Thought-Project refs | Yes | domain/AI actions | `App.tsx` | Use helper only | No, except cleanup | helper/tests/invariants | Separate from graph |
| `Project.sourceThoughtId` | Yes | promotion/provenance | `App.tsx` | promotion/validated AI/cleanup | No | tests/invariants | Confused with membership |
| Review queue | No | AI drafts, decisions, blockers, handoff candidates | `reviewQueue.ts` | No | Yes | pure helper/tests | UI can present wrong notice |
| Project content readiness | Stored and derived | Project fields | `readiness.ts` + Project | Stored can mutate through owner helpers | Yes for display/checks | readiness_drift invariant | Persisted drift warning-only |
| Engineering readiness summary | No | AppState + assessment + review/orphans | `engineeringReadiness.ts` | No | Yes | pure helper/tests | Semantic overlap with project readiness |
| Engineering readiness assessment | Yes | Manual user state | `engineeringReadiness.ts` | Via update action | No | normalization/tests | Manual state affects derived readiness |
| Next action list | No | thoughts/projects/questions/review/readiness | `nextActions.ts` | No | Yes | pure helper/tests | Derived action can mutate source state |
| NextActionState | Yes | user preferences over derived ids | `nextActions.ts` | Via next action actions | Normalize | normalization/invariants | Derived ids can stale |
| Imported normalized values | Yes after save | import JSON + normalizer | `App.tsx` | Full replace | normalize before use | transfer + App save | Shallow shape validation |
| Invariant warning output | No | normalized AppState | `appStateInvariants.ts` | No | Yes | transfer returns warnings | UI count only |
| Persisted snapshots | Yes localStorage | normalized AppState | `storage.ts` | Via `saveState` only | normalize before write | tests | No explicit schema version field |
| AI patch output | Only if accepted and saved | AIInsight.patch | `aiPatchMutations` + App | Via `setAiInsightStatus` | No | validation/tests | UI callback lacks result |
| AIInsight patch metadata | Yes | AI mock/import | AppState | Created by AI mock/import | Not recomputed | invariants | Invalid metadata can persist warning-only |
| AI dock open/chat/model/prompt/api/attachment state | UI local/session/localStorage only | UI interaction | `AiChatDock` | UI only | No | component checks | Must not enter AppState casually |
| Release metadata | Git/package/docs | package/git | repo | release task only | No | package/git checks | rc labels can drift from package |
| Tooling/check status | No | command outcome | tooling | No | run when needed | script exists | Not run here |

Boundary warnings:

- Derived state should not be persisted as canonical unless it is an intentional manual preference/assessment.
- Import normalizes into runtime and persists; invalid graph/direct-ref cases can remain as warning-bearing user data.
- AI dock/session state is UI-only. Do not store chat history, API key state, prompt drafts, or attachments in AppState without explicit product/domain review.

---

## 8. Import / Export / Persistence Lifecycle Flow

```txt
export -> serialized shape -> persisted file/storage -> import -> shape validation -> normalization -> invariant validation/warnings -> AppState replacement/merge -> runtime save -> persistence -> runtime use
```

| Stage | File | Input Shape | Output Shape | Validation | Normalization | Repair Behavior | Warning Behavior | Rejection Behavior | Compatibility Handling | Risk |
| ----- | ---- | ----------- | ------------ | ---------- | ------------- | --------------- | ---------------- | ------------------ | ---------------------- | ---- |
| export JSON string | `appStateTransfer.ts#stringifyAppState` | AppState | pretty JSON | none beyond TypeScript | `normalizeAppState` | relationship endpoint type repair if resolvable | none returned | none | optional legacy fields defaulted | exports manual semantic state too |
| download/copy UI | `AppStateTransfer.tsx` | JSON string | file/clipboard | none | already normalized | none | none | import errors only | full AppState UX | not architecture owner |
| localStorage save | `storage.ts#saveState` | AppState | normalized JSON | none beyond caller | `normalizeAppState` | endpoint type repair | none surfaced | catches storage errors | local-first safe fallback | silent persistence failure |
| localStorage load | `storage.ts#loadState` | raw JSON | AppState | `validateAppState` | through validate path | endpoint type repair | warnings not surfaced | malformed/invalid shape -> normalized seed | optional legacy state initialized | warning visibility missing |
| parse import | `parseAppStateJson` | text JSON | result object | JSON parse | later | none | parse error as error | invalid JSON rejected | N/A | JSON only |
| shape validation | `validateAppState` | unknown | AppStateImportResult | root object; required arrays; optional arrays/objects | after shallow checks | none yet | none yet | missing required arrays rejected | optional additive fields tolerated | shallow cast |
| normalization | `normalizeAppState` | cast AppState | normalized AppState | none | defaults optional state; endpoint repair | resolvable relationship endpoint types repaired | relationship repair warnings discarded here; invariants catch health later | no rejection | legacy additive fields defaulted | direct-ref drift not repaired |
| invariant warnings | `validateAppStateInvariants` | normalized state | warning list | enum/refs/relationships/AI/nextAction/handoff/readiness | none | none | missing refs, orphans, invalid patch target type, drift, readiness drift | no rejection | warning-only compatibility | warnings can be ignored |
| UI import | `AppStateTransfer.tsx` | result.state | calls `onImport` | result.ok check | already normalized | none | message shows count only | parse/shape errors shown | full replace wording | warning details not displayed |
| App import save | `App.tsx` | imported state | runtime/persisted normalized state | save normalizer | `normalizeAppState` again | endpoint type repair | none surfaced | none | resets selected ids | full replace, not merge |
| runtime use | `App.tsx` + readers | normalized AppState | UI/derived state | reader-specific | reader-specific | none | invariant warnings not automatic | none | local-first app | retained invalid graph can affect views |

Direct answers:

- Import is full replace, not merge.
- Import normalizes relationships by repairing resolvable endpoint types, but it does not delete orphan relationships.
- Import validates entity references as invariant warnings, not as rejection for most cross-entity problems.
- Invariant warnings are returned as `warnings` from `validateAppState` and counted in `AppStateTransfer` UI.
- Orphan relationships are retained + warning, not repaired/deleted/rejected.
- Direct-ref drift is retained + `thought_project_reference_drift` warning, not repaired/deleted/rejected.
- Invalid imported `AIInsight.patch.targetType` is warning-only: `invalid_patch_target_type`.
- Export includes persisted semantic/manual state (`Project.readiness`, `AIInsight.status`, `engineeringReadiness`, `nextActionState`) but not derived review queue items or computed summaries.
- Persistence saves semantic state because it serializes normalized AppState.
- Legacy schema handling exists through optional/default normalizers for blocking questions, decisions, engineering readiness, next action state, and relationship endpoint type repair.
- Round-trip safety is tested for current shape and legacy optional fields, but no explicit schema version migration exists.
- Invalid graph is warning-retained, not rejected.
- Runtime save normalizes before runtime state and persistence.

---

## 9. AI Patch Apply Safety Boundary

| Stage | File | Input | Allowed Mutation | Forbidden / Risky Mutation | Validation | Atomicity | Hardening Status | Risk |
| ----- | ---- | ----- | ---------------- | -------------------------- | ---------- | --------- | ---------------- | ---- |
| facade | `src/services/applyAiPatch.ts` | service import | re-export only | none | none | n/a | implemented | no independent logic |
| status entry | `aiPatchMutations.ts#setAiInsightStatus` | AppState, aiId, accepted/rejected | reject -> mark rejected; accept -> apply patch then mark accepted; no-patch accept -> mark accepted | invalid patch must not mark accepted | insight lookup, apply result | invalid patch returns original state/status unchanged | implemented + tested | UI callback void |
| patch dispatch | `applyAiInsightPatch` | AIInsight.patch | target thought/project only | unsupported target type, missing target, empty targetId | targetType/targetId | failure returns original state | implemented + tested | imported invalid metadata can persist |
| Thought patch validation | `validateThoughtPatch` | operation.patch | `title`, `content`, `type`, `universeId`, `projectId`, `why`, `outcome`, `nextAction` | `id`, `createdAt`, `status`, relationships, timestamps | string/type/ref/archive checks | validation happens before apply | implemented + tested | AI cannot unlink projectId because empty rejected |
| Project patch validation | `validateProjectPatch` | operation.patch | `name`/`title`, `intent`, `nextAction`, `universeId`, `sourceThoughtId` | `status`, `readiness`, `lifecycleStatus`, `linkedThoughtIds`, relationships, timestamps | string/ref checks | validation happens before apply | implemented + tested | sourceThought provenance can be updated by AI if valid |
| Thought apply | `applyAiInsightPatch` | accumulated patch | targeted field update + `updatedAt`; projectId via `linkThoughtToProjectReference` | direct relationship mutation | helper validation | if helper fails returns original state | implemented + tested | separate from regular updateThought |
| Project apply | `applyAiInsightPatch` | accumulated patch | targeted field update + recomputed readiness | direct status/lifecycle/readiness | helper validation | failure returns original state | implemented + tested | no direct linkedThoughtIds mutation |
| Review Queue accept UI | `ReviewQueueCenter.tsx` | click Accept | calls `onSetAiInsight(id, "accepted")` | UI assumes success | none at UI layer | state safety in callback only | partially enforced | misleading success notice |

Direct answers:

- AI patch can update thoughts and projects only.
- AI patch cannot directly update status/readiness/lifecycle, except it recomputes `Project.readiness` after allowed project field changes.
- AI patch cannot create/delete relationships.
- AI patch has its own guarded path rather than normal project/thought helper path.
- AI patch uses allowed-key filtering plus value/reference validation.
- AI patch validates thought/project/universe/source thought references and rejects archived project membership.
- AI patch does not validate relationship endpoints because it cannot mutate relationships.
- AI Thought.projectId causes hidden cross-entity mutation by design, but this goes through `linkThoughtToProjectReference` and is tested.
- AI patch failure is atomic externally: invalid/no-op/missing-target returns original state and does not mark accepted.
- Imported invalid patch targetType does not fail import; apply would reject unsupported target type.
- AI dock UI/API panel is separate from AI patch apply path. It sends chat completion requests and stores UI-only session/local state; it does not create `AIInsight.patch` or call `setAiInsightStatus`.

### AI Mutation Restrictions

| Restriction | Status | Evidence | Notes |
| ----------- | ------ | -------- | ----- |
| AI cannot mutate ids/timestamps | implemented + tested | `disallowed_field:id`, `createdAt` tests | warnings, valid allowed fields may still apply |
| AI cannot mutate Thought.status | implemented + tested | no allowed changes test | status remains unchanged |
| AI cannot mutate Project.status/readiness/lifecycleStatus | implemented + tested | applyAiPatch test | readiness recomputes only from allowed project changes |
| AI cannot mutate relationships[] | implemented | no operation supports relationships | no direct relationship test needed because impossible by type/path |
| AI validates Thought.type | implemented + tested | invalid type test | rejects invalid enum |
| AI validates universe refs | implemented + tested | missing universe tests | thought/project universeId |
| AI validates Thought.projectId refs | implemented + tested | missing/archived/empty tests | active project required |
| AI Thought.projectId keeps reciprocal direct refs | implemented + tested | link/move/no stale tests | uses `projectThoughtLinks` |
| AI can set valid Project.sourceThoughtId | implemented + tested | sourceThoughtId test | provenance only |
| Invalid AI patch not accepted | implemented + tested | setAiInsightStatus invalid title test | `statusChanged: false` |
| No-patch AI insight can be accepted | implemented + tested | non-patch insight test | review decision only, no state patch |
| Review Queue UI reflects invalid accept failure | missing / UI-only | callback is void | non-blocking state safety follow-up |

Future LLM caution: do not add relationship creation, status changes, lifecycle changes, or chat-dock request output directly into AI patch apply without new validation and tests.

---

## 10. Cross-Entity Mutation Coupling Map

| Action / Function | File | Mutates Entities | Also Mutates Relationships? | Also Mutates Direct Refs? | Also Mutates Status? | Hidden Coupling | Current Guard | Risk |
| ----------------- | ---- | ---------------- | --------------------------- | ------------------------- | -------------------- | --------------- | ------------- | ---- |
| `deleteThought` | `appMutations.ts` | thoughts, projects, questions, decisions, aiInsights, nextActionState | removes touching edges | clears source/linked thought refs | removes target insights/preferences | broad cleanup | missing id guard + tests | cleanup omissions if new refs added |
| `deleteProject` | `appMutations.ts` | projects, thoughts, questions, decisions, aiInsights, nextActionState | removes touching edges | clears thought.projectId | removes target insights/preferences | broad cleanup | missing id guard + tests | cleanup omissions if new refs added |
| `deleteUniverse(detach)` | `universeActions.ts` | universes, thoughts, projects, questions, decisions | removes touching edges | clears universe refs | n/a | mode-dependent cleanup | in-use guard or detach | caller may choose wrong mode |
| `deleteBlockingQuestion` | `blockingQuestions.ts` | questions, decisionRecords, nextActionState | removes touching edges | clears decision source refs | n/a | decision source cleanup | missing id guard + tests | future source refs need cleanup |
| `deleteDecisionRecord` | `decisionRecords.ts` | decisionRecords | removes touching edges | clears supersedes refs | n/a | reverse decision cleanup | missing id guard + tests | no formal decision graph |
| `promoteThoughtToProject` | `projectActions.ts` | project + thought | creates `evolves_into` | sourceThoughtId + membership refs | thought type/status | creates both graph and direct refs | thought guard + tests | representation drift risk |
| `linkThoughtToProjectReference` | `projectThoughtLinks.ts` | thoughts + projects | no | reciprocal refs | updatedAt | removes stale old project links | endpoint guards + tests | graph edge not updated |
| `unlinkThoughtFromProjectReferences` | `projectThoughtLinks.ts` | thoughts + projects | no | clears membership only | updatedAt | preserves sourceThoughtId | thought guard + tests | future code may expect source cleared |
| `updateProjectDetails(linkedThoughtIds)` | `projectActions.ts` | project + thoughts + projects | no | link/unlink/move refs | readiness/lifecycle/status may change | field patch can trigger membership moves | handoff guard + tests | explicit readiness patch |
| `acceptDecisionRecord` | `decisionRecords.ts` | decision + source question | no | no | decision accepted, question resolved | accept can resolve source question | tests | semantic surprise |
| `markProjectHandoffReady` | `engineeringHandoff.ts` | project | no | reads refs | lifecycle/readiness | derived guard reads relationships/questions | evaluation tests | guard drift if semantics change |
| `completeNextAction` | `nextActions.ts` | thought/project/question | no | no | question may become in_review | derived action mutates source | source guards | bypasses primary helpers |
| `setNextActionForSource` | `nextActions.ts` | thought/project | no | no | no | derived UI action writes source | source guards | bypasses primary helpers |
| `applyAiInsightPatch` | `aiPatchMutations.ts` | thought/project; direct refs | no | projectId helper | project readiness recompute | patch can move membership | value/ref validation | separate mutation path |
| import full replace | `appStateTransfer.ts`, `App.tsx` | whole AppState | repairs endpoint types only | retains direct refs | restores all statuses | imported state becomes runtime | shape + warnings | warning-only invalid state |
| normalization | `appState.ts` | optional state defaults, relationship endpoint metadata | repairs endpoint type metadata | no direct-ref repair | normalizes manual settings | repair without warning return | tests | user may expect more repair |
| persistence restore | `storage.ts` | whole AppState | same as import | same as import | restores statuses | localStorage becomes runtime | fallback on invalid shape | warnings hidden |

Hidden coupling to watch:

- `promoteThoughtToProject` is the only routine intentionally creating both direct refs and a relationship edge.
- `acceptDecisionRecord` mutates another entity type.
- `nextActions` is derived-state code that can mutate source records.
- AI Thought.projectId patch causes cross-entity direct-ref mutations by design.

---

## 11. Invariant Risk Map

| Invariant | Current Enforcement Location | Enforcement Status | Test Coverage | Missing Enforcement | Can Be Violated By | Risk | Recommended Enforcement Layer |
| --------- | ---------------------------- | ------------------ | ------------- | ------------------- | ------------------ | ---- | ----------------------------- |
| AppState shape must be valid | `appStateTransfer`, `storage` | partially enforced | transfer/storage tests | deep schema validation | import/localStorage | malformed semantic fields | import boundary |
| relationship endpoints must exist | `relationshipGraph`, `appStateInvariants` | partially enforced | relationship/invariant tests | import rejection | import/manual bad data | orphan edges retained | invariant warnings + UI health |
| linked ids must reference existing entities | `appStateInvariants`, `referenceCleanup` | partially enforced | invariant/delete tests | create/update endpoint validation | question/decision updates/import | warning-only invalid refs | mutation owner or invariant |
| Thought.projectId and Project.linkedThoughtIds reciprocal | `projectThoughtLinks`, invariants | implemented + tested | projectThoughtLinks/projectActions/AI/invariant tests | raw patch prevention | future direct object patch/import | drift warning-only | direct-ref helper + tests |
| Project.sourceThoughtId provenance not active membership | `projectThoughtLinks`, tests | implemented + tested | unlink/source provenance tests | formal doc in source | future unlink changes | provenance loss | direct-ref helper docs/tests |
| entity delete must not leave orphan references | `referenceCleanup`, `relationshipGraph` | implemented + tested | appMutations/universe/question/decision tests | future new ref fields | new entity refs | stale state | delete cleanup owner |
| relationship cleanup deterministic | `removeRelationshipsForNode` | implemented + tested | relationshipGraph tests | full typed policy doc | same-id untyped edges | wrong edge removal/retention | relationshipGraph |
| direct-ref cleanup deterministic | `projectThoughtLinks`, `referenceCleanup` | implemented + tested | direct-ref tests | import repair choice | raw mutation/import | drift | projectThoughtLinks |
| missing-id delete must not mutate state | domain action guards | implemented + tested | delete tests | none known | future delete actions | data loss | mutation owner |
| derived state should not be directly mutated | semantic/derived helpers | partially enforced | helper tests | architectural lint/rule | UI code storing summaries | stale persisted values | docs + review |
| import must normalize or warn invalid graph | transfer + invariants | implemented + tested | transfer/invariant tests | warning details UI | import | hidden warnings | import UI |
| import must not silently delete orphan relationships | relationshipGraph + tests | implemented + tested | transfer/invariant tests | none known | normalizer changes | data loss | appState normalizer tests |
| import must not throw on invalid AI patch targetType | invariants | implemented + tested | invariant test | none known | bad import | import failure | invariant checker |
| AI patch must not bypass invariants | aiPatchMutations | implemented + tested | applyAiPatch tests | no global invariant run after apply | future patch types | unsafe mutation | AI patch boundary |
| invalid AI patch must not be marked accepted | setAiInsightStatus | implemented + tested | applyAiPatch tests | UI feedback result | review queue UI | user confusion | callback result propagation |
| AI patch Thought.projectId no stale linkedThoughtIds | projectThoughtLinks in AI patch | implemented + tested | applyAiPatch tests | none known | helper bypass | direct drift | helper |
| status/readiness/lifecycle not contradictory | invariants/semantics | partially enforced | status/handoff/invariant tests | complete canonical semantics | project update/import | inconsistent UI | semantic table + invariant |
| handoff_ready only guarded | `projectActions`, `engineeringHandoff` | implemented + tested | projectActions/handoff tests | import can still carry handoff_ready with warning only | import/raw state | warning-bearing inconsistent lifecycle | mutation guard + import warning |
| review state must not redefine lifecycle | reviewQueue derived only | partially enforced | reviewQueue tests | explicit docs | future persisted queue | semantic drift | reviewQueue boundary |
| persisted state round-trip safe | transfer/storage tests | implemented + tested for current cases | many transfer tests | explicit schema migration | future shape change | localStorage breakage | transfer/storage |
| legacy import compatible or explicit | normalizers | implemented + tested for known optional fields | transfer/storage tests | schema versioning | future removals | silent default changes | appState normalizer |
| UI-only AI panel/chat state must not mutate AppState | AiChatDock source inspection | implemented for current branch | no domain tests | formal boundary test | future AI dock changes | domain pollution | component boundary + tests |

---

## 12. Dangerous Drift Hotspots

### `src/App.tsx`

- why dangerous: runtime AppState owner and mutation coordinator.
- invariant it can break: normalization-before-state/persistence, import full replacement, AI accept gating, UI-only vs domain state boundary.
- future LLM might misunderstand: because App imports many helpers, it may look like domain authority; it is the coordinator, not the source of all rules.
- safer in rc2: `save` normalizes before `setState` and `saveState`.
- safer in current branch: AI dock state is UI-only and not AppState.
- do not change casually: `save`, `acceptAI`, `onImport`, delete handlers, handoff handler.
- safe later modification: keep domain logic in domain helpers, return action results to UI, preserve normalization.

### `src/domain/types.ts`

- why dangerous: persisted shape and compile-time authority.
- invariant it can break: localStorage/import/export compatibility.
- future LLM might misunderstand: type changes are migrations, not cosmetic edits.
- safer in rc2/rc3: AppState shape supports warning/normalization and direct refs.
- do not change casually: optional vs required fields, status unions, AI patch types.
- safe later modification: add backwards-compatible optional fields and tests first.

### `src/domain/appState.ts`

- why dangerous: central normalizer.
- invariant it can break: import/save behavior, orphan retention, endpoint repair.
- future LLM might misunderstand: normalization is not a place to delete user data.
- safer in rc2: runtime/import/storage use this normalizer.
- rc3 boundary: direct-ref drift remains warning-only, not repaired.
- do not change casually: relationship orphan retention.
- safe later modification: add focused migration with transfer/storage tests.

### `src/services/appStateTransfer.ts`

- why dangerous: import validation and export serialization.
- invariant it can break: full replace, warnings, legacy compatibility.
- future LLM might misunderstand: `validateAppState` is shallow by design.
- safer in rc2: returns invariant warnings.
- do not change casually: warning-return behavior and normalization order.
- safe later modification: add narrow warning details UI or schema guard tests.

### `src/services/storage.ts`

- why dangerous: localStorage durable state.
- invariant it can break: reload compatibility and fallback safety.
- safer in rc2: load validates/normalizes; save normalizes.
- do not change casually: storage key, fallback behavior.
- safe later modification: introduce migration/versioning only with storage tests.

### `src/domain/validation/appStateInvariants.ts`

- why dangerous: import health claims and warning semantics.
- invariant it can break: orphan relationship warning, direct-ref drift warning, invalid AI patch target warning.
- future LLM might misunderstand: warnings are not rejection.
- safer in rc2/rc3: invalid patch target and direct drift coverage.
- do not change casually: warning-only behavior and non-mutating checker.
- safe later modification: add warnings, not destructive repairs, unless explicitly requested.

### `src/domain/mutations/aiPatchMutations.ts`

- why dangerous: untrusted AI-to-state boundary.
- invariant it can break: status/lifecycle/readiness safety, atomic failure, direct-ref consistency.
- future LLM might misunderstand: allowed keys are not enough; value/reference validation matters.
- safer in rc2: validation and unified accepted/rejected status.
- safer in rc3: Thought.projectId uses direct-ref helper.
- do not change casually: allowed fields, fail returns original state, accepted marking order.
- safe later modification: add one patch capability at a time with invalid and atomic tests.

### `src/domain/projectThoughtLinks.ts`

- why dangerous: reciprocal direct membership owner.
- invariant it can break: stale old `linkedThoughtIds`, duplicated links, sourceThought provenance.
- safer in rc3: explicit helper and tests.
- do not change casually: move semantics, unlink preserving sourceThoughtId, no relationship mutation.
- safe later modification: keep helper pure and add direct tests.

### `src/domain/projectActions.ts`

- why dangerous: project details, direct refs, readiness, lifecycle, promotion.
- invariant it can break: handoff guard, direct-ref consistency, graph/direct-ref separation.
- safer in rc2/rc3: handoff shortcut blocked; link/unlink/move uses helper.
- do not change casually: `updateProjectDetails` handoff guard, promotion relationship creation, linkedThoughtIds handling.
- safe later modification: route new membership behavior through `projectThoughtLinks`.

### `src/domain/mutations/referenceCleanup.ts`

- why dangerous: cross-entity cleanup owner.
- invariant it can break: delete must not leave stale refs.
- safer in rc2/rc3: direct refs, sourceThoughtId, linked ids, AI insights, next action ids cleaned.
- do not change casually: provenance cleanup vs unlink behavior.
- safe later modification: add new entity refs here when adding any new persisted cross-ref.

### `src/domain/relationships/relationshipGraph.ts`

- why dangerous: graph edge authority and endpoint repair.
- invariant it can break: orphan retention, typed endpoint matching, duplicate prevention.
- safer in rc2: typed endpoints, repair, remove helpers.
- do not change casually: `repairRelationshipEndpointTypes`, `removeRelationshipsForNode`, ambiguous endpoint handling.
- safe later modification: add relationship types/node types with tests.

### `src/domain/engineeringHandoff.ts`

- why dangerous: guarded `handoff_ready` authority.
- invariant it can break: lifecycle/readiness semantics.
- safer in rc2: guarded action and tests.
- do not change casually: `markProjectHandoffReady` readiness check.
- safe later modification: adjust evaluation with tests covering blocked/archive/question/relationship cases.

### `package.json`

- why dangerous: local verification/release signal.
- rc4: `typecheck` and `check` exist.
- do not change casually: `check` composition unless release/tooling task.
- safe later modification: lint addition only with config and docs.

### `docs/release/v0.2.3-rc2.md` and `docs/architecture/**`

- why dangerous: can mislead future LLMs if treated as source.
- stale/conflict: rc2 doc says tag not applied and generated outputs dirty; architecture docs say staged/uncommitted in places.
- safe later modification: source-backed doc freshness pass only.

### `src/components/layout/AiChatDock.tsx`

- why dangerous: looks AI-related but is not AI patch/domain logic.
- invariant it can break if expanded badly: UI-only chat/session state must not enter AppState and must not bypass AI patch review.
- current branch: committed UI-only/non-domain.
- do not change casually: do not wire model responses into `AIInsight` or AppState without validation/review.
- safe later modification: keep API/chat/session state local, add explicit domain bridge only with tests.

---

## 13. Domain Ownership Map

| Domain Area | Canonical File | Runtime Owner | Mutation Owner | Validation Owner | Test Coverage | Current Ambiguity |
| ----------- | -------------- | ------------- | -------------- | ---------------- | ------------- | ----------------- |
| AppState | `src/domain/types.ts` | `src/App.tsx` | App save/import + domain helpers | `appStateTransfer`, `appState`, invariants | transfer/storage/e2e | source type vs runtime owner |
| graph | `relationshipGraph.ts` | `App.tsx` | relationshipGraph helpers | relationshipGraph + invariants | relationshipGraph/Explorer tests | separate from direct membership |
| relationships | `types.ts`, `relationshipGraph.ts` | `App.tsx` | create/remove/repair helpers | relationshipGraph + invariants | relationship tests | orphan retained warning-only |
| direct refs | `types.ts`, `projectThoughtLinks.ts` | `App.tsx` | projectThoughtLinks/projectActions/AI patch/cleanup | invariants | direct-ref/project/AI tests | raw object patch possible |
| projects | `types.ts` | `App.tsx` | projectActions/appMutations/handoff/nextActions/AI patch | projectSemantics/readiness/invariants | project/handoff/status tests | readiness/lifecycle/status overlap |
| thoughts | `types.ts` | `App.tsx` | appMutations/thoughtTriage/nextActions/AI patch | statusSemantics/invariants | appMutations/triage/AI tests | projectId not in regular updateThought |
| universes | `types.ts` | `App.tsx` | universeActions | statusSemantics/invariants | universe tests | delete mode choice |
| blocking questions | `types.ts` | `App.tsx` | blockingQuestions/decisionRecords/nextActions | questionDecisionSemantics/invariants | blocking/decision/status tests | status owners overlap |
| decision records | `types.ts` | `App.tsx` | decisionRecords | questionDecisionSemantics/invariants | decision tests | accept resolves question |
| readiness/review | `readiness.ts`, `reviewQueue.ts`, `engineeringReadiness.ts` | derived consumers | source entity actions + assessment actions | semantic helpers/invariants | readiness/review tests | derived vs persisted manual state |
| lifecycle | `Project.lifecycleStatus` | `App.tsx` | projectActions + engineeringHandoff | projectSemantics/invariants | projectActions/handoff/status tests | import can carry invalid combo warning-only |
| engineering handoff | `engineeringHandoff.ts` | App callback | `markProjectHandoffReady` | evaluation + invariants | handoff tests/e2e | depends on derived readers |
| import/export | `appStateTransfer.ts` | App import callback | full replace only | transfer + invariants | transfer/e2e | warnings details not surfaced |
| AI patch | `aiPatchMutations.ts` | App AI callback | set/apply AI insight status | patch validators + invariants | applyAiPatch tests/e2e happy path | UI accept callback lacks result |
| persistence | `storage.ts` | App initial load/save | saveState/loadState | validateAppState/normalizer | storage tests | no schema version |
| invariant validation | `appStateInvariants.ts` | none | none | itself | invariant tests | warning-only |
| verification tooling | `package.json` scripts | npm | package metadata | command exit | not run here | lint deferred |
| release metadata | package/git/docs | repo | release tasks | git/package checks | not command-run here | rc docs stale |
| UI-only AI panel/session | `AiChatDock.tsx`, `AIPanel.tsx` | components | UI local state/navigation only | UI checks | no domain tests for dock | non-domain boundary must stay clear |

---

## 14. Hardening Summary: v0.2.3-rc2 through rc5

| Hardening Area | Files Involved | What Was Hardened | Tests | Remaining Risk |
| -------------- | -------------- | ----------------- | ----- | -------------- |
| runtime save/import normalization | `App.tsx`, `appState.ts`, `storage.ts`, `appStateTransfer.ts` | Runtime save/import/storage normalize before use/persist. State safety improvement. | storage/transfer tests | direct-ref drift retained |
| import invariant warnings | `appStateTransfer.ts`, `appStateInvariants.ts` | Imports return warning metadata after normalization. State safety improvement. | invariant/transfer tests | UI shows count, not details |
| orphan relationship handling | `relationshipGraph.ts`, `appState.ts`, invariants | Resolvable endpoint types repaired; orphan edges retained and warned. State safety improvement. | relationship/transfer/invariant tests | warning-only invalid graph |
| invalid AIInsight.patch.targetType warning | `appStateInvariants.ts` | Invalid imported patch targetType warns without throw/import failure. State safety improvement. | invariant test | bad draft can persist |
| AI patch value/reference validation | `aiPatchMutations.ts` | Validates values and refs, not only keys. State safety improvement. | applyAiPatch tests | new patch types need tests |
| unified AI accepted/rejected status flow | `aiPatchMutations.ts`, `App.tsx` | Status transitions centralized; invalid patch does not mark accepted. State safety improvement. | applyAiPatch tests/e2e happy path | Review Queue UI feedback issue |
| handoff_ready guarded transition | `projectActions.ts`, `engineeringHandoff.ts`, `ProjectDetail.tsx` | General project detail shortcut cannot newly set handoff_ready; guarded action required. State safety improvement. | projectActions/handoff/e2e | import can carry invalid combo warning-only |
| missing-id delete guard | domain action files | Missing thought/project/universe/question/decision deletes reject and keep original state. State safety improvement. | action tests | future delete actions must copy pattern |
| Thought-Project direct reference helper | `projectThoughtLinks.ts`, `projectActions.ts` | Reciprocal link/unlink/move/cleanup owner. State safety improvement. | projectThoughtLinks/projectActions tests | helper bypass still possible |
| AI patch Thought.projectId reciprocal consistency | `aiPatchMutations.ts`, `projectThoughtLinks.ts` | AI projectId patch uses helper and removes stale old linkedThoughtIds. State safety improvement. | applyAiPatch tests | AI cannot unlink projectId currently |
| direct-ref invariant warnings | `appStateInvariants.ts` | `thought_project_reference_drift` warns on reciprocal drift. State safety improvement. | invariant/transfer tests | warning-only |
| Project.sourceThoughtId provenance clarification | `projectThoughtLinks.ts`, tests | Unlink does not clear sourceThoughtId; delete/missing cleanup can clear. State safety improvement. | projectThoughtLinks/appMutations tests | easy future misunderstanding |
| architecture docs | `docs/architecture/**`, this file | Lightweight guardrails and current context. Architecture documentation improvement. | source/doc scan only | draft docs can stale |
| local verification gate | `package.json` | Adds `typecheck` and aggregate `check`. Tooling improvement. | script existence verified | check not run here; lint deferred |
| generated/local artifact untracking | `.gitignore`, git tracking state | Generated/local paths ignored and not tracked in checked paths. Release/process improvement. | git ls-files/status checks | ignored artifacts still exist locally |
| release metadata / rc2 tag readiness | `package.json`, `package-lock.json`, git tag, release doc | rc2 package version and local tag exist. Release/process improvement. | git/package checks | rc2 doc stale about tag/artifacts |

Classification:

- State safety improvements: normalization, warnings, AI validation/status gating, handoff guard, delete guards, direct-ref consistency.
- Architecture documentation improvements: `docs/architecture/**`, this context.
- Release/process improvements: rc2 metadata/tag, generated artifact untracking, `.env.local` risk identification.
- Tooling improvements: `typecheck` and `check`.
- Non-blocking follow-ups: Review Queue UI feedback, doc freshness, lint, `.env.local` process cleanup.

---

## 15. Remaining Risks / Follow-ups

| Follow-up | Type | Blocking? | Why It Matters | Likely Files | Suggested Minimal Next Step |
| --------- | ---- | --------- | -------------- | ------------ | --------------------------- |
| Review Queue invalid AI accept UI feedback | UI feedback/state-result boundary | non-blocking | State remains safe but user may see accepted notice on rejected invalid patch. | `ReviewQueueCenter.tsx`, `App.tsx`, `aiPatchMutations.ts`, tests | Return AI status result through callback and show success only when `statusChanged`. |
| docs freshness pass | documentation | non-blocking | `docs/release/v0.2.3-rc2.md` and draft architecture docs conflict with current git/tag/artifact state. | `docs/architecture/**`, `docs/release/v0.2.3-rc2.md` | Source-backed doc correction only; no source changes. |
| canonical status semantics consolidation | architecture | non-blocking | Status/readiness/lifecycle/review semantics overlap across helpers. | `semantics/**`, `readiness.ts`, `engineeringHandoff.ts`, `reviewQueue.ts` | Add small status interpretation table/tests; avoid state-machine rewrite. |
| relationship cleanup ownership clarification | architecture | non-blocking | Graph edges and direct refs are both persisted but separately owned. | `relationshipGraph.ts`, `projectThoughtLinks.ts`, `referenceCleanup.ts`, docs/tests | Document owner split and add missing tests if new ref paths appear. |
| relationship graph and direct-ref representations remain separate | architecture | non-blocking | Future work can update one and assume the other updates. | same as above | Keep separate but explicit; do not auto-canonicalize broad behavior. |
| remote/upstream | release/process | not blocking | Remote/upstream exists now, so no immediate follow-up. | git config | None unless release requires push/PR. |
| `.env.local` tracked ignored | secret/process | secret/process risk | Tracked ignored secret-like file can leak through history/process. | git metadata, `.gitignore` | Human-led secret audit/untrack/rotate plan; do not read content. |
| generated/local artifacts dirty/tracked | artifact hygiene | local artifact only | Checked generated paths are ignored/untracked, not tracked; local ignored artifacts exist. | `.gitignore`, git tracking | Keep out of architecture source; no action unless release process wants clean workspace. |
| lint deferred | tooling | tooling only | `check` lacks lint; no lint config found. | `package.json`, future lint config | Decide separately whether lint is needed; avoid framework/tool churn. |
| right AI panel/dock work | UI branch | UI-only | Current branch has committed UI-only AI dock/session work; could be mistaken for AI patch architecture. | `AiChatDock.tsx`, `App.tsx`, `Nav.tsx`, `style.css` | Keep chat/session state outside AppState; no domain conclusion from UI branch alone. |
| `npm run check` not executed here | tooling verification | tooling only | Script exists but was not run due artifact-modification constraint. | package scripts | Run in a verification task where build artifacts may be modified/cleaned. |

---

## 16. Minimal Next Hardening Priorities

Priority 1: Review Queue AI accept result feedback

- purpose: align UI feedback with state safety.
- files likely involved: `src/App.tsx`, `src/components/screens/ReviewQueueCenter.tsx`, `src/services/applyAiPatch.test.ts` or component/e2e test.
- invariant protected: invalid AI patch must not be presented as accepted.
- risk reduced: user-facing false positive without changing AI patch state safety.
- why now: known follow-up, small surface.
- do not touch: AI patch allowed fields, relationship helpers, AppState shape, right AI dock rendering beyond needed callback plumbing.
- expected test coverage: invalid AI accept UI path and existing valid accept path.

Priority 2: Relationship/direct-ref boundary note or narrow test

- purpose: prevent future code from assuming `relationships[]` and direct membership are one canonical representation.
- files likely involved: `projectThoughtLinks.test.ts`, `relationshipGraph.test.ts`, docs.
- invariant protected: direct membership moves do not mutate graph edges; graph edge creation does not imply membership.
- risk reduced: representation drift caused by incorrect future assumptions.
- why now: rc3 made direct refs safer but not canonicalized with graph.
- do not touch: broad relationship model, existing import behavior, product UI.
- expected test coverage: one or two focused boundary tests if behavior is not already explicit enough.

Priority 3: Small canonical status semantics table

- purpose: document current precedence and meaning without redesign.
- files likely involved: `src/domain/semantics/**`, docs, maybe invariant tests.
- invariant protected: handoff_ready/readiness/status/review meanings stay separate.
- risk reduced: UI interpretation leaking into domain semantics.
- why now: multiple helpers exist but no full map.
- do not touch: do not introduce state machine/workflow engine; do not change product behavior.
- expected test coverage: helper tests only if code changes.

Priority 4: Import warning visibility

- purpose: make invariant warnings inspectable after import/load.
- files likely involved: `AppStateTransfer.tsx`, maybe a small warning display type.
- invariant protected: invalid graph/direct drift remains warning-bearing, not silently invisible.
- risk reduced: users/agents ignoring warnings.
- why now: import already returns warnings but UI only counts them.
- do not touch: normalization repair/deletion rules.
- expected test coverage: transfer/component test for warning code display if implemented.

Priority 5: Secret/process cleanup plan for `.env.local`

- purpose: resolve tracked ignored secret risk.
- files likely involved: git metadata only; maybe `.gitignore` if process changes.
- invariant protected: no secrets in repo history/process.
- risk reduced: accidental disclosure.
- why now: current scan confirms tracked ignored file.
- do not touch: do not read content; do not auto-untrack/commit/push without explicit human instruction.
- expected test coverage: none; process verification via git commands.

---

## 17. Code Context Appendix

### `src/domain/types.ts`

summary:

- Source-of-truth for AppState/entity compile-time shape.
- Used by almost every map above.
- Source-of-truth, not runtime validator.

```ts
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

- Normalization owner for import/export/storage/runtime save.
- Repairs relationship endpoint type metadata only.

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

### `src/App.tsx`

summary:

- Runtime owner and coordinator.
- The normalization-before-runtime/persistence invariant depends on `save`.

```ts
const save = (next: AppState) => {
  const normalized = normalizeAppState(next);

  setState(normalized);
  saveState(normalized);

  return normalized;
};

const acceptAI = (aiId: string, status: "accepted" | "rejected") => {
  const result = setAiInsightStatus(state, aiId, status);

  if (result.statusChanged) {
    save(result.state);
  }
};
```

### `src/services/appStateTransfer.ts`

summary:

- Import/export boundary.
- Shape validation is shallow; invariant validation returns warnings.

```ts
const requiredArrays = ["universes", "thoughts", "projects", "relationships", "aiInsights"] as const;

const state = normalizeAppState(value as unknown as AppState);

return {
  ok: true,
  state,
  warnings: validateAppStateInvariants(state)
};
```

### `src/services/storage.ts`

summary:

- Persistence boundary.
- Load validates/normalizes or falls back; save normalizes.

```ts
const result = validateAppState(JSON.parse(raw));
return result.ok && result.state ? result.state : fallbackState();

storage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state), null, 2));
```

### `src/domain/relationships/relationshipGraph.ts`

summary:

- Relationship graph owner.
- Used for create, repair, orphan detection, and delete cleanup.

```ts
export function createTypedRelationship(state: AppState, input: CreateRelationshipInput): CreateRelationshipResult {
  if (!isSupportedRelationshipType(input.type)) return { state, ok: false, error: "Invalid relationship type." };
  const source = resolveRelationshipEndpoint(state, input.sourceId, input.sourceType);
  const target = resolveRelationshipEndpoint(state, input.targetId, input.targetType);
  if (source.status !== "resolved") return { state, ok: false, error: "Source node not found." };
  if (target.status !== "resolved") return { state, ok: false, error: "Target node not found." };
  ...
}

export function repairRelationshipEndpointTypes(state: AppState): RelationshipEndpointRepairResult {
  // Repairs sourceType/targetType only when both endpoints resolve.
  // Missing/ambiguous endpoints are retained and reported.
}
```

### `src/domain/projectThoughtLinks.ts`

summary:

- Direct-ref consistency owner.
- Does not touch `relationships[]`.

```ts
export function linkThoughtToProjectReference(state: AppState, projectId: string, thoughtId: string) {
  // sets thought.projectId, adds project.linkedThoughtIds,
  // removes stale linkedThoughtIds from other projects.
}

export function unlinkThoughtFromProjectReferences(state: AppState, thoughtId: string) {
  // clears membership but preserves Project.sourceThoughtId.
}
```

### `src/domain/mutations/referenceCleanup.ts`

summary:

- Cross-entity delete cleanup owner.
- Critical for preventing dangling direct refs and stale derived preference ids.

```ts
function removeThoughtReferences(state: AppState, thoughtId: string): AppState {
  return {
    ...state,
    projects: state.projects.map((project) => withoutDeletedThoughtProjectReferences(project, thoughtId, timestamp)),
    blockingQuestions: state.blockingQuestions?.map(...),
    decisionRecords: state.decisionRecords?.map(...),
    aiInsights: state.aiInsights.filter((insight) => insight.targetId !== thoughtId)
  };
}

export function removeDeletedNodeReferences(state: AppState, node: RelationshipNodeRef): AppState {
  const cleanedState = node.type === "thought" ? removeThoughtReferences(state, node.id) : ...;
  return removeNextActionReferences(cleanedState, node);
}
```

### `src/domain/mutations/appMutations.ts`

summary:

- Thought/project safe mutation owner.
- Missing-id delete guards and cleanup depend on this file.

```ts
export function deleteThought(state: AppState, thoughtId: string): ThoughtMutationResult {
  const thought = state.thoughts.find((item) => item.id === thoughtId);
  if (!thought) return { state, ok: false, error: thoughtNotFoundError };

  const relationshipCleanup = removeRelationshipsForNode(state, { id: thoughtId, type: "thought" });
  const referenceCleanup = removeDeletedNodeReferences(relationshipCleanup.state, { id: thoughtId, type: "thought" });

  return { state: { ...referenceCleanup, thoughts: referenceCleanup.thoughts.filter((item) => item.id !== thoughtId) }, ok: true, thoughtId };
}
```

### `src/domain/projectActions.ts`

summary:

- Project details, direct refs, promotion, and handoff shortcut guard.

```ts
if (patch.lifecycleStatus === "handoff_ready" && project.lifecycleStatus !== "handoff_ready") {
  return {
    state,
    ok: false,
    error: "Use the guarded handoff action to mark a project handoff_ready."
  };
}

if (nextLinkedThoughtIds !== undefined) {
  // unlink removed thoughts and link/move valid linkedThoughtIds through projectThoughtLinks.
}
```

### `src/domain/engineeringHandoff.ts`

summary:

- Guarded handoff lifecycle owner.

```ts
export function markProjectHandoffReady(state: AppState, projectId: string): MarkProjectHandoffReadyResult {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return { ok: false, state, error: "Project not found." };

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

### `src/domain/mutations/aiPatchMutations.ts`

summary:

- AI patch safety boundary and accepted/rejected status owner.

```ts
const allowedThoughtKeys = ["title", "content", "type", "universeId", "projectId", "why", "outcome", "nextAction"] as const;
const allowedProjectKeys = ["name", "title", "intent", "nextAction", "universeId", "sourceThoughtId"] as const;

if (projectIdPatch !== undefined) {
  const linkResult = linkThoughtToProjectReference(nextState, projectIdPatch, targetId);
  if (!linkResult.ok) return fail(state, "invalid_value", [...warnings, linkResult.error ?? "invalid_value:projectId"]);
  nextState = linkResult.state;
}

const result = applyAiInsightPatch(state, insight);
if (!result.applied) {
  return { ...result, statusChanged: false };
}
```

### `src/domain/validation/appStateInvariants.ts`

summary:

- Warning-only invariant owner.

```ts
warnings.push({
  code: "thought_project_reference_drift",
  severity: "warning",
  entityType,
  entityId,
  field,
  message
});

warnings.push({
  code: "invalid_patch_target_type",
  severity: "warning",
  entityType: "ai_insight",
  entityId: insightId,
  field: "patch.targetType",
  message: ...
});
```

### `src/components/screens/ReviewQueueCenter.tsx`

summary:

- Known UI feedback issue for invalid AI accept.
- State safety is downstream in App/AI mutation, but UI does not receive result.

```tsx
if (item.type === "ai_insight") {
  onAcceptAiInsight(item.sourceId);
  onError("");
  onNotice("AI draft accepted.");
  return;
}
```

### `src/components/layout/AiChatDock.tsx`

summary:

- UI-only AI chat/API dock.
- Stores UI/session settings in localStorage/sessionStorage keys separate from `todo-thought-universe:v1`.
- Does not mutate AppState.

```ts
const LOCAL_STORAGE_KEYS = {
  apiBaseUrl: "eflow.aiChat.apiBaseUrl",
  customModelId: "eflow.aiChat.customModelId",
  dockOpen: "eflow.ui.aiChatDockOpen",
  messages: "eflow.aiChat.messages",
  promptDraft: "eflow.aiChat.promptDraft",
  promptMode: "eflow.aiChat.promptMode",
  selectedModel: "eflow.aiChat.selectedModel"
} as const;

const SESSION_STORAGE_KEYS = {
  apiKey: "eflow.aiChat.apiKey",
  persistApiKey: "eflow.aiChat.persistApiKey"
} as const;
```

### `package.json`

summary:

- rc4 verification gate owner.
- `check` exists but was not run in this scan.

```json
{
  "version": "0.2.3-rc.2",
  "scripts": {
    "typecheck": "tsc -b --noEmit",
    "test": "vitest run",
    "build": "tsc -b && vite build",
    "check": "npm run typecheck && npm test && npm run build"
  }
}
```

### `.gitignore`

summary:

- rc5 hygiene evidence.
- `.env.local` is ignored by pattern but still tracked.

```gitignore
node_modules/
dist/
playwright-report/
test-results/
*.tsbuildinfo
.env
.env.*
!.env.example
```

---

## 18. Freshness / Confidence Notes

| Claim | Confidence | Based On | Needs Recheck? |
| ----- | ---------- | -------- | -------------- |
| Actual app repo is nested under `/Users/sean/Documents/todolist/todo-thought-universe` | high | git status, git rev-parse | Recheck only if cwd changes |
| Current branch is `ui/right-ai-chat-dock` with upstream | high | git status, git branch -vv | Recheck before commit/push |
| Current working tree only has modified context doc | high | git status | Recheck after edits |
| Package version is `0.2.3-rc.2` | high | package metadata | Recheck before release |
| `v0.2.3-rc2` tag exists at `70dd9bb` | high | git tag/rev-list | Recheck before tagging |
| Requested checkpoint commits exist | high | git show | No |
| rc5 artifact hygiene commit order differs from conceptual rc5 order | high | git log | No |
| Remote/upstream exists | high | git remote, branch -vv | Recheck before push |
| `.env.local` is tracked ignored | high | git ls-files -ci, git check-ignore --no-index | Yes before any secret process work |
| Generated artifacts checked are not tracked | high | git ls-files paths | Recheck before release |
| `npm run check` exists | high | package metadata | No |
| `npm run check` was not executed here | high | tool actions | No |
| No lint config found | medium | rg over common lint config names | Recheck if tooling changes |
| AppState canonical definition is `src/domain/types.ts` | high | source | Recheck if types move |
| App.tsx is runtime coordinator | high | source | Recheck after architecture refactor |
| Runtime save normalizes before setState/persist | high | source + tests | Recheck after App/storage changes |
| Import returns warnings and retains orphan relationships | high | source + tests | Recheck after transfer/invariant changes |
| Direct-ref drift is warning-only on import | high | source + tests | Recheck after direct-ref changes |
| AI patch value/reference validation implemented | high | source + tests | Recheck after AI patch changes |
| Invalid AI patch not marked accepted | high | source + tests | Recheck after AI/UI callback changes |
| Handoff ready is guarded | high | source + tests | Recheck after project/handoff UI changes |
| `Project.sourceThoughtId` is provenance, not membership | high | source + tests | Recheck after link/unlink changes |
| Relationship graph and direct refs remain separate owners | high | source + tests | Recheck after relationship refactor |
| Review Queue invalid AI accept is UI-feedback only | medium | source inspection, inferred from void callback | Needs a targeted invalid-patch UI test |
| AI dock is UI-only/non-domain | high | source inspection | Recheck if dock starts creating AIInsight/AppState writes |
| Architecture docs are draft/stale in places | high | docs + git state | Recheck after docs pass |

---

## 19. Working Tree / Branch Notes

| Item | Status | Architecture Impact | Notes |
| ---- | ------ | ------------------- | ----- |
| Actual repo root | `/Users/sean/Documents/todolist/todo-thought-universe` | high | Nested app repo is source of truth. |
| Invocation cwd | `/Users/sean/Documents/todolist` | process only | Outer repo has no commits and untracked app folder; do not use as app source. |
| Current branch | `ui/right-ai-chat-dock` | medium | Current branch includes committed UI dock work. |
| Current git status summary | `M docs/architecture-hardening-context.md` | documentation only | This file was already modified before this command and was refreshed by this command. |
| Latest commits | `9874e54`, `b3b7e98`, `3f7c914`, `ec15daa`, `70dd9bb`, `f47280f`, `68419ab`, `4153017` | release/process context | `9874e54` is committed UI-only dock/sidebar work; not uncommitted. |
| Remote/upstream | exists | release/process only | `origin/ui/right-ai-chat-dock` configured. |
| `docs/architecture-hardening-context.md` modified by this command | yes | documentation only | Only intended output file. |
| Source/test/package files left untouched | yes by intent and verified after write | none | Recheck `git diff --name-only` before any future action. |
| Uncommitted UI files exist | no | none | No uncommitted UI source/style files observed. |
| Committed UI/right AI dock files exist | yes | UI-only / non-domain | `src/components/layout/AiChatDock.tsx`, `src/App.tsx`, `src/components/layout/Nav.tsx`, `src/style.css` in latest commit. |
| UI files affect AppState/domain/AI patch/relationships/import/normalize | no current evidence | none | App hosts dock and passes derived counts/navigation callbacks only. |
| `.env.local` avoided | yes | secret/process risk only | Path status checked; contents not read. |
| Generated/local artifacts | ignored/untracked in checked paths | none | Do not use as architecture source of truth. |
| `npm run check` | script exists, not executed | tooling only | Not run because it may write generated artifacts. |
| Lint tooling | not found | tooling only | Do not claim lint gate exists. |

Final handoff rule: next AI should treat committed domain/source/tests as authority, this file as a source-backed map, architecture docs as draft orientation, generated artifacts as non-authoritative, and current AI dock work as UI-only unless future source changes explicitly bridge it into AppState/domain mutation paths.
