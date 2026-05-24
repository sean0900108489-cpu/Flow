import { describe, expect, it } from "vitest";
import { seed } from "../data/seed";
import {
  buildEngineeringHandoffPackageExport,
  formatEngineeringHandoffPackageExportJson,
  formatEngineeringHandoffPackageMarkdown
} from "./engineeringHandoffExport";

const exportedAt = "2026-01-01T00:00:00.000Z";

describe("EngineeringHandoffPackage export", () => {
  it("wraps the complete handoff package with export metadata and safety", () => {
    const result = buildEngineeringHandoffPackageExport(seed, "p-1", { exportedAt });

    expect(result.schema).toBe("engineering-handoff-package-export/v0");
    expect(result.exportedAt).toBe(exportedAt);
    expect(result.projectId).toBe("p-1");
    expect(result.package.projectId).toBe("p-1");
    expect(result.package.requiredSoftwarePlan.modules.length).toBeGreaterThan(0);
    expect(result.safety).toEqual({
      readOnlyExport: true,
      doesNotMarkHandoffReady: true,
      requiresConfirmedCommandForHandoffReady: true
    });
  });

  it("formats JSON export with schema, timestamp, project, package, and safety wrapper", () => {
    const result = buildEngineeringHandoffPackageExport(seed, "p-1", { exportedAt });
    const json = formatEngineeringHandoffPackageExportJson(result);

    expect(json).toContain("\"schema\": \"engineering-handoff-package-export/v0\"");
    expect(json).toContain("\"exportedAt\": \"2026-01-01T00:00:00.000Z\"");
    expect(json).toContain("\"projectId\": \"p-1\"");
    expect(json).toContain("\"package\"");
    expect(json).toContain("\"readOnlyExport\": true");
    expect(json).toContain("\"doesNotMarkHandoffReady\": true");
  });

  it("formats Markdown with safety, readiness, software, backend, task, and acceptance sections", () => {
    const result = buildEngineeringHandoffPackageExport(seed, "p-1", { exportedAt });
    const markdown = formatEngineeringHandoffPackageMarkdown(result);

    expect(markdown).toContain("# Engineering Handoff Package: Todo Thought Universe MVP");
    expect(markdown).toContain("## Safety");
    expect(markdown).toContain("This export is read-only.");
    expect(markdown).toContain("This export does not mark the project as handoff_ready.");
    expect(markdown).toContain("## Readiness Summary");
    expect(markdown).toContain("canGenerateEngineeringDraft");
    expect(markdown).toContain("canMarkHandoffReady");
    expect(markdown).toContain("## RequiredSoftwarePlan");
    expect(markdown).toContain("## BackendDesignPlan");
    expect(markdown).toContain("## CodexTaskPlan");
    expect(markdown).toContain("## AcceptanceTestPlan");
  });

  it("does not mutate the original AppState while building exports", () => {
    const before = JSON.stringify(seed);

    buildEngineeringHandoffPackageExport(seed, "p-1", { exportedAt });

    expect(JSON.stringify(seed)).toBe(before);
  });
});
