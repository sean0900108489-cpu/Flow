import { expect, test, type Page } from "@playwright/test";
import type { AppState, Project, Relationship } from "../src/domain/types";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

async function createThought(page: Page, title: string, type = "note", universeName?: string) {
  await page.getByRole("button", { name: "Quick Capture", exact: true }).click();
  const capture = page.locator("section.panel.form").filter({ has: page.getByRole("heading", { name: "快速捕捉想法" }) });

  await capture.getByLabel("標題").fill(title);
  await capture.getByLabel("內容").fill(`${title} content`);
  await capture.getByLabel("類型").selectOption(type);
  if (universeName) {
    await capture.locator("select").last().selectOption({ label: universeName });
  }
  await capture.getByRole("button", { name: "儲存到 Inbox" }).click();
}

async function createUniverse(page: Page, name: string, description = "Personal body and energy system") {
  await page.getByRole("button", { name: "Universes" }).click();
  const createCard = page.locator(".card").filter({ has: page.getByRole("heading", { name: "Create Universe" }) });

  await createCard.getByLabel("Name").fill(name);
  await createCard.getByLabel("Description").fill(description);
  await createCard.getByRole("button", { name: "Create Universe" }).click();
}

function universeCard(page: Page, name: string) {
  return page.locator(".card").filter({ has: page.locator("strong", { hasText: name }) });
}

async function loadAppState(page: Page, state: AppState) {
  await page.evaluate((nextState) => {
    localStorage.setItem("todo-thought-universe:v1", JSON.stringify(nextState));
  }, state);
  await page.reload();
}

function handoffProject(patch: Partial<Project> = {}): Project {
  return {
    id: "p-handoff",
    sourceThoughtId: "t-handoff",
    universeId: "u-handoff",
    status: "active",
    name: "Ready Handoff Project",
    intent: "A project with enough structure for engineering handoff.",
    users: ["Tester"],
    features: ["Handoff"],
    screens: ["Handoff Center"],
    dataObjects: ["Project"],
    flowSteps: ["Review readiness", "Export JSON"],
    unknowns: [],
    nextAction: "Send project to engineering.",
    readiness: "ready_for_engineering",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...patch
  };
}

function handoffState(projectPatch: Partial<Project> = {}, relationships: Relationship[] = []): AppState {
  const project = handoffProject(projectPatch);

  return {
    universes: [
      {
        id: "u-handoff",
        name: "Handoff Universe",
        description: "Universe for handoff testing",
        purpose: "Validate engineering handoff",
        focus: "main"
      }
    ],
    thoughts: [
      {
        id: "t-handoff",
        title: "Handoff thought",
        content: "Linked thought context for engineering handoff.",
        type: "project",
        status: "active",
        universeId: "u-handoff",
        why: "It should be ready to hand off.",
        outcome: "A valid handoff package.",
        nextAction: "Send project to engineering.",
        projectId: project.id,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      }
    ],
    projects: [project],
    relationships,
    aiInsights: []
  };
}

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

test("engineering handoff screen loads", async ({ page }) => {
  await page.getByRole("button", { name: "Engineering Handoff" }).click();

  await expect(page.getByRole("heading", { name: "Engineering Handoff Center", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ready for handoff" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Needs clarification" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Blocked" })).toBeVisible();
});

test("ready project can be marked handoff ready", async ({ page }) => {
  await loadAppState(page, handoffState());
  await page.getByRole("button", { name: "Engineering Handoff" }).click();

  const card = page.locator(".handoff-card").filter({ hasText: "Ready Handoff Project" });
  await expect(card).toBeVisible();

  await card.getByRole("button", { name: "Mark Handoff Ready" }).click();

  await expect(page.getByText("Project marked handoff_ready")).toBeVisible();
  await expect(card.getByText("lifecycle handoff_ready")).toBeVisible();
});

test("not ready project cannot be marked", async ({ page }) => {
  await loadAppState(page, handoffState({ nextAction: "" }));
  await page.getByRole("button", { name: "Engineering Handoff" }).click();

  const card = page.locator(".handoff-card").filter({ hasText: "Ready Handoff Project" });

  await expect(card.getByText("needs clarification")).toBeVisible();
  await expect(card.getByRole("button", { name: "Mark Handoff Ready" })).toBeDisabled();
});

test("copy handoff JSON shows copied state and preview", async ({ page }) => {
  await loadAppState(page, handoffState());
  await page.getByRole("button", { name: "Engineering Handoff" }).click();

  const card = page.locator(".handoff-card").filter({ hasText: "Ready Handoff Project" });
  await card.getByRole("button", { name: "Copy Handoff JSON" }).click();

  await expect(page.getByText("Handoff JSON copied")).toBeVisible();
  await expect(page.locator("pre.json").first()).toContainText("EngineeringFlowInput");
});

test("blocking relationship makes project blocked", async ({ page }) => {
  await loadAppState(
    page,
    handoffState(
      {},
      [
        {
          id: "r-block-handoff",
          sourceId: "t-handoff",
          targetId: "p-handoff",
          type: "blocks",
          description: "Missing final decision blocks engineering."
        }
      ]
    )
  );
  await page.getByRole("button", { name: "Engineering Handoff" }).click();

  const blocked = page.locator("section.panel").filter({ has: page.getByRole("heading", { name: "Blocked" }) });

  await expect(blocked.locator(".handoff-card").filter({ hasText: "Ready Handoff Project" })).toBeVisible();
  await expect(blocked.getByText("blocked", { exact: true })).toBeVisible();
});

test("archived thought can be restored to inbox", async ({ page }) => {
  await page.getByRole("button", { name: "Quick Capture", exact: true }).click();

  await page.getByLabel("標題").fill("Restorable archived thought");
  await page.getByLabel("內容").fill("This thought should leave archive when restored.");
  await page.getByLabel("類型").selectOption("task");
  await page.getByRole("button", { name: "儲存到 Inbox" }).click();

  await page.getByRole("button", { name: "Archive Thought" }).click();
  await page.getByRole("button", { name: "Archived Items" }).click();

  await expect(page.getByRole("heading", { name: "Archived Items", level: 1 })).toBeVisible();
  await expect(page.getByText("Restorable archived thought")).toBeVisible();

  await page.getByRole("button", { name: "Restore Thought" }).click();
  await expect(page.locator("main > section").first().getByText("Restorable archived thought")).toHaveCount(0);

  await page.getByRole("button", { name: "Idea Inbox" }).click();
  const inboxList = page.locator("main > div.panel").first();
  await expect(inboxList.locator(".item strong", { hasText: "Restorable archived thought" })).toBeVisible();
});

test("archived project can be restored to active dashboard projects", async ({ page }) => {
  await page.getByRole("button", { name: /Project Detail/ }).click();
  await page.getByRole("button", { name: "Archive Project" }).click();
  await page.getByRole("button", { name: "Archived Items" }).click();

  await expect(page.getByRole("heading", { name: "Archived Items", level: 1 })).toBeVisible();
  await expect(page.getByText("Todo Thought Universe MVP")).toBeVisible();

  await page.getByRole("button", { name: "Restore Project" }).click();
  await expect(page.locator("main > section").first().getByText("Todo Thought Universe MVP")).toHaveCount(0);

  await page.getByRole("button", { name: "Dashboard" }).click();
  const projectsPanel = page.locator(".panel").filter({ has: page.getByRole("heading", { name: "Projects" }) });
  await expect(projectsPanel.getByText("Todo Thought Universe MVP")).toBeVisible();
});

test("archived thought can be deleted from archived items", async ({ page }) => {
  await page.getByRole("button", { name: "Quick Capture", exact: true }).click();

  await page.getByLabel("標題").fill("Delete archived thought");
  await page.getByLabel("內容").fill("This archived thought should be deleted.");
  await page.getByLabel("類型").selectOption("note");
  await page.getByRole("button", { name: "儲存到 Inbox" }).click();

  await page.getByRole("button", { name: "Archive Thought" }).click();
  await page.getByRole("button", { name: "Archived Items" }).click();
  await expect(page.getByText("Delete archived thought")).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete Thought" }).click();

  await expect(page.getByText("Delete archived thought")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Archived Items", level: 1 })).toBeVisible();
});

test("thought search filters the idea inbox", async ({ page }) => {
  await createThought(page, "Alpha search thought", "note");
  await createThought(page, "Beta search thought", "note");

  await page.getByRole("button", { name: "Idea Inbox" }).click();
  const inbox = page.locator("main > div.panel").first();

  await inbox.getByLabel("Search").fill("Alpha");

  await expect(inbox.locator(".item strong", { hasText: "Alpha search thought" })).toBeVisible();
  await expect(inbox.locator(".item strong", { hasText: "Beta search thought" })).toHaveCount(0);
});

test("thought type filter narrows the idea inbox", async ({ page }) => {
  await createThought(page, "Task type filter thought", "task");
  await createThought(page, "Note type filter thought", "note");

  await page.getByRole("button", { name: "Idea Inbox" }).click();
  const inbox = page.locator("main > div.panel").first();

  await inbox.getByLabel("Search").fill("type filter");
  await inbox.getByLabel("Type").selectOption("task");

  await expect(inbox.locator(".item strong", { hasText: "Task type filter thought" })).toBeVisible();
  await expect(inbox.locator(".item strong", { hasText: "Note type filter thought" })).toHaveCount(0);
});

test("thought sort title ascending orders visible results", async ({ page }) => {
  await createThought(page, "Zebra sort thought", "note");
  await createThought(page, "Apple sort thought", "note");

  await page.getByRole("button", { name: "Idea Inbox" }).click();
  const inbox = page.locator("main > div.panel").first();

  await inbox.getByLabel("Search").fill("sort thought");
  await inbox.getByLabel("Sort").selectOption("title_asc");

  await expect(inbox.locator(".item strong").first()).toHaveText("Apple sort thought");
});

test("archived items search filters archived thoughts", async ({ page }) => {
  await createThought(page, "Archived searchable thought", "note");
  await page.getByRole("button", { name: "Archive Thought" }).click();

  await page.getByRole("button", { name: "Archived Items" }).click();
  const archivedThoughts = page.locator(".panel").filter({ has: page.getByRole("heading", { name: "Archived Thoughts" }) });

  await archivedThoughts.getByLabel("Search").fill("archived searchable");
  await expect(archivedThoughts.getByText("Archived searchable thought")).toBeVisible();

  await archivedThoughts.getByLabel("Search").fill("nonsense");
  await expect(archivedThoughts.getByText("Archived searchable thought")).toHaveCount(0);
});

test("create universe adds it to universe management", async ({ page }) => {
  await createUniverse(page, "Health Universe");

  await expect(page.getByRole("heading", { name: "Universe Management", level: 1 })).toBeVisible();
  await expect(universeCard(page, "Health Universe")).toBeVisible();
  await expect(universeCard(page, "Health Universe").locator("p", { hasText: "Personal body and energy system" })).toBeVisible();
});

test("edit universe updates its displayed name", async ({ page }) => {
  await createUniverse(page, "Health Universe");
  const card = universeCard(page, "Health Universe");

  await card.getByLabel("Name").fill("Health Universe Updated");
  await card.getByRole("button", { name: "Save" }).click();

  await expect(universeCard(page, "Health Universe Updated")).toBeVisible();
});

test("archive and restore universe updates its status", async ({ page }) => {
  await createUniverse(page, "Health Universe");
  const card = universeCard(page, "Health Universe");

  await card.getByRole("button", { name: "Archive" }).click();
  await expect(card.getByText("archived", { exact: true })).toBeVisible();

  await card.getByRole("button", { name: "Restore" }).click();
  await expect(card.getByText("active", { exact: true })).toBeVisible();
});

test("delete unused universe removes it", async ({ page }) => {
  await createUniverse(page, "Unused Delete Universe");
  const card = universeCard(page, "Unused Delete Universe");

  page.once("dialog", (dialog) => dialog.accept());
  await card.getByRole("button", { name: "Delete", exact: true }).click();

  await expect(universeCard(page, "Unused Delete Universe")).toHaveCount(0);
});

test("delete in-use universe is blocked", async ({ page }) => {
  await createUniverse(page, "Used Blocked Universe");
  await createThought(page, "Thought linked to blocked universe", "note", "Used Blocked Universe");

  await page.getByRole("button", { name: "Universes" }).click();
  const card = universeCard(page, "Used Blocked Universe");

  page.once("dialog", (dialog) => dialog.accept());
  await card.getByRole("button", { name: "Delete", exact: true }).click();

  await expect(page.getByText("Cannot delete universe while it is in use.")).toBeVisible();
  await expect(card).toBeVisible();
});

test("detach and delete in-use universe clears linked thought universe", async ({ page }) => {
  await createUniverse(page, "Detach Delete Universe");
  await createThought(page, "Thought linked to detachable universe", "note", "Detach Delete Universe");

  await page.getByRole("button", { name: "Universes" }).click();
  const card = universeCard(page, "Detach Delete Universe");

  page.once("dialog", (dialog) => dialog.accept());
  await card.getByRole("button", { name: "Detach and Delete" }).click();

  await expect(universeCard(page, "Detach Delete Universe")).toHaveCount(0);

  await page.getByRole("button", { name: "Idea Inbox" }).click();
  const inbox = page.locator("main > div.panel").first();
  await inbox.locator(".item", { hasText: "Thought linked to detachable universe" }).click();

  await expect(page.getByRole("heading", { name: "Thought Detail", level: 1 })).toBeVisible();
  const detail = page.locator("section.panel.form").filter({ has: page.getByRole("heading", { name: "Thought Detail" }) });
  await expect(detail.locator("select").last()).toHaveValue("");
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
