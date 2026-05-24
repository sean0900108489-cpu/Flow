# Engineering Handoff Template

Status: reusable template
Authority: source and tests remain the implementation authority

Use this template when preparing a project for engineering review. Keep the
content source-backed, concrete, and conservative. Do not claim backend,
runtime, or product intelligence capabilities that are not implemented in the
repo.

## Project Purpose

- What user problem does this project solve?
- What current product behavior or workflow should improve?
- Which source modules currently define the behavior?

## Scope

- Included user flows:
- Included data/state changes:
- Included UI surfaces:
- Included domain helpers/services:

## Non-Goals

- Out-of-scope product behavior:
- Out-of-scope backend/network behavior:
- Out-of-scope schema migration:
- Out-of-scope automation or AI behavior:

## Data Objects

- Canonical AppState objects:
- Derived report objects:
- UI-only state:
- Import/export compatibility notes:

## Screens

- Primary screens:
- Secondary/review screens:
- Empty/error/loading states:
- Accessibility or copy constraints:

## Flows

- Main happy path:
- Review/confirmation path:
- Import/export path:
- Failure and rollback behavior:

## Blockers

- Product blockers:
- Technical blockers:
- Data compatibility blockers:
- Test coverage blockers:

## Decisions

- Accepted decisions:
- Candidate decisions:
- Decisions still needing human review:

## Required Software / Modules

- UI modules:
- Domain modules:
- Service/persistence modules:
- Validation/reporting modules:
- Test modules:

## Version Evolution Plan

- Current version behavior:
- Compatible next step:
- Migration requirement, if any:
- Rollback or recovery plan:

## Constraint Codex

- Source/tests are authority.
- Preserve AppState compatibility unless a migration is explicit and tested.
- Keep AI output draft-only unless confirmed through command flow.
- Keep `ready_for_engineering` separate from `handoff_ready`.
- Keep graph relationships and direct membership refs separate.
- Do not persist derived ReviewItems or reports as canonical workflow state.

## Backend Design

- Current backend status:
- Snapshot strategy:
- Command endpoint strategy:
- Import validation/dry-run/apply strategy:
- Explicit backend non-goals:

## Codex Task Plan

- Task id:
- Objective:
- Likely files:
- Guardrails:
- Tests to run:
- Completion report requirements:

## Acceptance Tests

- Unit/domain tests:
- Component/render tests:
- Import/export tests:
- Command confirmation tests:
- No-build/source verification:
- Manual review checklist:
