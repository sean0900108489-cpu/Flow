import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { seed } from "../../data/seed";
import { DeploymentStatus } from "./DeploymentStatus";

describe("DeploymentStatus", () => {
  it("renders app info and production readiness summary", () => {
    const html = renderToStaticMarkup(<DeploymentStatus state={seed} projectId="p-1" />);

    expect(html).toContain("Deployment Status");
    expect(html).toContain("Todo Thought Universe");
    expect(html).toContain("Production Readiness Summary");
    expect(html).toContain("Architecture / Health / Handoff Debug Panel");
    expect(html).toContain("local-first");
    expect(html).toContain("todo-thought-universe:v1");
    expect(html).toContain("Next action system available");
  });
});
