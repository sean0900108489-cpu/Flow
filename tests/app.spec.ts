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

test("thought archive hides thought from active dashboard list", async ({ page }) => {
  await page.getByRole("button", { name: "Quick Capture", exact: true }).click();

  await page.getByLabel("標題").fill("E2E 封存想法");
  await page.getByLabel("內容").fill("這個想法會先變成 active，再被封存。");
  await page.getByLabel("類型").selectOption("task");
  await page.getByRole("button", { name: "儲存到 Inbox" }).click();

  await page.getByLabel("狀態").selectOption("active");
  await page.getByRole("button", { name: "Archive Thought" }).click();

  await expect(page.getByRole("heading", { name: "Universe Dashboard", level: 1 })).toBeVisible();
  const nextActions = page.locator(".panel").filter({ has: page.getByRole("heading", { name: "目前下一步" }) });
  await expect(nextActions.getByText("E2E 封存想法")).toHaveCount(0);
});

test("thought delete removes thought and related UI stays stable", async ({ page }) => {
  await page.getByRole("button", { name: "Quick Capture", exact: true }).click();

  await page.getByLabel("標題").fill("E2E 刪除想法");
  await page.getByLabel("內容").fill("這個想法會被刪除。");
  await page.getByLabel("類型").selectOption("note");
  await page.getByRole("button", { name: "儲存到 Inbox" }).click();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete Thought" }).click();

  await expect(page.getByRole("heading", { name: "Universe Dashboard", level: 1 })).toBeVisible();
  await expect(page.getByText("E2E 刪除想法")).toHaveCount(0);
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

test("project archive hides project from dashboard project list", async ({ page }) => {
  await page.getByRole("button", { name: /Project Detail/ }).click();

  await page.getByRole("button", { name: "Archive Project" }).click();

  await expect(page.getByRole("heading", { name: "Universe Dashboard", level: 1 })).toBeVisible();
  const projectsPanel = page.locator(".panel").filter({ has: page.getByRole("heading", { name: "Projects" }) });
  await expect(projectsPanel.getByText("Todo Thought Universe MVP")).toHaveCount(0);
});

test("project delete removes project without deleting linked thought", async ({ page }) => {
  await page.getByRole("button", { name: /Project Detail/ }).click();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete Project" }).click();

  await expect(page.getByRole("heading", { name: "Universe Dashboard", level: 1 })).toBeVisible();
  const projectsPanel = page.locator(".panel").filter({ has: page.getByRole("heading", { name: "Projects" }) });
  await expect(projectsPanel.getByText("Todo Thought Universe MVP")).toHaveCount(0);
  await expect(page.locator("strong", { hasText: "做一個不是普通 todo list 的思想宇宙網站" }).first()).toBeVisible();
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

test("AI patch proposal applies to thought only after accept", async ({ page }) => {
  await page.getByRole("button", { name: "Quick Capture", exact: true }).click();

  await page.getByLabel("標題").fill("E2E AI patch project idea");
  await page.getByLabel("內容").fill("Build an app for structured planning.");
  await page.getByLabel("類型").selectOption("inspiration");
  await page.getByRole("button", { name: "儲存到 Inbox" }).click();

  await page.getByRole("button", { name: /AI Planning Panel/ }).click();
  await page.getByRole("button", { name: "分析目前 Thought" }).click();

  await expect(page.getByText("classification")).toBeVisible();
  await expect(page.getByText("Proposed changes")).toBeVisible();
  await expect(page.getByText('thought.nextAction: "Define the first concrete engineering step."')).toBeVisible();

  await page.getByRole("button", { name: /接受/ }).click();
  await page.getByRole("button", { name: "Thought Detail", exact: true }).click();

  await expect(page.getByLabel("Next Action / 下一步")).toHaveValue("Define the first concrete engineering step.");
  await expect(page.getByLabel("Why / 原因")).toHaveValue("Clarify why this matters before execution.");
  await expect(page.getByLabel("Desired Outcome / 想達成什麼")).toHaveValue("Define what success looks like.");
});

test("rejecting AI patch proposal does not apply thought changes", async ({ page }) => {
  await page.getByRole("button", { name: "Quick Capture", exact: true }).click();

  await page.getByLabel("標題").fill("E2E reject AI patch idea");
  await page.getByLabel("內容").fill("Build an app that should stay unchanged after reject.");
  await page.getByLabel("類型").selectOption("inspiration");
  await page.getByRole("button", { name: "儲存到 Inbox" }).click();

  await page.getByRole("button", { name: /AI Planning Panel/ }).click();
  await page.getByRole("button", { name: "分析目前 Thought" }).click();

  await expect(page.getByText("Proposed changes")).toBeVisible();
  await page.getByRole("button", { name: /拒絕/ }).click();
  await expect(page.getByText("rejected", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Thought Detail", exact: true }).click();

  await expect(page.getByLabel("Next Action / 下一步")).toHaveValue("");
  await expect(page.getByLabel("Why / 原因")).toHaveValue("");
  await expect(page.getByLabel("Desired Outcome / 想達成什麼")).toHaveValue("");
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
        status: "active",
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
