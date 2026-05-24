# Architecture Decisions

Status: Draft with accepted Phase 1A decisions
Verification: `src/domain/semantics/statusSemantics.test.ts`
Authority: Source-backed ADR index

This document records durable decisions only when source, tests, and human intent
support them. Candidate decisions remain coordination scaffolds until promoted.

## Purpose

This file records product and architecture decisions that guard persisted shape,
workflow semantics, and mutation ownership.

## Accepted Decisions

### ADR-001: TodoItem Is A ThoughtItem Task Role For Phase 1

Status: Accepted

Decision: Do not add a persisted `todos[]` collection or a separate persisted
`TodoItem` entity in Phase 1. A todo is represented by `ThoughtItem` with
`type: "task"` plus existing thought status, context, and project membership
fields.

Rationale: Current `AppState` has `thoughts[]` and no `todos[]`. Adding a new
persisted collection would require a schema migration and would overlap with
`ThoughtItem.type`, `ThoughtItem.status`, `ThoughtItem.projectId`, and
`Project.linkedThoughtIds`.

Guardrails:

- Do not add `todos[]` to `AppState` without an explicit migration plan.
- Do not treat task-like thoughts as a second canonical entity.
- Future TodoItem extraction must migrate from current ThoughtItem data.

Verification: `statusSemantics.test.ts` asserts the task role lives in
`thoughts[]` and no persisted `todos` collection is present.

### ADR-002: Universe Remains A Persisted Container Object

Status: Accepted

Decision: Keep `Universe` as a persisted domain/container object referenced by
`ThoughtItem.universeId` and `Project.universeId`. It is not a plain tag,
folder string, or relationship-only grouping.

Rationale: Current source already persists `universes[]` and direct universe
references on thoughts and projects. Relationship graph edges may express
additional semantics, but they do not replace the persisted Universe object.

Guardrails:

- Do not downgrade Universe to tags, folders, or free-form labels.
- Do not require `relationships[]` `belongs_to` edges for baseline universe
membership.
- Graph relationships may supplement direct universe references, not replace
them.

Verification: `statusSemantics.test.ts` asserts thoughts and projects directly
reference a persisted Universe without needing relationship edges.

### ADR-003: Project Readiness Is Content Maturity, Handoff Ready Is Workflow State

Status: Accepted

Decision: `Project.readiness: "ready_for_engineering"` means the project content
is mature enough for engineering review. It does not automatically mean
`Project.lifecycleStatus: "handoff_ready"`.

Rationale: `ready_for_engineering` is computed from project content and can
surface a review candidate. `handoff_ready` is a human-confirmed lifecycle state
that must go through the guarded handoff path.

Guardrails:

- Do not set `handoff_ready` through generic project updates.
- Do not let computed readiness automatically transition lifecycle status.
- A ready project should appear as a handoff review candidate until explicitly
confirmed.

Verification: `statusSemantics.test.ts`, `projectActions.test.ts`, and
`engineeringHandoff.test.ts` cover the separation and guarded transition.

## Candidate Decisions

### ADR-CAND-001: Keep Governance Lightweight

Candidate: Architecture docs should coordinate work, not create an enterprise documentation system.

### ADR-CAND-002: Prefer Existing App Shape Before New Frameworks

Candidate: Do not add large frameworks, workflow engines, event sourcing, or broad state-machine infrastructure unless a concrete source-backed need appears.

### ADR-CAND-003: Protect Existing User Flows And Saved Data

Candidate: Architecture changes should preserve existing UI flows, localStorage compatibility, and green build/test/e2e checks.

## Decision Rule

Promote a candidate to accepted only when the repo source, tests, and human intent support it.
