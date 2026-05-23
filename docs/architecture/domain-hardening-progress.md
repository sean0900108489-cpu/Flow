# Domain Hardening Progress

Purpose: track scoped architecture hardening slices. Source and tests remain the
authority; this log is only a progress record.

Domain Architecture Hardening: Completed

Final status: Phase 3J completed the final architecture QA, guardrail audit, and
documentation freeze. No further hardening phase was started from this track.

## Phase 1A / Product Blocking Decisions Formalization

Date: 2026-05-23 Australia/Sydney

### Completed

- Formalized TodoItem as a derived ThoughtItem task role for Phase 1.
- Formalized Universe as a persisted workspace/domain/container object.
- Formalized Project readiness as content maturity and handoff readiness as a
  guarded workflow lifecycle state.
- Added source boundary comments in `src/domain/types.ts`.
- Added source-backed tests in `src/domain/semantics/statusSemantics.test.ts`.
- Recorded accepted ADRs in `docs/architecture/ARCHITECTURE_DECISIONS.md`.

### Decisions

- TodoItem is not a persisted entity in Phase 1. Do not add `todos[]` without an
  explicit AppState migration.
- Universe remains persisted in `universes[]` and is referenced through direct
  `universeId` fields on thoughts and projects. Graph `belongs_to` relationships
  can supplement this, but cannot replace direct membership refs.
- `Project.readiness = "ready_for_engineering"` does not imply
  `Project.lifecycleStatus = "handoff_ready"`. The latter remains gated by the
  existing handoff guard.

### Files Changed

- `docs/architecture/ARCHITECTURE_DECISIONS.md`
- `docs/architecture/domain-hardening-progress.md`
- `src/domain/types.ts`
- `src/domain/semantics/statusSemantics.test.ts`

### Tests

- `npm test -- src/domain/semantics/statusSemantics.test.ts`
  - Passed: 1 file, 7 tests.
- `npm run typecheck`
  - Passed: `tsc -b --noEmit`.

### Not Yet Handled

- Phase 1B: Canonical Status Semantics.
- Phase 1C: DomainIndex / EntityResolver.
- Later phases: RelationshipContext, deterministic reports, ReviewItems,
  Command Layer, AIPlanningContext, EngineeringHandoffPackage, backend command
  contract.

### Risks / TODO

- Canonical status precedence still lives across existing helper modules and
  needs a dedicated source-backed table/helper layer.
- Domain lookup remains ad hoc until DomainIndex is introduced.
- Review Queue invalid AI accept UI feedback is still a later CommandResult/UI
  integration task.

### Next Recommended Step

- Phase 1B: Canonical Status Semantics.

## Phase 1B / Canonical Status Semantics

Date: 2026-05-23 Australia/Sydney

### Completed

- Added `src/domain/semantics/canonicalStatusSemantics.ts` as a canonical,
  read-only status semantics table/helper module.
- Covered Thought, Project, BlockingQuestion, DecisionRecord, AIInsight, and
  derived Project effective stage semantics.
- Added `getProjectEffectiveStage` with precedence:
  `Project.status archived > actionable lifecycleStatus > active blockers >
  computed readiness`.
- Added `getProjectReadinessDrift` to compare stored and computed readiness
  without mutating project state.
- Added tests for table coverage, archived precedence, handoff-ready separation,
  active blocker effects, readiness drift, and non-mutation.

### Files Changed

- `docs/architecture/domain-hardening-progress.md`
- `src/domain/semantics/canonicalStatusSemantics.ts`
- `src/domain/semantics/canonicalStatusSemantics.test.ts`

### Tests

- `npm test -- src/domain/semantics/canonicalStatusSemantics.test.ts`
  - Passed: 1 file, 6 tests.
- `npm run typecheck`
  - Passed: `tsc -b --noEmit`.

### Not Yet Handled

- Phase 1C: DomainIndex / EntityResolver.
- RelationshipContext and deterministic report layers.
- ReviewItem derived queue, Command Layer, AIPlanningContext, and
  EngineeringHandoffPackage.

### Risks / TODO

- The canonical module is intentionally read-only and does not replace existing
  mutation owners or UI-specific helpers.
- `planning` is treated as the default lifecycle state; only actionable
  lifecycle states (`blocked`, `handoff_ready`) outrank active blockers and
  computed readiness so normal planning projects can still surface blockers and
  readiness.
- Future DomainIndex work should reuse canonical status helpers rather than
  duplicating status precedence logic.

### Next Recommended Step

- Phase 1C: DomainIndex / EntityResolver.

## Phase 1C / DomainIndex / EntityResolver

Date: 2026-05-23 Australia/Sydney

### Completed

- Added `src/domain/domainIndex.ts` as a read-only lookup and resolver layer.
- Added `buildDomainIndex(state)` with by-id lookups for Universe, Thought,
  Project, Relationship, AIInsight, BlockingQuestion, and DecisionRecord.
- Added `resolveNode(id)` and `inferNodeTypeById(id)` for shared deterministic
  entity resolution.
- Fixed missing id behavior as `undefined`.
- Fixed ambiguous id priority as:
  `thought > project > universe > relationship > aiInsight > blockingQuestion >
  decisionRecord`.
- Kept duplicate ids within one collection deterministic by preserving the first
  source-order entity.
- Added tests for lookup coverage, resolution, missing ids, ambiguity,
  relationship lookup, orphan non-repair, direct-ref drift non-repair,
  non-mutation, and mutation-method absence.

### DomainIndex API

- `buildDomainIndex(state)`
- `universeById`
- `thoughtById`
- `projectById`
- `relationshipById`
- `aiInsightById`
- `blockingQuestionById`
- `decisionRecordById`
- `resolveNode(id)`
- `inferNodeTypeById(id)`

### Node Resolution Behavior

- Supported node types: `thought`, `project`, `universe`, `relationship`,
  `aiInsight`, `blockingQuestion`, and `decisionRecord`.
- Missing ids return `undefined`.
- Ambiguous ids resolve by the fixed priority listed above.
- Orphan relationships are indexed as relationships but are not repaired,
  removed, or typed.
- Direct-reference drift, such as a thought pointing at a missing universe, is
  preserved and surfaced through lookup rather than repaired.

### Files Changed

- `docs/architecture/domain-hardening-progress.md`
- `src/domain/domainIndex.ts`
- `src/domain/domainIndex.test.ts`

### Tests

- `npm test -- src/domain/domainIndex.test.ts`
  - Passed: 1 file, 10 tests.
- `npm run typecheck`
  - Passed: `tsc -b --noEmit`.

### Not Yet Handled

- Phase 2A: RelationshipContext.
- ThoughtProgressionReport, ProjectReadinessReport, ReviewItem derived queue,
  Command Layer, AIPlanningContext, EngineeringHandoffPackage, and backend
  command contract.

### Risks / TODO

- DomainIndex intentionally does not replace mutation owners, app-state
  normalization, or relationship endpoint repair.
- DomainIndex returns read-only shallow entity snapshots; future consumers that
  need deep immutable snapshots should add a source-backed requirement and tests.
- RelationshipContext should build on DomainIndex rather than reintroducing
  ad hoc lookup behavior.

### Next Recommended Step

- Phase 2A: RelationshipContext.

## Phase 2A / RelationshipContext

Date: 2026-05-23 Australia/Sydney

### Completed

- Added `src/domain/relationshipContext.ts` as a read-only relationship context
  layer for Thought and Project targets.
- Built all lookups through `buildDomainIndex(state)`.
- Kept relationship categories separate:
  - graph relationships from `relationships[]`
  - direct membership refs from `Thought.projectId`, `Thought.universeId`,
    `Project.linkedThoughtIds`, and `Project.universeId`
  - provenance refs from `Project.sourceThoughtId`
- Added deterministic invalid/missing target behavior.
- Added finding/warning output with stable codes, severity, target, reason, and
  evidence ids.
- Added tests for direct universe refs, direct project membership, provenance,
  graph/direct side-by-side behavior, universe graph drift, orphan endpoints,
  invalid direct refs, membership mismatch, graph/direct drift,
  sourceThoughtId separation, blockers/dependencies, missing target behavior,
  and non-mutation.

### RelationshipContext API

- `buildRelationshipContext(state, targetId)`
- `buildThoughtRelationshipContext(state, thoughtId)`
- `buildProjectRelationshipContext(state, projectId)`

### Relationship Categories

- Graph relationships are reported from `relationships[]` and retain endpoint
  direction, endpoint status, and orphan endpoint state.
- Direct membership refs are reported separately and are not inferred from graph
  edges.
- Provenance refs are reported separately; `Project.sourceThoughtId` is not
  treated as a substitute for `Project.linkedThoughtIds`.

### Finding Codes

- `target_missing`
- `target_unsupported`
- `orphan_relationship_endpoint`
- `invalid_thought_project_id`
- `invalid_thought_universe_id`
- `invalid_project_universe_id`
- `invalid_project_source_thought_id`
- `invalid_project_linked_thought_id`
- `thought_project_missing_reverse_link`
- `project_linked_thought_missing_forward_link`
- `project_linked_thought_mismatched_forward_link`
- `graph_project_membership_without_direct_membership`
- `direct_project_membership_without_graph_edge`
- `graph_universe_membership_without_direct_ref`
- `source_thought_not_linked_thought`

### Files Changed

- `docs/architecture/domain-hardening-progress.md`
- `src/domain/relationshipContext.ts`
- `src/domain/relationshipContext.test.ts`

### Tests

- `npm test -- src/domain/relationshipContext.test.ts`
  - Passed: 1 file, 15 tests.
- `npm run typecheck`
  - Passed: `tsc -b --noEmit`.

### Not Yet Handled

- Phase 2B: ThoughtProgressionReport.
- ProjectReadinessReport, ReviewItem derived queue, Command Layer,
  AIPlanningContext, EngineeringHandoffPackage, and backend command contract.

### Risks / TODO

- RelationshipContext intentionally reports drift but does not repair, normalize,
  or merge graph/direct/provenance references.
- Endpoint resolution is constrained to relationship graph node types and uses
  DomainIndex snapshots for deterministic lookups.
- Future reports should consume RelationshipContext findings instead of
  reimplementing relationship drift detection.

### Next Recommended Step

- Phase 2B: ThoughtProgressionReport.

## Phase 2B / ThoughtProgressionReport

Date: 2026-05-23 Australia/Sydney

### Completed

- Added `src/domain/thoughtProgressionReport.ts` as a deterministic, read-only
  report layer for Thought progression.
- Added `buildThoughtProgressionReport(state, thoughtId)` for single-target
  reporting and `buildThoughtProgressionReports(state)` for deterministic batch
  reporting.
- Used `buildDomainIndex(state)` for entity lookup.
- Used `buildThoughtRelationshipContext(state, thoughtId)` to reuse
  RelationshipContext graph/direct/provenance drift detection rather than
  reimplementing relationship warnings.
- Reported progression from capture/inbox/classify/universe/context/actionable
  to project candidate and promote/link project stages.
- Added suggested command draft metadata only; no command execution, mutation
  owner calls, Command Layer, or persisted schema changes.
- Added tests for missing targets, inbox/active thought state, missing
  classification, missing/invalid universe refs, missing context fields,
  semantic role inference, blockers/dependencies, relationship warnings,
  graph/direct universe distinction, promotion/link candidates, stable command
  drafts, batch ordering, and non-mutation.

### ThoughtProgressionReport API

- `buildThoughtProgressionReport(state, thoughtId)`
- `buildThoughtProgressionReports(state)`

### Progression Stages

- `capture`
- `inbox`
- `classify`
- `universe`
- `context`
- `actionable`
- `project_candidate`
- `promote_link_project`

### Finding Codes

- `target_missing`
- `thought_inbox`
- `thought_active`
- `classification_missing`
- `universe_missing`
- `universe_invalid`
- `context_missing_why`
- `context_missing_outcome`
- `context_missing_next_action`
- `semantic_role_task`
- `semantic_role_goal`
- `semantic_role_question`
- `semantic_role_project_seed`
- `semantic_role_note`
- `semantic_role_reference`
- `semantic_role_unknown`
- `active_blocker`
- `active_dependency`
- `relationship_warning`
- `promotion_candidate`
- `promotion_blocked`
- `link_project_candidate`
- `needs_human_review`

### Suggested Command Drafts

- Suggested commands are metadata only and always set
  `requiresHumanConfirmation: true`.
- Stable ids use `thought-progress:<thoughtId>:<commandType>`.
- Supported draft command types:
  - `classify_thought`
  - `assign_universe`
  - `add_thought_context`
  - `add_next_action`
  - `link_thought_to_project`
  - `promote_thought_to_project`
  - `review_relationship_blockers`

### Files Changed

- `docs/architecture/domain-hardening-progress.md`
- `src/domain/thoughtProgressionReport.ts`
- `src/domain/thoughtProgressionReport.test.ts`

### Tests

- `npm test -- src/domain/thoughtProgressionReport.test.ts`
  - Passed: 1 file, 15 tests.
- `npm run typecheck`
  - Passed: `tsc -b --noEmit`.

### Not Yet Handled

- Phase 2C: ProjectReadinessReport.
- ReviewItem derived queue, Command Layer, AIPlanningContext,
  EngineeringHandoffPackage, and backend command contract.

### Risks / TODO

- The report intentionally suggests command drafts but never imports or calls
  mutation owners.
- Promotion/link rules are conservative and deterministic; future Command Layer
  work should reuse these findings but still enforce mutation-time validation.
- Relationship warnings are carried from RelationshipContext as report findings,
  so future relationship-drift changes should be made in RelationshipContext
  first.

### Next Recommended Step

- Phase 2C: ProjectReadinessReport.

## Phase 2C / ProjectReadinessReport

Date: 2026-05-23 Australia/Sydney

### Completed

- Added `src/domain/projectReadinessReport.ts` as a deterministic, read-only
  report layer for Project readiness and handoff preflight.
- Added `buildProjectReadinessReport(state, projectId)` for single-target
  reporting and `buildProjectReadinessReports(state)` for deterministic batch
  reporting.
- Used `buildDomainIndex(state)` for target lookup.
- Used `buildProjectRelationshipContext(state, projectId)` to reuse
  RelationshipContext direct-ref and relationship health warnings.
- Used/aligned with canonical status semantics through readiness drift and
  effective project stage helpers.
- Added handoff preflight output that separates content maturity, blockers,
  questions, decisions, AI drafts, direct refs, relationship health, and
  lifecycle state.
- Added suggested command draft metadata only; no command execution, mutation
  owner calls, Command Layer, schema migration, or AppState shape changes.
- Added tests for missing targets, stored/computed readiness, readiness drift,
  missing stored readiness, lifecycle handoff separation, stale handoff,
  blockers, blocking questions, proposed decisions, pending AI drafts,
  relationship warnings, invalid direct refs, draft-vs-handoff separation,
  handoff preflight pass/block behavior, stable command drafts, batch ordering,
  and non-mutation.

### ProjectReadinessReport API

- `buildProjectReadinessReport(state, projectId)`
- `buildProjectReadinessReports(state)`

### Handoff Preflight Design

- Preflight is read-only and never calls `markProjectHandoffReady` or other
  mutation owners.
- Preflight reports whether the project exists, is archived, has computed
  readiness at `ready_for_engineering`, has active blockers, has open or
  in-review blocking questions, has proposed decisions, has pending AI drafts,
  has stale handoff lifecycle state, has invalid direct refs, or has
  relationship warnings.
- Preflight can pass while still requiring a human-confirmed command before
  lifecycle state changes.

### Draft vs Handoff Rules

- `canGenerateEngineeringDraft` can be true for active projects whose computed
  readiness is `draftable` or `ready_for_engineering`.
- `canMarkHandoffReady` is stricter and requires computed
  `ready_for_engineering`, no active blockers, no unresolved blocking questions,
  no proposed decisions, no pending AI drafts, no invalid direct refs, no
  blocking relationship health findings, and human confirmation.
- `Project.readiness = "ready_for_engineering"` does not mutate or imply
  `Project.lifecycleStatus = "handoff_ready"`.
- Existing `lifecycleStatus = "handoff_ready"` is reflected as lifecycle state;
  if current preflight is blocked, the report emits stale handoff/lifecycle drift
  findings.

### Finding Codes

- `target_missing`
- `project_archived`
- `stored_readiness_missing`
- `computed_readiness_ready_for_engineering`
- `readiness_drift`
- `lifecycle_handoff_ready`
- `lifecycle_drift`
- `stale_handoff`
- `active_blocker`
- `pending_ai_draft`
- `proposed_decision`
- `open_blocking_question`
- `in_review_blocking_question`
- `direct_ref_warning`
- `relationship_warning`
- `handoff_preflight_passed`
- `handoff_preflight_blocked`
- `engineering_draft_candidate`
- `handoff_candidate`
- `needs_human_review`

### Suggested Command Drafts

- Suggested commands are metadata only and always set
  `requiresHumanConfirmation: true`.
- Stable ids use `project-readiness:<projectId>:<commandType>`.
- Supported draft command types:
  - `recompute_update_stored_readiness`
  - `resolve_blocker`
  - `answer_review_blocking_question`
  - `confirm_reject_proposed_decision`
  - `review_ai_draft`
  - `repair_direct_ref`
  - `review_relationship_drift`
  - `generate_engineering_draft`
  - `mark_project_handoff_ready`

### Files Changed

- `docs/architecture/domain-hardening-progress.md`
- `src/domain/projectReadinessReport.ts`
- `src/domain/projectReadinessReport.test.ts`

### Tests

- `npm test -- src/domain/projectReadinessReport.test.ts`
  - Passed: 1 file, 17 tests.
- `npm run typecheck`
  - Passed: `tsc -b --noEmit`.

### Not Yet Handled

- Phase 2D: Derived Review Queue + AppHealthReport.
- Command Layer, AIPlanningContext, EngineeringHandoffPackage, and backend
  command/snapshot contract.

### Risks / TODO

- Handoff command drafts are intentionally advisory; later mutation-time command
  validation must still call guarded handoff logic.
- Relationship health blocking currently treats RelationshipContext `error`
  findings and invalid direct refs as hard preflight blockers; non-error
  relationship warnings are still surfaced for review.
- The report is deterministic and read-only, but future UI consumers still need
  to decide which findings become visible review items.

### Next Recommended Step

- Phase 2D: Derived Review Queue + AppHealthReport.

## Phase 2D / Derived Review Queue + AppHealthReport

Date: 2026-05-23 Australia/Sydney

### Completed

- Added `src/domain/appHealthReport.ts` as a deterministic, read-only state
  health report layer.
- Added `buildAppHealthReport(state)` to surface import/invariant warnings,
  relationship/direct-ref drift, invalid AI patch targets, readiness drift,
  stale handoff, duplicate ids, and orphan relationship endpoints.
- Reused existing `validateAppStateInvariants(state)` and Phase 2A/2C reports
  instead of adding a repair, normalization-save, or mutation path.
- Added `src/domain/derivedReviewQueue.ts` with
  `buildDerivedReviewQueue(state)`.
- Derived review items from `ThoughtProgressionReport`,
  `ProjectReadinessReport`, `AppHealthReport`, AI draft insights, open/in-review
  blocking questions, and proposed decision records.
- Kept `ReviewItem` derived only. No persisted review item collection was added.
- Added suggested command draft metadata only. Every draft sets
  `requiresHumanConfirmation: true` and no draft is executable from this layer.
- Added tests for health findings, deterministic review queue generation,
  stable ids, command metadata, invalid AI patch target visibility, and
  non-mutation.

### AppHealthReport API

- `buildAppHealthReport(state)`

### AppHealthReport Finding Codes

- `duplicate_id`
- `orphan_relationship`
- `ambiguous_relationship_endpoint`
- `direct_ref_drift`
- `invalid_ai_patch_target`
- `readiness_drift`
- `stale_handoff`
- `invalid_universe_ref`
- `invalid_project_ref`
- `invalid_linked_thought_id`
- `invalid_source_thought_id`
- `invalid_relationship_endpoint`
- `invariant_warning`

### Derived Review Queue API

- `buildDerivedReviewQueue(state)`

### ReviewItem Generation Sources

- `ThoughtProgressionReport` actionable findings and command candidates.
- `ProjectReadinessReport` handoff/readiness/preflight findings and command
  candidates.
- `AppHealthReport` warning/error findings.
- Draft `AIInsight` records.
- Open or in-review `BlockingQuestion` records.
- Proposed `DecisionRecord` records.

### Suggested Command Drafts

- Suggested commands are metadata only and always set
  `requiresHumanConfirmation: true`.
- State-changing ideas remain draft metadata until a future command layer and
  mutation owner validates and applies them.
- Command draft families include:
  - thought classification/context/project-linking drafts from
    ThoughtProgressionReport
  - project readiness/handoff drafts from ProjectReadinessReport
  - app health repair/review drafts for invariant and relationship findings
  - AI draft review drafts
  - blocking question answer/review drafts
  - proposed decision confirm/reject drafts

### Files Changed

- `docs/architecture/domain-hardening-progress.md`
- `src/domain/appHealthReport.ts`
- `src/domain/appHealthReport.test.ts`
- `src/domain/derivedReviewQueue.ts`
- `src/domain/derivedReviewQueue.test.ts`

### Tests

- `npm test -- src/domain/appHealthReport.test.ts src/domain/derivedReviewQueue.test.ts`
  - Passed: 2 files, 12 tests.
- `npm run typecheck`
  - Passed: `tsc -b --noEmit`.

### Not Yet Handled

- Phase 3A: Command Layer.
- AIPlanningContext, EngineeringHandoffPackage, and backend command/snapshot
  contract.
- UI consumption of the derived queue and health report.

### Risks / TODO

- AppHealthReport intentionally deduplicates by finding code and target. If a UI
  needs every raw invariant source, it should read `invariantWarnings` from the
  report.
- Derived review items are actionable metadata only; future command execution
  must still validate with mutation owners.
- RelationshipContext and AppHealthReport can describe related issues at
  different layers, so UI grouping may still need product-specific presentation
  rules.

### Next Recommended Step

- Phase 3A: Command Layer.

## Phase 3A / Command Layer

Date: 2026-05-23 Australia/Sydney

### Completed

- Added `src/domain/commandLayer.ts` as the unified domain command entrypoint.
- Added `executeDomainCommand(state, command, ctx)` with deterministic
  `CommandResult` success/failure shapes.
- Required explicit `confirmedByUser: true` before any state-changing command
  can call mutation owners.
- Blocked unconfirmed AI commands and suggested command draft metadata from
  mutating state.
- Routed supported commands through existing mutation owners where available:
  `updateThought`, `linkThoughtToProject`, `promoteThoughtToProject`,
  `updateProjectDetails`, `setAiInsightStatus`, `markProjectHandoffReady`, and
  `createTypedRelationship`.
- Added minimal graph-only relationship update/delete support inside the command
  layer because no dedicated relationship update/delete owner exists yet.
- Normalized successful command states through `normalizeAppState(state)` and
  attached `validateAppStateInvariants(state)` warnings instead of silently
  ignoring post-command health information.
- Added tests for confirmation guards, invalid targets/payloads, atomic failure,
  generic handoff-ready protection, guarded handoff preflight, graph/direct ref
  separation, suggested command metadata rejection, invalid AI patch targets,
  and deterministic result shapes.

### Command Layer API

- `executeDomainCommand(state, command, ctx)`
- `DomainCommand`
- `CommandResult`
- `DomainCommandErrorCode`
- `supportedDomainCommandTypes`

### Supported Command Types

- `thought.classify`
- `thought.assignUniverse`
- `thought.linkProject`
- `project.promoteFromThought`
- `project.updateReadiness`
- `aiInsight.review`
- `project.markHandoffReady`
- `relationship.create`
- `relationship.update`
- `relationship.delete`

### Guard Rules

- `source: "ai"` commands must be explicitly user confirmed.
- Suggested command drafts remain metadata and cannot be executed directly.
- Invalid AI patch targets fail before insight status changes.
- Generic project update commands cannot set
  `Project.lifecycleStatus = "handoff_ready"`.
- `project.markHandoffReady` must use the guarded handoff owner.
- Relationship commands can only mutate `relationships[]` graph edges.
- Direct membership commands cannot create or update graph edges.
- Failures always return the original state object.

### Error Codes

- `ai_command_requires_user_confirmation`
- `invalid_command_type`
- `invalid_target`
- `invalid_payload`
- `forbidden_generic_handoff_ready`
- `handoff_preflight_failed`
- `relationship_command_cannot_update_direct_refs`
- `direct_membership_command_cannot_update_graph`
- `mutation_failed`

### Mutation Ownership / Atomicity

- Command Layer validates command envelope, target, payload, and cross-boundary
  guard rules before calling mutation owners.
- Existing mutation owners remain responsible for canonical state changes.
- Failed validation or failed mutation owner results return the original state.
- Successful results are normalized and include invariant warnings for callers
  to surface or review.

### Files Changed

- `docs/architecture/domain-hardening-progress.md`
- `src/domain/commandLayer.ts`
- `src/domain/commandLayer.test.ts`

### Tests

- `npm test -- src/domain/commandLayer.test.ts`
  - Passed: 1 file, 14 tests.
- `npm run typecheck`
  - Passed: `tsc -b --noEmit`.

### Not Yet Handled

- Phase 3B: AIPlanningContext.
- EngineeringHandoffPackage and backend command/snapshot contract.
- UI wiring to execute `DomainCommand` from confirmed review items.
- Dedicated relationship update/delete mutation owner extraction.

### Risks / TODO

- Relationship update/delete are intentionally minimal graph-only commands until
  a dedicated relationship mutation owner exists.
- Successful commands currently return invariant warnings rather than failing on
  warnings, because imported or legacy state can already contain reviewable
  warnings.
- Command Layer does not provide dry-run, event sourcing, backend persistence,
  or AI planning context yet.

### Next Recommended Step

- Phase 3B: AIPlanningContext.

## Phase 3B / AIPlanningContext

Date: 2026-05-23 Australia/Sydney

### Completed

- Added `src/domain/aiPlanningContext.ts` as a deterministic, read-only
  planning context builder for AI draft generation.
- Added `buildAIPlanningContext(state, scope, limits)` with scoped app,
  thought, project, and universe views.
- Included relevant ThoughtProgressionReport, ProjectReadinessReport,
  RelationshipContext, DerivedReviewQueue, AppHealthReport, canonical status
  semantics, allowed command schema, safety rules, and explicit AI limitations.
- Added deterministic bounds and truncation flags for report, relationship,
  review, health, and canonical semantics collections.
- Added a small command schema export in `src/domain/commandLayer.ts` so
  AIPlanningContext references Phase 3A supported command types instead of
  maintaining a separate drifting schema.
- Added tests for app/thought/project/universe scopes, invalid target behavior,
  supported command schema coverage, safety rules, truncation, deterministic
  ordering, and non-mutation.

### AIPlanningContext API

- `buildAIPlanningContext(state, scope, limits?)`
- `AIPlanningScope`
- `defaultAIPlanningContextLimits`
- `aiPlanningSafetyRules`
- `aiPlanningLimitations`

### Scope Behavior

- `app` scope includes app health, derived review queue, bounded thought/project
  report summaries, relationship contexts, canonical semantics, and command
  schema.
- `thought` scope includes the target ThoughtProgressionReport, target
  RelationshipContext, related ProjectReadinessReports from direct or graph
  project links, and relevant review/health findings.
- `project` scope includes the target ProjectReadinessReport, target
  RelationshipContext, linked/source ThoughtProgressionReports, and relevant
  review/health findings.
- `universe` scope includes thoughts and projects with direct `universeId`
  membership, their bounded report summaries, relationship contexts, and
  relevant review/health findings.
- Missing thought/project targets return deterministic invalid contexts with
  invalid reports or missing relationship context instead of throwing.

### Included Reports

- `ThoughtProgressionReport`
- `ProjectReadinessReport`
- `RelationshipContext`
- `DerivedReviewItem[]` from `buildDerivedReviewQueue(state)`
- `AppHealthReport` summary and bounded findings
- canonical status semantics from `listCanonicalStatusSemantics()`

### Allowed Command Schema

- Added `getAllowedDomainCommandSchema()` to `src/domain/commandLayer.ts`.
- The schema covers every Phase 3A supported command type and includes target
  type, payload requirements, `requiresUserConfirmation: true`, and safety
  notes.
- AIPlanningContext exposes the schema as planning metadata only. It does not
  create, validate, or execute commands.

### Safety Rules

- AI planning output is draft only.
- AIPlanningContext cannot mutate AppState.
- AI cannot call mutation owners directly.
- AI cannot bypass `executeDomainCommand`.
- AI commands require human confirmation.
- Suggested command draft metadata is not executable by itself.
- `handoff_ready` cannot be set by generic update.
- Relationship commands do not modify direct refs.
- Direct membership commands do not modify graph edges.
- Failures must be atomic in Command Layer.

### Files Changed

- `docs/architecture/domain-hardening-progress.md`
- `src/domain/aiPlanningContext.ts`
- `src/domain/aiPlanningContext.test.ts`
- `src/domain/commandLayer.ts`

### Tests

- `npm test -- src/domain/aiPlanningContext.test.ts`
  - Passed: 1 file, 7 tests.

### Not Yet Handled

- Phase 3C: EngineeringHandoffPackage.
- Backend command/snapshot contract.
- UI wiring from confirmed review items into `executeDomainCommand`.
- Dedicated relationship update/delete mutation owner extraction.

### Risks / TODO

- App and universe scopes intentionally expose bounded report collections; UIs
  that need full detail should request narrower thought/project scopes.
- AIPlanningContext surfaces allowed command schema but does not provide dry-run,
  persistence, or execution.
- Review items may include repair-oriented draft command families that are not
  yet Phase 3A executable command types; callers must check the allowed command
  schema before proposing executable DomainCommand payloads.

### Next Recommended Step

- Phase 3C: EngineeringHandoffPackage.

## Phase 3C / EngineeringHandoffPackage

Date: 2026-05-23 Australia/Sydney

### Completed

- Added `src/domain/engineeringHandoffPackage.ts` as a deterministic,
  read-only engineering handoff package builder.
- Added `buildEngineeringHandoffPackage(state, projectId, options?)`.
- Reused `buildProjectReadinessReport(state, projectId)`,
  `buildAIPlanningContext(state, { type: "project", id: projectId })`, and
  `buildDomainIndex(state)` for source-backed context.
- Returned deterministic invalid packages for missing projects instead of
  throwing.
- Kept `generatedAt` deterministic: default is `null`; callers can pass
  `options.generatedAt`.
- Added metadata-only suggested command drafts with
  `requiresHumanConfirmation: true`.
- Added tests for invalid targets, valid package sections, readiness/lifecycle
  separation, deterministic timestamps, required software modules, constraints,
  backend design scope, Codex tasks, acceptance tests, suggested command
  metadata, and non-mutation.

### EngineeringHandoffPackage API

- `buildEngineeringHandoffPackage(state, projectId, options?)`
- `EngineeringHandoffPackage`
- `EngineeringFlowInput`
- `RequiredSoftwarePlan`
- `ProjectEvolutionPlan`
- `ConstraintCodex`
- `BackendDesignPlan`
- `CodexTaskPlan`
- `AcceptanceTestPlan`

### Package Sections

- `readinessReport`
- `engineeringFlowInput`
- `requiredSoftwarePlan`
- `projectEvolutionPlan`
- `constraintCodex`
- `backendDesignPlan`
- `codexTaskPlan`
- `acceptanceTestPlan`
- `safetyNotes`
- `blockers`
- `suggestedCommands`

### RequiredSoftwarePlan Design

- Produces deterministic software/module planning from project fields and
  read-only reports.
- Includes frontend UI, domain command, persistence/snapshot,
  validation/reporting, engineering flow generator, project evolution planner,
  constraint limiter/codex, and backend design adapter modules.
- Each module includes responsibility, dependencies, state ownership notes,
  command/API touchpoints, UI touchpoints, testing responsibilities, risk level,
  and uncertainty.
- Does not call external AI.

### BackendDesignPlan Scope

- Design-only in Phase 3C.
- Includes future endpoint candidates:
  - `POST /commands`
  - `GET /state`
  - `PUT /state/import`
  - `GET /projects/:id/handoff`
- Explicitly excludes login, auth, multi-user, permissions, complex sync
  conflict, realtime collaboration, and database normalization migration.
- Leaves backend command/snapshot contract to Phase 3D.

### CodexTaskPlan Design

- Splits future work into stable, reviewable tasks:
  - read-only handoff preview
  - confirmed command import path
  - relationship health surfacing
  - backend command/snapshot contract
  - handoff acceptance suite
- Each task includes stable id, title, objective, likely touched areas,
  dependencies, acceptance criteria, guardrails, and whether human confirmation
  is required.

### Safety Rules

- `ready_for_engineering` does not imply `handoff_ready`.
- AI suggestions are drafts only.
- Commands require validation and human confirmation.
- Relationship graph does not replace direct refs.
- EngineeringHandoffPackage is read-only and deterministic.
- The package does not call `markProjectHandoffReady`, execute commands, repair
  refs, or mutate AppState.

### Files Changed

- `docs/architecture/domain-hardening-progress.md`
- `src/domain/engineeringHandoffPackage.ts`
- `src/domain/engineeringHandoffPackage.test.ts`

### Tests

- `npm test -- src/domain/engineeringHandoffPackage.test.ts`
  - Passed: 1 file, 10 tests.
- `npm test -- src/domain/engineeringHandoffPackage.test.ts src/domain/projectReadinessReport.test.ts src/domain/aiPlanningContext.test.ts`
  - Passed: 3 files, 34 tests.
- `npm run typecheck`
  - Passed: `tsc -b --noEmit`.

### Not Yet Handled

- Phase 3D: Backend Command/Snapshot Contract.
- UI wiring for handoff package preview.
- UI wiring from confirmed review items into `executeDomainCommand`.
- Dedicated relationship update/delete mutation owner extraction.

### Risks / TODO

- RequiredSoftwarePlan and ProjectEvolutionPlan are deterministic heuristics from
  local project context; they are not external AI planning output.
- Existing `buildProjectHandoffPackage` still uses a timestamp and throws on
  missing project; Phase 3C intentionally added a separate deterministic package
  builder instead of changing existing UI/export behavior.
- Backend endpoint candidates are design metadata only until Phase 3D defines a
  command/snapshot contract.

### Next Recommended Step

- Phase 3D: Backend Command/Snapshot Contract.

## Phase 3D / Backend Command/Snapshot Contract

Date: 2026-05-23 Australia/Sydney

### Completed

- Added `src/domain/backendContract.ts` as a design-only future backend
  command/snapshot contract.
- Added contract metadata for:
  - `POST /commands`
  - `GET /state`
  - `PUT /state/import`
  - `GET /projects/:id/handoff`
- Added minimal request/response/error transport types for command requests,
  state snapshots, state import dry-runs, and handoff package responses.
- Added `getBackendContract()` for deterministic endpoint metadata.
- Added `validateBackendCommandRequest(request)` for transport-level command
  request shape checks.
- Added `validateStateImportRequest(request)` for transport-level snapshot
  import candidate shape checks.
- Added tests for endpoint ordering, Command Layer boundaries, request
  validation, AI confirmation notes, import flow, handoff read-only behavior,
  excluded backend features, and non-mutation.

### Backend Contract API

- `getBackendContract()`
- `validateBackendCommandRequest(request)`
- `validateStateImportRequest(request)`
- `BackendEndpointId`
- `BackendCommandRequest`
- `BackendCommandResponse`
- `BackendStateSnapshotResponse`
- `BackendStateImportRequest`
- `BackendStateImportDryRunResponse`
- `BackendHandoffPackageResponse`
- `BackendContractError`

### Endpoint Contract Summary

- `POST /commands`
  - Receives a `DomainCommand`.
  - Is a transport wrapper only.
  - Must call `executeDomainCommand(state, command, ctx)`.
  - Must not call mutation owners directly.
  - Returns a `CommandResult`.
- `GET /state`
  - Returns the current local-first `AppState` snapshot.
  - May include app health summary/findings.
  - Does not mutate, repair, or normalize-save state.
- `PUT /state/import`
  - Receives an import candidate snapshot.
  - Follows `Validate -> Dry Run -> Apply`.
  - Does not directly overwrite state.
  - Requires visible warnings and user confirmation before any future apply.
- `GET /projects/:id/handoff`
  - Returns an `EngineeringHandoffPackage`.
  - Does not mark `handoff_ready`.
  - Does not execute commands or mutate state.
  - Missing projects must remain deterministic invalid package responses.

### Local-First Strategy

- Local-first `AppState` remains the source of truth for this phase.
- Backend channel is only a future transport boundary.
- Command execution must still pass through Command Layer.
- Snapshot import must still follow `Validate -> Dry Run -> Apply`.

### Import Strategy

- `Validate`: check transport shape and required snapshot fields.
- `Dry Run`: future import preview should surface warnings before apply.
- `Apply`: out of scope for this helper and must require explicit user
  confirmation.

### Excluded Backend Features

- login
- auth
- multi-user
- permissions
- complex sync conflict
- realtime collaboration
- database normalization migration
- remote persistence implementation
- actual HTTP routing/server
- automatic AI command execution

### Safety Rules

- Backend command endpoint is a transport wrapper only.
- Command Layer remains the mutation gate.
- AI drafts and suggested command metadata cannot automatically mutate state.
- Validation helpers do not execute commands.
- Validation helpers do not import state.
- Validation helpers do not normalize-save.
- Handoff endpoint does not set `handoff_ready`.

### Files Changed

- `docs/architecture/domain-hardening-progress.md`
- `src/domain/backendContract.ts`
- `src/domain/backendContract.test.ts`

### Tests

- `npm test -- src/domain/backendContract.test.ts`
  - Passed: 1 file, 10 tests.
- `npm run typecheck`
  - Passed: `tsc -b --noEmit`.

### Not Yet Handled

- Actual HTTP routing/server.
- Remote persistence implementation.
- Apply-state import UI or backend endpoint.
- Auth, permissions, multi-user, realtime collaboration, and sync conflict
  handling.

### Risks / TODO

- `validateStateImportRequest` intentionally checks transport shape and required
  snapshot fields only; deeper invariant validation remains with existing app
  health/import validation flows.
- The contract does not provide dry-run execution for commands. Command dry-run
  semantics would need a separate source-backed design.
- Endpoint metadata is not wired to UI or network code.

### Next Recommended Step

- Phase 3E or UI integration: surface read-only handoff/backend contract
  metadata and keep confirmed command import behind Command Layer validation.

## Phase 3E / Read-only Architecture Visibility + Confirmed Command Entry UI Integration

Date: 2026-05-23 Australia/Sydney

### Completed

- Added a read-only architecture/status panel to the existing Deployment Status
  screen.
- Surfaced AppHealthReport summary, top health finding codes, and bounded
  finding targets.
- Surfaced Derived Review Queue summary with item severity, target, reason, and
  `requiresHumanConfirmation`.
- Surfaced design-only Backend Contract endpoint metadata and excluded backend
  features.
- Surfaced EngineeringHandoffPackage summary for the selected/current project
  without changing lifecycle state.
- Surfaced AIPlanningContext safety rules and command limitations.
- Routed existing AI draft review UI in Review Queue and AI Planning Panel
  through `executeDomainCommand`.
- Routed existing handoff-ready action through `executeDomainCommand`.
- Added targeted render and non-mutation tests for the read-only architecture
  panel.

### UI Integration Point

- Existing screen: `DeploymentStatus`.
- Added component: `ArchitectureStatusPanel`.
- The panel is read-only and builds deterministic domain report summaries from
  the current local AppState.

### Read-only Reports / Contract Metadata Visible

- AppHealthReport:
  - findings count by severity
  - top finding codes
  - top finding targets
- Derived Review Queue:
  - item count
  - severity
  - target
  - reason
  - `requiresHumanConfirmation`
- Backend Contract:
  - `POST /commands`
  - `GET /state`
  - `PUT /state/import`
  - `GET /projects/:id/handoff`
  - local-first source-of-truth note
  - excluded features
- EngineeringHandoffPackage:
  - valid/invalid
  - readiness and lifecycle summary
  - RequiredSoftwarePlan module count
  - CodexTaskPlan task count
  - AcceptanceTestPlan section count
  - blockers count
  - suggested command confirmation visibility
- AIPlanningContext:
  - AI output is draft only
  - commands require human confirmation
  - suggested command metadata is not executable by itself

### Command Entry Guard Status

- `ReviewQueueCenter` and `AIPanel` AI draft review now call App's confirmed
  command entry helper, which calls:
  - `executeDomainCommand(state, command, ctx)`
- `EngineeringHandoffCenter` handoff-ready action now calls the same confirmed
  command entry helper with:
  - `project.markHandoffReady`
- CommandResult failures are shown through existing UI error/notice surfaces
  and the app system message, and do not save state.
- No full command editor or arbitrary command import UI was added in this
  phase.

### Handoff Package Visibility

- The selected/current project package summary is visible from Deployment
  Status.
- The package preview is read-only.
- It does not call `markProjectHandoffReady` directly.
- It does not execute commands.
- It does not mutate AppState.
- Suggested commands remain marked as requiring human confirmation.

### Backend Contract Visibility

- Backend metadata is visible as design-only endpoint cards.
- No fetch client was added.
- No HTTP routes were added.
- No remote persistence was added.
- No login, auth, multi-user, permissions, realtime collaboration, or complex
  sync conflict handling was added.

### Files Changed

- `docs/architecture/domain-hardening-progress.md`
- `src/App.tsx`
- `src/components/screens/ArchitectureStatusPanel.tsx`
- `src/components/screens/ArchitectureStatusPanel.test.tsx`
- `src/components/screens/DeploymentStatus.tsx`
- `src/components/screens/DeploymentStatus.test.tsx`

### Tests

- `npm test -- src/components/screens/ArchitectureStatusPanel.test.tsx src/components/screens/DeploymentStatus.test.tsx`
  - Passed: 2 files, 3 tests.
- `npm run typecheck`
  - Passed: `tsc -b --noEmit`.
- `npm test -- src/domain/commandLayer.test.ts src/components/screens/ArchitectureStatusPanel.test.tsx src/components/screens/DeploymentStatus.test.tsx`
  - Passed: 3 files, 17 tests.

### Not Yet Handled

- Full command editor / arbitrary command import UI.
- Command dry-run preview UI.
- Actual backend server, fetch client, remote persistence, auth, permissions,
  multi-user mode, realtime collaboration, or sync conflict policy.
- Rich drill-down navigation from architecture findings into each source panel.

### Risks / TODO

- The architecture panel intentionally shows bounded summaries; deeper report
  details still require domain-level tests or future drill-down UI.
- AppState import still uses existing local import flow; backend import apply
  remains out of scope.
- CommandResult error display currently uses the existing app-level system
  message rather than per-row inline error state.

### Next Recommended Step

- Add a small confirmed command dry-run/import panel, or add drill-down links
  from architecture findings to the relevant source screens.

## Phase 3F: Confirmed Command Import / Validation Preview Panel

### Completed

- Added a safe external command import path with three explicit stages:
  - Validate: parse JSON and check command envelope, command type, target shape,
    required payload fields, confirmation metadata, and known unsafe payload
    patterns.
  - Dry Run: simulate commands against a cloned AppState through
    `executeDomainCommand` and report per-command preview, affected entities,
    expected changes, warnings, and blocking errors.
  - Apply: require UI confirmation, execute through `executeDomainCommand`, and
    commit only after the whole batch succeeds.
- Added a Confirmed Command Import panel near the deployment architecture and
  health panels.
- Kept imported commands untrusted by default. The panel does not auto-execute
  pasted JSON.
- Kept failed batch apply atomic. A failure returns the original AppState and
  applies zero commands.

### Main Files

- `src/domain/commands/commandImport.ts`
- `src/domain/commands/commandDryRun.ts`
- `src/domain/commands/confirmedCommandImport.ts`
- `src/domain/commands/commandImport.test.ts`
- `src/components/screens/ConfirmedCommandImportPanel.tsx`
- `src/components/screens/DeploymentStatus.tsx`
- `src/App.tsx`
- `src/style.css`
- `docs/architecture/domain-hardening-progress.md`

### Safety Flow

- Imported commands are parsed as one of:
  - single command object
  - command array
  - wrapped `{ commands: [...] }` payload
- Validate rejects invalid JSON, unknown command types, missing required
  fields, unsafe generic `handoff_ready` updates, relationship commands that
  attempt direct ref changes, and direct membership commands that attempt graph
  edge changes.
- Dry Run uses a cloned AppState and never saves the simulated state.
- Apply stamps commands as confirmed only after the UI confirmation step and
  then delegates to `executeDomainCommand`.
- Existing command layer guardrails remain the authority for target existence,
  payload semantics, handoff preflight, relationship safety, and atomic command
  failure.

### Tests

- Domain helper tests cover:
  - invalid JSON validation errors
  - single command parsing
  - command array parsing
  - wrapped command parsing
  - unknown command type and missing field reporting
  - dry-run read-only behavior
  - dry-run failure reporting without original state mutation
  - apply confirmation requirement
  - confirmed batch atomicity
  - unsafe generic `handoff_ready` rejection
  - relationship direct ref rejection

### Known Limits

- The panel previews bounded command summaries rather than a full object diff.
- Validation does not replace state-aware command execution; target existence
  and deeper semantic checks still happen in dry-run/apply through the command
  layer.
- No backend server, auth, realtime sync, full command editor, handoff package
  product UI, or drill-down UI was added.

### Verification

- `npm run typecheck`
  - Passed: `tsc -b --noEmit`.
- `npm test -- src/domain/commands/commandImport.test.ts`
  - Passed: 1 file, 11 tests.
- `npm test -- src/domain/commands/commandImport.test.ts src/components/screens/DeploymentStatus.test.tsx src/components/screens/ArchitectureStatusPanel.test.tsx`
  - Passed: 3 files, 14 tests.

## Phase 3G: Review / Health / Command Drill-down UI

### Completed

- Added a read-only Review & Health Drill-down panel to the existing
  Architecture / Health / Handoff debug surface.
- The panel reads existing derived reports only:
  - `buildDerivedReviewQueue(state)`
  - `buildAppHealthReport(state)`
- Each derived review item can be expanded to inspect:
  - stable id
  - source and source code
  - target type/id/label when available
  - severity
  - reason
  - deterministic evidence entries
  - `requiresHumanConfirmation`
  - suggested command drafts
- Each AppHealth finding can be expanded to inspect:
  - finding code
  - severity
  - target type/id/label when available
  - reason
  - source and source code
  - evidence IDs
- Added lightweight review filtering:
  - all review items
  - warnings/errors
  - items with suggested commands
  - items requiring human confirmation
- Added lightweight grouping:
  - severity
  - target type
  - source

### Suggested Command Safety

- Suggested commands remain draft-only display metadata.
- The panel can copy one command draft JSON payload or all command drafts for
  one review item.
- Copy payloads use a draft schema marker:
  - `derived-command-draft/v0`
  - `derived-command-draft-bundle/v0`
- The panel does not execute commands.
- The panel does not add one-click apply.
- The panel does not persist suggested commands.
- The panel explicitly routes humans back to Phase 3F Confirmed Command Import:
  - Validate
  - Dry Run
  - Apply with confirmation

### Main Files

- `src/components/screens/ReviewHealthDrillDownPanel.tsx`
- `src/components/screens/ReviewHealthDrillDownPanel.test.tsx`
- `src/components/screens/ArchitectureStatusPanel.tsx`
- `src/components/screens/ArchitectureStatusPanel.test.tsx`
- `src/style.css`
- `docs/architecture/domain-hardening-progress.md`

### Tests

- UI tests cover:
  - stable review ids, severity, reason, target, and evidence rendering
  - expanded item evidence visibility
  - suggested command draft JSON rendering
  - draft-only safety copy
  - absence of direct execute/apply suggested-command controls
  - AppHealth issue details beyond summary counts
  - empty states for no review items and no health issues
  - command draft clipboard payload formatting
  - review-item filtering helper behavior

### Known Limits

- Copy to clipboard is intentionally best-effort. The visible JSON preview is
  the fallback if browser clipboard access is unavailable.
- The panel does not send copied drafts directly into the Confirmed Command
  Import textarea because there is no existing shared state for that path.
- The panel keeps review items expanded by default for auditability; deeper
  navigation into source screens can be added later without changing domain
  semantics.
- AppHealth issue coverage is limited to existing deterministic report output.
  No new health engine or domain semantics were added.

### Verification

- `npm run typecheck`
  - Passed: `tsc -b --noEmit`.
- `npm test -- src/components/screens/ReviewHealthDrillDownPanel.test.tsx src/components/screens/ArchitectureStatusPanel.test.tsx src/components/screens/DeploymentStatus.test.tsx`
  - Passed: 3 files, 10 tests.
- `npm test -- src/domain/commands/commandImport.test.ts src/components/screens/ReviewHealthDrillDownPanel.test.tsx src/components/screens/ArchitectureStatusPanel.test.tsx src/components/screens/DeploymentStatus.test.tsx`
  - Passed: 4 files, 21 tests.

## Phase 3H: EngineeringHandoffPackage Export UI

### Completed

- Added a product-facing EngineeringHandoffPackage export panel beside the
  Architecture / Health / Handoff debug surface.
- The panel provides:
  - project selector with project name and id
  - read-only package generation for the selected project
  - readiness summary for stored readiness, computed readiness,
    `canGenerateEngineeringDraft`, and `canMarkHandoffReady`
  - visible blockers, warnings, preflight status, lifecycle status, and draft
    completeness warnings
  - package section preview for EngineeringFlowInput, RequiredSoftwarePlan,
    ProjectEvolutionPlan, ConstraintCodex / Limiter, BackendDesignPlan,
    CodexTaskPlan, AcceptanceTestPlan, and Blockers / Warnings
  - Copy JSON, Download JSON, Copy Markdown, and Download Markdown controls
- Added a domain export helper that wraps the full
  `EngineeringHandoffPackage` with metadata and safety flags.
- Added deterministic Markdown export formatting for handoff review and
  downstream engineering planning.

### JSON Export Format

- JSON exports use schema `engineering-handoff-package-export/v0`.
- The wrapper includes:
  - `exportedAt`
  - `projectId`
  - full `package`
  - `safety.readOnlyExport`
  - `safety.doesNotMarkHandoffReady`
  - `safety.requiresConfirmedCommandForHandoffReady`

### Markdown Export Format

- Markdown exports include:
  - Safety
  - Readiness Summary
  - Blockers / Warnings
  - EngineeringFlowInput
  - RequiredSoftwarePlan
  - ProjectEvolutionPlan
  - ConstraintCodex / Limiter
  - BackendDesignPlan
  - CodexTaskPlan
  - AcceptanceTestPlan
- Array content follows package order or existing deterministic package order.

### Read-only Export Safety

- Export generation delegates to `buildEngineeringHandoffPackage` and does not
  mutate `AppState`.
- Exporting does not mark a project as `handoff_ready`.
- `ready_for_engineering` remains separate from `handoff_ready`.
- `canGenerateEngineeringDraft` and `canMarkHandoffReady` are displayed as
  separate readiness signals.
- Projects that are not formally handoff-ready show:
  - "Draft package may be incomplete."
  - "This project is not handoff_ready."
  - guidance to resolve blockers and use confirmed command flow before formal
    handoff.
- No Mark Handoff Ready, one-click handoff, direct command apply, backend
  server, auth, multi-user, realtime sync, or new domain semantics were added.

### Main Files

- `src/domain/engineeringHandoffExport.ts`
- `src/domain/engineeringHandoffExport.test.ts`
- `src/components/screens/HandoffPackageExportPanel.tsx`
- `src/components/screens/HandoffPackageExportPanel.test.tsx`
- `src/components/screens/ArchitectureStatusPanel.tsx`
- `src/components/screens/ArchitectureStatusPanel.test.tsx`
- `src/style.css`
- `docs/architecture/domain-hardening-progress.md`

### Tests

- Domain export tests cover:
  - JSON wrapper schema, timestamp, project id, full package, and safety flags
  - formatted JSON containing metadata and safety fields
  - Markdown section coverage for Safety, Readiness Summary,
    RequiredSoftwarePlan, BackendDesignPlan, CodexTaskPlan, and
    AcceptanceTestPlan
  - export generation does not mutate original AppState
- UI tests cover:
  - empty project state
  - project selector project listing
  - selected package preview sections
  - separate `canGenerateEngineeringDraft` and `canMarkHandoffReady` display
  - read-only / no `handoff_ready` safety copy
  - not-ready draft warning
  - JSON and Markdown controls
  - absence of direct Mark Handoff Ready / Apply Handoff actions
  - render does not mutate original AppState

### Known Limits

- Clipboard copy depends on browser clipboard support; visible export controls
  remain available even if clipboard permission is denied.
- Download behavior uses browser Blob download and is not exhaustively tested in
  static component tests.
- The panel previews bounded summaries for large package sections rather than
  rendering the entire JSON wrapper inline.
- Backend adapter / contract harness remains deferred to Phase 3I.

### Verification

- `npm run typecheck`
  - Passed: `tsc -b --noEmit`.
- `npm test -- src/domain/engineeringHandoffExport.test.ts src/components/screens/HandoffPackageExportPanel.test.tsx src/components/screens/ArchitectureStatusPanel.test.tsx src/components/screens/DeploymentStatus.test.tsx`
  - Passed: 4 files, 13 tests.

## Phase 3I: Backend Snapshot Adapter Stub / Contract Harness

### Completed

- Added a local in-memory backend snapshot adapter harness.
- The adapter is pure TypeScript/domain code:
  - no HTTP server
  - no routes
  - no database
  - no auth/login/permissions
  - no multi-user or realtime sync
  - no conflict resolution
- The adapter holds an internal in-memory `AppState` clone and exposes contract
  equivalents for:
  - `GET /state`
  - `PUT /state/import`
  - `POST /commands`
  - `GET /projects/:id/handoff`
- `GET /state` returns a cloned snapshot and AppHealth summary.
- `PUT /state/import` validates snapshot transport shape and does a full
  replacement only after validation succeeds.
- `POST /commands` requires explicit adapter-level confirmation, validates the
  command payload with the Phase 3F import validator, and applies commands via
  `applyConfirmedCommandImport`.
- `GET /projects/:id/handoff` uses the Phase 3H
  `buildEngineeringHandoffPackageExport` helper and remains read-only.

### Contract Endpoint Behavior

- `GET /state`
  - Returns current local-first state as a clone.
  - Includes AppHealth summary.
  - Does not mutate, repair, normalize-save, or touch storage.
- `PUT /state/import`
  - Accepts a complete snapshot.
  - Uses existing backend import request validation.
  - Replaces adapter state on success.
  - Does not merge old state into the new snapshot.
  - Does not auto repair, delete orphan records, migrate user data, or resolve
    conflicts.
- `POST /commands`
  - Accepts one command or a command array.
  - Rejects requests without `confirmed: true`.
  - Reuses `validateCommandImport`.
  - Reuses `applyConfirmedCommandImport`.
  - Keeps batch apply atomic: any failed command leaves internal state
    unchanged.
  - Keeps unsafe generic `handoff_ready` updates rejected.
- `GET /projects/:id/handoff`
  - Returns an EngineeringHandoffPackage export for existing projects.
  - Returns `ok:false` for missing projects.
  - Reports `canGenerateEngineeringDraft`, `canMarkHandoffReady`, blocker
    count, and warning count.
  - Does not mark `handoff_ready`.
  - Does not execute commands.

### Main Files

- `src/domain/backendSnapshotAdapter.ts`
- `src/domain/backendSnapshotAdapter.test.ts`
- `docs/architecture/domain-hardening-progress.md`

### Safety Notes

- All command mutation still goes through the confirmed command import helper
  and then the Command Layer.
- AI/imported command metadata still cannot execute by itself.
- Import is full replace only; there is no merge path.
- Handoff generation is read-only and cannot promote
  `ready_for_engineering` to `handoff_ready`.
- The adapter is a contract harness for future backend behavior, not a backend
  implementation.

### Tests

- Adapter tests cover:
  - `getState` returns a clone and caller mutation cannot affect internal state
  - invalid snapshot import returns `ok:false` and keeps existing state
  - valid snapshot import fully replaces internal state
  - import does not merge old state into replacement snapshot
  - `POST /commands` without confirmation is rejected
  - confirmed command apply updates state through command layer flow
  - failed command keeps original state
  - batch apply remains atomic when a later command fails
  - unsafe generic `handoff_ready` update is rejected
  - project handoff export exists for valid project
  - missing project handoff returns `ok:false`
  - handoff export does not mutate state
  - adapter methods do not rely on real network/server APIs

### Known Limits

- This harness does not open HTTP ports, implement route handlers, or persist
  snapshots remotely.
- Snapshot validation is intentionally transport-shape validation plus existing
  AppHealth visibility; it is not a schema migration system.
- Blob/download and UI export behavior remain Phase 3H concerns.
- Final architecture freeze and documentation stop were completed in Phase 3J.

### Verification

- `npm run typecheck`
  - Passed: `tsc -b --noEmit`.
- `npm test -- src/domain/backendSnapshotAdapter.test.ts src/domain/backendContract.test.ts src/domain/commands/commandImport.test.ts src/domain/engineeringHandoffExport.test.ts src/domain/engineeringHandoffPackage.test.ts`
  - Passed: 5 files, 47 tests.
- `npm test`
  - Passed: 42 files, 401 tests.

## Phase 3J / Final Architecture QA / Documentation Freeze

Date: 2026-05-23 Australia/Sydney

Status: Completed

Domain Architecture Hardening: Completed

### Summary

- Completed final architecture QA and guardrail audit across domain reports,
  command import, dry-run, confirmed apply, handoff export, backend adapter, AI
  planning context, review drill-down, and AppHealth visibility.
- Completed documentation freeze for the hardening track.
- Confirmed the track remains local-first and does not implement a real backend
  server, HTTP route/listener, database, auth/login, permissions, multi-user,
  realtime sync, conflict resolution, or remote persistence.
- No new product feature, new phase, large refactor, schema migration, command
  editor, one-click suggested-command apply, or one-click handoff-ready path was
  added.

### Completed Phases

- Phase 1A: Product Blocking Decisions Formalization.
- Phase 1B: Canonical Status Semantics.
- Phase 1C: DomainIndex / EntityResolver.
- Phase 2A: RelationshipContext.
- Phase 2B: ThoughtProgressionReport.
- Phase 2C: ProjectReadinessReport.
- Phase 2D: Derived Review Queue + AppHealthReport.
- Phase 3A: Command Layer.
- Phase 3B: AIPlanningContext.
- Phase 3C: EngineeringHandoffPackage.
- Phase 3D: Backend Command/Snapshot Contract.
- Phase 3E: Read-only Architecture Visibility + Confirmed Command Entry UI
  Integration.
- Phase 3F: Confirmed Command Import / Validation Preview Panel.
- Phase 3G: Review / Health / Command Drill-down UI.
- Phase 3H: EngineeringHandoffPackage Export UI.
- Phase 3I: Backend Snapshot Adapter Stub / Contract Harness.
- Phase 3J: Final Architecture QA / Documentation Freeze.

### Final Guardrail Audit

#### Command / AI Safety

- Imported commands do not auto-execute. They must pass Validate -> Dry Run ->
  Apply, and Apply requires explicit confirmation.
- Dry Run operates on cloned state and does not mutate or save AppState.
- Confirmed apply delegates to `executeDomainCommand` through the confirmed
  command import helper and keeps batch failure atomic.
- Suggested commands remain draft metadata. Review / Health drill-down can copy
  draft payloads but cannot execute them.
- `AIPlanningContext` exposes bounded planning metadata and allowed command
  schema only; it does not execute commands or call mutation owners.
- Unsafe generic `handoff_ready` updates remain rejected by import validation
  and by the Command Layer.

#### Handoff Safety

- `ready_for_engineering` remains content maturity and does not imply
  `handoff_ready`.
- `canGenerateEngineeringDraft` and `canMarkHandoffReady` are separate signals.
- `EngineeringHandoffPackage` generation and Phase 3H export remain read-only.
- Handoff export and backend adapter handoff endpoint do not mark
  `handoff_ready`, execute commands, or mutate AppState.
- `project.markHandoffReady` remains the guarded command path for handoff-ready
  lifecycle changes.

#### Relationship / Reference Safety

- Graph relationships, direct membership references, and provenance references
  remain separate concepts.
- Relationship commands mutate graph relationships only and do not repair or
  rewrite direct refs.
- Direct membership commands do not create graph edges.
- `RelationshipContext` and `AppHealthReport` surface drift, orphan refs, and
  warnings without auto-repair, normalization-save, or deletion.

#### Import / Backend Safety

- `PUT /state/import` in the local adapter is full replace only; it does not
  merge old state into the replacement snapshot.
- Import validation failure leaves adapter internal state unchanged.
- Snapshot import does not auto repair, delete orphan records, migrate user
  data, resolve conflicts, or persist remotely.
- `backendSnapshotAdapter` is a local in-memory contract harness only and does
  not rely on network/server APIs.
- `POST /commands` requires `confirmed: true`, validates imported command
  payloads, and applies through the confirmed command helper and Command Layer.

#### Derived Report Safety

- `DomainIndex`, `RelationshipContext`, `ThoughtProgressionReport`,
  `ProjectReadinessReport`, `AppHealthReport`, Derived Review Queue,
  `AIPlanningContext`, and handoff package builders remain read-only report or
  planning layers.
- Review items remain derived and are not persisted as `ReviewItem` state.
- Derived review suggested commands require human confirmation and are not
  executable metadata by themselves.

### Final Safety Guarantees

- AI suggestions are drafts only.
- Commands require validation, dry-run, and confirmed apply before mutation.
- Command mutation is gated by `executeDomainCommand`.
- Failed command batches do not partially apply.
- `ready_for_engineering` does not imply `handoff_ready`.
- `handoff_ready` requires guarded command flow.
- Engineering handoff generation/export is read-only.
- Backend adapter is local in-memory harness only.
- Review items are derived and not persisted.
- Graph/direct/provenance relationships remain distinct.

### Files Changed

- `docs/architecture/domain-hardening-progress.md`

### Tests

- `npm run typecheck`
  - Passed: `tsc -b --noEmit`.
- `npm test`
  - Passed: 42 files, 401 tests.

### Known Limitations

- No real backend server, HTTP route/listener, database, auth/login,
  permissions, multi-user, realtime sync, conflict resolution, or remote
  persistence exists in this hardening track.
- Backend snapshot adapter validation remains transport-shape validation plus
  AppHealth visibility, not a migration system.
- Command import preview remains bounded and is not a full object diff.
- Review drill-down copies command draft payloads only; users still route them
  through Confirmed Command Import before execution.
- Blob download and browser clipboard behaviors remain browser-dependent.
- Historical "Next Recommended Step" notes in earlier sections are preserved as
  phase history. The hardening track is closed by this Phase 3J section.

### Stop Marker

Domain Architecture Hardening is complete.
No further phase was started.
