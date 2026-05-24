# Domain Engine Checkpoint

Date: 2026-05-23 Australia/Sydney
Status: checkpoint report, not a release tag

Source and tests remain the authority. This report records current hygiene for
release review and Task 36 planning; it does not claim a backend implementation
or stable release readiness.

## Repository Snapshot

- Current branch: `ui/right-ai-chat-dock`
- Package version: `0.2.3-rc.2`
- Latest relevant commits:
  - `9874e54 feat: add overlay AI chat dock and compact sidebar`
  - `b3b7e98 chore: add local verification gate`
  - `3f7c914 feat: stabilize thought-project direct reference consistency`
  - `ec15daa chore: untrack generated artifacts`
  - `70dd9bb v0.2.3-rc2 version metadata`

## Files Changed Summary

Tracked modified files at checkpoint time:

- `docs/architecture-hardening-context.md`
- `docs/architecture/ARCHITECTURE_DECISIONS.md`
- `package.json`
- `src/App.tsx`
- `src/components/screens/AIPanel.tsx`
- `src/components/screens/AppStateTransfer.tsx`
- `src/components/screens/DeploymentStatus.test.tsx`
- `src/components/screens/DeploymentStatus.tsx`
- `src/components/screens/ReviewQueueCenter.tsx`
- `src/domain/semantics/statusSemantics.test.ts`
- `src/domain/types.ts`
- `src/style.css`

Tracked diff stat, excluding the local environment file, is 12 files changed,
1531 insertions, and 867 deletions.

Important untracked source/test/docs to review:

- Domain modules and tests: `src/domain/backendContract.*`,
  `src/domain/backendSnapshotAdapter.*`, `src/domain/commandLayer.*`,
  `src/domain/derivedReviewQueue.*`, `src/domain/domainIndex.*`,
  `src/domain/engineeringHandoffExport.*`,
  `src/domain/engineeringHandoffPackage.*`,
  `src/domain/projectReadinessReport.*`,
  `src/domain/relationshipContext.*`,
  `src/domain/thoughtProgressionReport.*`, `src/domain/commands/`
- UI modules and tests: `src/components/screens/AppStateTransfer.test.tsx`,
  `ArchitectureStatusPanel.*`, `ConfirmedCommandImportPanel.tsx`,
  `HandoffPackageExportPanel.*`, `ReviewHealthDrillDownPanel.*`
- Documentation: `docs/acceptance/`,
  `docs/architecture/backend-command-channel.md`,
  `docs/architecture/domain-engine-landing-checklist.md`,
  `docs/architecture/domain-hardening-progress.md`,
  `docs/engineering-handoff/`

## Generated And Local Artifacts

Present generated or local artifacts:

- `dist/`
- `tsconfig.tsbuildinfo`
- `test-results/`
- `playwright-report/`
- `.vercel/`
- `.DS_Store` files
- `node_modules/`

`git ls-files` reports no tracked files under `dist`, `tsconfig.tsbuildinfo`,
`test-results`, `playwright-report`, or `.vercel`. `git status --ignored`
reports them as ignored/local artifacts, not source.

## Verification Results

Task 33 verification result referenced for this checkpoint:

- `npm run verify:source`
- Passed: Vitest 9 files, 114 tests.
- Passed: `tsc --noEmit --incremental false`.
- No build output or `*.tsbuildinfo` is produced by that verification command.

No new verification was run for this checkpoint report.

## Contract Confirmations

- `.env.local` was not read, printed, diffed, snapshotted, staged, committed, or
  pushed.
- `src/domain/types.ts` still defines `AppState` as canonical persisted arrays:
  `universes`, `thoughts`, `projects`, `relationships`, `aiInsights`, plus
  optional `blockingQuestions`, `decisionRecords`, `engineeringReadiness`, and
  `nextActionState`.
- `AppState` does not include persisted `reviewItems`, generated reports, or
  AI chat dock messages/session state.
- `ReviewItems` and reports remain derived from current `AppState` through
  modules such as `derivedReviewQueue`, `projectReadinessReport`,
  `appHealthReport`, and related context builders.
- `handoff_ready` remains guarded: generic project update commands that set
  `lifecycleStatus` to `handoff_ready` are rejected, and the write path remains
  `project.markHandoffReady` / `markProjectHandoffReady`.
- Relationship graph and direct membership remain separate: graph
  `belongs_to` or `related_to` relationships can supplement direct refs, but do
  not replace `Thought.projectId`, `Project.linkedThoughtIds`,
  `Thought.universeId`, or `Project.universeId`.

## Remaining Blockers Before Release

- Reviewer still needs to decide which dirty tracked and untracked files belong
  in the release candidate.
- Generated/local artifacts must stay ignored and out of source control.
- The checkpoint does not include a real backend implementation.
- Backend-facing modules are source-level contracts/adapters only until a future
  backend task implements and tests server behavior.
- Product Intelligence and AI planning surfaces should remain described as
  deterministic local planning/reporting support, not mature autonomous product
  intelligence.
- A fresh verification run should happen after the release reviewer selects the
  final commit set.

Recommended next checkpoint tag name, if the reviewer accepts the selected
commit set later: `v0.2.3-rc2-domain-engine-checkpoint`

## Go / No-Go

Task 36 can start from this checkpoint after review of the dirty worktree scope.
This is a go for Task 36 planning and implementation work, but not a go for a
release tag until the reviewer selects files, reruns verification, and confirms
generated artifacts remain untracked.
