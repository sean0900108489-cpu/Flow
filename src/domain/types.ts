export type ThoughtType = "inspiration" | "task" | "project" | "goal" | "question" | "note";
export type ThoughtStatus = "inbox" | "active" | "paused" | "done" | "archived";
export type ProjectStatus = "active" | "archived";
export type Readiness = "not_ready" | "needs_clarification" | "draftable" | "ready_for_engineering";

export interface Universe {
  id: string;
  name: string;
  description: string;
  purpose: string;
  focus: "main" | "secondary" | "someday";
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
}
