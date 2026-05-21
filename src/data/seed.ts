import type { AppState } from "../domain/types";
import { now } from "../domain/utils";

export const seed: AppState = {
  universes: [
    {
      id: "u-thought",
      name: "思想管理系統宇宙",
      description: "管理想法、目標、任務、專案與工程交接。",
      purpose: "把混沌想法整理成可推進下一步與可工程化專案。",
      focus: "main"
    },
    {
      id: "u-ai",
      name: "AI 工具宇宙",
      description: "AI 分類、整理、規劃與工程輸入草稿。",
      purpose: "讓 AI 讀取結構化思想，而不是零散文字。",
      focus: "secondary"
    }
  ],
  thoughts: [
    {
      id: "t-1",
      title: "做一個不是普通 todo list 的思想宇宙網站",
      content: "它要幫我判斷現在想做什麼、想法屬於哪個宇宙、它是靈感/任務/專案/目標，以及下一步是什麼。",
      type: "project",
      status: "active",
      universeId: "u-thought",
      why: "普通 todo 無法處理高密度思考、專案演化與工程交接。",
      outcome: "能把想法整理成 EngineeringFlowInput。",
      nextAction: "完成 MVP：Quick Capture、Inbox、Universe、Project Readiness、Export。",
      projectId: "p-1",
      createdAt: now(),
      updatedAt: now()
    },
    {
      id: "t-2",
      title: "AI 幫我建議分類與下一步",
      content: "AI 應該根據結構化資料提出分類、宇宙、關係與 next action。",
      type: "inspiration",
      status: "inbox",
      universeId: "u-ai",
      why: "降低整理摩擦。",
      outcome: "每個 AI 建議都能被人工接受或拒絕。",
      nextAction: "先做 mock AI。",
      createdAt: now(),
      updatedAt: now()
    }
  ],
  projects: [
    {
      id: "p-1",
      sourceThoughtId: "t-1",
      linkedThoughtIds: ["t-1"],
      universeId: "u-thought",
      status: "active",
      name: "Todo Thought Universe MVP",
      intent: "建立 local-first 思想管理系統，讓使用者快速捕捉想法、分類、放入宇宙、產生下一步，並判斷是否能工程化。",
      users: ["Sean / 創作者本人", "一般個人使用者", "AI Assistant"],
      features: ["Quick Capture", "Idea Inbox", "Universe Grouping", "Project Readiness", "Engineering Handoff Export"],
      screens: ["Universe Dashboard", "Quick Capture", "Idea Inbox", "Thought Detail", "Project Detail", "AI Planning Panel", "Export"],
      dataObjects: ["ThoughtItem", "Universe", "Project", "Relationship", "AIInsight", "EngineeringHandoff"],
      flowSteps: ["快速輸入想法", "進入 Inbox", "分類", "放入 Universe", "補上 why/outcome/nextAction", "判斷 readiness", "匯出 EngineeringFlowInput"],
      unknowns: ["第一版是否需要登入？", "AI 是 mock 還是真實 API？", "Relationship Map 是否第一版就圖形化？"],
      nextAction: "確認資料模型與工程交接條件。",
      readiness: "draftable",
      createdAt: now(),
      updatedAt: now()
    }
  ],
  relationships: [
    {
      id: "r-1",
      sourceId: "t-2",
      targetId: "t-1",
      type: "supports",
      description: "AI 整理建議支援思想宇宙系統的核心體驗。"
    }
  ],
  aiInsights: [],
  engineeringReadiness: {
    note: "Use the readiness center to decide when product decisions, review queue health, and persistence are stable enough for engineering.",
    manualConfidence: "medium",
    targetPhase: "prototype",
    lastReviewedAt: undefined,
    updatedAt: now()
  },
  blockingQuestions: [
    {
      id: "bq-thought-todo",
      question: "ThoughtItem 和 TodoItem 是否應該分開？",
      context: "目前 MVP 採用 TodoItem 不獨立，task 是 ThoughtItem 的一種 type。",
      proposedResolution: "Keep TodoItem as ThoughtItem with type = task until task-specific workflow becomes complex.",
      finalResolution: "TodoItem 不獨立，task 暫時維持為 ThoughtItem 的一種 type。",
      status: "resolved",
      linkedThoughtIds: ["t-1"],
      linkedProjectIds: ["p-1"],
      linkedUniverseIds: ["u-thought"],
      createdAt: now(),
      updatedAt: now()
    },
    {
      id: "bq-universe-model",
      question: "Universe 是標籤、資料夾，還是獨立物件？",
      context: "目前 MVP 已將 Universe 實作為可管理的一級物件。",
      proposedResolution: "Universe is an independent object that can group thoughts, projects, and relationships.",
      finalResolution: "Universe 是可建立、編輯、封存、刪除的一級物件。",
      status: "resolved",
      linkedThoughtIds: ["t-1", "t-2"],
      linkedProjectIds: ["p-1"],
      linkedUniverseIds: ["u-thought", "u-ai"],
      createdAt: now(),
      updatedAt: now()
    },
    {
      id: "bq-engineering-readiness",
      question: "專案什麼時候可以進入工程階段？",
      context: "目前 MVP 新增 Engineering Handoff Center，用 readiness 判斷 project 是否可交接。",
      proposedResolution: "A project can enter engineering handoff when required fields, next action, universe context, and blockers are resolved.",
      status: "in_review",
      linkedThoughtIds: ["t-1"],
      linkedProjectIds: ["p-1"],
      linkedUniverseIds: ["u-thought"],
      createdAt: now(),
      updatedAt: now()
    }
  ]
};
