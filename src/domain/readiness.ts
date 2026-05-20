import type { Project, Readiness } from "./types";

export function readiness(project: Project): { score: number; value: Readiness; missing: string[] } {
  const checks = [
    ["intent", project.intent.trim().length > 0],
    ["users", project.users.length > 0],
    ["features", project.features.length > 0],
    ["screens", project.screens.length > 0],
    ["dataObjects", project.dataObjects.length > 0],
    ["flowSteps", project.flowSteps.length > 0],
    ["nextAction", project.nextAction.trim().length > 0]
  ] as const;

  const passed = checks.filter(([, ok]) => ok).length;
  const score = Math.round((passed / checks.length) * 100);
  const missing = checks.filter(([, ok]) => !ok).map(([name]) => name);

  const value: Readiness =
    score >= 90
      ? "ready_for_engineering"
      : score >= 70
        ? "draftable"
        : score >= 40
          ? "needs_clarification"
          : "not_ready";

  return { score, value, missing };
}
