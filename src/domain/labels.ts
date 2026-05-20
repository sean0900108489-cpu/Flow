import type { Readiness, ThoughtStatus, ThoughtType } from "./types";

export const typeLabel: Record<ThoughtType, string> = {
  inspiration: "靈感",
  task: "任務",
  project: "專案",
  goal: "目標",
  question: "問題",
  note: "筆記"
};

export const statusLabel: Record<ThoughtStatus, string> = {
  inbox: "Inbox",
  active: "進行中",
  paused: "暫停",
  done: "完成",
  archived: "封存"
};

export const readinessLabel: Record<Readiness, string> = {
  not_ready: "尚未準備",
  needs_clarification: "需要釐清",
  draftable: "可產生工程草稿",
  ready_for_engineering: "可工程交接"
};
