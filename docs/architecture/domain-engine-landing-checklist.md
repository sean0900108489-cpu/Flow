# Domain Engine Landing Checklist

Status: release-review checklist
Authority: source and tests remain the implementation authority

This checklist summarizes the current domain hardening track. It should guide
future backend and handoff work, but source and tests are the authority for
actual behavior.

## Completed Engine Modules

- Canonical status semantics.
- DomainIndex / EntityResolver.
- RelationshipContext.
- ThoughtProgressionReport.
- ProjectReadinessReport.
- AppHealthReport.
- Derived Review Queue.
- Command Layer.
- AIPlanningContext.
- EngineeringHandoffPackage.
- Backend command/snapshot contract metadata.
- Read-only architecture visibility panel.
- Confirmed command import / validation preview flow.
- Review and health drill-down UI.
- Engineering handoff package export UI.
- Local in-memory backend snapshot adapter harness.
- Final architecture QA / documentation freeze.

## Key Safety Rules

- Source and tests are authority.
- The app remains local-first.
- The backend snapshot adapter is a local contract harness, not a deployed
  backend implementation.
- AI planning output is draft-only.
- Suggested command metadata is not executable by itself.
- Imported commands must go through Validate -> Dry Run -> Apply.
- Apply requires explicit confirmation.
- Command mutation is gated by `executeDomainCommand`.
- Failed command batches must not partially apply.
- `ready_for_engineering` does not imply `handoff_ready`.
- `handoff_ready` must go through guarded `project.markHandoffReady` /
  engineering handoff ownership.
- Raw generic project updates must not set `handoff_ready`.
- Graph relationships, direct membership refs, and provenance refs remain
  separate.
- ReviewItems and report findings are derived and not persisted as canonical
  workflow state.
- AppState import/export compatibility must be preserved unless a migration is
  explicit and tested.

## Tests To Run Before Backend Work

- `npm run verify:source`
- `npm test -- src/domain/backendContract.test.ts`
- `npm test -- src/domain/backendSnapshotAdapter.test.ts`
- `npm test -- src/domain/commandLayer.test.ts`
- `npm test -- src/domain/commands/commandImport.test.ts`
- `npm test -- src/services/appStateTransfer.test.ts`
- `npm test -- src/domain/validation/appStateInvariants.test.ts`
- `npm test -- src/domain/relationships/relationshipGraph.test.ts`
- `npm test -- src/domain/projectThoughtLinks.test.ts`
- `npm test -- src/domain/projectActions.test.ts`
- `npm test -- src/domain/engineeringHandoff.test.ts`

Run broader checks only when the change risk justifies them and the task allows
artifact-writing commands.

## Known Limitations

- No real backend server, HTTP route/listener, database, auth/login,
  permissions, multi-user mode, realtime collaboration, conflict resolution, or
  remote persistence exists.
- Backend adapter validation is a contract harness, not a migration system.
- Confirmed command import preview is bounded and is not a full object diff.
- Review drill-down copies command draft payloads only; humans still route them
  through Confirmed Command Import.
- Product Intelligence is currently deterministic local planning/reporting
  support, not an autonomous product decision engine.
- Browser clipboard and Blob download behavior remain browser-dependent.
- No `ConstraintRuntime` is claimed by this checklist.

## Future Work

- Convert backend contract metadata into real route handlers only after source
  boundaries are reaffirmed.
- Add explicit AppState DTO conversion before any entity backend work.
- Add backend/server validation parity tests for warning-vs-reject behavior.
- Add richer command dry-run diffs if product review needs them.
- Add UI drill-down links from report findings to source screens.
- Revisit AppState schema only with an explicit migration and compatibility
  suite.

## Release Checkpoint Checklist

- Source/test authority stated in docs.
- No backend implementation claimed unless source implements it.
- No ConstraintRuntime claimed before source exists.
- Product Intelligence maturity described conservatively.
- AppState schema unchanged unless migration is intentional and tested.
- Import/export full-state compatibility preserved.
- Handoff-ready path still guarded.
- ReviewItems/reports remain derived.
- Graph/direct/provenance boundaries preserved.
- Docs, tests, and source do not contradict each other.
