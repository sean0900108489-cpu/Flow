import { describe, expect, it } from "vitest";
import type { AppState, BlockingQuestion, DecisionRecord, Project, ThoughtItem } from "../types";
import {
  acceptedDecisionCanResolveBlockingQuestion,
  isBlockingQuestionResolved,
  shouldBlockingQuestionAppearInNextAction,
  shouldBlockingQuestionAppearInReviewQueue,
  shouldDecisionRecordAppearInReviewQueue
} from "./questionDecisionSemantics";
import {
  canProjectEnterEngineeringHandoff,
  getProjectUnresolvedHandoffQuestions,
  isProjectActive,
  isProjectArchived,
  isProjectBlocked,
  isProjectLifecycleHandoffReady,
  isProjectReadyForEngineering,
  shouldProjectAppearInHandoffReviewQueue
} from "./projectSemantics";
import {
  shouldAIInsightAppearInReviewQueue,
  shouldThoughtAppearInNextAction
} from "./statusSemantics";

const timestamp = "2026-01-01T00:00:00.000Z";

function project(patch: Partial<Project> = {}): Project {
  return {
    id: "p-semantic",
    universeId: "u-semantic",
    status: "active",
    lifecycleStatus: "planning",
    name: "Semantic Project",
    intent: "Clarify core semantics.",
    users: ["Builder"],
    features: ["Semantic helpers"],
    screens: ["Project detail"],
    dataObjects: ["Project"],
    flowSteps: ["Review", "Handoff"],
    unknowns: [],
    nextAction: "Prepare handoff.",
    readiness: "ready_for_engineering",
    createdAt: timestamp,
    updatedAt: timestamp,
    ...patch
  };
}

function thought(patch: Partial<ThoughtItem> = {}): ThoughtItem {
  return {
    id: "t-semantic",
    title: "Semantic thought",
    content: "",
    type: "task",
    status: "active",
    universeId: "u-semantic",
    why: "",
    outcome: "",
    nextAction: "Do the next step.",
    createdAt: timestamp,
    updatedAt: timestamp,
    ...patch
  };
}

function stateWithProject(item: Project, questions: BlockingQuestion[] = []): AppState {
  return {
    universes: [],
    thoughts: [thought()],
    projects: [item],
    relationships: [],
    aiInsights: [],
    blockingQuestions: questions,
    decisionRecords: []
  };
}

describe("status semantics", () => {
  it("formalizes TodoItem as a ThoughtItem task role instead of a persisted collection", () => {
    const task = thought({ type: "task" });
    const appState: AppState = {
      universes: [],
      thoughts: [task],
      projects: [],
      relationships: [],
      aiInsights: [],
      blockingQuestions: [],
      decisionRecords: []
    };

    expect(appState.thoughts[0].type).toBe("task");
    expect(Object.prototype.hasOwnProperty.call(appState, "todos")).toBe(false);
  });

  it("formalizes Universe as a persisted object referenced directly by thoughts and projects", () => {
    const item = project({ universeId: "u-semantic" });
    const task = thought({ universeId: "u-semantic" });
    const appState: AppState = {
      universes: [
        {
          id: "u-semantic",
          name: "Semantic Universe",
          description: "A persisted domain container.",
          purpose: "Group related thought and project records.",
          focus: "main"
        }
      ],
      thoughts: [task],
      projects: [item],
      relationships: [],
      aiInsights: [],
      blockingQuestions: [],
      decisionRecords: []
    };

    expect(appState.universes[0]).toMatchObject({
      id: "u-semantic",
      purpose: "Group related thought and project records."
    });
    expect(appState.thoughts[0].universeId).toBe("u-semantic");
    expect(appState.projects[0].universeId).toBe("u-semantic");
    expect(appState.relationships).toEqual([]);
  });

  it("keeps project data status, lifecycle, and readiness as separate meanings", () => {
    const archivedReadyProject = project({ status: "archived" });
    const handoffButNotReadyProject = project({
      lifecycleStatus: "handoff_ready",
      readiness: "not_ready",
      users: [],
      features: [],
      screens: [],
      dataObjects: [],
      flowSteps: []
    });

    expect(isProjectArchived(archivedReadyProject)).toBe(true);
    expect(isProjectActive(archivedReadyProject)).toBe(false);
    expect(canProjectEnterEngineeringHandoff(archivedReadyProject, stateWithProject(archivedReadyProject))).toBe(false);

    expect(isProjectLifecycleHandoffReady(handoffButNotReadyProject)).toBe(true);
    expect(isProjectReadyForEngineering(handoffButNotReadyProject)).toBe(false);
  });

  it("keeps ready_for_engineering as reviewable content maturity, not handoff_ready workflow state", () => {
    const readyPlanningProject = project({
      lifecycleStatus: "planning",
      readiness: "ready_for_engineering"
    });

    expect(isProjectReadyForEngineering(readyPlanningProject)).toBe(true);
    expect(isProjectLifecycleHandoffReady(readyPlanningProject)).toBe(false);
    expect(shouldProjectAppearInHandoffReviewQueue(readyPlanningProject)).toBe(true);
    expect(canProjectEnterEngineeringHandoff(readyPlanningProject, stateWithProject(readyPlanningProject))).toBe(true);
  });

  it("treats linked unresolved high impact questions as project handoff blockers", () => {
    const item = project();
    const question: BlockingQuestion = {
      id: "bq-semantic",
      question: "Can this project enter engineering?",
      status: "open",
      impactLevel: "blocking",
      linkedProjectIds: [item.id],
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const state = stateWithProject(item, [question]);

    expect(getProjectUnresolvedHandoffQuestions(item, state)).toEqual([question]);
    expect(isProjectBlocked(item, state)).toBe(true);
    expect(canProjectEnterEngineeringHandoff(item, state)).toBe(false);
  });

  it("centralizes review and next action visibility for thoughts, AI drafts, questions, and decisions", () => {
    expect(shouldThoughtAppearInNextAction(thought())).toBe(true);
    expect(shouldThoughtAppearInNextAction(thought({ status: "archived" }))).toBe(false);
    expect(shouldAIInsightAppearInReviewQueue({ status: "draft" })).toBe(true);
    expect(shouldAIInsightAppearInReviewQueue({ status: "accepted" })).toBe(false);
    expect(shouldBlockingQuestionAppearInReviewQueue({ status: "in_review" })).toBe(true);
    expect(shouldBlockingQuestionAppearInNextAction({ status: "archived" })).toBe(false);
    expect(shouldDecisionRecordAppearInReviewQueue({ status: "proposed" })).toBe(true);
    expect(shouldDecisionRecordAppearInReviewQueue({ status: "accepted" })).toBe(false);
  });

  it("captures accepted decision records as a resolution path for their source question", () => {
    const question: BlockingQuestion = {
      id: "bq-source",
      question: "Which data model should ship?",
      status: "resolved",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const accepted: DecisionRecord = {
      id: "decision-source",
      title: "Data model",
      decision: "Keep the merged model.",
      status: "accepted",
      sourceBlockingQuestionId: question.id,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const proposed: DecisionRecord = { ...accepted, id: "decision-proposed", status: "proposed" };

    expect(isBlockingQuestionResolved(question)).toBe(true);
    expect(acceptedDecisionCanResolveBlockingQuestion(accepted, question)).toBe(true);
    expect(acceptedDecisionCanResolveBlockingQuestion(proposed, question)).toBe(false);
  });
});
