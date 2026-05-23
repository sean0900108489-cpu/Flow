import { expect, test, type Page } from "@playwright/test";
import type { AppState, Project, Relationship } from "../src/domain/types";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

async function createThought(page: Page, title: string, type = "note", universeName?: string) {
  await page.getByRole("button", { name: "Quick Capture", exact: true }).click();
  const capture = page.locator("section.panel.form").filter({ has: page.getByRole("heading", { name: "Quick Capture" }) });

  await capture.getByLabel("Title").fill(title);
  await capture.getByLabel("Content").fill(`${title} content`);
  await capture.locator("select").first().selectOption(type);
  if (universeName) {
    await capture.locator("select").last().selectOption({ label: universeName });
  }
  await capture.getByRole("button", { name: "Save to Inbox" }).click();
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

function blockingQuestionCard(page: Page, question: string) {
  return page.locator(".blocking-question-card").filter({ hasText: question });
}

function decisionRecordCard(page: Page, title: string) {
  return page.locator(".decision-record-card").filter({ hasText: title });
}

function relationshipExplorerCard(page: Page, title: string) {
  return page.locator(".relationship-explorer-card").filter({ hasText: title });
}

function projectCard(page: Page, title: string) {
  return page.locator(".project-card").filter({ hasText: title });
}

function nextActionCard(page: Page, title: string) {
  return page.locator(".next-action-card").filter({ hasText: title });
}

function triageCard(page: Page, title: string) {
  return page.locator(".triage-card").filter({ hasText: title });
}

function globalSearchResultCard(page: Page, title: string) {
  return page.locator(".global-search-result-card").filter({ hasText: title });
}

function reviewQueueCard(page: Page, title: string) {
  return page.locator(".review-queue-card").filter({ hasText: title });
}

async function loadAppState(page: Page, state: AppState) {
  await page.evaluate((nextState) => {
    localStorage.setItem("todo-thought-universe:v1", JSON.stringify(nextState));
  }, state);
  await page.reload();
}

async function createDecisionRecord(page: Page, title: string, decision = "Keep TodoItem for now.") {
  await page.getByRole("button", { name: "Decision Records", exact: true }).click();
  const form = page.getByTestId("create-decision-form");

  await form.getByLabel("Title").fill(title);
  await form.getByLabel("Decision").fill(decision);
  await form.getByLabel("Rationale").fill("The decision keeps product and architecture tradeoffs explicit.");
  await form.getByLabel("Consequences").fill("Future work can revisit the boundary deliberately.");
  await form.getByRole("button", { name: "Create Decision Record" }).click();
}

async function createProject(
  page: Page,
  title: string,
  description = "Project created for relationship explorer",
  nextAction = `Start ${title}`
) {
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  const form = page.locator("section.panel.form").filter({ has: page.getByRole("heading", { name: "Create Project" }) });

  await form.getByLabel("Title").fill(title);
  await form.getByLabel("Description").fill(description);
  await form.getByLabel("Next Action").fill(nextAction);
  await form.getByRole("button", { name: "Create Project" }).click();
}

async function createExplorerRelationship(
  page: Page,
  input: {
    sourceTitle: string;
    targetTitle: string;
    type: "related_to" | "belongs_to" | "depends_on" | "supports" | "blocks" | "evolves_into";
    description: string;
  }
) {
  await page.getByRole("button", { name: "Relationship Explorer" }).click();

  await page.getByLabel("Source type", { exact: true }).selectOption("thought");
  await page.getByLabel("Source", { exact: true }).selectOption({ label: input.sourceTitle });
  await page.getByLabel("Relationship type", { exact: true }).selectOption(input.type);
  await page.getByLabel("Target type", { exact: true }).selectOption("project");
  await page.getByLabel("Target", { exact: true }).selectOption({ label: input.targetTitle });
  await page.getByLabel("Description", { exact: true }).fill(input.description);
  await page.getByRole("button", { name: "Create Relationship" }).click();
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
  await expect(page.getByText("What do I want to do now?")).toBeVisible();
  await expect(page.locator("strong").filter({ hasText: "思想管理系統宇宙" })).toBeVisible();
  await expect(page.getByText("Todo Thought Universe MVP").first()).toBeVisible();
});

test("language toggle switches visible shell UI without mutating app state", async ({ page }) => {
  await page.getByRole("button", { name: "繁中" }).click();
  const main = page.getByRole("main");

  await expect(main.getByRole("heading", { name: "宇宙儀表板" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "全域搜尋" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "審查佇列" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "下一步行動" })).toBeVisible();
  await expect(page.getByText("我現在想做什麼？")).toBeVisible();
  await expect(page.getByPlaceholder("搜尋想法")).toBeVisible();
  await expect(page.getByRole("button", { name: "快速捕捉" })).toBeVisible();
  await expect(page.getByRole("button", { name: "EN" })).toHaveAttribute("aria-pressed", "false");

  await page.getByRole("button", { name: "專案", exact: true }).click();
  await expect(main.getByRole("heading", { name: "建立專案" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "專案清單" })).toBeVisible();

  await page.getByRole("button", { name: "宇宙", exact: true }).click();
  await expect(main.getByRole("heading", { name: "宇宙管理", level: 2 })).toBeVisible();
  await expect(main.getByRole("heading", { name: "建立宇宙" })).toBeVisible();

  await page.getByRole("button", { name: "下一步行動", exact: true }).click();
  await expect(main.getByRole("heading", { name: "下一步行動中心", level: 2 })).toBeVisible();
  await expect(main.getByRole("heading", { name: "系統訊號摘要" })).toBeVisible();

  await page.getByRole("button", { name: "全域搜尋", exact: true }).click();
  await expect(main.getByRole("heading", { name: "全域搜尋中心", level: 2 })).toBeVisible();
  await expect(page.getByPlaceholder("搜尋所有內容")).toBeVisible();

  await page.getByRole("button", { name: "審查佇列", exact: true }).click();
  await expect(main.getByRole("heading", { name: "審查佇列中心", level: 2 })).toBeVisible();
  await expect(main.getByText("待處理總數", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "想法分流", exact: true }).click();
  await expect(main.getByRole("heading", { name: "想法分流中心", level: 2 })).toBeVisible();
  await expect(main.getByText("收件匣想法", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "阻塞問題", exact: true }).click();
  await expect(main.getByRole("heading", { name: "決策中心", level: 2 })).toBeVisible();
  await expect(main.getByRole("heading", { name: "決策摘要" })).toBeVisible();

  await page.getByRole("button", { name: "決策紀錄", exact: true }).click();
  await expect(main.getByRole("heading", { name: "決策紀錄中心", level: 2 })).toBeVisible();
  await expect(main.getByText("提議中的決策", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "關聯", exact: true }).click();
  await expect(main.getByRole("heading", { name: "關聯", level: 2 })).toBeVisible();
  await expect(main.getByRole("button", { name: "開啟關聯探索器" })).toBeVisible();

  await page.getByRole("button", { name: "關聯探索器", exact: true }).click();
  await expect(main.getByRole("heading", { name: "關聯探索器", level: 2 })).toBeVisible();
  await expect(main.getByRole("heading", { name: "影響地圖" })).toBeVisible();

  await expect.poll(
    () => page.evaluate(() => localStorage.getItem("todo-thought-universe:ui-language"))
  ).toBe("zh-TW");

  const appStateJson = await page.evaluate(() => localStorage.getItem("todo-thought-universe:v1"));
  expect(appStateJson ?? "").not.toContain("zh-TW");

  await page.getByRole("button", { name: "儀表板", exact: true }).click();
  await page.getByRole("button", { name: "EN" }).click();
  await expect(main.getByRole("heading", { name: "Universe Dashboard" })).toBeVisible();
});

test("quick capture creates a thought and redirects to Thought Detail", async ({ page }) => {
  await page.getByRole("button", { name: "Quick Capture", exact: true }).click();

  await page.getByLabel("Title").fill("E2E 新增想法");
  await page.getByLabel("Content").fill("這是一個由 Playwright 自動建立的想法。");
  await page.locator("section.panel.form select").first().selectOption("task");
  await page.getByRole("button", { name: "Save to Inbox" }).click();

  await expect(page.getByRole("heading", { name: "Thought Detail", level: 1 })).toBeVisible();
  await expect(page.getByLabel("標題")).toHaveValue("E2E 新增想法");

  await page.getByLabel("Next Action / 下一步").fill("確認這個想法可以被保存與更新");
  await expect(page.getByLabel("Next Action / 下一步")).toHaveValue("確認這個想法可以被保存與更新");
});

test("thought archive hides thought from active dashboard list", async ({ page }) => {
  await page.getByRole("button", { name: "Quick Capture", exact: true }).click();

  await page.getByLabel("Title").fill("E2E 封存想法");
  await page.getByLabel("Content").fill("這個想法會先變成 active，再被封存。");
  await page.locator("section.panel.form select").first().selectOption("task");
  await page.getByRole("button", { name: "Save to Inbox" }).click();

  await page.getByLabel("狀態").selectOption("active");
  await page.getByRole("button", { name: "Archive Thought" }).click();

  await expect(page.getByRole("heading", { name: "Universe Dashboard", level: 1 })).toBeVisible();
  const nextActions = page.locator(".panel").filter({ has: page.getByRole("heading", { name: "Current next steps" }) });
  await expect(nextActions.getByText("E2E 封存想法")).toHaveCount(0);
});

test("thought delete removes thought and related UI stays stable", async ({ page }) => {
  await page.getByRole("button", { name: "Quick Capture", exact: true }).click();

  await page.getByLabel("Title").fill("E2E 刪除想法");
  await page.getByLabel("Content").fill("這個想法會被刪除。");
  await page.locator("section.panel.form select").first().selectOption("note");
  await page.getByRole("button", { name: "Save to Inbox" }).click();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete Thought" }).click();

  await expect(page.getByRole("heading", { name: "Universe Dashboard", level: 1 })).toBeVisible();
  await expect(page.getByText("E2E 刪除想法")).toHaveCount(0);
});

test("project detail shows readiness and export generates EngineeringFlowInput", async ({ page }) => {
  await page.getByRole("button", { name: /Project Detail/ }).click();

  await expect(page.getByRole("heading", { name: "Project Detail", level: 1 })).toBeVisible();
  await expect(page.getByText(/工程準備度：100% · 可工程交接/)).toBeVisible();
  await expect(page.getByLabel("Lifecycle").locator("option", { hasText: "handoff_ready" })).toHaveCount(0);

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

test("promote thought to project creates a linked project", async ({ page }) => {
  await createThought(page, "Promote me into project", "task");

  await page.getByLabel("Next Action / 下一步").fill("Define first project milestone");
  await page.getByRole("button", { name: "Promote to Project" }).click();

  await expect(page.getByRole("heading", { name: "Project Detail", level: 1 })).toBeVisible();
  const detail = page.locator("section.panel.form").filter({ has: page.getByRole("heading", { name: "Project Detail" }) });

  await expect(detail.getByLabel("Title")).toHaveValue("Promote me into project");
  await expect(detail.locator(".mini-list").filter({ hasText: "Linked Thoughts" }).getByText("Promote me into project")).toBeVisible();
});

test("create project from projects screen", async ({ page }) => {
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  const form = page.locator("section.panel.form").filter({ has: page.getByRole("heading", { name: "Create Project" }) });

  await form.getByLabel("Title").fill("New independent project");
  await form.getByLabel("Description").fill("Project created without initial thought");
  await form.getByLabel("Next Action").fill("Write implementation outline");
  await form.getByRole("button", { name: "Create Project" }).click();

  const card = projectCard(page, "New independent project");

  await expect(card).toBeVisible();
  await expect(card.getByText("Write implementation outline")).toBeVisible();

  await card.getByRole("button", { name: "View Project" }).click();

  const detail = page.locator("section.panel.form").filter({ has: page.getByRole("heading", { name: "Project Detail" }) });
  await expect(detail.getByLabel("Title")).toHaveValue("New independent project");
  await expect(detail.getByLabel("Description")).toHaveValue("Project created without initial thought");
  await expect(detail.getByLabel("Next Action")).toHaveValue("Write implementation outline");
});

test("edit project details with save", async ({ page }) => {
  await page.getByRole("button", { name: "Project Detail", exact: true }).click();
  const detail = page.locator("section.panel.form").filter({ has: page.getByRole("heading", { name: "Project Detail" }) });

  await detail.getByLabel("Title").fill("Updated project title");
  await detail.getByLabel("Next Action").fill("Updated project next action");
  await detail.getByRole("button", { name: "Save Project" }).click();

  await expect(page.getByText("Project saved.")).toBeVisible();
  await expect(detail.getByLabel("Title")).toHaveValue("Updated project title");
  await expect(detail.getByLabel("Next Action")).toHaveValue("Updated project next action");
});

test("promoted project appears in engineering handoff", async ({ page }) => {
  await createThought(page, "Handoff promoted project", "task");
  await page.getByRole("button", { name: "Promote to Project" }).click();
  await page.getByRole("button", { name: "Engineering Handoff" }).click();

  await expect(page.locator(".handoff-card").filter({ hasText: "Handoff promoted project" })).toBeVisible();
});

test("project detail shows linked thoughts imported with app state", async ({ page }) => {
  await loadAppState(page, {
    universes: [
      {
        id: "u-linked",
        name: "Linked Import Universe",
        description: "Imported universe",
        purpose: "Validate linked project import",
        focus: "main"
      }
    ],
    thoughts: [
      {
        id: "t-linked",
        title: "Linked imported thought",
        content: "Thought imported with project link.",
        type: "project",
        status: "active",
        universeId: "u-linked",
        why: "Validate linkedThoughtIds",
        outcome: "Project detail shows the link",
        nextAction: "Open project detail",
        projectId: "p-linked",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      }
    ],
    projects: [
      {
        id: "p-linked",
        linkedThoughtIds: ["t-linked"],
        universeId: "u-linked",
        status: "active",
        name: "Imported linked project",
        intent: "Project imported with linked thoughts.",
        users: ["Tester"],
        features: ["Linked import"],
        screens: ["Project Detail"],
        dataObjects: ["Project", "ThoughtItem"],
        flowSteps: ["Import", "View project"],
        unknowns: [],
        nextAction: "Verify linked thought display",
        readiness: "ready_for_engineering",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      }
    ],
    relationships: [],
    aiInsights: []
  });

  await page.getByRole("button", { name: "Project Detail", exact: true }).click();
  const detail = page.locator("section.panel.form").filter({ has: page.getByRole("heading", { name: "Project Detail" }) });

  await expect(detail.getByLabel("Title")).toHaveValue("Imported linked project");
  await expect(detail.locator(".mini-list").filter({ hasText: "Linked Thoughts" }).getByText("Linked imported thought")).toBeVisible();
});

test("next action center screen loads", async ({ page }) => {
  await page.getByRole("button", { name: "Next Actions" }).click();

  await expect(page.getByRole("heading", { name: "Next Action Center", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Top Recommended Action" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recommended Actions List" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "System Signals Summary" })).toBeVisible();
});

test("thought triage center screen loads", async ({ page }) => {
  await page.getByRole("button", { name: "Thought Triage" }).click();

  await expect(page.getByRole("heading", { name: "Thought Triage Center", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Triage Focus" })).toBeVisible();
  await expect(page.getByText("Inbox thoughts", { exact: true })).toBeVisible();
});

test("triage thought saves context and moves it to active", async ({ page }) => {
  await createThought(page, "Triage center thought", "note");
  await page.getByRole("button", { name: "Thought Triage" }).click();

  const card = triageCard(page, "Triage center thought");

  await expect(card).toBeVisible();
  await expect(card.getByText("Needs context")).toBeVisible();

  await card.getByLabel("Triage type").selectOption("task");
  await card.getByLabel("Triage why").fill("This thought should become executable.");
  await card.getByLabel("Triage outcome").fill("A clear active task.");
  await card.getByLabel("Triage next action").fill("Start the triaged task.");
  await card.getByRole("button", { name: "Save Triage" }).click();

  await expect(card.getByText("Ready")).toBeVisible();
  await card.getByRole("button", { name: "Mark Triaged" }).click();

  await expect(triageCard(page, "Triage center thought")).toHaveCount(0);

  await page.getByRole("button", { name: "Thought Detail", exact: true }).click();
  await expect(page.getByLabel("狀態")).toHaveValue("active");
  await expect(page.getByLabel("Next Action / 下一步")).toHaveValue("Start the triaged task.");
});

test("triage center can promote an inbox thought to project", async ({ page }) => {
  await createThought(page, "Triage promoted project", "task");
  await page.getByRole("button", { name: "Thought Triage" }).click();

  await triageCard(page, "Triage promoted project").getByRole("button", { name: "Promote to Project" }).click();

  await expect(page.getByRole("heading", { name: "Project Detail", level: 1 })).toBeVisible();
  const detail = page.locator("section.panel.form").filter({ has: page.getByRole("heading", { name: "Project Detail" }) });
  await expect(detail.getByLabel("Title")).toHaveValue("Triage promoted project");
});

test("thought next action appears in next action center", async ({ page }) => {
  await createThought(page, "Thought with next action", "task");
  await page.getByLabel("Next Action / 下一步").fill("Do the first thought step");
  await page.getByRole("button", { name: "Next Actions" }).click();

  const card = nextActionCard(page, "Thought with next action");

  await expect(card).toBeVisible();
  await expect(card.getByText("Do the first thought step")).toBeVisible();
});

test("next action center saves note, pins focus, dismisses actions, and survives reload", async ({ page }) => {
  await createThought(page, "Persistent next action", "task");
  await page.getByLabel("Next Action / 下一步").fill("Persist this thought action");
  await page.getByRole("button", { name: "Next Actions" }).click();

  await page.getByLabel("Manual next action note").fill("Review the focus action before building.");
  await page.getByLabel("Manual confidence").selectOption("high");
  await page.getByLabel("Focus mode").selectOption("review");
  await page.getByRole("button", { name: "Save Next Action Settings" }).click();
  await expect(page.getByText("Next action settings saved.")).toBeVisible();

  const card = nextActionCard(page, "Persistent next action");
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Pin Focus" }).click();
  await expect(page.getByText("Focus action pinned.")).toBeVisible();
  await expect(page.locator("section").filter({ has: page.getByRole("heading", { name: "Focus Action" }) }).getByText("Persistent next action")).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Next Actions" }).click();
  await expect(page.getByLabel("Manual next action note")).toHaveValue("Review the focus action before building.");
  await expect(page.locator("section").filter({ has: page.getByRole("heading", { name: "Focus Action" }) }).getByText("Persistent next action")).toBeVisible();

  await nextActionCard(page, "Persistent next action").getByRole("button", { name: "Dismiss" }).click();
  await expect(page.getByText("Next action dismissed.")).toBeVisible();
  await expect(nextActionCard(page, "Persistent next action")).toHaveCount(0);

  await page.reload();
  await page.getByRole("button", { name: "Next Actions" }).click();
  await expect(nextActionCard(page, "Persistent next action")).toHaveCount(0);
});

test("project next action appears in next action center", async ({ page }) => {
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  const form = page.locator("section.panel.form").filter({ has: page.getByRole("heading", { name: "Create Project" }) });

  await form.getByLabel("Title").fill("Project with next action");
  await form.getByLabel("Next Action").fill("Do the first project step");
  await form.getByRole("button", { name: "Create Project" }).click();
  await page.getByRole("button", { name: "Next Actions" }).click();

  const card = nextActionCard(page, "Project with next action");

  await expect(card).toBeVisible();
  await expect(card.getByText("Do the first project step")).toBeVisible();
});

test("blocking question appears in next action center", async ({ page }) => {
  await page.getByRole("button", { name: "Blocking Questions" }).click();
  const form = page.locator("section.panel.form").filter({ has: page.getByRole("heading", { name: "Create Blocking Question" }) });

  await form.getByLabel("Question").fill("What should block next execution?");
  await form.getByLabel("Context").fill("Need a decision before building.");
  await form.getByRole("button", { name: "Create Blocking Question" }).click();
  await page.getByRole("button", { name: "Next Actions" }).click();

  const card = nextActionCard(page, "What should block next execution?");

  await expect(card).toBeVisible();
  await expect(card.getByText("Resolve blocking question")).toBeVisible();
});

test("next action search and source filter", async ({ page }) => {
  await createThought(page, "Thought source action", "task");
  await page.getByLabel("Next Action / 下一步").fill("Do thought-only step");

  await page.getByRole("button", { name: "Projects", exact: true }).click();
  const form = page.locator("section.panel.form").filter({ has: page.getByRole("heading", { name: "Create Project" }) });

  await form.getByLabel("Title").fill("Project source action");
  await form.getByLabel("Next Action").fill("Do project-only step");
  await form.getByRole("button", { name: "Create Project" }).click();
  await page.getByRole("button", { name: "Next Actions" }).click();

  await page.getByLabel("Search next actions").fill("project");

  await expect(nextActionCard(page, "Project source action")).toBeVisible();
  await expect(nextActionCard(page, "Thought source action")).toHaveCount(0);

  await page.getByLabel("Search next actions").fill("");
  await page.getByLabel("Source filter").selectOption("project");

  await expect(nextActionCard(page, "Project source action")).toBeVisible();
  await expect(nextActionCard(page, "Thought source action")).toHaveCount(0);
});

test("dashboard shows next action summary", async ({ page }) => {
  await createThought(page, "Dashboard next action thought", "task");
  await page.getByLabel("Next Action / 下一步").fill("Start from dashboard summary");
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();

  const panel = page.locator(".panel").filter({ has: page.getByRole("heading", { name: "Next Actions" }) });

  await expect(panel.getByText("Dashboard next action thought")).toBeVisible();
  await expect(panel.getByRole("button", { name: "Open Next Action Center" })).toBeVisible();
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

test("engineering readiness center shows criteria and persists assessment", async ({ page }) => {
  await page.getByRole("button", { name: "Engineering Readiness" }).click();

  await expect(page.getByRole("heading", { name: "Engineering Readiness Center", level: 1 })).toBeVisible();
  await expect(page.getByText("Readiness score")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Criteria Checklist" })).toBeVisible();
  await expect(page.getByText("Blocking questions resolved enough")).toBeVisible();
  await expect(page.locator(".readiness-blocker-card").filter({ hasText: "專案什麼時候可以進入工程階段？" })).toBeVisible();

  await page.getByLabel("Readiness note").fill("Confirm review queue health before engineering starts.");
  await page.getByLabel("Manual confidence").selectOption("high");
  await page.getByLabel("Target phase").selectOption("engineering");
  await page.getByRole("button", { name: "Save Readiness Assessment" }).click();

  await expect(page.getByText("Readiness assessment saved.")).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Engineering Readiness" }).click();

  await expect(page.getByLabel("Readiness note")).toHaveValue("Confirm review queue health before engineering starts.");
  await expect(page.getByLabel("Manual confidence")).toHaveValue("high");
  await expect(page.getByLabel("Target phase")).toHaveValue("engineering");
});

test("engineering readiness center reflects unresolved decision blockers", async ({ page }) => {
  await page.getByRole("button", { name: "Blocking Questions" }).click();
  const card = blockingQuestionCard(page, "專案什麼時候可以進入工程階段？");

  await card.getByLabel("Decision note / current thinking").fill("");
  await card.getByLabel("Preferred option").selectOption("");
  await card.getByLabel("Proposed resolution").fill("");
  await card.getByLabel("Final resolution").fill("");
  await card.getByLabel("Status").selectOption("open");
  await card.getByRole("button", { name: "Save" }).click();

  await page.getByRole("button", { name: "Engineering Readiness" }).click();

  await expect(page.locator(".readiness-status-not_ready", { hasText: "Not Ready" })).toBeVisible();
  await expect(page.getByText("Choose a preferred option for: 專案什麼時候可以進入工程階段？")).toBeVisible();
  await expect(page.locator(".readiness-blocker-card").filter({ hasText: "專案什麼時候可以進入工程階段？" })).toBeVisible();
});

test("blocking questions screen loads with seed questions", async ({ page }) => {
  await page.getByRole("button", { name: "Blocking Questions" }).click();

  await expect(page.getByRole("heading", { name: "Decision Center", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Decision Summary" })).toBeVisible();
  await expect(page.getByText("Not fully ready for engineering")).toBeVisible();
  await expect(blockingQuestionCard(page, "ThoughtItem 和 TodoItem 是否應該分開？")).toBeVisible();
  await expect(blockingQuestionCard(page, "Universe 是標籤、資料夾，還是獨立物件？")).toBeVisible();
  const engineeringCard = blockingQuestionCard(page, "專案什麼時候可以進入工程階段？");
  await expect(engineeringCard).toBeVisible();
  await expect(engineeringCard.getByText("Preferred: after review queue confirms minimum architecture")).toBeVisible();
});

test("decision center edits status note and preferred option across reload", async ({ page }) => {
  await page.getByRole("button", { name: "Blocking Questions" }).click();
  const card = blockingQuestionCard(page, "專案什麼時候可以進入工程階段？");

  await card.getByLabel("Decision note / current thinking").fill("Engineering can begin after the minimum architecture review clears.");
  await card.getByLabel("Preferred option").selectOption("after-review-queue-confirms-minimum-architecture");
  await card.getByLabel("Status").selectOption("resolved");
  await card.getByRole("button", { name: "Save" }).click();

  await expect(card.locator(".badge", { hasText: "resolved" })).toBeVisible();
  await expect(
    card.locator(".mini-list", { hasText: "Decision note" }).locator("p", {
      hasText: "Engineering can begin after the minimum architecture review clears."
    })
  ).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Blocking Questions" }).click();
  const reloadedCard = blockingQuestionCard(page, "專案什麼時候可以進入工程階段？");

  await expect(reloadedCard.getByLabel("Decision note / current thinking")).toHaveValue(
    "Engineering can begin after the minimum architecture review clears."
  );
  await expect(reloadedCard.getByLabel("Preferred option")).toHaveValue(
    "after-review-queue-confirms-minimum-architecture"
  );
  await expect(reloadedCard.locator(".badge", { hasText: "resolved" })).toBeVisible();
});

test("create blocking question adds an open question", async ({ page }) => {
  await page.getByRole("button", { name: "Blocking Questions" }).click();
  const form = page.locator("section.panel.form").filter({ has: page.getByRole("heading", { name: "Create Blocking Question" }) });

  await form.getByLabel("Question").fill("Should habits become a first-class object?");
  await form.getByLabel("Context").fill("Habits may require recurring workflows.");
  await form.getByRole("button", { name: "Create Blocking Question" }).click();

  const card = blockingQuestionCard(page, "Should habits become a first-class object?");
  await expect(card).toBeVisible();
  await expect(card.locator(".badge", { hasText: "open" })).toBeVisible();
});

test("blocking questions search and filter", async ({ page }) => {
  await page.getByRole("button", { name: "Blocking Questions" }).click();

  await page.getByLabel("Search blocking questions").fill("Universe");

  await expect(blockingQuestionCard(page, "Universe 是標籤、資料夾，還是獨立物件？")).toBeVisible();
  await expect(blockingQuestionCard(page, "ThoughtItem 和 TodoItem 是否應該分開？")).toHaveCount(0);

  await page.getByLabel("Status filter").selectOption("resolved");

  await expect(blockingQuestionCard(page, "Universe 是標籤、資料夾，還是獨立物件？")).toBeVisible();
});

test("resolve blocking question records final resolution", async ({ page }) => {
  await page.getByRole("button", { name: "Blocking Questions" }).click();
  const form = page.locator("section.panel.form").filter({ has: page.getByRole("heading", { name: "Create Blocking Question" }) });

  await form.getByLabel("Question").fill("Should habits stay as thoughts?");
  await form.getByLabel("Context").fill("Habits may require recurring workflows.");
  await form.getByRole("button", { name: "Create Blocking Question" }).click();

  const card = blockingQuestionCard(page, "Should habits stay as thoughts?");
  await card.getByLabel("Final resolution").fill("Keep it as a thought subtype for now.");
  await card.getByRole("button", { name: "Resolve" }).click();

  await expect(card.locator(".badge", { hasText: "resolved" })).toBeVisible();
  await expect(card.locator(".mini-list p", { hasText: "Keep it as a thought subtype for now." })).toBeVisible();
});

test("archive and delete blocking question", async ({ page }) => {
  await page.getByRole("button", { name: "Blocking Questions" }).click();
  const form = page.locator("section.panel.form").filter({ has: page.getByRole("heading", { name: "Create Blocking Question" }) });

  await form.getByLabel("Question").fill("Temporary blocking question");
  await form.getByLabel("Context").fill("This question should be archived and deleted.");
  await form.getByRole("button", { name: "Create Blocking Question" }).click();

  const card = blockingQuestionCard(page, "Temporary blocking question");
  await card.getByRole("button", { name: "Archive" }).click();
  await expect(card.locator(".badge", { hasText: "archived" })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await card.getByRole("button", { name: "Delete" }).click();

  await expect(blockingQuestionCard(page, "Temporary blocking question")).toHaveCount(0);
});

test("decision records center screen loads", async ({ page }) => {
  await page.getByRole("button", { name: "Decision Records", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Decision Records Center", level: 1 })).toBeVisible();
  await expect(page.getByText("Proposed decisions")).toBeVisible();
  await expect(page.getByText("Accepted decisions")).toBeVisible();
});

test("create decision record adds a proposed decision", async ({ page }) => {
  await createDecisionRecord(page, "TodoItem persistence decision", "Use TodoItem as the persisted implementation object.");

  const card = decisionRecordCard(page, "TodoItem persistence decision");
  await expect(card).toBeVisible();
  await expect(card.locator(".badge", { hasText: "proposed" })).toBeVisible();
  await expect(card.locator("p", { hasText: "Use TodoItem as the persisted implementation object." }).first()).toBeVisible();
});

test("accept decision record marks it accepted", async ({ page }) => {
  await createDecisionRecord(page, "Acceptable TodoItem decision");

  const card = decisionRecordCard(page, "Acceptable TodoItem decision");
  await card.getByRole("button", { name: "Accept" }).click();

  await expect(card.locator(".badge", { hasText: "accepted" })).toBeVisible();
});

test("edit decision record title saves changes", async ({ page }) => {
  await createDecisionRecord(page, "Editable decision title");

  const card = decisionRecordCard(page, "Editable decision title");
  await card.getByLabel("Title").fill("Updated decision title");
  await card.getByRole("button", { name: "Save Decision" }).click();

  await expect(decisionRecordCard(page, "Updated decision title")).toBeVisible();
});

test("archive and delete temporary decision record", async ({ page }) => {
  await createDecisionRecord(page, "Temporary decision record");

  const card = decisionRecordCard(page, "Temporary decision record");
  await card.getByRole("button", { name: "Archive" }).click();
  await expect(card.locator(".badge", { hasText: "archived" })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await card.getByRole("button", { name: "Delete" }).click();

  await expect(decisionRecordCard(page, "Temporary decision record")).toHaveCount(0);
});

test("create decision record from resolved blocking question", async ({ page }) => {
  await page.getByRole("button", { name: "Blocking Questions" }).click();
  const form = page.locator("section.panel.form").filter({ has: page.getByRole("heading", { name: "Create Blocking Question" }) });

  await form.getByLabel("Question").fill("Should TodoItem remain the persisted object?");
  await form.getByLabel("Context").fill("This decision affects architecture names and migrations.");
  await form.getByRole("button", { name: "Create Blocking Question" }).click();

  const card = blockingQuestionCard(page, "Should TodoItem remain the persisted object?");
  await card.getByLabel("Final resolution").fill("Keep TodoItem as the persisted object for now.");
  await card.getByRole("button", { name: "Resolve" }).click();
  await card.getByRole("button", { name: "Create Decision Record" }).click();

  await expect(page.getByRole("heading", { name: "Decision Records Center", level: 1 })).toBeVisible();
  const decision = decisionRecordCard(page, "Should TodoItem remain the persisted object?");
  await expect(decision).toBeVisible();
  await expect(decision.locator("p", { hasText: "Keep TodoItem as the persisted object for now." }).first()).toBeVisible();
});

test("decision records search and status filter", async ({ page }) => {
  await createDecisionRecord(page, "Alpha architecture decision", "Alpha keeps TodoItem stable.");
  await createDecisionRecord(page, "Beta architecture decision", "Beta changes the object boundary.");

  const alpha = decisionRecordCard(page, "Alpha architecture decision");
  await alpha.getByRole("button", { name: "Accept" }).click();

  await page.getByLabel("Search decision records").fill("Alpha");

  await expect(decisionRecordCard(page, "Alpha architecture decision")).toBeVisible();
  await expect(decisionRecordCard(page, "Beta architecture decision")).toHaveCount(0);

  await page.getByLabel("Search decision records").fill("");
  await page.getByLabel("Decision status filter").selectOption("accepted");

  await expect(decisionRecordCard(page, "Alpha architecture decision")).toBeVisible();
  await expect(decisionRecordCard(page, "Beta architecture decision")).toHaveCount(0);
});

test("archived thought can be restored to inbox", async ({ page }) => {
  await page.getByRole("button", { name: "Quick Capture", exact: true }).click();

  await page.getByLabel("Title").fill("Restorable archived thought");
  await page.getByLabel("Content").fill("This thought should leave archive when restored.");
  await page.locator("section.panel.form select").first().selectOption("task");
  await page.getByRole("button", { name: "Save to Inbox" }).click();

  await page.getByRole("button", { name: "Archive Thought" }).click();
  await page.getByRole("button", { name: "Archived Items" }).click();

  await expect(page.getByRole("heading", { name: "Archived Items", level: 1 })).toBeVisible();
  const archivedThoughts = page.locator(".panel").filter({ has: page.getByRole("heading", { name: "Archived Thoughts" }) });
  const archivedThought = archivedThoughts.locator(".archive-card").filter({ hasText: "Restorable archived thought" });
  await expect(archivedThought).toBeVisible();

  await archivedThought.getByRole("button", { name: "Restore Thought" }).click();
  await expect(archivedThoughts.locator(".archive-card").filter({ hasText: "Restorable archived thought" })).toHaveCount(0);

  await page.getByRole("button", { name: "Idea Inbox" }).click();
  const inboxList = page.locator("main > div.panel").first();
  await expect(inboxList.locator(".item strong", { hasText: "Restorable archived thought" })).toBeVisible();
});

test("archived project can be restored to active dashboard projects", async ({ page }) => {
  await page.getByRole("button", { name: /Project Detail/ }).click();
  await page.getByRole("button", { name: "Archive Project" }).click();
  await page.getByRole("button", { name: "Archived Items" }).click();

  await expect(page.getByRole("heading", { name: "Archived Items", level: 1 })).toBeVisible();
  const archivedProjects = page.locator(".panel").filter({ has: page.getByRole("heading", { name: "Archived Projects" }) });
  const archivedProject = archivedProjects.locator(".archive-card").filter({ hasText: "Todo Thought Universe MVP" });
  await expect(archivedProject).toBeVisible();

  await archivedProject.getByRole("button", { name: "Restore Project" }).click();
  await expect(archivedProjects.locator(".archive-card").filter({ hasText: "Todo Thought Universe MVP" })).toHaveCount(0);

  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  const projectsPanel = page.locator(".panel").filter({ has: page.getByRole("heading", { name: "Projects" }) });
  await expect(projectsPanel.getByText("Todo Thought Universe MVP")).toBeVisible();
});

test("archived thought can be deleted from archived items", async ({ page }) => {
  await page.getByRole("button", { name: "Quick Capture", exact: true }).click();

  await page.getByLabel("Title").fill("Delete archived thought");
  await page.getByLabel("Content").fill("This archived thought should be deleted.");
  await page.locator("section.panel.form select").first().selectOption("note");
  await page.getByRole("button", { name: "Save to Inbox" }).click();

  await page.getByRole("button", { name: "Archive Thought" }).click();
  await page.getByRole("button", { name: "Archived Items" }).click();
  const archivedThoughts = page.locator(".panel").filter({ has: page.getByRole("heading", { name: "Archived Thoughts" }) });
  const archivedThought = archivedThoughts.locator(".archive-card").filter({ hasText: "Delete archived thought" });
  await expect(archivedThought).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await archivedThought.getByRole("button", { name: "Delete Thought" }).click();

  await expect(archivedThoughts.locator(".archive-card").filter({ hasText: "Delete archived thought" })).toHaveCount(0);
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
  await inbox.locator("select").first().selectOption("task");

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

test("view universe opens the universe detail center", async ({ page }) => {
  await createUniverse(page, "Writing Universe");

  await universeCard(page, "Writing Universe").getByRole("button", { name: "View Universe" }).click();

  await expect(page.getByRole("heading", { name: "Universe Detail Center", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Writing Universe" })).toBeVisible();
  await expect(page.getByText("Health score")).toBeVisible();
});

test("universe detail shows thoughts in the selected universe", async ({ page }) => {
  await createUniverse(page, "Research Universe");
  await createThought(page, "Research universe thought", "note", "Research Universe");

  await page.getByRole("button", { name: "Universes" }).click();
  await universeCard(page, "Research Universe").getByRole("button", { name: "View Universe" }).click();

  const thoughts = page.locator("section.panel").filter({ has: page.getByRole("heading", { name: "Thoughts in this universe" }) });

  await expect(thoughts.locator(".universe-thought-card", { hasText: "Research universe thought" })).toBeVisible();
});

test("universe detail shows projects in the selected universe", async ({ page }) => {
  await createUniverse(page, "Build Universe");
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  const form = page.locator("section.panel.form").filter({ has: page.getByRole("heading", { name: "Create Project" }) });

  await form.getByLabel("Title").fill("Build universe project");
  await form.getByLabel("Universe").selectOption({ label: "Build Universe" });
  await form.getByLabel("Next Action").fill("Plan build kickoff");
  await form.getByRole("button", { name: "Create Project" }).click();
  await page.getByRole("button", { name: "Universes" }).click();
  await universeCard(page, "Build Universe").getByRole("button", { name: "View Universe" }).click();

  const projects = page.locator("section.panel").filter({ has: page.getByRole("heading", { name: "Projects in this universe" }) });

  await expect(projects.locator(".universe-project-card", { hasText: "Build universe project" })).toBeVisible();
  await expect(projects.getByText("Plan build kickoff")).toBeVisible();
});

test("universe detail shows next actions in the selected universe", async ({ page }) => {
  await createUniverse(page, "Action Universe");
  await createThought(page, "Action universe thought", "task", "Action Universe");

  await page.getByLabel("Next Action / 下一步").fill("Run the universe action");
  await page.getByRole("button", { name: "Universes" }).click();
  await universeCard(page, "Action Universe").getByRole("button", { name: "View Universe" }).click();

  const actions = page.locator("section.panel").filter({ has: page.getByRole("heading", { name: "Next actions in this universe" }) });

  await expect(actions.locator(".universe-next-action-card", { hasText: "Action universe thought" })).toBeVisible();
  await expect(actions.getByText("Run the universe action")).toBeVisible();
});

test("universe detail shows blocking questions linked to the universe", async ({ page }) => {
  await loadAppState(page, {
    universes: [
      {
        id: "u-blocked",
        name: "Blocked Universe",
        description: "Imported blocker universe",
        purpose: "Test linked blockers",
        focus: "main"
      }
    ],
    thoughts: [],
    projects: [],
    relationships: [],
    aiInsights: [],
    blockingQuestions: [
      {
        id: "bq-blocked",
        question: "What decision blocks this universe?",
        status: "open",
        linkedUniverseIds: ["u-blocked"],
        proposedResolution: "Pick a direction.",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      }
    ]
  });

  await page.getByRole("button", { name: "Universes" }).click();
  await universeCard(page, "Blocked Universe").getByRole("button", { name: "View Universe" }).click();

  const blockers = page.locator("section.panel").filter({ has: page.getByRole("heading", { name: "Blocking questions in this universe" }) });

  await expect(blockers.getByText("What decision blocks this universe?")).toBeVisible();
  await expect(blockers.getByText("Pick a direction.")).toBeVisible();
});

test("universe detail shows linked decision records", async ({ page }) => {
  await loadAppState(page, {
    universes: [
      {
        id: "u-strategy",
        name: "Strategy Universe",
        description: "Imported decision universe",
        purpose: "Test linked decisions",
        focus: "main"
      }
    ],
    thoughts: [],
    projects: [],
    relationships: [],
    aiInsights: [],
    decisionRecords: [
      {
        id: "decision-strategy",
        title: "Strategy TodoItem decision",
        decision: "Keep TodoItem naming inside persistence while presenting thoughts in the UI.",
        status: "accepted",
        linkedUniverseIds: ["u-strategy"],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      }
    ]
  });

  await page.getByRole("button", { name: "Universes" }).click();
  await universeCard(page, "Strategy Universe").getByRole("button", { name: "View Universe" }).click();

  const decisions = page.locator("section.panel").filter({ has: page.getByRole("heading", { name: "Decision records in this universe" }) });

  await expect(decisions.locator(".universe-decision-record-card", { hasText: "Strategy TodoItem decision" })).toBeVisible();
  await expect(decisions.getByText("accepted", { exact: true })).toBeVisible();
  await expect(decisions.getByText("Keep TodoItem naming inside persistence while presenting thoughts in the UI.")).toBeVisible();

  await decisions.getByRole("button", { name: "Open Decision Records" }).first().click();
  await expect(page.getByRole("heading", { name: "Decision Records Center", level: 1 })).toBeVisible();
});

test("universe detail copies universe JSON and shows package preview", async ({ page }) => {
  await createUniverse(page, "Export Universe");

  await universeCard(page, "Export Universe").getByRole("button", { name: "View Universe" }).click();
  await page.getByRole("button", { name: "Copy Universe JSON" }).click();

  await expect(page.getByText("Universe JSON copied")).toBeVisible();
  await expect(page.locator("pre.json").first()).toContainText("UniversePackage");
});

test("universe detail shows empty states for an empty universe", async ({ page }) => {
  await createUniverse(page, "Empty Universe");

  await universeCard(page, "Empty Universe").getByRole("button", { name: "View Universe" }).click();

  await expect(page.getByText("No thoughts in this universe.")).toBeVisible();
  await expect(page.getByText("No projects in this universe.")).toBeVisible();
  await expect(page.getByText("No next actions in this universe.")).toBeVisible();
  await expect(page.getByText("No decision records in this universe.")).toBeVisible();
  await expect(page.getByText("No relationships in this universe.")).toBeVisible();
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

  await page.getByLabel("Title").fill("E2E AI patch project idea");
  await page.getByLabel("Content").fill("Build an app for structured planning.");
  await page.locator("section.panel.form select").first().selectOption("inspiration");
  await page.getByRole("button", { name: "Save to Inbox" }).click();

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

  await page.getByLabel("Title").fill("E2E reject AI patch idea");
  await page.getByLabel("Content").fill("Build an app that should stay unchanged after reject.");
  await page.locator("section.panel.form select").first().selectOption("inspiration");
  await page.getByRole("button", { name: "Save to Inbox" }).click();

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

test("relationship explorer screen loads", async ({ page }) => {
  await page.getByRole("button", { name: "Relationship Explorer" }).click();

  await expect(page.getByRole("heading", { name: "Relationship Explorer", level: 1 })).toBeVisible();
  await expect(page.getByText("Total relationships")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Impact Map" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Orphan thoughts" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Orphan projects" })).toBeVisible();
});

test("relationship explorer creates a thought to project relationship", async ({ page }) => {
  await createThought(page, "Relationship source thought", "note");
  await createProject(page, "Relationship target project");
  await createExplorerRelationship(page, {
    sourceTitle: "Relationship source thought",
    targetTitle: "Relationship target project",
    type: "supports",
    description: "Thought supports project direction"
  });

  const card = relationshipExplorerCard(page, "Relationship source thought").filter({ hasText: "Relationship target project" });

  await expect(card).toBeVisible();
  await expect(card.getByText("supports", { exact: true })).toBeVisible();
  await expect(card.getByText("Thought supports project direction")).toBeVisible();
});

test("relationship explorer blocks duplicate relationships", async ({ page }) => {
  await createThought(page, "Duplicate relationship source", "note");
  await createProject(page, "Duplicate relationship target");
  await createExplorerRelationship(page, {
    sourceTitle: "Duplicate relationship source",
    targetTitle: "Duplicate relationship target",
    type: "supports",
    description: "Duplicate relationship description"
  });

  await page.getByRole("button", { name: "Create Relationship" }).click();

  await expect(page.getByText("Relationship already exists.")).toBeVisible();
});

test("relationship explorer impact map shows incoming and outgoing links", async ({ page }) => {
  await createThought(page, "Impact source thought", "note");
  await createProject(page, "Impact target project");
  await createExplorerRelationship(page, {
    sourceTitle: "Impact source thought",
    targetTitle: "Impact target project",
    type: "supports",
    description: "Impact source supports target"
  });

  await page.getByLabel("Select node type").selectOption("project");
  await page.getByLabel("Select node", { exact: true }).selectOption({ label: "Impact target project" });
  const incoming = page.locator(".impact-group").filter({ hasText: "Incoming relationships" });
  await expect(incoming.getByText("Impact source thought supports Impact target project")).toBeVisible();

  await page.getByLabel("Select node type").selectOption("thought");
  await page.getByLabel("Select node", { exact: true }).selectOption({ label: "Impact source thought" });
  const outgoing = page.locator(".impact-group").filter({ hasText: "Outgoing relationships" });
  await expect(outgoing.getByText("Impact source thought supports Impact target project")).toBeVisible();
});

test("relationship explorer shows blocking impact in both directions", async ({ page }) => {
  await createThought(page, "Blocking impact thought", "note");
  await createProject(page, "Blocking impact project");
  await createExplorerRelationship(page, {
    sourceTitle: "Blocking impact thought",
    targetTitle: "Blocking impact project",
    type: "blocks",
    description: "Thought blocks project progress"
  });

  await page.getByLabel("Select node type").selectOption("project");
  await page.getByLabel("Select node", { exact: true }).selectOption({ label: "Blocking impact project" });
  const blockedBy = page.locator(".impact-group").filter({ hasText: "Blocked by" });
  await expect(blockedBy.getByText("Blocking impact thought blocks Blocking impact project")).toBeVisible();

  await page.getByLabel("Select node type").selectOption("thought");
  await page.getByLabel("Select node", { exact: true }).selectOption({ label: "Blocking impact thought" });
  const blocks = page.locator(".impact-group").filter({ has: page.getByText("Blocks", { exact: true }) });
  await expect(blocks.getByText("Blocking impact thought blocks Blocking impact project")).toBeVisible();
});

test("relationship explorer search and type filters relationships", async ({ page }) => {
  await createThought(page, "Supports filter source", "note");
  await createProject(page, "Supports filter target");
  await createExplorerRelationship(page, {
    sourceTitle: "Supports filter source",
    targetTitle: "Supports filter target",
    type: "supports",
    description: "Support filter relationship"
  });

  await createThought(page, "Blocks filter source", "note");
  await createProject(page, "Blocks filter target");
  await createExplorerRelationship(page, {
    sourceTitle: "Blocks filter source",
    targetTitle: "Blocks filter target",
    type: "blocks",
    description: "Block filter relationship"
  });

  await page.getByLabel("Search relationships").fill("Supports filter source");
  await expect(relationshipExplorerCard(page, "Supports filter source")).toBeVisible();
  await expect(relationshipExplorerCard(page, "Blocks filter source")).toHaveCount(0);

  await page.getByLabel("Search relationships").fill("");
  await page.getByLabel("Relationship type filter").selectOption("blocks");
  await expect(relationshipExplorerCard(page, "Blocks filter source")).toBeVisible();
  await expect(relationshipExplorerCard(page, "Supports filter source")).toHaveCount(0);
});

test("relationship explorer lists orphan thoughts", async ({ page }) => {
  await createThought(page, "Orphan thought for explorer", "note");
  await page.getByRole("button", { name: "Relationship Explorer" }).click();

  const orphans = page.locator("section.panel").filter({ has: page.getByRole("heading", { name: "Orphan thoughts" }) });

  await expect(orphans.locator("strong", { hasText: "Orphan thought for explorer" })).toBeVisible();
});

test("relationship explorer view source and target navigate to details", async ({ page }) => {
  await createThought(page, "View source relationship thought", "note");
  await createProject(page, "View target relationship project");
  await createExplorerRelationship(page, {
    sourceTitle: "View source relationship thought",
    targetTitle: "View target relationship project",
    type: "supports",
    description: "Relationship with navigable endpoints"
  });

  const card = relationshipExplorerCard(page, "View source relationship thought").filter({ hasText: "View target relationship project" });
  await card.getByRole("button", { name: "View Source" }).click();

  await expect(page.getByRole("heading", { name: "Thought Detail", level: 1 })).toBeVisible();
  await expect(page.getByLabel("標題")).toHaveValue("View source relationship thought");

  await page.getByRole("button", { name: "Relationship Explorer" }).click();
  await relationshipExplorerCard(page, "View source relationship thought")
    .filter({ hasText: "View target relationship project" })
    .getByRole("button", { name: "View Target" })
    .click();

  await expect(page.getByRole("heading", { name: "Project Detail", level: 1 })).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveValue("View target relationship project");
});

test("global search screen loads", async ({ page }) => {
  await page.getByRole("button", { name: "Global Search", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Global Search Center", level: 1 })).toBeVisible();
  await expect(page.getByPlaceholder("Search everything")).toBeVisible();
  await expect(page.getByText("Total results")).toBeVisible();
});

test("global search opens a thought result", async ({ page }) => {
  await createThought(page, "Global searchable thought", "note");
  await page.getByRole("button", { name: "Global Search", exact: true }).click();

  await page.getByPlaceholder("Search everything").fill("Global searchable");

  const card = globalSearchResultCard(page, "Global searchable thought");
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Open" }).click();

  await expect(page.getByRole("heading", { name: "Thought Detail", level: 1 })).toBeVisible();
  await expect(page.getByLabel("標題")).toHaveValue("Global searchable thought");
});

test("global search opens a project result", async ({ page }) => {
  await createProject(
    page,
    "Global searchable project",
    "Project visible through global search",
    "Search project next step"
  );
  await page.getByRole("button", { name: "Global Search", exact: true }).click();

  await page.getByPlaceholder("Search everything").fill("visible through global search");

  const card = globalSearchResultCard(page, "Global searchable project");
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Open" }).click();

  await expect(page.getByRole("heading", { name: "Project Detail", level: 1 })).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveValue("Global searchable project");
});

test("global search opens a universe result", async ({ page }) => {
  await createUniverse(page, "Global searchable universe", "Universe visible in global finder");
  await page.getByRole("button", { name: "Global Search", exact: true }).click();

  await page.getByPlaceholder("Search everything").fill("global finder");

  const card = globalSearchResultCard(page, "Global searchable universe");
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Open" }).click();

  await expect(page.getByRole("heading", { name: "Universe Detail Center", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Global searchable universe" })).toBeVisible();
});

test("global search opens a decision record result", async ({ page }) => {
  await createDecisionRecord(
    page,
    "Global searchable decision",
    "This decision should appear in global search."
  );
  await page.getByRole("button", { name: "Global Search", exact: true }).click();

  await page.getByPlaceholder("Search everything").fill("should appear in global search");

  const card = globalSearchResultCard(page, "Global searchable decision");
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Open" }).click();

  await expect(page.getByRole("heading", { name: "Decision Records Center", level: 1 })).toBeVisible();
  await expect(decisionRecordCard(page, "Global searchable decision")).toBeVisible();
});

test("global search opens a command result", async ({ page }) => {
  await page.getByRole("button", { name: "Global Search", exact: true }).click();

  await page.getByPlaceholder("Search everything").fill("Open Next Action Center");

  const card = globalSearchResultCard(page, "Open Next Action Center");
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Open" }).click();

  await expect(page.getByRole("heading", { name: "Next Action Center", level: 1 })).toBeVisible();
});

test("global search type filter narrows results", async ({ page }) => {
  await createThought(page, "Global filter thought", "note");
  await createProject(page, "Global filter project", "Project for global type filter");
  await page.getByRole("button", { name: "Global Search", exact: true }).click();

  await page.getByPlaceholder("Search everything").fill("Global filter");
  await page.getByLabel("Type filter").selectOption("project");

  await expect(globalSearchResultCard(page, "Global filter project")).toBeVisible();
  await expect(globalSearchResultCard(page, "Global filter thought")).toHaveCount(0);
});

test("global search universe filter narrows results", async ({ page }) => {
  await createUniverse(page, "Search Filter Universe");
  await createThought(page, "Universe filtered thought", "note", "Search Filter Universe");
  await page.getByRole("button", { name: "Global Search", exact: true }).click();

  await page.getByLabel("Universe filter").selectOption({ label: "Search Filter Universe" });

  await expect(globalSearchResultCard(page, "Universe filtered thought")).toBeVisible();
});

test("dashboard links to global search", async ({ page }) => {
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();

  const panel = page.locator(".panel").filter({ has: page.getByRole("heading", { name: "Global Search", exact: true }) });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("button", { name: "Open Global Search" })).toBeVisible();

  await panel.getByRole("button", { name: "Open Global Search" }).click();
  await expect(page.getByRole("heading", { name: "Global Search Center", level: 1 })).toBeVisible();
});

test("review queue screen loads", async ({ page }) => {
  await page.getByRole("button", { name: "Review Queue", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Review Queue Center", level: 1 })).toBeVisible();
  await expect(page.getByPlaceholder("Search review queue")).toBeVisible();
  await expect(page.getByText("Total pending")).toBeVisible();
});

test("review queue accepts an AI draft and applies its patch", async ({ page }) => {
  await page.getByRole("button", { name: "Quick Capture", exact: true }).click();

  await page.getByLabel("Title").fill("Review queue AI idea");
  await page.getByLabel("Content").fill("Build a structured planning app from an idea.");
  await page.locator("section.panel.form select").first().selectOption("inspiration");
  await page.getByRole("button", { name: "Save to Inbox" }).click();

  await page.getByRole("button", { name: /AI Planning Panel/ }).click();
  await page.getByRole("button", { name: "分析目前 Thought" }).click();

  await page.getByRole("button", { name: "Review Queue", exact: true }).click();
  const card = reviewQueueCard(page, "Review queue AI idea");
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Accept" }).click();
  await expect(page.getByText("AI draft accepted.")).toBeVisible();
  await expect(card).toHaveCount(0);

  await page.getByRole("button", { name: "Thought Detail", exact: true }).click();
  await expect(page.getByLabel("Next Action / 下一步")).toHaveValue("Define the first concrete engineering step.");
});

test("review queue accepts and rejects proposed decisions with scoped card actions", async ({ page }) => {
  await createDecisionRecord(page, "Review queue accepted decision", "Accept this proposed decision.");
  await createDecisionRecord(page, "Review queue rejected decision", "Reject this proposed decision.");

  await page.getByRole("button", { name: "Review Queue", exact: true }).click();

  await reviewQueueCard(page, "Review queue accepted decision").getByRole("button", { name: "Accept" }).click();
  await expect(reviewQueueCard(page, "Review queue accepted decision")).toHaveCount(0);

  await reviewQueueCard(page, "Review queue rejected decision").getByRole("button", { name: "Reject" }).click();
  await expect(reviewQueueCard(page, "Review queue rejected decision")).toHaveCount(0);

  await page.getByRole("button", { name: "Decision Records", exact: true }).click();
  await expect(decisionRecordCard(page, "Review queue accepted decision").locator(".badge", { hasText: "accepted" })).toBeVisible();
  await expect(decisionRecordCard(page, "Review queue rejected decision").locator(".badge", { hasText: "superseded" })).toBeVisible();
});

test("review queue marks blocking questions reviewed", async ({ page }) => {
  const state = handoffState({}, []);
  state.projects = [];
  state.blockingQuestions = [
    {
      id: "bq-review-queue",
      question: "Review queue blocker?",
      context: "This blocker is waiting for human review.",
      proposedResolution: "Resolve it through the review queue.",
      status: "in_review",
      linkedUniverseIds: ["u-handoff"],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    }
  ];
  state.decisionRecords = [];
  await loadAppState(page, state);

  await page.getByRole("button", { name: "Review Queue", exact: true }).click();

  const card = reviewQueueCard(page, "Review queue blocker?");
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Mark Reviewed" }).click();
  await expect(card).toHaveCount(0);

  await page.getByRole("button", { name: "Blocking Questions" }).click();
  await expect(blockingQuestionCard(page, "Review queue blocker?").locator(".badge", { hasText: "resolved" })).toBeVisible();
});

test("review queue marks handoff candidates reviewed", async ({ page }) => {
  await loadAppState(page, handoffState({}, []));

  await page.getByRole("button", { name: "Review Queue", exact: true }).click();

  const card = reviewQueueCard(page, "Ready Handoff Project");
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Mark Reviewed" }).click();
  await expect(card).toHaveCount(0);

  await page.getByRole("button", { name: "Project Detail", exact: true }).click();
  await expect(page.getByLabel("Lifecycle")).toHaveValue("handoff_ready");
});

test("review queue filters, dashboard link, and global search command work", async ({ page }) => {
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  const dashboardPanel = page.locator(".panel").filter({ has: page.getByRole("heading", { name: "Review Queue", exact: true }) });
  await expect(dashboardPanel.getByRole("button", { name: "Open Review Queue" })).toBeVisible();

  await dashboardPanel.getByRole("button", { name: "Open Review Queue" }).click();
  await expect(page.getByRole("heading", { name: "Review Queue Center", level: 1 })).toBeVisible();
  await expect(page.getByText("Open decisions")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open Decision Center" })).toBeVisible();
  await page.getByLabel("Review type filter").selectOption("blocking_question");
  await expect(reviewQueueCard(page, "專案什麼時候可以進入工程階段？")).toBeVisible();

  await page.getByRole("button", { name: "Open Decision Center" }).click();
  await expect(page.getByRole("heading", { name: "Decision Center", level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "Global Search", exact: true }).click();
  await page.getByPlaceholder("Search everything").fill("Open Review Queue");
  const command = globalSearchResultCard(page, "Open Review Queue");
  await expect(command).toBeVisible();
  await command.getByRole("button", { name: "Open" }).click();
  await expect(page.getByRole("heading", { name: "Review Queue Center", level: 1 })).toBeVisible();
});

test("production routes open centers directly and survive reload", async ({ page }) => {
  const routes = [
    { path: "/review-queue", heading: "Review Queue Center" },
    { path: "/blocking-questions", heading: "Decision Center" },
    { path: "/engineering-readiness", heading: "Engineering Readiness Center" },
    { path: "/next-actions", heading: "Next Action Center" },
    { path: "/deployment-status", heading: "Deployment Status" }
  ];

  for (const route of routes) {
    await page.goto(route.path);
    await expect(page.getByRole("heading", { name: route.heading, level: 1 })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: route.heading, level: 1 })).toBeVisible();
  }
});

test("deployment status screen renders app info and readiness summary", async ({ page }) => {
  await page.getByRole("button", { name: "Deployment Status" }).click();

  await expect(page.getByRole("heading", { name: "Deployment Status", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "App Info" })).toBeVisible();
  await expect(page.getByText("Todo Thought Universe", { exact: true })).toBeVisible();
  await expect(page.getByText("todo-thought-universe:v1")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Production Readiness Summary" })).toBeVisible();
  await expect(page.locator(".deployment-readiness-card").filter({ hasText: "Build ready" })).toBeVisible();
  await expect(page.locator(".deployment-readiness-card").filter({ hasText: "Next action system available" })).toBeVisible();
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

  await page.getByLabel("Import App State JSON").fill(JSON.stringify(importedState, null, 2));
  await page.getByRole("button", { name: "Import and overwrite current data" }).click();

  await expect(page.getByRole("heading", { name: "Universe Dashboard" })).toBeVisible();
  await expect(page.getByText("App State imported successfully.")).toBeVisible();
  await expect(page.locator(".card strong", { hasText: "匯入宇宙" })).toBeVisible();
  await expect(page.locator(".item strong", { hasText: "匯入專案" }).first()).toBeVisible();
  await expect(page.locator(".item strong", { hasText: "匯入想法" }).first()).toBeVisible();
});
