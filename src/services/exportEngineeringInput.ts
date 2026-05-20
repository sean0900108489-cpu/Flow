import type { Project, Universe } from "../domain/types";
import { now } from "../domain/utils";

export function engineeringInput(project: Project, universe?: Universe) {
  return {
    schemaVersion: "engineering-flow-input/v0",
    id: `input-${project.id}`,
    projectName: project.name,
    projectIntent: project.intent,
    sourceType: "todo-thought-universe-export",
    createdAt: now(),
    updatedAt: now(),
    userTypes: project.users.map((name, i) => ({
      id: `user-${i + 1}`,
      name,
      goal: `使用 ${project.name} 達成目標。`,
      description: universe ? `隸屬 Universe：${universe.name}` : ""
    })),
    mainScreens: project.screens.map((name, i) => ({
      id: `screen-${i + 1}`,
      name,
      purpose: `${project.name} 的主要畫面：${name}`,
      keyActions: []
    })),
    coreFunctions: project.features.map((name, i) => ({
      id: `feature-${i + 1}`,
      name,
      description: `${project.name} 的核心功能：${name}`,
      priority: i < 5 ? "must_have" : "should_have",
      relatedScreenIds: [],
      relatedDataObjectIds: []
    })),
    flowSteps: project.flowSteps.map((title, i) => ({
      id: `flow-${i + 1}`,
      step: i + 1,
      title,
      description: title,
      relatedScreenId: "",
      relatedFunctionIds: []
    })),
    dataObjects: project.dataObjects.map((name, i) => ({
      id: `data-${i + 1}`,
      name,
      description: `${project.name} 使用的資料物件：${name}`
    })),
    aiRoles: [
      {
        id: "ai-classification-suggestion",
        task: "分類建議",
        requiresHumanConfirmation: true,
        relatedScreenIds: [],
        relatedFunctionIds: []
      },
      {
        id: "ai-next-step-suggestion",
        task: "下一步建議",
        requiresHumanConfirmation: true,
        relatedScreenIds: [],
        relatedFunctionIds: []
      },
      {
        id: "ai-engineering-input-draft",
        task: "工程輸入草稿產生",
        requiresHumanConfirmation: true,
        relatedScreenIds: [],
        relatedFunctionIds: []
      }
    ],
    unknowns: project.unknowns.map((question, i) => ({
      id: `unknown-${i + 1}`,
      question,
      blocksGeneration: false
    }))
  };
}
