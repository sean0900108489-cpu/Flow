import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { seed } from "../../data/seed";
import type { AppState, Project } from "../../domain/types";
import { HandoffPackageExportPanel } from "./HandoffPackageExportPanel";

function emptyState(): AppState {
  return {
    universes: [],
    thoughts: [],
    projects: [],
    relationships: [],
    aiInsights: [],
    blockingQuestions: [],
    decisionRecords: []
  };
}

function project(patch: Partial<Project>): Project {
  return {
    ...seed.projects[0],
    ...patch
  };
}

function twoProjectState(): AppState {
  return {
    ...seed,
    projects: [
      seed.projects[0],
      project({
        id: "p-2",
        name: "Second Handoff Project",
        sourceThoughtId: undefined,
        linkedThoughtIds: [],
        readiness: "not_ready",
        nextAction: ""
      })
    ]
  };
}

describe("HandoffPackageExportPanel", () => {
  it("shows an empty state when no projects are available", () => {
    const html = renderToStaticMarkup(<HandoffPackageExportPanel state={emptyState()} />);

    expect(html).toContain("EngineeringHandoffPackage Export");
    expect(html).toContain("No projects are available for EngineeringHandoffPackage export.");
  });

  it("lists projects in the selector and renders the selected handoff preview", () => {
    const html = renderToStaticMarkup(<HandoffPackageExportPanel state={twoProjectState()} projectId="p-2" />);

    expect(html).toContain("Project selector");
    expect(html).toContain("Todo Thought Universe MVP (p-1)");
    expect(html).toContain("Second Handoff Project (p-2)");
    expect(html).toContain("EngineeringFlowInput");
    expect(html).toContain("RequiredSoftwarePlan");
    expect(html).toContain("ProjectEvolutionPlan");
    expect(html).toContain("ConstraintCodex / Limiter");
    expect(html).toContain("BackendDesignPlan");
    expect(html).toContain("CodexTaskPlan");
    expect(html).toContain("AcceptanceTestPlan");
  });

  it("shows canGenerateEngineeringDraft and canMarkHandoffReady as separate readiness signals", () => {
    const html = renderToStaticMarkup(<HandoffPackageExportPanel state={seed} projectId="p-1" />);

    expect(html).toContain("Stored readiness");
    expect(html).toContain("Computed readiness");
    expect(html).toContain("canGenerateEngineeringDraft");
    expect(html).toContain("canMarkHandoffReady");
  });

  it("shows read-only safety copy and not-ready draft warning", () => {
    const html = renderToStaticMarkup(<HandoffPackageExportPanel state={seed} projectId="p-1" />);

    expect(html).toContain("This handoff package is a read-only engineering draft export.");
    expect(html).toContain("Generating or exporting it does not mutate");
    expect(html).toContain("It does not mark the project as handoff_ready.");
    expect(html).toContain("handoff_ready requires explicit user confirmation through the command layer.");
    expect(html).toContain("Draft package may be incomplete.");
    expect(html).toContain("This project is not handoff_ready.");
  });

  it("renders JSON and Markdown copy/download controls without direct handoff actions", () => {
    const html = renderToStaticMarkup(<HandoffPackageExportPanel state={seed} projectId="p-1" />);

    expect(html).toContain("Copy JSON");
    expect(html).toContain("Download JSON");
    expect(html).toContain("Copy Markdown");
    expect(html).toContain("Download Markdown");
    expect(html).not.toContain(">Mark Handoff Ready<");
    expect(html).not.toContain(">Apply handoff<");
    expect(html).not.toContain(">Apply Handoff<");
  });

  it("does not mutate AppState while rendering the export preview", () => {
    const before = JSON.stringify(seed);

    renderToStaticMarkup(<HandoffPackageExportPanel state={seed} projectId="p-1" />);

    expect(JSON.stringify(seed)).toBe(before);
  });
});
