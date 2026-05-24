# TDU Milestone Acceptance Report

## 0. Executive Summary

- Current branch: `ui/right-ai-chat-dock` in `/Users/sean/Documents/todolist/todo-thought-universe`. The invocation cwd `/Users/sean/Documents/todolist` is a separate outer git repo with no commits and treats `todo-thought-universe/` as untracked; this report uses the nested app repo as the app source of truth.
- Current git status: dirty before this report. Tracked modified files were `docs/architecture-hardening-context.md`, `docs/architecture/ARCHITECTURE_DECISIONS.md`, `package.json`, `src/App.tsx`, `src/components/screens/AIPanel.tsx`, `src/components/screens/AppStateTransfer.tsx`, `src/components/screens/DeploymentStatus.test.tsx`, `src/components/screens/DeploymentStatus.tsx`, `src/components/screens/ReviewQueueCenter.tsx`, `src/domain/semantics/statusSemantics.test.ts`, `src/domain/types.ts`, and `src/style.css`. Important untracked source/test/docs include the command layer, Domain Engine read models, Product Intelligence engine files, EngineeringHandoffPackage/export, backend contract/adapter, export/review UI panels, and their tests.
- Current package version: `0.2.3-rc.2` in both committed `HEAD:package.json` and current working-tree `package.json`. Current working-tree package metadata adds `test:source-targets`, `typecheck:no-build`, and `verify:source`, so those scripts are working-tree only.
- Latest relevant commits: `9874e54 feat: add overlay AI chat dock and compact sidebar`; `b3b7e98 chore: add local verification gate`; `3f7c914 feat: stabilize thought-project direct reference consistency`; `ec15daa chore: untrack generated artifacts`; `70dd9bb v0.2.3-rc2 version metadata`; `f47280f v0.2.3-rc2 architecture hardening`.
- Remote/upstream status: `origin https://github.com/sean0900108489-cpu/Flow.git` is configured for fetch/push. No remote mutations were performed.
- Tags: latest local tags are `v0.2.3-rc2` and `v0.2.3-rc1`.
- Verification command result: `npm run typecheck:no-build` passed and `npm test` passed with 47 test files and 429 tests. `npm run check` was not run because it invokes `npm run build`, which can write `dist/**` and `tsconfig.tsbuildinfo`, paths this scan was explicitly told not to modify.
- Whether source/test/package files were modified by this scan: no. Only this acceptance report is written by this scan.
- Whether `.env.local` was avoided: yes. The required tracked-ignored check detected the local env path, but its contents were not read, diffed, snapshotted, printed, staged, committed, or pushed.
- Whether generated artifacts are tracked or dirty: `git ls-files dist node_modules playwright-report test-results tsconfig.tsbuildinfo .vercel coverage .vite` returned no tracked files. Ignored local artifacts exist but are not source of truth.
- Current milestone label inferred from repo/docs/source: `post-v0.2.3-rc2 Domain Engine / Engineering Handoff / Project Intelligence working-tree checkpoint`.
- Overall score out of 100: 72 / 100 as an acceptance score after applying the working-tree-only cap. The current functional working tree is closer to 84 / 100, but large parts cannot count as committed architecture state.
- Whether this milestone is acceptable: conditional for local Domain Engine MVP review; not acceptable as a 95-point release or architecture state.
- Whether it reaches 95: no.
- What prevents it from reaching 95: critical implementation is working-tree only; full `npm run check` was not verified under the no-generated-artifact rule; package/docs/source are dirty; backend contract and local backend adapter semantics conflict around import apply; and Product Intelligence is implemented as deterministic local planning support, not a mature autonomous intelligence layer.
- Suggested next phase: architecture hardening and release/process cleanup first; then MVP usability and engineering handoff polish. Full Project Intelligence should be a later phase unless the milestone scope is explicitly redefined.

```txt
Overall assessment:
- Architecture Hardening: 82 / 100
- MVP Product Usability: 70 / 100
- Engineering Handoff / Blueprint: 62 / 100
- Project Intelligence: 58 / 100
- Verification / Release Readiness: 55 / 100
- Overall Weighted Score: 72 / 100
- 95-point acceptance: FAIL
```

## 1. Scorecard

The scores below apply the requested cap: working-tree-only architecture is capped at 60% and cannot be counted as committed milestone state.

| Area | Weight | Score | Evidence Level | Why |
|---|---:|---:|---|---|
| AppState / persistence / import-export safety | 10 | 88 | implemented + tested; partially enforced | `normalizeAppState`, storage, transfer validation, invariant warnings, warning details UI, and round-trip tests exist. Import still full-replaces state and warnings are visible after validation/apply flow, not a separate full AppState dry-run. |
| Mutation ownership / CommandResult safety | 10 | 72 | implemented + tested; working-tree only | Existing mutation owners are tested. New `commandLayer`, command import, and atomic `CommandResult` are strong but untracked, so this area is capped. |
| AI patch safety / false-success prevention | 10 | 90 | implemented + tested | `setAiInsightStatus` only marks accepted after valid patch apply. Invalid AI patch attempts are atomic failures. Current AIPanel/ReviewQueueCenter use result-aware feedback. |
| Relationship / direct refs / provenance separation | 10 | 88 | implemented + tested; partially working-tree only | `projectThoughtLinks` and `relationshipGraph` are distinct; `sourceThoughtId` provenance is tested. `RelationshipContext` is working-tree only. |
| Domain Engine read models | 10 | 60 | implemented + tested; working-tree only | `domainIndex`, `relationshipContext`, `appHealthReport`, `thoughtProgressionReport`, `projectReadinessReport`, and `derivedReviewQueue` exist with tests, but are untracked. |
| Review / Workflow / Next action support | 8 | 64 | implemented + tested; working-tree only | Existing review/next action source exists. New `NextBestAction` engine and workflow support are untracked, so acceptance score is capped. |
| Project readiness / handoff gates | 8 | 86 | implemented + tested | `ready_for_engineering` is separated from `handoff_ready`; generic update cannot newly set `handoff_ready`; guarded handoff tests exist. |
| Engineering handoff package | 8 | 60 | implemented + tested; working-tree only | Rich package/export source and tests exist, but the current package is untracked and is a DTO/planning package rather than an executable blueprint. |
| Required software / module planning | 6 | 60 | implemented + tested; working-tree only | `RequiredSoftwarePlan` exists with modules/dependencies/tests, but it is deterministic heuristic output, not a runtime planner. |
| Project Intelligence / clustering / planning | 6 | 58 | partial; implemented + tested; working-tree only | `ProjectCluster`, `NextBestAction`, and `AIWorkflowPlan` engines exist and are tested, but untracked and not full Product Intelligence. |
| Constraint runtime / scope guard | 5 | 58 | implemented + tested; working-tree only | `ConstraintRuntime` / `ScopeGuard` exists and blocks several unsafe command classes, but is untracked and limited to command preflight. |
| UI integration / feedback correctness | 4 | 68 | implemented only; partially tested; working-tree only | AI/review feedback is result-aware; import warning details and export panels exist. No fresh browser/E2E verification was run. |
| Test coverage / verification gate | 3 | 68 | implemented + tested; not fully verified | `npm run typecheck:no-build` and `npm test` passed. Full `npm run check`, build, and E2E were not run. Many tests are untracked. |
| Docs freshness / release hygiene | 2 | 45 | stale / conflicting; working-tree only | Docs exist but are dirty/untracked. Some docs still say no `ConstraintRuntime`; source now has an untracked one. Release docs are not committed milestone truth. |

Weighted score calculation: 72.24 / 100, rounded to 72 / 100.

## 2. 95-Point Acceptance Gate

| Gate | Pass? | Evidence | Notes |
|---|---|---|---|
| No P0 state safety risk | CONDITIONAL | implemented + tested | Current working tree blocks the obvious corruption paths, but key guards are untracked. |
| AppState contract stable | CONDITIONAL | implemented + tested; working-tree dirty | Shape is explicit in `src/domain/types.ts`; the file is currently modified, so committed contract is not final. |
| Import/export round-trip safe or explicitly warned | PASS | implemented + tested | Round-trip, normalization, orphan relationship preservation, typed endpoint repair, and warning detail UI are covered. |
| AI invalid patch cannot be accepted falsely at state level | PASS | implemented + tested | Invalid AI patches leave status/state unchanged. |
| UI does not show accepted when command failed, or gap is explicitly classified | CONDITIONAL | implemented only; partially tested | AIPanel and ReviewQueueCenter are result-aware. No fresh browser/E2E verification was run. |
| relationship graph != direct membership | PASS | implemented + tested | Relationship graph helpers and command guards keep graph separate from direct refs. |
| Project.sourceThoughtId provenance is not treated as active membership | PASS | implemented + tested | Direct-ref helper and RelationshipContext preserve provenance semantics. |
| handoff_ready cannot be set by generic update | PASS | implemented + tested | `projectActions`, `commandLayer`, command import, and ScopeGuard block generic `handoff_ready`. |
| ReviewItems / reports are derived, not persisted | PASS | implemented + tested; working-tree only | No `reviewItems` field exists in `AppState`; reports/queues are read models. |
| Command failures are atomic | PASS | implemented + tested; working-tree only | CommandResult and confirmed command import return original state on failure. |
| Project readiness and final handoff are separated | PASS | implemented + tested | `ready_for_engineering` does not imply `handoff_ready`. |
| Engineering handoff can produce usable JSON / Markdown | CONDITIONAL | implemented + tested; working-tree only | Export helper and panel exist, but are untracked. |
| Required software / module plan exists, if claiming engineering blueprint maturity | CONDITIONAL | implemented + tested; working-tree only | Exists as deterministic plan; not executable planning runtime. |
| Constraint / scope guard exists, if claiming 95 product intelligence maturity | CONDITIONAL | implemented + tested; working-tree only | `ConstraintRuntime` exists, but is untracked and not enough for full Product Intelligence 95. |
| Verification command passes or failure is environmental and documented | CONDITIONAL | partially verified | Safe verification passed; full `npm run check` was intentionally not run due artifact-write constraints. |
| No generated artifacts are treated as source of truth | PASS | process evidence | Tracked generated paths check returned empty. |
| `.env.local` was not read or exposed | PASS | process evidence | Path was detected by required git check only; contents were avoided. |

```txt
95-point conclusion:
- PASS: No.
- CONDITIONAL PASS: Current working tree is close to a Domain Engine MVP safety checkpoint after review, commit, and a clean verification run.
- FAIL: The milestone does not reach 95 because acceptance-critical architecture is working-tree only, full verification is incomplete, release/package/docs state is dirty, and Product Intelligence remains partial.
```

Minimum fixes before 95: 5 for scoped Domain Engine MVP acceptance; 7+ for full Product Intelligence acceptance.

## 3. Milestone Delta

| Area | Previously | Now | Delta | Evidence |
|---|---|---|---|---|
| Direct Thought-Project refs | rc2/rc3 had `projectThoughtLinks` and reciprocal consistency. | Still implemented and tested. | stable | source + tests |
| Review Queue AI false feedback | Previous context flagged likely false accepted UI feedback. | AIPanel and ReviewQueueCenter now use result-aware callbacks/messages. | newly implemented; tracked modified | source + tests pass |
| AppState import warnings | Transfer returned warnings and earlier UI mostly surfaced count. | `AppStateImportWarningDetails` now renders code, severity, target/evidence, and message. | newly exposed in UI; tracked modified | source + component test |
| Command layer | Previously mutation owners existed but not a full command envelope. | `commandLayer`, command import, dry-run, confirmed import, and atomic command batch apply exist. | newly implemented/tested; working-tree only | untracked source/tests |
| Domain read engine | Previously fragmented helpers and docs claims. | DomainIndex, RelationshipContext, AppHealthReport, ThoughtProgressionReport, ProjectReadinessReport, DerivedReviewQueue exist. | newly implemented/tested; working-tree only | untracked source/tests |
| Engineering handoff package | Previously simpler `EngineeringFlowInput` in `engineeringHandoff.ts`. | New `EngineeringHandoffPackage` includes flow input, required software, evolution plan, constraints, backend plan, Codex tasks, and acceptance plan. | newly implemented/tested/exported; working-tree only | untracked source/tests |
| Handoff export UI | Previously no full package export panel. | JSON/Markdown export helper and panel exist. | newly exposed in UI; working-tree only | untracked component/test |
| Backend-safe channel | Previously design docs only. | Backend contract, command DTO validation, command batch apply, and local in-memory snapshot adapter exist. | newly implemented/tested; working-tree only | untracked source/tests |
| Product Intelligence | Previous acceptance report incorrectly said cluster/planner/ConstraintRuntime missing. | `ProjectCluster`, `NextBestAction`, `AIWorkflowPlan`, and `ConstraintRuntime` exist in `src/domain/engine`. | newly implemented/tested; working-tree only | source search + tests |
| Docs | rc2 docs claimed tag should be applied later and no ConstraintRuntime in some places. | Current source has tag and untracked ConstraintRuntime; new docs are checkpoint-style. | stale/conflicting | docs vs source/git |
| Verification | Prior checkpoint referenced `verify:source`; old acceptance report had older test count. | `typecheck:no-build` and `npm test` passed in this scan. | newly verified partially | command output |

## 4. Implementation Reality Map

| Capability | Status | Evidence Level | Source Files | Tests | Notes |
|---|---|---|---|---|---|
| Canonical AppState shape | mostly complete | implemented + tested; working-tree dirty | `src/domain/types.ts`, `src/types.ts` | storage/transfer/invariant tests | No ReviewItems/reports/chat state in AppState; current file is modified. |
| Runtime normalization | complete | implemented + tested | `src/domain/appState.ts`, `src/services/storage.ts`, `src/services/appStateTransfer.ts`, `src/App.tsx` | `storage.test.ts`, `appStateTransfer.test.ts` | Normalize before save/import/export. |
| Import invariant warnings | mostly complete | implemented + tested | `src/domain/validation/appStateInvariants.ts`, `src/services/appStateTransfer.ts`, `src/components/screens/AppStateTransfer.tsx` | `appStateInvariants.test.ts`, `appStateTransfer.test.ts`, `AppStateTransfer.test.tsx` | Warnings are visible; full AppState import still applies as full replace. |
| AI patch validation | complete | implemented + tested | `src/domain/mutations/aiPatchMutations.ts`, `src/services/applyAiPatch.ts` | `applyAiPatch.test.ts`, `commandLayer.test.ts` | Value/reference validation and direct-ref helper use are covered. |
| AI accepted/rejected status flow | complete | implemented + tested | `aiPatchMutations.ts`, `src/App.tsx`, `AIPanel.tsx`, `ReviewQueueCenter.tsx` | `applyAiPatch.test.ts`, `commandLayer.test.ts` | Accepted only after valid apply; failed UI result is surfaced. |
| CommandResult contract | mostly complete | implemented + tested; working-tree only | `src/domain/commandLayer.ts`, `src/domain/commands/**` | `commandLayer.test.ts`, `commandImport.test.ts` | Strong boundary but not committed. |
| Direct Thought-Project ref helper | complete | implemented + tested | `src/domain/projectThoughtLinks.ts` | `projectThoughtLinks.test.ts`, `projectActions.test.ts` | Owns reciprocal link/move/unlink/cleanup. |
| Relationship graph helper | complete | implemented + tested | `src/domain/relationships/relationshipGraph.ts` | `relationshipGraph.test.ts` | Typed graph, orphans retained/warned. |
| RelationshipContext | mostly complete | implemented + tested; working-tree only | `src/domain/relationshipContext.ts` | `relationshipContext.test.ts` | Read model separates graph, direct membership, and provenance. |
| AppHealthReport | mostly complete | implemented + tested; working-tree only | `src/domain/appHealthReport.ts` | `appHealthReport.test.ts` | Aggregates invariant/readiness/relationship findings. |
| ThoughtProgressionReport | mostly complete | implemented + tested; working-tree only | `src/domain/thoughtProgressionReport.ts` | `thoughtProgressionReport.test.ts` | Derived workflow read model. |
| ProjectReadinessReport | mostly complete | implemented + tested; working-tree only | `src/domain/projectReadinessReport.ts` | `projectReadinessReport.test.ts` | Separates draft readiness, blockers, preflight, and handoff. |
| ReviewItems | mostly complete | implemented + tested; working-tree only | `src/domain/reviewQueue.ts`, `src/domain/derivedReviewQueue.ts` | `reviewQueue.test.ts`, `derivedReviewQueue.test.ts` | Derived, not persisted. |
| Handoff guarded action | complete | implemented + tested | `src/domain/engineeringHandoff.ts`, `src/domain/projectActions.ts`, `src/domain/commandLayer.ts` | `engineeringHandoff.test.ts`, `projectActions.test.ts`, `commandLayer.test.ts` | Generic `handoff_ready` blocked. |
| EngineeringFlowInput | mostly complete | implemented + tested | `engineeringHandoff.ts`, `engineeringHandoffPackage.ts` | `engineeringHandoff.test.ts`, `engineeringHandoffPackage.test.ts` | Richer current version is working-tree only. |
| EngineeringHandoffPackage | mostly complete | implemented + tested; working-tree only | `src/domain/engineeringHandoffPackage.ts`, `src/domain/engineeringHandoffExport.ts` | package/export tests | Usable DTO/export; not executable blueprint. |
| RequiredSoftwarePlan | partial | implemented + tested; working-tree only | `engineeringHandoffPackage.ts` | `engineeringHandoffPackage.test.ts` | Deterministic heuristic module plan. |
| AIPlanningContext | mostly complete | implemented + tested; working-tree only | `src/domain/aiPlanningContext.ts` | `aiPlanningContext.test.ts` | Derived context, not persisted. |
| AIWorkflowPlanner / NextBestAction | partial | implemented + tested; working-tree only | `src/domain/engine/aiWorkflowPlanner.ts`, `src/domain/engine/nextBestActions.ts` | engine tests | DAG/phases/ranking exist; still deterministic local planning support. |
| ProjectClusterEngine | partial | implemented + tested; working-tree only | `src/domain/engine/projectClusters.ts` | `projectClusters.test.ts` | Existing/project/universe/relationship/candidate/warning clusters; no autonomous project creation. |
| EngineeringBlueprintCompiler | missing | missing | none found | none | Handoff package is adjacent but not a compiler. |
| ConstraintRuntime / ScopeGuard | partial | implemented + tested; working-tree only | `src/domain/engine/constraintRuntime.ts` | `constraintRuntime.test.ts`, `commandLayer.test.ts` | Blocks command classes; not a full product scope runtime. |
| Export UI | mostly complete | implemented + tested; working-tree only | `src/components/screens/HandoffPackageExportPanel.tsx`, existing export UI | `HandoffPackageExportPanel.test.tsx` | Copy/download JSON/Markdown package UI exists. |
| Backend-safe command DTO docs | partial | implemented + tested; stale/conflicting | `backendContract.ts`, `backendSnapshotAdapter.ts`, `commands/**`, docs | backend/command tests | Contract says import preview only; adapter has full-replace import apply. Clarify before 95. |
| Verification gate | partial | implemented only / not fully verified | `package.json` | `npm test`, typecheck output | Safe verification passed; full `check`/build/e2e not run. |

## 5. Architecture Maturity Map

| Layer | Maturity | Score | Evidence | Main Gap |
|---|---|---:|---|---|
| AppState safety layer | stable | 88 | source + tests | Dirty contract file; import full-replace needs clearer pre-apply boundary for 95. |
| Mutation owner layer | usable | 72 | source + tests | Command layer is untracked. |
| AI safety layer | stable | 90 | source + tests | Browser/E2E verification not rerun. |
| Relationship/domain graph layer | stable | 88 | source + tests | RelationshipContext is untracked. |
| Domain read engine | usable | 60 | working-tree source + tests | Not committed, capped. |
| Workflow/review layer | usable | 64 | source + tests | NextBestAction workflow engine is untracked. |
| Engineering handoff layer | usable | 60 | working-tree source + tests | DTO/export package, not executable blueprint. |
| Product intelligence layer | partial | 58 | working-tree source + tests | Missing blueprint compiler, version evolution engine, overbuild/drift detectors, real autonomous planning. |
| Constraint enforcement layer | partial | 58 | working-tree source + tests | Command preflight guard only; not committed. |
| Backend-ready channel | partial | 60 | working-tree source + tests | Local adapter only; import apply semantics conflict with contract docs. |
| UI usability layer | partial | 68 | source + tests | No browser/E2E verification; many UI panels untracked. |
| Verification/release layer | partial | 55 | command output + git status | Dirty package/source/docs, untracked architecture, no full check/build/e2e. |

## 6. Source-of-Truth / Authority Matrix

| State / Concept | Canonical Definition | Runtime Owner | Allowed Mutation Owner | Validation Owner | Derived or Persisted | Current Ambiguity | Risk |
|---|---|---|---|---|---|---|---|
| AppState | `src/domain/types.ts` | `src/App.tsx`, `storage.ts` | mutation helpers / command layer | `appStateTransfer.ts`, `appStateInvariants.ts` | persisted | Current contract dirty; new command layer untracked | medium |
| Thought | `ThoughtItem` | `App.tsx` | thought mutations, projectThoughtLinks, command layer | invariants/semantics | persisted | direct project ref must use helper | medium |
| Project | `Project` | `App.tsx` | project actions, handoff action, command layer | readiness/reports/invariants | persisted | readiness vs lifecycle remains semantically sensitive | high |
| Universe | `Universe` | `App.tsx` | universe actions / command layer | invariants | persisted | delete/detach semantics must remain owner-controlled | low |
| relationships[] | `Relationship` | `App.tsx` | relationshipGraph / relationship commands | relationshipGraph + invariants | persisted | may be confused with direct membership | high |
| Thought.projectId | `ThoughtItem.projectId` | `App.tsx` | `projectThoughtLinks`, project actions, AI patch via helper | invariants | persisted direct ref | raw import can carry drift warning | medium |
| Project.linkedThoughtIds | `Project.linkedThoughtIds` | `App.tsx` | `projectThoughtLinks`, project actions | invariants | persisted direct ref | raw import can carry drift warning | medium |
| Project.sourceThoughtId | `Project.sourceThoughtId` | `App.tsx` | project creation/promotion/update owner | invariants/context | persisted provenance | can be mistaken for membership | medium |
| status | entity status fields | entity owners | scoped mutation helpers | status semantics | persisted | canonical status semantics newly untracked | medium |
| lifecycleStatus | `ProjectLifecycleStatus` | project owner | guarded handoff action for `handoff_ready` | project semantics/invariants | persisted | generic update must remain blocked | high |
| readiness | `Readiness` | project/readiness owners | readiness helpers / command layer | readiness reports | persisted plus computed comparison | stale stored readiness possible | medium |
| ReviewItem | review queue / derivedReviewQueue types | read model | none directly | review model tests | derived | must not enter AppState | medium |
| AIInsight | `AIInsight` | `App.tsx` | `setAiInsightStatus`, AI patch mutation | AI patch validation/invariants | persisted | import invalid patch target is warning-only | medium |
| BlockingQuestion | `BlockingQuestion` | `App.tsx` | blocking question actions | question semantics/invariants | persisted | unresolved questions block handoff | low |
| DecisionRecord | `DecisionRecord` | `App.tsx` | decision record actions | decision semantics/invariants | persisted | proposed decisions block handoff | low |
| EngineeringFlowInput | `engineeringHandoff.ts`, `engineeringHandoffPackage.ts` | read model/export | none | package tests | derived/exported | richer version is untracked | medium |
| EngineeringHandoffPackage | `engineeringHandoffPackage.ts` | read model/export | none | package/export tests | derived/exported | DTO, not executable blueprint | medium |
| RequiredSoftwarePlan | `engineeringHandoffPackage.ts` | read model/export | none | package tests | derived/exported | static plan, no module planner runtime | medium |
| AIPlanningContext | `aiPlanningContext.ts` | read model | none | AI planning context tests | derived | not persisted; untracked | medium |
| ProjectCluster | `engine/projectClusters.ts` | read model | none | cluster tests | derived | untracked; no autonomous create | medium |
| ConstraintRuntime | `engine/constraintRuntime.ts` | command preflight/read model | none | constraint/command tests | derived guard | untracked; limited command scope | high if claiming 95 |
| persisted snapshot | localStorage / import/export JSON | `storage.ts`, `AppStateTransfer` | full replace import / save | transfer validation/invariants | persisted | import apply semantics differ between local UI and backend contract | medium |
| import warnings | `AppStateInvariantWarning` | transfer UI | none | invariants | derived at import | visible after validation; no full-state dry run | medium |
| UI-only AI chat/session state | `AiChatDock` local/session keys | React UI state + local/sessionStorage | UI only | no domain tests | UI/local only | must not enter AppState | low |

## 7. Invariant Enforcement Map

| Invariant | Enforcement Location | Status | Test Coverage | Can Be Violated By | Risk | Needed Before 95? |
|---|---|---|---|---|---|---|
| AppState shape must be valid. | `validateAppState`, `normalizeAppState`, storage load | enforced at import/load | yes | direct casts/manual localStorage | medium | yes |
| Runtime save/import must normalize before state/persistence. | `App.tsx`, `storage.ts`, `appStateTransfer.ts` | enforced | yes | bypassing `save` | medium | yes |
| Import warnings must be visible and not silently destructive. | invariants + AppStateTransfer details | mostly enforced | yes | full replace import without separate dry run | medium | yes |
| Orphan relationships must be warned/retained or explicitly handled. | relationshipGraph + invariants + transfer | enforced | yes | manual graph edits | medium | yes |
| Direct Thought-Project refs must stay reciprocal. | `projectThoughtLinks`, project actions, AI patch | enforced by owners; warned on import | yes | raw import, generic object edits | medium | yes |
| relationships[] must not be conflated with direct membership. | relationshipGraph, command layer, RelationshipContext, ScopeGuard | enforced in owners/guard | yes | future UI/backend shortcut | high | yes |
| Project.sourceThoughtId must remain provenance. | projectThoughtLinks, RelationshipContext, invariants | enforced/read-model verified | yes | treating source thought as linked thought | medium | yes |
| missing-id deletes must not mutate state. | app/universe/question/decision mutations | enforced | yes | raw array filtering outside owners | high | yes |
| invalid AI patch must be atomic failure. | `aiPatchMutations`, command layer | enforced | yes | bypassing mutation owner | high | yes |
| invalid AI patch must not be marked accepted at state level. | `setAiInsightStatus` | enforced | yes | direct AIInsight status mutation | high | yes |
| UI must not display false accepted if command failed. | AIPanel/ReviewQueueCenter current source | mostly enforced | component/unit indirect | unverified UI route regression | medium | yes |
| AI cannot directly canonical-mutate restricted fields. | AI patch whitelist/value validation, command import, ScopeGuard | enforced | yes | raw backend/app patch | high | yes |
| handoff_ready can only be set through guarded handoff command. | projectActions, commandLayer, commandImport, ScopeGuard | enforced | yes | raw state import/direct mutation | high | yes |
| ready_for_engineering does not imply handoff_ready. | project semantics, readiness reports, package tests | enforced | yes | UI copy/generic update misuse | high | yes |
| ReviewItems must remain derived. | derivedReviewQueue/reviewQueue and AppState absence | enforced by design | yes | adding `reviewItems` to AppState | medium | yes |
| Engineering draft must not be treated as final handoff. | projectReadinessReport/handoff package | enforced in read model | yes | UI wording/export consumer | medium | yes |
| Constraint rules must be enforceable if claiming 95 product intelligence. | `ConstraintRuntime` / ScopeGuard | partially enforced; working-tree only | yes | unsupported future commands, not committed | high | yes for PI 95 |
| Backend channel must not allow raw PATCH bypassing domain owner. | backendContract, command import, adapter command path | partially enforced | yes | future server routes or adapter import full replace | high | yes |
| UI-only AI session state must not enter AppState without explicit design. | AiChatDock local/session state only | currently enforced by absence | no dedicated AppState test | future persistence shortcut | medium | yes |

## 8. Risk Register

| Risk | Severity | Type | Evidence | Blocking? | Minimal Fix | Owner Area |
|---|---|---|---|---|---|---|
| Acceptance-critical implementation is modified/untracked. | P1 | release/process | `git status --short`; `git ls-files` empty for new engine files | yes for 95 | Review and commit chosen source/tests/docs, or explicitly scope milestone as working-tree-only. | release |
| Full verification gate was not run. | P1 | testing gap | `npm run check` includes build; safe tests only ran | yes for 95 | Run full check in clean artifact-safe environment or add a no-write CI gate. | tooling |
| Backend contract and adapter disagree on import apply. | P1 | backend overreach | contract says dry-run/apply outside helper; adapter `importState` full-replaces | yes for backend readiness | Rename adapter as local harness or add explicit confirmed apply mode with tests/docs aligned. | backend boundary |
| Working-tree package metadata is dirty. | P2 | release/process | `package.json` modified with safe verification scripts | yes for release acceptance | Decide whether to keep scripts, then commit or revert in a separate task. | package/tooling |
| Product Intelligence exists but is not mature enough for 95. | P2 | product intelligence gap | engines exist, but no blueprint compiler/version engine/drift detectors | yes for PI 95 | Keep PI claim conservative or add minimal missing read models/tests. | product intelligence |
| AppState import is full replace with warnings, not full dry-run/confirm. | P2 | import/export risk | AppStateTransfer applies parsed state then shows warnings | conditional | Add explicit preview/confirm if the product wants import safety at 95. | import UI |
| UI panels are not browser/E2E verified in this scan. | P2 | UI false feedback | no browser/e2e run | conditional | Add or run targeted component/browser checks for failure feedback/export/import. | UI |
| Docs conflict with current untracked source. | P3 | docs stale | docs say no ConstraintRuntime; source has it | no, but blocks clean release | Reconcile docs after source selection. | docs |
| `.env.local` is tracked ignored. | P3 | secret/process | required tracked-ignored check detected path | not architecture-blocking | Untrack in a separate secret hygiene task without reading contents. | process |
| Generated/local artifacts exist ignored locally. | P3 | generated artifact hygiene | generated tracked check empty; ignored artifacts present | no | Keep ignored and out of source truth. | release |

## 9. Product Flow Acceptance

| Flow | Can User Complete It? | Evidence | Gap | Score |
|---|---|---|---|---:|
| Quick capture thought | Yes | app/UI source and thought mutation tests | Not freshly E2E verified | 80 |
| Inbox triage | Yes | `thoughtTriage.ts`, review/queue tests | UI polish not assessed | 78 |
| Classify thought | Yes | thought command/mutation paths | command path working-tree only | 76 |
| Assign universe | Yes | universe/thought command tests | command path working-tree only | 76 |
| Add context / next action | Yes | `nextActions.ts`, thought/project fields | new NBA engine untracked | 72 |
| Link thought to project | Yes | `projectThoughtLinks.ts`, projectActions tests | raw import can warn but not repair | 86 |
| Promote thought to project | Yes | projectActions/command tests | command path untracked | 82 |
| See blockers / dependencies | Yes | relationship/readiness/blocking question reports | drilldown UI untracked | 74 |
| Review AI suggestion | Yes | AI patch/review queue tests | UI browser not rerun | 84 |
| Reject invalid AI suggestion safely | Yes | AI patch + command tests | none major | 90 |
| See project readiness | Yes | `projectReadinessReport.ts`, UI panels | working-tree only | 60 |
| Mark handoff ready through guard | Yes | handoff/project/command tests | source partly untracked | 84 |
| Generate engineering draft | Yes | `engineeringHandoff.ts`, package/export | draft-only | 74 |
| Generate final handoff | Partial | handoff package/export | final vs draft remains semantic, no external consumer | 60 |
| Export JSON / Markdown | Yes | `engineeringHandoffExport.ts`, export panel tests | working-tree only | 60 |
| See required software / modules | Yes | `RequiredSoftwarePlan` | static heuristic, working-tree only | 60 |
| See version plan | Partial | `ProjectEvolutionPlan` | no VersionEvolutionEngine | 52 |
| See constraints / non-goals | Partial | `ConstraintCodex`, `ConstraintRuntime` | runtime untracked/limited | 58 |
| See backend/API plan | Partial | `BackendDesignPlan`, backend contract/adapter | no real backend; contract conflict | 56 |
| See Codex task slices | Yes | `CodexTaskPlan` | static tasks, working-tree only | 60 |
| See next best action | Yes | `buildNextBestActions` | working-tree only | 58 |
| See project clusters / emergent projects | Yes | `buildProjectClusters` | working-tree only, no autonomous promotion | 58 |

## 10. Engineering Handoff / Blueprint Acceptance

| Output | Exists? | Source | Test | Usable? | Gap |
|---|---|---|---|---|---|
| EngineeringFlowInput | Yes | `engineeringHandoff.ts`, `engineeringHandoffPackage.ts` | yes | yes | richer current package untracked |
| EngineeringHandoffPackage | Yes | `engineeringHandoffPackage.ts` | yes | yes | DTO/planning package, not executable |
| RequiredSoftwarePlan | Yes | `engineeringHandoffPackage.ts` | yes | partly | static module plan |
| ProjectEvolutionPlan | Yes | `engineeringHandoffPackage.ts` | yes | partly | no version evolution engine |
| ConstraintCodex / Limiter | Yes | package + `ConstraintRuntime` | yes | partly | runtime guard untracked and command-scoped |
| BackendDesignPlan | Yes | package + `backendContract.ts` | yes | partly | no server; adapter/contract import conflict |
| CodexTaskPlan | Yes | `engineeringHandoffPackage.ts` | yes | yes | static task slices |
| AcceptanceTestPlan | Yes | `engineeringHandoffPackage.ts` | yes | partly | plan text, not generated executable tests |
| JSON export | Yes | `engineeringHandoffExport.ts`, export panel | yes | yes | working-tree only |
| Markdown export | Yes | `engineeringHandoffExport.ts`, export panel | yes | yes | working-tree only |
| Dependency order / DAG | Partial | `RequiredSoftwarePlan.dependencies`, `AIWorkflowPlan.dagEdges` | yes | partly | no DAG executor/validator beyond read model |
| v0/v1/v2 slicing | Partial | `ProjectEvolutionPlan` | yes | partly | no named VersionEvolutionEngine |

Current classification:

```txt
handoff DTO
```

It is a strong handoff DTO / deterministic planning package. It is not yet:

```txt
executable engineering blueprint
```

Do not score Engineering Blueprint maturity at 95 until there is a committed compiler/planner boundary, downstream consumer contract, and verification that the generated plan can drive implementation slices.

## 11. Project Intelligence Acceptance

| Capability | Exists? | Evidence | Maturity | Gap |
|---|---|---|---|---|
| ProjectClusterEngine | Yes | `src/domain/engine/projectClusters.ts`, tests | partial | working-tree only; no autonomous project creation |
| Multi-thought project candidate detection | Yes | project candidate clusters | partial | heuristic grouping only |
| Blocker aggregation | Yes | readiness/review/cluster engines | usable | working-tree only |
| Decision aggregation | Yes | readiness/review reports | usable | working-tree only |
| AI insight aggregation | Yes | review queue/planning context/NBA | usable | working-tree only |
| NextBestAction ranking | Yes | `nextBestActions.ts` | partial | local deterministic ranking only |
| PlanningEngine | Partial | `aiWorkflowPlanner.ts` | partial | no named generic `PlanningEngine` abstraction |
| AIWorkflowPlanner | Yes | `aiWorkflowPlanner.ts` | partial | working-tree only; emits reviewable plan, not executor |
| Priority / momentum scoring | Partial | next-best-action rank/priority/impact/risk | partial | no broader momentum model |
| Project maturity scoring | Partial | readiness report + project clusters | partial | readiness, not full maturity intelligence |
| Cross-universe dependency detection | Partial | graph/context can surface relationships | early | no dedicated cross-universe dependency engine |
| ConstraintRuntime / ScopeGuard | Yes | `constraintRuntime.ts` | partial | command-scoped, working-tree only |
| Overbuild detector | No | source search | missing | no source-backed detector |
| Architecture drift detector | Partial | AppHealth/invariants/readiness drift | early | no named architecture drift detector |

```txt
This milestone may be 95-ready for Domain Engine MVP after committing and clean verification, but not 95-ready for full Project Intelligence.
```

## 12. Tests / Verification

| Test / Command | Result | What It Covers | What It Does Not Cover |
|---|---|---|---|
| `git branch --show-current` | passed | current branch | upstream tracking details beyond remote URL |
| `git status --short` | passed | dirty tracked/untracked files | semantic correctness |
| `git log --oneline -10` | passed | recent commit context | uncommitted architecture state |
| `git remote -v` | passed | remote URL configured | no network push/pull |
| `git tag --list --sort=-creatordate \| head -20` | passed | local tag context | remote tags |
| `git ls-files -ci --exclude-standard` | passed; detected local env path | tracked ignored hygiene | no contents read |
| `cat package.json` / read package metadata | passed | scripts/version | package correctness beyond scripts |
| `npm run typecheck:no-build` | PASS | TypeScript without build artifacts | build output / bundling |
| `npm test` | PASS, 47 files / 429 tests | source/unit/component coverage | browser E2E, production build, generated output |
| `npm run check` | not run | would cover typecheck + tests + build | not safe under this scan because build may write forbidden generated outputs |
| `npm run build` | not run | would cover production bundle | not safe under no generated artifact modification |
| `npm run e2e` | not run | browser product flows | could write reports/test-results |

Coverage spot check:

| Required Coverage Area | Found? | Evidence |
|---|---|---|
| appState normalization | Yes | `storage.test.ts`, `appStateTransfer.test.ts` |
| appStateTransfer import/export | Yes | `appStateTransfer.test.ts`, `AppStateTransfer.test.tsx` |
| invariant warnings | Yes | `appStateInvariants.test.ts` |
| AI patch invalid failure | Yes | `applyAiPatch.test.ts`, `commandLayer.test.ts` |
| AI patch status flow | Yes | `applyAiPatch.test.ts` |
| AI patch Thought.projectId direct-ref consistency | Yes | `applyAiPatch.test.ts`, `projectThoughtLinks.test.ts` |
| projectThoughtLinks reciprocal consistency | Yes | `projectThoughtLinks.test.ts` |
| relationshipGraph behavior | Yes | `relationshipGraph.test.ts` |
| Project.sourceThoughtId provenance | Yes | `projectThoughtLinks.test.ts`, `relationshipContext.test.ts` |
| missing-id delete guard | Yes | mutation/action tests |
| handoff_ready guard | Yes | `engineeringHandoff.test.ts`, `projectActions.test.ts`, `commandLayer.test.ts` |
| CommandResult failure atomicity | Yes | `commandLayer.test.ts`, `commandImport.test.ts` |
| ReviewItems derived output | Yes | `reviewQueue.test.ts`, `derivedReviewQueue.test.ts` |
| ProjectReadinessReport | Yes | `projectReadinessReport.test.ts` |
| ThoughtProgressionReport | Yes | `thoughtProgressionReport.test.ts` |
| EngineeringHandoffPackage | Yes | `engineeringHandoffPackage.test.ts` |
| RequiredSoftwarePlan | Yes | `engineeringHandoffPackage.test.ts` |
| ConstraintRuntime | Yes | `constraintRuntime.test.ts` |
| ProjectClusterEngine | Yes | `projectClusters.test.ts` |
| Export UI | Yes | `HandoffPackageExportPanel.test.tsx` |

## 13. Files Changed By This Scan

| File | Changed? | Why | Allowed? |
|---|---|---|---|
| `docs/acceptance/milestone-acceptance-report.md` | Yes | Required output file; previous report was stale against current source/tests. | Yes |
| `src/**` | No | Source was read only. | Yes |
| `tests/**` / `*.test.ts` / `*.test.tsx` | No | Tests were read/executed only. | Yes |
| `package.json` / `package-lock.json` | No | Metadata was read only. | Yes |
| `docs/release/**` | No | Release docs were read only. | Yes |
| `docs/architecture-hardening-context.md` | No | Read as reference only. | Yes |
| `dist/**`, `node_modules/**`, `playwright-report/**`, `test-results/**`, `tsconfig.tsbuildinfo` | No | Not used as source of truth; no build/E2E run. | Yes |
| `.env.local` | No | Path detected by required git check; contents avoided. | Yes |

Ideal post-scan state: only `docs/acceptance/milestone-acceptance-report.md` changes because of this scan; source/tests/package remain untouched by this scan.

## 14. Minimal Path to 95

### Must fix before 95

| Item | Why It Blocks 95 | Minimal Implementation | Tests Needed | Estimated Risk |
|---|---|---|---|---|
| Select and commit/review the working-tree architecture set. | Working-tree-only code is capped and cannot be accepted as committed milestone state. | Decide exact source/tests/docs set for Domain Engine/Handoff/PI checkpoint, then commit in a later explicit git task. | rerun unit/typecheck after selection | Medium |
| Run clean full verification or add a no-write release gate. | Full `npm run check` was not executed. | Run in clean environment where generated artifacts may be written and then discarded, or add CI/no-write verification command. | `npm run check`, targeted E2E/build | Medium |
| Resolve backend import contract vs adapter behavior. | Contract says dry-run/preview; adapter full-replaces state. | Add explicit confirmed apply mode or rename adapter as local harness and align docs/tests. | backendContract/backendSnapshotAdapter tests | Medium |
| Stabilize package/docs release state. | `package.json` and docs are dirty, so release state is not reproducible. | Commit or defer package scripts/docs; remove stale statements like no ConstraintRuntime if source keeps it. | source verification + docs review | Low |
| Add targeted browser/component verification for critical UI feedback. | 95 needs confidence that UI does not show false success. | Verify AI accept failure, import warnings, command import failure, handoff export copy/download states. | component/browser tests | Medium |
| Keep Product Intelligence claim scoped. | Current PI is deterministic planning support, not mature 95 intelligence. | Either lower claim to Domain Engine MVP or add missing drift/overbuild/version/dependency guard read models. | focused engine tests | Medium |

### Optional after 95

| Item | Why Useful | Can Defer? |
|---|---|---|
| Real backend routes/server | Converts contract harness into deployable backend. | Yes |
| Rich AppState import preview/diff | Better UX for full replace imports. | Yes, unless import safety is the milestone |
| VersionEvolutionEngine | Makes ProjectEvolutionPlan more than heuristic text. | Yes |
| EngineeringBlueprintCompiler | Moves handoff DTO toward executable blueprint. | Yes |
| Overbuild and architecture drift detectors | Raises Product Intelligence maturity. | Yes |
| Secret/process cleanup for tracked ignored local env path | Improves release hygiene. | Yes, but do separately without reading contents |

## 15. Recommended Next Codex Prompts

```txt
Codex Prompt 01: Commit-Scope Audit For Domain Engine

Goal:
Produce a commit-scope recommendation for the current Domain Engine / Handoff / Product Intelligence working tree.

Read:
git status --short, package.json, src/domain/engine/**, src/domain/commandLayer.ts, src/domain/commands/**, src/domain/*Report*.ts, src/domain/engineeringHandoffPackage.ts, related tests.

Change:
Do not change files. Output a keep/defer list with owner boundaries and risks.

Do not:
Do not read .env.local. Do not stage, commit, tag, push, rename, or edit source.

Tests:
No tests required for audit-only.

Acceptance:
The output clearly separates committed state, tracked dirty state, and untracked working-tree-only state.
```

```txt
Codex Prompt 02: Backend Import Contract Alignment

Goal:
Make backend snapshot import semantics consistent with the documented Validate -> Dry Run -> Apply boundary.

Read:
src/domain/backendContract.ts, src/domain/backendSnapshotAdapter.ts, src/domain/backendContract.test.ts, src/domain/backendSnapshotAdapter.test.ts, src/domain/commands/**.

Change:
Choose the minimal fix: either require explicit confirmed apply metadata in the adapter or document/test the adapter as a local apply harness. Keep mutation through existing validation owners.

Do not:
Do not add a real backend server. Do not raw PATCH projects. Do not read .env.local. Do not change AppState schema.

Tests:
npm test -- src/domain/backendContract.test.ts src/domain/backendSnapshotAdapter.test.ts src/domain/commands/commandImport.test.ts

Acceptance:
Docs, contract types, adapter behavior, and tests agree on when import mutates state.
```

```txt
Codex Prompt 03: Critical UI False-Success Verification

Goal:
Add targeted coverage that failed AI/command/import actions do not display success.

Read:
src/components/screens/AIPanel.tsx, src/components/screens/ReviewQueueCenter.tsx, src/components/screens/AppStateTransfer.tsx, src/components/screens/ConfirmedCommandImportPanel.tsx, existing component tests.

Change:
Add focused tests only. Keep source edits minimal and only if a test exposes false success.

Do not:
Do not change AppState schema. Do not persist ReviewItems or AI chat state. Do not read .env.local.

Tests:
npm test -- src/components/screens/AppStateTransfer.test.tsx src/components/screens/HandoffPackageExportPanel.test.tsx src/components/screens/ReviewHealthDrillDownPanel.test.tsx

Acceptance:
Invalid command/AI/import paths render an error or warning state, never an accepted/success message.
```

```txt
Codex Prompt 04: Product Intelligence Claim Hardening

Goal:
Clarify whether current Product Intelligence is Domain Engine MVP support or full PI maturity.

Read:
src/domain/engine/**, src/domain/aiPlanningContext.ts, docs/architecture/domain-engine-landing-checklist.md, docs/architecture/domain-hardening-progress.md.

Change:
If editing docs is allowed, update only architecture docs to state that clusters/NBA/workflow/ConstraintRuntime are deterministic local read models and working-tree scope. Do not claim 95 PI.

Do not:
Do not edit source/tests/package. Do not read .env.local. Do not treat docs as implementation proof.

Tests:
No tests if docs-only.

Acceptance:
Docs no longer conflict with source about ConstraintRuntime and do not overclaim autonomous Product Intelligence.
```

```txt
Codex Prompt 05: Minimal Architecture Drift Read Model

Goal:
Add a small derived read model for architecture drift using existing AppHealth, invariants, readiness, and command safety outputs.

Read:
src/domain/appHealthReport.ts, src/domain/validation/appStateInvariants.ts, src/domain/engine/constraintRuntime.ts, src/domain/engine/aiWorkflowPlanner.ts.

Change:
Create a derived report only. Do not persist it in AppState. Include drift codes for stale docs/source claims only if source evidence can identify them.

Do not:
Do not store ReviewItems/reports in AppState. Do not mix relationship graph with direct membership. Do not read .env.local.

Tests:
npm test -- src/domain/appHealthReport.test.ts src/domain/engine/constraintRuntime.test.ts <new-test-file>

Acceptance:
The report is deterministic, read-only, tested, and does not mutate AppState.
```

```txt
Codex Prompt 06: Clean Verification Gate

Goal:
Provide a safe verification command that avoids generated artifact writes while covering source integrity.

Read:
package.json, tsconfig*.json, vite config, vitest config, existing tests.

Change:
If package edits are allowed, add or refine a no-build verification script that runs targeted source tests plus no-incremental typecheck. Do not remove existing check/build scripts.

Do not:
Do not modify source/tests unless necessary. Do not run build if artifact writes are forbidden. Do not read .env.local.

Tests:
npm run <new-safe-script>

Acceptance:
The new command passes without writing dist, test-results, playwright-report, or tsconfig.tsbuildinfo.
```

## 16. Final Verdict

```txt
Final verdict:
- Current overall score: 72 / 100
- Domain Engine MVP score: 88 / 100 functional working tree, 72 / 100 acceptance-capped
- Full Product Intelligence score: 58 / 100
- 95-point acceptance: FAIL
- This milestone is safe to build on: CONDITIONAL
- Next best phase: architecture hardening + release/process cleanup, then MVP usability and engineering handoff polish
- Minimum fixes before next milestone: select/commit the working-tree architecture scope, run clean full verification, align backend import contract vs adapter, stabilize package/docs, and keep Product Intelligence claims scoped unless additional engines are implemented/tested
```
