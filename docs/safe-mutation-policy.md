# Safe Mutation Policy

Version: v0.2.3 Safe Mutation

The app treats UI actions as intent and domain mutations as the place where data safety is enforced. Relationship cleanup must go through the centralized relationship graph helper, status semantics must stay explicit, and derived views should be able to read a consistent next state immediately after a mutation.

| Mutation | Owner | Policy |
| --- | --- | --- |
| `deleteThought` | `src/domain/mutations/appMutations.ts` | Remove typed relationships touching the thought, clear project source/linked thought references, blocking question links, decision links, AI insight targets, and next action focus. |
| `deleteProject` | `src/domain/mutations/appMutations.ts` | Remove typed relationships touching the project, clear `thought.projectId`, blocking question project links, decision project links, AI insight targets, and next action focus. |
| `deleteUniverse` | `src/domain/universeActions.ts` | Block deletion while in use by default. In detach mode, clear item `universeId`, blocking/decision universe links, and relationships. |
| `deleteBlockingQuestion` | `src/domain/blockingQuestions.ts` | Remove typed relationships and clear decision `sourceBlockingQuestionId` plus next action focus. |
| `deleteDecisionRecord` | `src/domain/decisionRecords.ts` | Remove typed relationships and clear other records' `supersedesDecisionId`. |
| `promoteThoughtToProject` | `src/domain/projectActions.ts` | Create the project, keep the source thought linked, and create a typed `evolves_into` relationship. |
| `acceptDecision` | `src/domain/decisionRecords.ts` | Mark the decision accepted and resolve its source blocking question when one exists. |
| `archiveProject` / `archiveQuestion` | domain action owner | Preserve records and relationships. Derived views use semantic helpers to hide or downgrade archived items. |
| `applyAiPatch` | `src/domain/mutations/aiPatchMutations.ts` | AI may update descriptive fields only. It cannot directly change `status`, `readiness`, `lifecycleStatus`, relationships, IDs, or timestamps. |
| `importAppState` | `src/domain/appState.ts` | Normalize optional legacy state and repair relationship endpoint types when endpoints resolve. Preserve orphan relationships so warning-capable views can surface them. |

Completion standard: after any mutation, Review Queue, Engineering Readiness, Engineering Handoff, Global Search, Universe Overview, Relationship Explorer, Next Action, AI patch, and import/export should read a state with no stale references to deleted primary nodes.
