import { describe, expect, it } from "vitest";
import { missingRequiredUiTranslations, translateText, UI_LANGUAGE_STORAGE_KEY } from "./i18n";

describe("UI i18n", () => {
  it("has no empty required Traditional Chinese translations", () => {
    expect(missingRequiredUiTranslations()).toEqual([]);
  });

  it("translates shell and safety copy with interpolation", () => {
    expect(translateText("zh-TW", "Universe Dashboard")).toBe("宇宙儀表板");
    expect(translateText("zh-TW", "Delete this project?")).toBe("要刪除這個專案嗎？");
    expect(translateText("zh-TW", "App State imported with {count} invariant warning(s). Review the warning details before leaving transfer.", {
      count: 2
    })).toContain("2 個 invariant warning");
  });

  it("covers high-traffic dashboard, archive, project, and universe UI copy", () => {
    expect(translateText("zh-TW", "Global Search")).toBe("全域搜尋");
    expect(translateText("zh-TW", "Review Queue")).toBe("審查佇列");
    expect(translateText("zh-TW", "Next Actions")).toBe("下一步行動");
    expect(translateText("zh-TW", "Archived Items")).toBe("已封存項目");
    expect(translateText("zh-TW", "Restore Thought")).toBe("還原想法");
    expect(translateText("zh-TW", "Project List")).toBe("專案清單");
    expect(translateText("zh-TW", "Universe JSON copied")).toBe("宇宙 JSON 已複製。");
    expect(translateText("zh-TW", "{count} active projects", { count: 3 })).toBe("3 個進行中專案");
    expect(translateText("zh-TW", "Linked thoughts: {count}", { count: 2 })).toBe("已連結想法：2");
  });

  it("covers workflow center UI copy", () => {
    expect(translateText("zh-TW", "Next Action Center")).toBe("下一步行動中心");
    expect(translateText("zh-TW", "Global Search Center")).toBe("全域搜尋中心");
    expect(translateText("zh-TW", "Review Queue Center")).toBe("審查佇列中心");
    expect(translateText("zh-TW", "Thought Triage Center")).toBe("想法分流中心");
    expect(translateText("zh-TW", "Top Recommended Action")).toBe("首要建議行動");
    expect(translateText("zh-TW", "Search everything")).toBe("搜尋所有內容");
    expect(translateText("zh-TW", "Queue Items")).toBe("佇列項目");
    expect(translateText("zh-TW", "Triage Focus")).toBe("分流焦點");
    expect(translateText("zh-TW", "Next action settings saved.")).toBe("下一步行動設定已儲存。");
    expect(translateText("zh-TW", "{visible} visible, {dismissed} dismissed", {
      visible: 4,
      dismissed: 1
    })).toBe("顯示 4 筆，已忽略 1 筆");
    expect(translateText("en", "Thought Triage Center")).toBe("Thought Triage Center");
  });

  it("covers decision, blocking, and relationship UI copy", () => {
    expect(translateText("zh-TW", "Decision Records Center")).toBe("決策紀錄中心");
    expect(translateText("zh-TW", "Blocking Questions")).toBe("阻塞問題");
    expect(translateText("zh-TW", "Relationships")).toBe("關聯");
    expect(translateText("zh-TW", "Relationship Explorer")).toBe("關聯探索器");
    expect(translateText("zh-TW", "Create Decision Record")).toBe("建立決策紀錄");
    expect(translateText("zh-TW", "Decision Summary")).toBe("決策摘要");
    expect(translateText("zh-TW", "Not fully ready for engineering while core blocking decisions remain open.")).toBe(
      "核心阻塞決策仍待處理，尚未完全準備好進入工程。"
    );
    expect(translateText("zh-TW", "Impact: {impact}", { impact: "高" })).toBe("影響：高");
    expect(translateText("zh-TW", "Linked projects: {count}", { count: 2 })).toBe("已連結專案：2");
    expect(translateText("zh-TW", "blocks")).toBe("阻擋");
    expect(translateText("zh-TW", "decided")).toBe("已決定");
    expect(translateText("en", "Relationship Explorer")).toBe("Relationship Explorer");
  });

  it("covers AI, engineering, readiness, and architecture UI copy", () => {
    expect(translateText("zh-TW", "AI Panel")).toBe("AI 面板");
    expect(translateText("zh-TW", "Engineering Handoff Center")).toBe("工程交接中心");
    expect(translateText("zh-TW", "Engineering Readiness Center")).toBe("工程就緒度中心");
    expect(translateText("zh-TW", "Architecture / Health / Handoff Debug Panel")).toBe("架構狀態");
    expect(translateText("zh-TW", "Review & Health Drill-down")).toBe("審查健康度");
    expect(translateText("zh-TW", "Ready for Engineering")).toBe("可進入工程");
    expect(translateText("zh-TW", "Review Queue Signal")).toBe("審查佇列訊號");
    expect(translateText("zh-TW", "{count} major review blocker(s) detected.", { count: 2 })).toBe(
      "偵測到 2 個主要審查阻塞。"
    );
    expect(translateText("en", "AI Panel")).toBe("AI Panel");
  });

  it("reports missing required translation keys", () => {
    expect(missingRequiredUiTranslations(["Global Search", "Missing Phase 2A key"])).toEqual(["Missing Phase 2A key"]);
  });

  it("keeps English as the stable fallback language", () => {
    expect(translateText("en", "Universe Dashboard")).toBe("Universe Dashboard");
    expect(UI_LANGUAGE_STORAGE_KEY).toBe("todo-thought-universe:ui-language");
  });
});
