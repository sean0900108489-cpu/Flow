import type { AIInsight, ThoughtItem, Universe } from "../types";

export function isArchivedStatus(status: string | undefined) {
  return status === "archived";
}

export function isThoughtArchived(thought: Pick<ThoughtItem, "status">) {
  return isArchivedStatus(thought.status);
}

export function isThoughtActive(thought: Pick<ThoughtItem, "status">) {
  return !isThoughtArchived(thought);
}

export function isThoughtPaused(thought: Pick<ThoughtItem, "status">) {
  return thought.status === "paused";
}

export function isThoughtInbox(thought: Pick<ThoughtItem, "status">) {
  return thought.status === "inbox";
}

export function shouldThoughtAppearInNextAction(thought: Pick<ThoughtItem, "status" | "nextAction">) {
  return isThoughtActive(thought) && thought.nextAction.trim().length > 0;
}

export function isUniverseArchived(universe: Pick<Universe, "status">) {
  return isArchivedStatus(universe.status);
}

export function isUniverseActive(universe: Pick<Universe, "status">) {
  return !isUniverseArchived(universe);
}

export function isAIInsightDraft(insight: Pick<AIInsight, "status">) {
  return insight.status === "draft";
}

export function shouldAIInsightAppearInReviewQueue(insight: Pick<AIInsight, "status">) {
  return isAIInsightDraft(insight);
}
