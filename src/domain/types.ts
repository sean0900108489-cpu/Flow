export type ThoughtType = "inspiration" | "task" | "project" | "goal" | "question" | "note";
export type ThoughtStatus = "inbox" | "active" | "paused" | "done" | "archived";
export type ProjectStatus = "active" | "archived";
export type ProjectLifecycleStatus = "planning" | "handoff_ready" | "blocked";
export type UniverseStatus = "active" | "archived";
export type Readiness = "not_ready" | "needs_clarification" | "draftable" | "ready_for_engineering";
export type BlockingQuestionStatus = "open" | "in_review" | "resolved" | "archived";

export interface Universe {
  id: string;
  name: string;
  description: string;
  purpose: string;
  focus: "main" | "secondary" | "someday";
  status?: UniverseStatus;
}

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
  universeId: string;
  status: ProjectStatus;
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
  type: "belongs_to" | "depends_on" | "supports" | "blocks" | "evolves_into" | "related_to";
  description: string;
}

export interface BlockingQuestion {
  id: string;
  question: string;
  context?: string;
  proposedResolution?: string;
  finalResolution?: string;
  status: BlockingQuestionStatus;
  linkedThoughtIds?: string[];
  linkedProjectIds?: string[];
  linkedUniverseIds?: string[];
  createdAt: string;
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
}
