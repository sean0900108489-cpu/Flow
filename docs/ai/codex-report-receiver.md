# TDU Codex Report Receiver

The TDU Codex Report Receiver is a local wrapper around `codex exec`. It records the evidence around a Codex task run so a human can review what was requested, what Codex reported, what events were emitted, and what changed in git.

This receiver does not make Codex output canonical truth. A Codex final report is only a suggestion/report. The durable evidence is the prompt, JSONL event log, git status before and after, diff, changed-file list, receiver metadata, and the human review status.

## Why This Project Needs It

`todo-thought-universe` has domain engine, engineering handoff, and project intelligence work in progress. The working tree can contain important untracked architecture source, tests, and docs. A receiver gives each Codex run a local audit trail without staging, committing, tagging, pushing, or mutating product state directly.

This matters because Codex may summarize incorrectly, omit uncertainty, or misunderstand a boundary. The evidence files let reviewers compare the request, the actual event stream, and the git changes before accepting anything.

## Usage

Run this from inside the `todo-thought-universe` git worktree:

```bash
scripts/run-codex-task.sh audit-domain-engine <<'PROMPT'
Audit the domain engine boundaries only. Do not change files. Return risks, commands run, checks performed, and follow-up recommendations.
PROMPT
```

The first argument is an optional slug. If omitted, the receiver uses `codex-task`. Slugs are sanitized to letters, numbers, dash, and underscore.

## Audit-Only Example

```bash
scripts/run-codex-task.sh audit-review-queue <<'PROMPT'
Audit the Review Queue implementation for boundary violations. Do not modify files, do not run build/e2e, and do not read .env.local. Return a schema-conforming report with affectedAreas set to review-queue, domain, tests, or unknown as appropriate.
PROMPT
```

## Implementation Example

```bash
scripts/run-codex-task.sh implement-doc-note <<'PROMPT'
Add a short docs-only note explaining how reviewStatus should be interpreted. Do not modify src/, do not run build/e2e, and do not stage or commit. Return a schema-conforming report.
PROMPT
```

## Output Structure

Each run creates:

```text
.ai/codex-runs/<YYYYMMDD-HHMMSS-slug>/
  prompt.md
  final-report.json
  events.jsonl
  git-before.txt
  git-after.txt
  status-before.txt
  status-after.txt
  diff.patch
  changed-files.txt
  receiver-meta.json
```

`final-report.json` must match `.ai/schemas/codex-completion-report.schema.json`. `receiver-meta.json` records the run id, project root, created time, paths, receiver status, and default `reviewStatus: "unreviewed"`.

## Human Review

Review starts from `receiver-meta.json` and `final-report.json`, but it should not stop there. Compare:

- `prompt.md` against the actual task scope.
- `events.jsonl` against the final report.
- `status-before.txt` and `status-after.txt` against expected repository movement.
- `diff.patch` against the claimed changed files.
- `changed-files.txt` against generated artifacts or out-of-scope edits.

After review, a human can mark the run as approved, rejected, or needing follow-up in whichever review workflow owns that status. The first receiver version only records `unreviewed`; it does not make product decisions.

## Why Codex Reports Are Not Canonical

Codex reports are generated text. They can be useful, but they are not the authoritative state of the app, domain model, project intelligence layer, or engineering handoff. Canonical truth must come from the source files, domain owners, validation rules, command boundaries, tests, and human review.

The prompt, event log, diff, changed files, and metadata are evidence because they are closer to what was requested and what happened on disk. They still require review, especially when the working tree was already dirty before the run.

## Environment Files

Do not read, diff, print, copy, or expose `.env.local`. Environment files can contain secrets or local-only configuration. The receiver excludes `.env.local` from diff evidence and redacts it from status output.

## Generated Artifacts

Do not treat `node_modules`, `dist`, `coverage`, `playwright-report`, `test-results`, or `tsconfig.tsbuildinfo` as source of truth. If generated artifacts appear in a run, treat them as review signals, not canonical architecture or product evidence.

## No UI Integration In Version One

Version one is intentionally file-based. It avoids UI, AppState, domain state, Review Queue, Engineering Handoff, Backend Contract, and Product Intelligence integration so it cannot accidentally create new product semantics or bypass existing owners.

Future work can connect receiver metadata and human review outcomes into Review Queue, Engineering Handoff, or Product Intelligence. That integration should be designed through the existing domain boundaries and validation paths, not by directly persisting reports into AppState.
