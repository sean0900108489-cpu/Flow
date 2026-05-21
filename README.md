# Todo Thought Universe / 待辦事項思想宇宙

Todo Thought Universe is a local-first thought, task, project, and engineering-readiness system. It is not a plain todo list. It helps a user capture raw thoughts, organize them into universes, clarify decisions, review generated work, choose the next action, and export a project into an engineering handoff.

The app is built as a Vite + React single-page app and stores the full AppState in browser localStorage.

## Core Workflow

```text
Quick Capture
→ Idea Inbox
→ Thought Triage
→ Universe / Project organization
→ Decision Center
→ Review Queue Center
→ Engineering Readiness Center
→ Next Action Center
→ Engineering Handoff Export
```

## Features

- Universe Dashboard for active thoughts, projects, review signals, and next actions
- Quick Capture and Idea Inbox for low-friction thought entry
- Thought Triage for turning inbox items into clearer tasks, questions, goals, or projects
- Project Detail with readiness, lifecycle, linked thoughts, and handoff fields
- Relationship Explorer for typed links between thoughts, projects, universes, decisions, and blockers
- Local mock AI planning insights with human review before applying patches
- App State Transfer for full local-first import/export
- EngineeringFlowInput export for project handoff
- Deployment Status screen for production-readiness visibility

## Decision Center

The Decision Center is built around blocking questions. It tracks:

- open, in-review, resolved, and archived blocking questions
- impact level and current decision notes
- possible options and preferred option
- proposed or final resolution
- linked thoughts, projects, and universes

Decision records can be created from blocking questions or managed separately in the Decision Records Center. The goal is to keep product and architecture decisions explicit before engineering work depends on them.

## Review Queue Center

The Review Queue Center collects items that need human confirmation:

- draft AI insights
- proposed decision records
- unresolved blocking questions
- engineering handoff candidates

It provides counts, filters, priority ordering, and scoped actions so review work can be cleared without losing context.

## Engineering Readiness

The Engineering Readiness Center asks whether the app, project, or workflow is clear enough to move toward engineering. It summarizes:

- core identity clarity
- universe model clarity
- blocking decision status
- review queue health
- AppState persistence stability
- minimum workflow visibility

It also stores a manual readiness note, confidence level, target phase, and last review timestamp.

## Next Action Center

The Next Action Center answers: "What should happen next?"

It recommends actions from:

- thought next actions
- project next actions
- blocking questions
- review queue items
- engineering readiness signals

It supports manual notes, confidence, focus mode, pinned focus actions, dismissed actions, and persistent settings.

## Local-First Architecture

The app keeps user data in browser localStorage under this stable key:

```text
todo-thought-universe:v1
```

Do not change this key without a migration plan. The current implementation normalizes loaded state before use so older AppState objects receive defaults for newer additive fields such as:

- `blockingQuestions`
- `decisionRecords`
- `engineeringReadiness`
- `nextActionState`

Malformed or corrupted localStorage falls back to the bundled seed state instead of crashing the app.

## Import / Export

App State Transfer exports and imports the complete AppState JSON. This is the safest way to move data between browsers or recover from local-first storage.

The import path validates the required collections, applies compatibility defaults, and preserves additive state for Decision Center, Review Queue, Engineering Readiness, and Next Action Center.

Engineering Handoff Export creates an `engineering-flow-input/v0` JSON payload for project-by-project handoff.

## Migration Compatibility

Compatibility is intentionally additive:

- existing AppState collections remain unchanged
- optional state fields are defaulted when missing
- import/export preserves new fields when present
- localStorage parse or shape failures fall back safely
- production routes use SPA fallback so reload and direct navigation continue to work

## Local Development

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Build the production bundle:

```bash
npm run build
```

Run unit tests:

```bash
npm run test
```

Run Playwright e2e tests:

```bash
npm run e2e
```

Run the full local check:

```bash
npm run check
```

Preview the production build locally:

```bash
npm run preview
```

## Vercel Deployment

The app includes `vercel.json` for Vite production output and SPA fallback:

- build command: `npm run build`
- output directory: `dist`
- rewrite fallback: all routes serve `index.html`

Install the Vercel CLI if needed:

```bash
npm install -g vercel
```

Link the repo when the local workspace is not linked yet:

```bash
vercel link
```

Create a preview deployment:

```bash
vercel
```

Create the production deployment:

```bash
vercel --prod
```

If deployment logs are needed:

```bash
vercel deploy --logs
```

After deployment, direct navigation to routes such as `/deployment-status`, `/review-queue`, `/engineering-readiness`, and `/next-actions` should load the app instead of returning a 404.
