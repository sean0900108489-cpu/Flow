export type ThoughtType = "inspiration" | "task" | "project" | "goal" | "question" | "note";
export type ThoughtStatus = "inbox" | "active" | "paused" | "done" | "archived";
export type ProjectStatus = "active" | "archived";
export type ProjectLifecycleStatus = "planning" | "handoff_ready" | "blocked";
export type UniverseStatus = "active" | "archived";
export type Readiness = "not_ready" | "needs_clarification" | "draftable" | "ready_for_engineering";
export type BlockingQuestionStatus = "open" | "in_review" | "resolved" | "archived";
export type BlockingQuestionImpactLevel = "low" | "medium" | "high" | "blocking";
export type DecisionRecordStatus = "proposed" | "accepted" | "superseded" | "archived";
export type RelationshipNodeType = "thought" | "project" | "universe" | "blocking_question" | "decision_record";
export type EngineeringReadinessConfidence = "low" | "medium" | "high";
export type EngineeringReadinessTargetPhase = "exploration" | "prototype" | "engineering";
export type EngineeringReadinessOverallStatus =
  | "not_ready"
  | "partially_ready"
  | "ready_to_prototype"
  | "ready_for_engineering";
export type EngineeringReadinessCriterionStatus = "met" | "partial" | "unmet" | "blocked";
export type NextActionConfidence = "low" | "medium" | "high";
export type NextActionFocusMode = "explore" | "decide" | "build" | "review";

export interface Universe {
  id: string;
  name: string;
  description: string;
  purpose: string;
  focus: "main" | "secondary" | "someday";
  status?: UniverseStatus;
}

// Todo items are currently represented as ThoughtItem records with type "task".
// Do not add a persisted todos[] collection without an explicit AppState migration.
export interface ThoughtItem {
  id: string;
  title: string;
  content: string;
  type: ThoughtType;
  status: ThoughtStatus;
  universeId: string;
  why: string;
  outcome: string;
  nextAction: string;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  sourceThoughtId?: string;
  linkedThoughtIds?: string[];
  // Universe is a persisted container object, not a tag/folder string.
  universeId: string;
  status: ProjectStatus;
  // lifecycleStatus is workflow state; readiness is content maturity.
  // ready_for_engineering must not imply handoff_ready.
  lifecycleStatus?: ProjectLifecycleStatus;
  name: string;
  intent: string;
  users: string[];
  features: string[];
  screens: string[];
  dataObjects: string[];
  flowSteps: string[];
  unknowns: string[];
  nextAction: string;
  readiness: Readiness;
  createdAt: string;
  updatedAt: string;
}

export interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  sourceType?: RelationshipNodeType;
  targetType?: RelationshipNodeType;
  type: "belongs_to" | "depends_on" | "supports" | "blocks" | "evolves_into" | "related_to";
  description: string;
}

export interface BlockingQuestionOption {
  id: string;
  label: string;
  description?: string;
}

export interface BlockingQuestion {
  id: string;
  question: string;
  context?: string;
  proposedResolution?: string;
  finalResolution?: string;
  status: BlockingQuestionStatus;
  impactLevel?: BlockingQuestionImpactLevel;
  decisionNote?: string;
  possibleOptions?: BlockingQuestionOption[];
  preferredOptionId?: string;
  linkedThoughtIds?: string[];
  linkedProjectIds?: string[];
  linkedUniverseIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export type DecisionRecord = {
  id: string;
  title: string;
  decision: string;
  rationale?: string;
  consequences?: string;
  status: DecisionRecordStatus;
  sourceBlockingQuestionId?: string;
  linkedThoughtIds?: string[];
  linkedProjectIds?: string[];
  linkedUniverseIds?: string[];
  supersedesDecisionId?: string;
  createdAt: string;
  updatedAt: string;
};

export interface EngineeringReadinessAssessment {
  note: string;
  manualConfidence: EngineeringReadinessConfidence;
  targetPhase: EngineeringReadinessTargetPhase;
  lastReviewedAt?: string;
  updatedAt: string;
}

export interface NextActionState {
  savedActionIds: string[];
  selectedFocusActionId?: string;
  dismissedActionIds: string[];
  manualNote: string;
  manualConfidence: NextActionConfidence;
  focusMode: NextActionFocusMode;
  lastReviewedAt?: string;
  updatedAt: string;
}

export type AIInsightPatchOperation =
  | {
      type: "updateThought";
      thoughtId: string;
      patch: Partial<ThoughtItem>;
    }
  | {
      type: "updateProject";
      projectId: string;
      patch: Partial<Project>;
    };

export interface AIInsightPatch {
  targetType: "thought" | "project";
  targetId: string;
  operations: AIInsightPatchOperation[];
}

export interface AIInsight {
  id: string;
  targetId: string;
  type: "classification" | "next_action" | "relationship" | "project_readiness" | "engineering_draft";
  content: string;
  status: "draft" | "accepted" | "rejected";
  createdAt: string;
  patch?: AIInsightPatch;
}

export interface AppState {
  universes: Universe[];
  thoughts: ThoughtItem[];
  projects: Project[];
  relationships: Relationship[];
  aiInsights: AIInsight[];
  blockingQuestions?: BlockingQuestion[];
  decisionRecords?: DecisionRecord[];
  engineeringReadiness?: EngineeringReadinessAssessment;
  nextActionState?: NextActionState;
}
