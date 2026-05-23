import { describe, expect, it } from "vitest";
import type { Project, Relationship } from "../types";
import {
  getCanonicalStatusSemantics,
  getProjectEffectiveStage,
  getProjectReadinessDrift,
  listCanonicalStatusSemantics
} from "./canonicalStatusSemantics";

const timestamp = "2026-01-01T00:00:00.000Z";

function project(patch: Partial<Project> = {}): Project {
  return {
    id: "p-canonical",
    universeId: "u-canonical",
    status: "active",
    lifecycleStatus: "planning",
    name: "Canonical Project",
    intent: "Clarify canonical status semantics.",
    users: ["Builder"],
    features: ["Status table"],
    screens: ["Project detail"],
    dataObjects: ["Project"],
    flowSteps: ["Review", "Handoff"],
    unknowns: [],
    nextAction: "Prepare status semantics.",
    readiness: "ready_for_engineering",
    createdAt: timestamp,
    updatedAt: timestamp,
    ...patch
  };
}

describe("canonical status semantics", () => {
  it("includes canonical entries for the required entity fields", () => {
    const keys = new Set(
      listCanonicalStatusSemantics().map((item) => `${item.entity}.${item.field}`)
    );

    expect([...keys]).toEqual(expect.arrayContaining([
      "Thought.status",
      "Project.status",
      "Project.lifecycleStatus",
      "Project.readiness",
      "BlockingQuestion.status",
      "DecisionRecord.status",
      "AIInsight.status",
      "Project.effectiveStage"
    ]));
    expect(getCanonicalStatusSemantics("Project", "readiness").map((item) => item.value)).toContain(
      "ready_for_engineering"
    );
  });

  it("gives archived project status the highest effective-stage precedence", () => {
    const item = project({
      status: "archived",
      lifecycleStatus: "handoff_ready"
    });
    const blocker: Relationship = {
      id: "r-block",
      sourceId: "t-blocker",
      sourceType: "thought",
      targetId: item.id,
      targetType: "project",
      type: "blocks",
      description: "Still lower precedence than archived."
    };

    expect(getProjectEffectiveStage(item, { relationships: [blocker] })).toMatchObject({
      stage: "archived",
      source: "project.status",
      blockers: []
    });
  });

  it("does not derive handoff_ready from ready_for_engineering readiness", () => {
    const item = project({
      lifecycleStatus: "planning",
      readiness: "ready_for_engineering"
    });

    expect(getProjectEffectiveStage(item)).toMatchObject({
      stage: "ready_for_engineering",
      source: "computed_readiness"
    });
  });

  it("reflects handoff_ready only when lifecycleStatus says handoff_ready", () => {
    const item = project({
      lifecycleStatus: "handoff_ready",
      readiness: "not_ready",
      users: [],
      features: [],
      screens: [],
      dataObjects: [],
      flowSteps: [],
      nextAction: ""
    });

    expect(getProjectEffectiveStage(item)).toMatchObject({
      stage: "handoff_ready",
      source: "project.lifecycleStatus",
      computedReadiness: "not_ready",
      readinessDrift: false
    });
  });

  it("lets active blockers affect effective stage without mutating stored readiness", () => {
    const item = project({ readiness: "ready_for_engineering" });
    const original = JSON.stringify(item);
    const blocker: Relationship = {
      id: "r-block",
      sourceId: "t-blocker",
      sourceType: "thought",
      targetId: item.id,
      targetType: "project",
      type: "blocks",
      description: "Blocks the project."
    };
    const result = getProjectEffectiveStage(item, { relationships: [blocker] });

    expect(result).toMatchObject({
      stage: "blocked",
      source: "active_blockers",
      storedReadiness: "ready_for_engineering",
      computedReadiness: "ready_for_engineering",
      readinessDrift: false,
      blockers: ["blocking_relationship"]
    });
    expect(JSON.stringify(item)).toBe(original);
  });

  it("detects stored versus computed readiness drift deterministically", () => {
    const item = project({
      readiness: "ready_for_engineering",
      intent: "",
      users: [],
      features: [],
      screens: [],
      dataObjects: [],
      flowSteps: [],
      nextAction: ""
    });

    expect(getProjectReadinessDrift(item)).toMatchObject({
      storedReadiness: "ready_for_engineering",
      computedReadiness: "not_ready",
      computedScore: 0,
      hasDrift: true
    });
    expect(getProjectEffectiveStage(item)).toMatchObject({
      stage: "not_ready",
      source: "computed_readiness",
      readinessDrift: true
    });
  });
});
