import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { seed } from "../../data/seed";
import { ArchitectureStatusPanel } from "./ArchitectureStatusPanel";

describe("ArchitectureStatusPanel", () => {
  it("renders read-only architecture, health, backend, AI safety, and handoff summaries", () => {
    const html = renderToStaticMarkup(<ArchitectureStatusPanel state={seed} projectId="p-1" />);

    expect(html).toContain("Architecture / Health / Handoff Debug Panel");
    expect(html).toContain("AppHealthReport Summary");
    expect(html).toContain("Derived Review Queue Summary");
    expect(html).toContain("Review &amp; Health Drill-down");
    expect(html).toContain("Backend Contract Metadata");
    expect(html).toContain("POST /commands");
    expect(html).toContain("GET /state");
    expect(html).toContain("PUT /state/import");
    expect(html).toContain("GET /projects/:id/handoff");
    expect(html).toContain("AIPlanningContext Safety Summary");
    expect(html).toContain("AI planning output is draft only");
    expect(html).toContain("Suggested command metadata is not executable by itself");
    expect(html).toContain("EngineeringHandoffPackage Export");
    expect(html).toContain("Copy Markdown");
    expect(html).toContain("This handoff package is a read-only engineering draft export");
    expect(html).toContain("HandoffPackage Summary");
    expect(html).toContain("requires human confirmation");
  });

  it("renders handoff summary without mutating AppState", () => {
    const before = JSON.stringify(seed);

    renderToStaticMarkup(<ArchitectureStatusPanel state={seed} projectId="p-1" />);

    expect(JSON.stringify(seed)).toBe(before);
  });
});
