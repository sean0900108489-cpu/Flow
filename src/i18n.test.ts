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

  it("reports missing required translation keys", () => {
    expect(missingRequiredUiTranslations(["Global Search", "Missing Phase 2A key"])).toEqual(["Missing Phase 2A key"]);
  });

  it("keeps English as the stable fallback language", () => {
    expect(translateText("en", "Universe Dashboard")).toBe("Universe Dashboard");
    expect(UI_LANGUAGE_STORAGE_KEY).toBe("todo-thought-universe:ui-language");
  });
});
