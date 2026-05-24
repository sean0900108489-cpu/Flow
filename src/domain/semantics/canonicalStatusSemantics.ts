import { readiness as computeProjectReadiness } from "../readiness";
import { hasBlockingRelationshipToProject } from "./projectSemantics";
import { blockingQuestionAffectsProjectHandoff } from "./questionDecisionSemantics";
import type {
  AIInsight,
  BlockingQuestionStatus,
  DecisionRecordStatus,
  Project,
  ProjectLifecycleStatus,
  ProjectStatus,
  Readiness,
  Relationship,
  ThoughtStatus
} from "../types";

export type CanonicalStatusEntity =
  | "Thought"
  | "Project"
  | "BlockingQuestion"
  | "DecisionRecord"
  | "AIInsight";

export type CanonicalStatusField =
  | "status"
  | "lifecycleStatus"
  | "readiness"
  | "effectiveStage";

export type EffectiveProjectStage =
  | "archived"
  | "handoff_ready"
  | "blocked"
  | "ready_for_engineering"
  | "draftable"
  | "needs_clarification"
  | "not_ready";

export type EffectiveProjectStageSource =
  | "project.status"
  | "project.lifecycleStatus"
  | "active_blockers"
  | "computed_readiness";

export type CanonicalStatusValue =
  | ThoughtStatus
  | ProjectStatus
  | ProjectLifecycleStatus
  | Readiness
  | BlockingQuestionStatus
  | DecisionRecordStatus
  | AIInsight["status"]
  | EffectiveProjectStage;

export interface CanonicalStatusSemanticsEntry {
  entity: CanonicalStatusEntity;
  field: CanonicalStatusField;
  value: CanonicalStatusValue;
  meaning: string;
  persisted: boolean;
  canBeAiDrafted: boolean;
  requiresHumanConfirmation: boolean;
  safetyNotes: string[];
  transitionNotes: string[];
}

export interface ProjectReadinessDrift {
  storedReadiness: Readiness;
  computedReadiness: Readiness;
  computedScore: number;
  missing: string[];
  hasDrift: boolean;
}

export interface ProjectEffectiveStage {
  projectId: string;
  stage: EffectiveProjectStage;
  source: EffectiveProjectStageSource;
  storedReadiness: Readiness;
  computedReadiness: Readiness;
  computedScore: number;
  readinessDrift: boolean;
  blockers: string[];
}

export interface ProjectEffectiveStageContext {
  relationships?: Relationship[];
  blockingQuestions?: Array<{
    question: string;
    status: BlockingQuestionStatus;
    impactLevel?: "low" | "medium" | "high" | "blocking";
    linkedProjectIds?: string[];
  }>;
}

function entry(
  entity: CanonicalStatusEntity,
  field: CanonicalStatusField,
  value: CanonicalStatusValue,
  meaning: string,
  options: {
    persisted?: boolean;
    canBeAiDrafted?: boolean;
    requiresHumanConfirmation?: boolean;
    safetyNotes?: string[];
    transitionNotes?: string[];
  } = {}
): CanonicalStatusSemanticsEntry {
  return {
    entity,
    field,
    value,
    meaning,
    persisted: options.persisted ?? true,
    canBeAiDrafted: options.canBeAiDrafted ?? false,
    requiresHumanConfirmation: options.requiresHumanConfirmation ?? false,
    safetyNotes: options.safetyNotes ?? [],
    transitionNotes: options.transitionNotes ?? []
  };
}

export const canonicalStatusSemantics = [
  entry("Thought", "status", "inbox", "Captured and awaiting triage.", {
    transitionNotes: ["May appear in triage/review flows before it has enough context."]
  }),
  entry("Thought", "status", "active", "Current thought record can participate in planning and next actions."),
  entry("Thought", "status", "paused", "Temporarily held; still retained as source context."),
  entry("Thought", "status", "done", "Completed thought/task role; retained for history."),
  entry("Thought", "status", "archived", "Hidden from active workflows without deleting persisted data.", {
    safetyNotes: ["Archived thoughts should not drive active next-action recommendations."]
  }),

  entry("Project", "status", "active", "Project can participate in active planning and handoff review."),
  entry("Project", "status", "archived", "Project is removed from active workflow consideration.", {
    safetyNotes: ["Archived project status has the highest effective-stage precedence."]
  }),

  entry("Project", "lifecycleStatus", "planning", "Default workflow state before explicit handoff readiness.", {
    transitionNotes: ["Default when lifecycleStatus is omitted on legacy projects."]
  }),
  entry("Project", "lifecycleStatus", "blocked", "Workflow is explicitly blocked.", {
    requiresHumanConfirmation: true,
    safetyNotes: ["Blocks effective stage without mutating stored readiness."]
  }),
  entry("Project", "lifecycleStatus", "handoff_ready", "Human-confirmed workflow state for engineering handoff.", {
    requiresHumanConfirmation: true,
    safetyNotes: ["Must come from the guarded handoff path, not computed readiness."]
  }),

  entry("Project", "readiness", "not_ready", "Project content is missing most handoff inputs."),
  entry("Project", "readiness", "needs_clarification", "Project content has a partial shape but needs clearer inputs."),
  entry("Project", "readiness", "draftable", "Project content can support a draft, not final handoff."),
  entry("Project", "readiness", "ready_for_engineering", "Project content is mature enough for handoff review.", {
    safetyNotes: ["Does not automatically imply lifecycleStatus handoff_ready."]
  }),

  entry("BlockingQuestion", "status", "open", "Question still needs resolution."),
  entry("BlockingQuestion", "status", "in_review", "Question has a review path but is not resolved yet.", {
    requiresHumanConfirmation: true
  }),
  entry("BlockingQuestion", "status", "resolved", "Question has an accepted resolution."),
  entry("BlockingQuestion", "status", "archived", "Question is retained but should not block active review."),

  entry("DecisionRecord", "status", "proposed", "Decision is proposed and awaits review.", {
    requiresHumanConfirmation: true
  }),
  entry("DecisionRecord", "status", "accepted", "Decision is accepted as current guidance.", {
    requiresHumanConfirmation: true
  }),
  entry("DecisionRecord", "status", "superseded", "Decision has been replaced by a newer decision."),
  entry("DecisionRecord", "status", "archived", "Decision is retained but inactive."),

  entry("AIInsight", "status", "draft", "AI suggestion exists but has not been accepted or rejected.", {
    safetyNotes: ["Draft AI output cannot mutate canonical state until a user confirms an allowed action."]
  }),
  entry("AIInsight", "status", "accepted", "User accepted the AI suggestion through allowed mutation paths.", {
    requiresHumanConfirmation: true
  }),
  entry("AIInsight", "status", "rejected", "User rejected the AI suggestion.", {
    requiresHumanConfirmation: true
  }),

  entry("Project", "effectiveStage", "archived", "Derived project stage when Project.status is archived.", {
    persisted: false,
    safetyNotes: ["Highest precedence."]
  }),
  entry("Project", "effectiveStage", "handoff_ready", "Derived project stage from lifecycleStatus handoff_ready.", {
    persisted: false,
    requiresHumanConfirmation: true,
    safetyNotes: ["Never derived from readiness alone."]
  }),
  entry("Project", "effectiveStage", "blocked", "Derived project stage from lifecycleStatus or active blockers.", {
    persisted: false,
    safetyNotes: ["Does not mutate stored readiness."]
  }),
  entry("Project", "effectiveStage", "ready_for_engineering", "Derived from computed readiness after higher gates pass.", {
    persisted: false
  }),
  entry("Project", "effectiveStage", "draftable", "Derived from computed readiness after higher gates pass.", {
    persisted: false
  }),
  entry("Project", "effectiveStage", "needs_clarification", "Derived from computed readiness after higher gates pass.", {
    persisted: false
  }),
  entry("Project", "effectiveStage", "not_ready", "Derived from computed readiness after higher gates pass.", {
    persisted: false
  })
] as const satisfies CanonicalStatusSemanticsEntry[];

export function listCanonicalStatusSemantics(): readonly CanonicalStatusSemanticsEntry[] {
  return canonicalStatusSemantics;
}

export function getCanonicalStatusSemantics(
  entity: CanonicalStatusEntity,
  field?: CanonicalStatusField
): readonly CanonicalStatusSemanticsEntry[] {
  return canonicalStatusSemantics.filter((item) =>
    item.entity === entity && (field === undefined || item.field === field)
  );
}

export function getProjectReadinessDrift(project: Project): ProjectReadinessDrift {
  const computed = computeProjectReadiness(project);

  return {
    storedReadiness: project.readiness,
    computedReadiness: computed.value,
    computedScore: computed.score,
    missing: computed.missing,
    hasDrift: project.readiness !== computed.value
  };
}

function lifecycleStatus(project: Pick<Project, "lifecycleStatus">): ProjectLifecycleStatus {
  return project.lifecycleStatus ?? "planning";
}

function projectBlockers(project: Project, context: ProjectEffectiveStageContext | undefined): string[] {
  if (!context) return [];

  const relationshipBlocker = context.relationships && hasBlockingRelationshipToProject(project, context.relationships)
    ? ["blocking_relationship"]
    : [];
  const questionBlockers = (context.blockingQuestions ?? [])
    .filter((question) => blockingQuestionAffectsProjectHandoff(question, project.id))
    .map((question) => `blocking_question:${question.question}`);

  return [...relationshipBlocker, ...questionBlockers];
}

export function getProjectEffectiveStage(
  project: Project,
  context?: ProjectEffectiveStageContext
): ProjectEffectiveStage {
  const readinessDrift = getProjectReadinessDrift(project);
  const base = {
    projectId: project.id,
    storedReadiness: readinessDrift.storedReadiness,
    computedReadiness: readinessDrift.computedReadiness,
    computedScore: readinessDrift.computedScore,
    readinessDrift: readinessDrift.hasDrift,
    blockers: [] as string[]
  };

  if (project.status === "archived") {
    return { ...base, stage: "archived", source: "project.status" };
  }

  const lifecycle = lifecycleStatus(project);

  if (lifecycle === "handoff_ready") {
    return { ...base, stage: "handoff_ready", source: "project.lifecycleStatus" };
  }

  if (lifecycle === "blocked") {
    return { ...base, stage: "blocked", source: "project.lifecycleStatus" };
  }

  const blockers = projectBlockers(project, context);

  if (blockers.length > 0) {
    return {
      ...base,
      stage: "blocked",
      source: "active_blockers",
      blockers
    };
  }

  return {
    ...base,
    stage: readinessDrift.computedReadiness,
    source: "computed_readiness"
  };
}
