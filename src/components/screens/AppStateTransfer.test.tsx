import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AppState } from "../../domain/types";
import { parseAppStateJson } from "../../services/appStateTransfer";
import { AppStateImportWarningDetails } from "./AppStateTransfer";

const baseState = (): AppState => ({
  universes: [
    {
      id: "u-1",
      name: "Universe",
      description: "A test universe.",
      purpose: "Keep test state valid.",
      focus: "main"
    }
  ],
  thoughts: [
    {
      id: "t-1",
      title: "Thought",
      content: "A thought linked to a project.",
      type: "project",
      status: "active",
      universeId: "u-1",
      why: "Test direct reference drift.",
      outcome: "Warnings are visible.",
      nextAction: "Render warning details.",
      projectId: "p-1",
      createdAt: "2026-05-23T00:00:00.000Z",
      updatedAt: "2026-05-23T00:00:00.000Z"
    }
  ],
  projects: [
    {
      id: "p-1",
      sourceThoughtId: "t-1",
      linkedThoughtIds: [],
      universeId: "u-1",
      status: "active",
      lifecycleStatus: "planning",
      name: "Project",
      intent: "A project with direct-ref drift.",
      users: ["User"],
      features: ["Feature"],
      screens: ["Screen"],
      dataObjects: ["ThoughtItem"],
      flowSteps: ["Step"],
      unknowns: [],
      nextAction: "Fix drift.",
      readiness: "draftable",
      createdAt: "2026-05-23T00:00:00.000Z",
      updatedAt: "2026-05-23T00:00:00.000Z"
    }
  ],
  relationships: [],
  aiInsights: [],
  blockingQuestions: [],
  decisionRecords: []
});

describe("AppStateTransfer warning details", () => {
  it("renders no warning details for clean imports", () => {
    const html = renderToStaticMarkup(<AppStateImportWarningDetails warnings={[]} />);

    expect(html).toBe("");
  });

  it("renders invariant warning code, severity, target, field, and message", () => {
    const result = parseAppStateJson(JSON.stringify(baseState()));
    const driftWarning = result.warnings?.find((warning) => warning.code === "thought_project_reference_drift");

    expect(result.ok).toBe(true);
    expect(result.state).toBeDefined();
    expect(driftWarning).toBeDefined();

    const html = renderToStaticMarkup(<AppStateImportWarningDetails warnings={driftWarning ? [driftWarning] : []} />);

    expect(html).toContain("Import warning details");
    expect(html).toContain("thought_project_reference_drift");
    expect(html).toContain("severity:warning");
    expect(html).toContain("target:thought:t-1 / field:projectId");
    expect(html).toContain("Thought t-1 points to project p-1");
  });
});
