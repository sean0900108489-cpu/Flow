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

  it("keeps English as the stable fallback language", () => {
    expect(translateText("en", "Universe Dashboard")).toBe("Universe Dashboard");
    expect(UI_LANGUAGE_STORAGE_KEY).toBe("todo-thought-universe:ui-language");
  });
});
