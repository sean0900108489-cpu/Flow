import type { AIInsight, AIInsightPatch, Project, ThoughtItem, Universe } from "../domain/types";
import { readiness } from "../domain/readiness";
import { readinessLabel } from "../domain/labels";

export type DraftAIInsight = Omit<AIInsight, "id" | "createdAt">;

function buildPatch<TTarget extends "thought" | "project">(
  targetType: TTarget,
  targetId: string,
  operations: AIInsightPatch["operations"]
): AIInsightPatch | undefined {
  return operations.length > 0
    ? {
        targetType,
        targetId,
        operations
      }
    : undefined;
}

export function generateThoughtClassificationInsight(thought: ThoughtItem, universes: Universe[]): DraftAIInsight {
  const looksLikeProject = /網站|系統|app|專案|建立|做/i.test(`${thought.title} ${thought.content}`);
  const patch: Partial<ThoughtItem> = {};

  if (looksLikeProject && thought.type !== "project") {
    patch.type = "project";
  }

  if (looksLikeProject && !thought.nextAction.trim()) {
    patch.nextAction = "Define the first concrete engineering step.";
  }

  if (!thought.why.trim()) {
    patch.why = "Clarify why this matters before execution.";
  }

  if (!thought.outcome.trim()) {
    patch.outcome = "Define what success looks like.";
  }

  const operations = Object.keys(patch).length > 0
    ? [{ type: "updateThought" as const, thoughtId: thought.id, patch }]
    : [];

  return {
    targetId: thought.id,
    type: "classification",
    content: [
      `分類建議：${looksLikeProject ? "專案" : "靈感"}`,
      `宇宙建議：${universes.find((u) => u.id === thought.universeId)?.name ?? universes[0]?.name}`,
      "下一步建議：補上 why、outcome、nextAction；如果範圍清楚，就升級為 Project。"
    ].join("\n"),
    status: "draft",
    patch: buildPatch("thought", thought.id, operations)
  };
}

export function generateProjectReadinessInsight(project: Project): DraftAIInsight {
  const result = readiness(project);
  const patch: Partial<Project> = {};

  if (!project.nextAction.trim()) {
    patch.nextAction = "Write the first implementation task.";
  }

  const operations = Object.keys(patch).length > 0
    ? [{ type: "updateProject" as const, projectId: project.id, patch }]
    : [];

  return {
    targetId: project.id,
    type: "project_readiness",
    content: [
      `工程準備度：${result.score}% / ${readinessLabel[result.value]}`,
      result.missing.length ? `缺少：${result.missing.join(", ")}` : "必要欄位已具備。",
      `下一步建議：${project.nextAction || "確認 screens/dataObjects/flowSteps 後匯出 EngineeringFlowInput。"}`
    ].join("\n"),
    status: "draft",
    patch: buildPatch("project", project.id, operations)
  };
}
