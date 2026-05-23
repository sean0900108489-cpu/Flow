import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { seed } from "../../data/seed";
import { buildAppHealthReport } from "../../domain/appHealthReport";
import { buildDerivedReviewQueue, type DerivedReviewSuggestedCommandDraft } from "../../domain/derivedReviewQueue";
import type { AppState } from "../../domain/types";
import {
  filterDrillDownReviewItems,
  formatSuggestedCommandJson,
  ReviewHealthDrillDownPanel
} from "./ReviewHealthDrillDownPanel";

const timestamp = "2026-01-01T00:00:00.000Z";

function stateWithIssues(): AppState {
  return {
    ...seed,
    relationships: [
      ...seed.relationships,
      {
        id: "r-orphan",
        sourceId: "missing-thought",
        sourceType: "thought",
        targetId: "p-1",
        targetType: "project",
        type: "blocks",
        description: "Missing thought blocks the project."
      }
    ],
    aiInsights: [
      {
        id: "ai-draft",
        targetId: "t-1",
        type: "classification",
        content: "Draft classification needs review.",
        status: "draft",
        createdAt: timestamp
      }
    ]
  };
}

function cleanState(): AppState {
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

function renderPanel(state: AppState) {
  return renderToStaticMarkup(
    <ReviewHealthDrillDownPanel
      state={state}
      reviewItems={buildDerivedReviewQueue(state)}
      appHealth={buildAppHealthReport(state)}
    />
  );
}

describe("ReviewHealthDrillDownPanel", () => {
  it("renders stable review ids, severity, reason, target, and evidence", () => {
    const html = renderPanel(stateWithIssues());

    expect(html).toContain("Review &amp; Health Drill-down");
    expect(html).toContain("Derived Review Queue Details");
    expect(html).toContain("derived-review:app-health:orphan_relationship:relationship:r-orphan");
    expect(html).toContain("warning");
    expect(html).toContain("Target");
    expect(html).toContain("Evidence");
  });

  it("renders suggested command drafts as JSON with safety copy", () => {
    const html = renderPanel(stateWithIssues());

    expect(html).toContain("Suggested commands are drafts only");
    expect(html).toContain("Confirmed Command Import");
    expect(html).toContain("Copy command JSON");
    expect(html).toContain("derived-command-draft/v0");
    expect(html).toContain("repair_relationship_endpoint");
    expect(html).toContain("requiresHumanConfirmation");
  });

  it("does not expose direct execute or direct apply suggested-command controls", () => {
    const html = renderPanel(stateWithIssues());

    expect(html).not.toContain("Execute suggested command");
    expect(html).not.toContain("Apply suggested command");
    expect(html).not.toContain("Run suggested command");
  });

  it("shows AppHealth issue details beyond summary counts", () => {
    const html = renderPanel(stateWithIssues());

    expect(html).toContain("AppHealth Issue Details");
    expect(html).toContain("orphan_relationship");
    expect(html).toContain("r-orphan");
    expect(html).toContain("source: relationship_context");
    expect(html).toContain("Evidence IDs");
  });

  it("renders empty states for clean derived reports", () => {
    const html = renderPanel(cleanState());

    expect(html).toContain("No derived review items.");
    expect(html).toContain("No app health issues detected.");
  });

  it("formats suggested command draft payloads for clipboard copy", () => {
    const command: DerivedReviewSuggestedCommandDraft = {
      id: "draft-1",
      commandType: "repair_relationship_endpoint",
      label: "Repair relationship endpoint",
      reason: "Relationship endpoint is missing.",
      target: { type: "relationship", id: "r-1" },
      requiresHumanConfirmation: true,
      payloadPreview: { sourceCode: "orphan_relationship" }
    };

    expect(formatSuggestedCommandJson(command)).toContain("\"schemaVersion\": \"derived-command-draft/v0\"");
    expect(formatSuggestedCommandJson(command)).toContain("\"commandType\": \"repair_relationship_endpoint\"");
    expect(formatSuggestedCommandJson(command)).toContain("\"requiresHumanConfirmation\": true");
  });

  it("filters to command-bearing review items without changing source items", () => {
    const state = stateWithIssues();
    const items = buildDerivedReviewQueue(state);
    const commandItems = filterDrillDownReviewItems(items, "with_commands");

    expect(commandItems.length).toBeGreaterThan(0);
    expect(commandItems.every((item) => item.suggestedCommands.length > 0)).toBe(true);
    expect(items.length).toBe(buildDerivedReviewQueue(state).length);
  });
});
