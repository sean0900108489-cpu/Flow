import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("dashboard renders core product areas", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Universe Dashboard" })).toBeVisible();
  await expect(page.getByText("我現在想做什麼？")).toBeVisible();
  await expect(page.locator("strong").filter({ hasText: "思想管理系統宇宙" })).toBeVisible();
  await expect(page.getByText("Todo Thought Universe MVP")).toBeVisible();
});

test("quick capture creates a thought and redirects to Thought Detail", async ({ page }) => {
  await page.getByRole("button", { name: "Quick Capture", exact: true }).click();

  await page.getByLabel("標題").fill("E2E 新增想法");
  await page.getByLabel("內容").fill("這是一個由 Playwright 自動建立的想法。");
  await page.getByLabel("類型").selectOption("task");
  await page.getByRole("button", { name: "儲存到 Inbox" }).click();

  await expect(page.getByRole("heading", { name: "Thought Detail", level: 1 })).toBeVisible();
  await expect(page.getByLabel("標題")).toHaveValue("E2E 新增想法");

  await page.getByLabel("Next Action / 下一步").fill("確認這個想法可以被保存與更新");
  await expect(page.getByLabel("Next Action / 下一步")).toHaveValue("確認這個想法可以被保存與更新");
});

test("project detail shows readiness and export generates EngineeringFlowInput", async ({ page }) => {
  await page.getByRole("button", { name: /Project Detail/ }).click();

  await expect(page.getByRole("heading", { name: "Project Detail", level: 1 })).toBeVisible();
  await expect(page.getByText(/工程準備度：100% · 可工程交接/)).toBeVisible();

  await page.getByRole("button", { name: /Engineering Export/ }).click();

  await expect(page.getByRole("heading", { name: "Engineering Handoff Export", level: 1 })).toBeVisible();
  await expect(page.getByText('"schemaVersion": "engineering-flow-input/v0"')).toBeVisible();
  await expect(page.getByText('"projectName": "Todo Thought Universe MVP"')).toBeVisible();
});

test("mock AI creates draft insight and can accept it", async ({ page }) => {
  await page.getByRole("button", { name: /AI Planning Panel/ }).click();

  await page.getByRole("button", { name: "分析目前 Project" }).click();

  await expect(page.getByText("project_readiness")).toBeVisible();
  await expect(page.getByText(/工程準備度：100%/)).toBeVisible();
  await expect(page.getByText("draft", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /接受/ }).click();

  await expect(page.getByText("accepted", { exact: true })).toBeVisible();
});

test("relationship page displays seeded relationship", async ({ page }) => {
  await page.getByRole("button", { name: /Relationships/ }).click();

  await expect(page.getByRole("heading", { name: "Relationships" })).toBeVisible();
  await expect(page.getByText("supports")).toBeVisible();
  await expect(page.getByText("AI 整理建議支援思想宇宙系統的核心體驗。")).toBeVisible();
});

test("app state transfer exports and imports full local state", async ({ page }) => {
  await page.getByRole("button", { name: /App State Transfer/ }).click();

  await expect(page.getByRole("heading", { name: "App State Transfer", level: 1 })).toBeVisible();
  await expect(page.getByText('"universes"')).toBeVisible();
  await expect(page.getByText('"thoughts"')).toBeVisible();
  await expect(page.getByText('"projects"')).toBeVisible();

  const importedState = {
    universes: [
      {
        id: "u-imported",
        name: "匯入宇宙",
        description: "由 E2E 匯入",
        purpose: "驗證完整 App State 匯入",
        focus: "main"
      }
    ],
    thoughts: [
      {
        id: "t-imported",
        title: "匯入想法",
        content: "這是匯入的完整狀態。",
        type: "note",
        status: "active",
        universeId: "u-imported",
        why: "驗證匯入",
        outcome: "匯入後 dashboard 可見",
        nextAction: "確認畫面顯示匯入資料",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      }
    ],
    projects: [
      {
        id: "p-imported",
        universeId: "u-imported",
        name: "匯入專案",
        intent: "驗證匯入專案",
        users: ["Tester"],
        features: ["Import"],
        screens: ["Transfer"],
        dataObjects: ["AppState"],
        flowSteps: ["Paste JSON", "Import"],
        unknowns: [],
        nextAction: "Run e2e",
        readiness: "ready_for_engineering",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      }
    ],
    relationships: [],
    aiInsights: []
  };

  await page.getByLabel("匯入 App State JSON").fill(JSON.stringify(importedState, null, 2));
  await page.getByRole("button", { name: "匯入並覆蓋目前資料" }).click();

  await expect(page.getByRole("heading", { name: "Universe Dashboard" })).toBeVisible();
  await expect(page.locator(".card strong", { hasText: "匯入宇宙" })).toBeVisible();
  await expect(page.locator(".item strong", { hasText: "匯入專案" })).toBeVisible();
  await expect(page.locator(".item strong", { hasText: "匯入想法" }).first()).toBeVisible();
});
