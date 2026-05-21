export type SafeMutationPolicyItem = {
  mutation: string;
  owner: string;
  relationshipPolicy: string;
  statusPolicy: string;
  derivedViewPolicy: string;
};

export const safeMutationPolicy: SafeMutationPolicyItem[] = [
  {
    mutation: "deleteThought",
    owner: "domain/mutations/appMutations",
    relationshipPolicy: "Remove relationships touching the thought through relationshipGraph.",
    statusPolicy: "Deleted thoughts are removed; archived thoughts remain restorable.",
    derivedViewPolicy: "Clear project source/linked thought references, blocking/decision links, AI insight targets, and next action focus."
  },
  {
    mutation: "deleteProject",
    owner: "domain/mutations/appMutations",
    relationshipPolicy: "Remove relationships touching the project through relationshipGraph.",
    statusPolicy: "Deleted projects are removed; archived projects remain restorable.",
    derivedViewPolicy: "Clear thought.projectId, blocking/decision project links, AI insight targets, and next action focus."
  },
  {
    mutation: "deleteUniverse",
    owner: "domain/universeActions",
    relationshipPolicy: "Remove relationships touching the universe through relationshipGraph.",
    statusPolicy: "Block delete while in use unless caller explicitly detaches linked items.",
    derivedViewPolicy: "Detach universeId and linkedUniverseIds before derived views read the next state."
  },
  {
    mutation: "deleteBlockingQuestion",
    owner: "domain/blockingQuestions",
    relationshipPolicy: "Remove relationships touching the blocking question through relationshipGraph.",
    statusPolicy: "Archived questions are hidden from active readiness; deleted questions are removed.",
    derivedViewPolicy: "Clear decision source references and next action focus."
  },
  {
    mutation: "deleteDecisionRecord",
    owner: "domain/decisionRecords",
    relationshipPolicy: "Remove relationships touching the decision record through relationshipGraph.",
    statusPolicy: "Archived decisions leave history; deleted decisions are removed.",
    derivedViewPolicy: "Clear supersedesDecisionId references."
  },
  {
    mutation: "acceptDecision",
    owner: "domain/decisionRecords",
    relationshipPolicy: "Relationships remain intact.",
    statusPolicy: "Accepted source decisions resolve their source blocking question when present.",
    derivedViewPolicy: "Review Queue, Engineering Readiness, and Next Action read the resolved question state."
  },
  {
    mutation: "applyAiPatch",
    owner: "domain/mutations/aiPatchMutations",
    relationshipPolicy: "AI patches cannot create or delete relationships.",
    statusPolicy: "AI patches cannot directly change status, lifecycleStatus, or readiness.",
    derivedViewPolicy: "Allowed field changes recompute project readiness through the existing readiness helper."
  },
  {
    mutation: "importAppState",
    owner: "domain/appState",
    relationshipPolicy: "Legacy relationship endpoint types are repaired when endpoints resolve.",
    statusPolicy: "Legacy optional state receives normalized defaults without deleting imported data.",
    derivedViewPolicy: "Orphan relationships are preserved as warnings for read paths instead of being silently dropped."
  }
];
