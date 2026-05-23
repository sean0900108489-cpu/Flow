# Backend Command Channel

Status: planning reference
Authority: source and tests remain the implementation authority

This document records backend-safe boundaries for future work. It is not a
claim that a backend server, HTTP routes, remote persistence, auth,
multi-user sync, or permissions have been implemented.

## Current Position

- The current app remains local-first.
- `AppState` import/export compatibility remains a product constraint.
- The safest future backend option is an `AppState` snapshot backend that
  preserves full-state compatibility.
- An entity backend is possible only behind explicit AppState DTO conversion,
  compatibility tests, and reviewed ownership boundaries.
- Source files and tests are the authority whenever this document conflicts
  with implementation details.

## Command Channel

- Prefer `POST /commands` over raw entity `PATCH` endpoints.
- A future `POST /commands` route should be a transport wrapper around the
  confirmed command flow and Command Layer.
- Do not let transport code call mutation owners directly.
- Do not expose raw `PATCH /projects/:id` behavior that can set protected
  lifecycle fields.
- Never allow raw `PATCH /projects/:id { lifecycleStatus: "handoff_ready" }`.
- `handoff_ready` must go through `project.markHandoffReady` /
  engineering handoff ownership and the existing preflight guard.

## Snapshot And Import Channel

- A future `GET /state` may return a full AppState snapshot plus derived health
  metadata.
- A future `PUT /state/import` must keep the visible Validate -> Dry Run ->
  Apply flow.
- Import warnings must remain visible to the user and must intentionally match
  local warning-vs-reject behavior.
- Server validation must mirror local warning-vs-reject behavior on purpose,
  not by accident.
- Import does not imply auto-repair, schema migration, conflict resolution, or
  silent data loss.

## Data Boundaries

- The `relationships[]` graph and direct project membership references remain
  separate concepts.
- Graph relationship commands must not rewrite direct refs.
- Direct membership commands must not create graph edges unless an explicit
  source-backed design changes that boundary.
- ReviewItems, AppHealthReport findings, readiness reports, and planning
  reports are derived review/workflow metadata, not canonical persisted
  workflow state.
- AiChatDock session/local UI state must not enter `AppState` unless a future
  redesign explicitly changes the persisted schema and adds compatibility tests.

## Backend Shape That Is Safe To Explore

- `POST /commands`: confirmed domain commands only.
- `GET /state`: read-only AppState snapshot.
- `PUT /state/import`: snapshot validation/dry-run/apply flow.
- `GET /projects/:id/handoff`: read-only engineering handoff package/export.

## Explicit Non-Goals

- Raw entity mutation endpoints as the primary write path.
- A direct route that marks handoff-ready without command validation.
- Persisting derived reports as canonical workflow records.
- Treating backend availability as proof that Product Intelligence is mature.
- Adding backend-only state shape that cannot round-trip through AppState
  import/export.
