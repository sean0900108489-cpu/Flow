import { evaluateProjectHandoff } from "../engineeringHandoff";
import { readiness as projectReadiness } from "../readiness";
import {
  findRelationshipGraphNodesById,
  relationshipNodeTypes,
  relationshipTypes,
  resolveRelationshipEndpoint
} from "../relationships/relationshipGraph";
import { searchReviewQueue } from "../reviewQueue";
import type { AppState, AIInsight, RelationshipNodeType } from "../types";

export type AppStateInvariantSeverity = "info" | "warning" | "error";

export type AppStateInvariantWarning = {
  code: string;
  severity: AppStateInvariantSeverity;
  entityType?: string;
  entityId?: string;
  field?: string;
  message: string;
};

const thoughtStatuses = new Set(["inbox", "active", "paused", "done", "archived"]);
const thoughtTypes = new Set(["inspiration", "task", "project", "goal", "question", "note"]);
const projectStatuses = new Set(["active", "archived"]);
const projectLifecycleStatuses = new Set(["planning", "handoff_ready", "blocked"]);
const readinessValues = new Set(["not_ready", "needs_clarification", "draftable", "ready_for_engineering"]);
const aiInsightStatuses = new Set(["draft", "accepted", "rejected"]);
const blockingQuestionStatuses = new Set(["open", "in_review", "resolved", "archived"]);
const decisionRecordStatuses = new Set(["proposed", "accepted", "superseded", "archived"]);
const intrinsicNextActionPrefixes = new Set(["engineering_readiness", "system"]);
const aiPatchTargetTypes = new Set(["thought", "project"]);

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function warning(input: AppStateInvariantWarning): AppStateInvariantWarning {
  return input;
}

function collectionIds(items: Array<{ id: string }>) {
  return new Set(items.map((item) => item.id));
}

function fieldValue(entity: object, field: string) {
  return (entity as Record<string, unknown>)[field];
}

function addDuplicateIdWarnings(
  warnings: AppStateInvariantWarning[],
  collection: string,
  items: Array<{ id: string }>
) {
  const seen = new Set<string>();
  const duplicateIds = new Set<string>();

  for (const item of items) {
    if (seen.has(item.id)) {
      duplicateIds.add(item.id);
    }

    seen.add(item.id);
  }

  for (const id of duplicateIds) {
    warnings.push(warning({
      code: "duplicate_id",
      severity: "error",
      entityType: collection,
      entityId: id,
      field: "id",
      message: `${collection} contains duplicate id: ${id}.`
    }));
  }
}

function addInvalidEnumWarning(
  warnings: AppStateInvariantWarning[],
  entityType: string,
  entityId: string,
  field: string,
  value: unknown
) {
  warnings.push(warning({
    code: "invalid_enum",
    severity: "error",
    entityType,
    entityId,
    field,
    message: `${entityType} ${entityId} has invalid ${field}: ${String(value)}.`
  }));
}

function checkEnumField(
  warnings: AppStateInvariantWarning[],
  entityType: string,
  entityId: string,
  entity: object,
  field: string,
  allowed: Set<string>,
  options: { optional?: boolean } = {}
) {
  const value = fieldValue(entity, field);

  if (value === undefined && options.optional) return;

  if (typeof value !== "string" || !allowed.has(value)) {
    addInvalidEnumWarning(warnings, entityType, entityId, field, value);
  }
}

function addMissingReferenceWarning(
  warnings: AppStateInvariantWarning[],
  entityType: string,
  entityId: string,
  field: string,
  targetId: unknown,
  targetType: string
) {
  warnings.push(warning({
    code: "missing_reference",
    severity: "warning",
    entityType,
    entityId,
    field,
    message: `${entityType} ${entityId} references missing ${targetType}: ${String(targetId)}.`
  }));
}

function checkReference(
  warnings: AppStateInvariantWarning[],
  entityType: string,
  entityId: string,
  field: string,
  targetId: unknown,
  targetIds: Set<string>,
  targetType: string,
  options: { optional?: boolean } = {}
) {
  const cleanTargetId = text(targetId);

  if (!cleanTargetId && options.optional) return;

  if (!cleanTargetId || !targetIds.has(cleanTargetId)) {
    addMissingReferenceWarning(warnings, entityType, entityId, field, targetId, targetType);
  }
}

function checkReferenceList(
  warnings: AppStateInvariantWarning[],
  entityType: string,
  entityId: string,
  field: string,
  targetIds: unknown,
  validIds: Set<string>,
  targetType: string
) {
  if (!Array.isArray(targetIds)) return;

  for (const targetId of targetIds) {
    checkReference(warnings, entityType, entityId, field, targetId, validIds, targetType, { optional: true });
  }
}

function entityIdsByType(state: AppState) {
  return {
    thought: collectionIds(state.thoughts),
    project: collectionIds(state.projects),
    universe: collectionIds(state.universes),
    blocking_question: collectionIds(state.blockingQuestions ?? []),
    decision_record: collectionIds(state.decisionRecords ?? [])
  } satisfies Record<RelationshipNodeType, Set<string>>;
}

function entityExists(state: AppState, type: RelationshipNodeType, id: string) {
  return entityIdsByType(state)[type].has(id);
}

function isAIPatchTargetType(value: unknown): value is "thought" | "project" {
  return typeof value === "string" && aiPatchTargetTypes.has(value);
}

function addRelationshipEndpointWarnings(warnings: AppStateInvariantWarning[], state: AppState) {
  for (const relationship of state.relationships) {
    checkEnumField(
      warnings,
      "relationship",
      relationship.id,
      relationship,
      "type",
      new Set(relationshipTypes)
    );

    for (const endpoint of ["source", "target"] as const) {
      const endpointId = endpoint === "source" ? relationship.sourceId : relationship.targetId;
      const endpointType = endpoint === "source" ? relationship.sourceType : relationship.targetType;
      const resolution = resolveRelationshipEndpoint(state, endpointId, endpointType);

      if (resolution.status === "resolved") continue;

      const anyCandidates = findRelationshipGraphNodesById(state, endpointId);
      const code = resolution.status === "ambiguous"
        ? "ambiguous_relationship_endpoint"
        : "missing_relationship_endpoint";
      const typeMismatch = endpointType && anyCandidates.length > 0;

      warnings.push(warning({
        code,
        severity: "warning",
        entityType: "relationship",
        entityId: relationship.id,
        field: `${endpoint}Id`,
        message: typeMismatch
          ? `Relationship ${relationship.id} has ${endpoint} type ${endpointType} but ${endpointId} exists as ${anyCandidates.map((node) => node.type).join(", ")}.`
          : `Relationship ${relationship.id} has ${resolution.status} ${endpoint} endpoint: ${endpointId}.`
      }));
    }
  }
}

function checkDirectReferences(warnings: AppStateInvariantWarning[], state: AppState) {
  const universeIds = collectionIds(state.universes);
  const thoughtIds = collectionIds(state.thoughts);
  const projectIds = collectionIds(state.projects);
  const blockingQuestionIds = collectionIds(state.blockingQuestions ?? []);
  const decisionRecordIds = collectionIds(state.decisionRecords ?? []);

  for (const thought of state.thoughts) {
    checkReference(warnings, "thought", thought.id, "universeId", thought.universeId, universeIds, "universe");
    checkReference(warnings, "thought", thought.id, "projectId", thought.projectId, projectIds, "project", {
      optional: true
    });
  }

  for (const project of state.projects) {
    checkReference(warnings, "project", project.id, "universeId", project.universeId, universeIds, "universe");
    checkReference(warnings, "project", project.id, "sourceThoughtId", project.sourceThoughtId, thoughtIds, "thought", {
      optional: true
    });
    checkReferenceList(warnings, "project", project.id, "linkedThoughtIds", project.linkedThoughtIds, thoughtIds, "thought");
  }

  for (const question of state.blockingQuestions ?? []) {
    checkReferenceList(warnings, "blocking_question", question.id, "linkedThoughtIds", question.linkedThoughtIds, thoughtIds, "thought");
    checkReferenceList(warnings, "blocking_question", question.id, "linkedProjectIds", question.linkedProjectIds, projectIds, "project");
    checkReferenceList(warnings, "blocking_question", question.id, "linkedUniverseIds", question.linkedUniverseIds, universeIds, "universe");
    checkReference(
      warnings,
      "blocking_question",
      question.id,
      "sourceThoughtId",
      fieldValue(question, "sourceThoughtId"),
      thoughtIds,
      "thought",
      { optional: true }
    );
  }

  for (const record of state.decisionRecords ?? []) {
    checkReference(
      warnings,
      "decision_record",
      record.id,
      "sourceBlockingQuestionId",
      record.sourceBlockingQuestionId,
      blockingQuestionIds,
      "blocking_question",
      { optional: true }
    );
    checkReferenceList(warnings, "decision_record", record.id, "linkedThoughtIds", record.linkedThoughtIds, thoughtIds, "thought");
    checkReferenceList(warnings, "decision_record", record.id, "linkedProjectIds", record.linkedProjectIds, projectIds, "project");
    checkReferenceList(warnings, "decision_record", record.id, "linkedUniverseIds", record.linkedUniverseIds, universeIds, "universe");
    checkReference(
      warnings,
      "decision_record",
      record.id,
      "supersedesDecisionId",
      record.supersedesDecisionId,
      decisionRecordIds,
      "decision_record",
      { optional: true }
    );
  }
}

function inferredAIInsightTargetType(insight: AIInsight): RelationshipNodeType | undefined {
  if (insight.patch?.targetType === "thought" || insight.patch?.targetType === "project") {
    return insight.patch.targetType;
  }

  if (insight.type === "classification" || insight.type === "next_action") return "thought";
  if (insight.type === "project_readiness" || insight.type === "engineering_draft") return "project";

  return undefined;
}

function addAIInsightMissingTargetWarning(
  warnings: AppStateInvariantWarning[],
  insightId: string,
  field: string,
  targetType: RelationshipNodeType,
  targetId: string
) {
  warnings.push(warning({
    code: "ai_insight_target_missing",
    severity: "warning",
    entityType: "ai_insight",
    entityId: insightId,
    field,
    message: `AI insight ${insightId} references missing ${targetType}: ${targetId}.`
  }));
}

function addAIInsightInvalidPatchTargetTypeWarning(
  warnings: AppStateInvariantWarning[],
  insightId: string,
  targetType: unknown
) {
  warnings.push(warning({
    code: "invalid_patch_target_type",
    severity: "warning",
    entityType: "ai_insight",
    entityId: insightId,
    field: "patch.targetType",
    message: `AI insight ${insightId} has invalid patch targetType: ${String(targetType)}.`
  }));
}

function checkAIInsightTargets(warnings: AppStateInvariantWarning[], state: AppState) {
  for (const insight of state.aiInsights) {
    const targetType = inferredAIInsightTargetType(insight);

    if (targetType && !entityExists(state, targetType, insight.targetId)) {
      addAIInsightMissingTargetWarning(warnings, insight.id, "targetId", targetType, insight.targetId);
    }

    if (insight.patch) {
      if (!isAIPatchTargetType(insight.patch.targetType)) {
        addAIInsightInvalidPatchTargetTypeWarning(warnings, insight.id, insight.patch.targetType);
      } else if (!entityExists(state, insight.patch.targetType, insight.patch.targetId)) {
        addAIInsightMissingTargetWarning(
          warnings,
          insight.id,
          "patch.targetId",
          insight.patch.targetType,
          insight.patch.targetId
        );
      }
    }

    for (const operation of insight.patch?.operations ?? []) {
      if (operation.type === "updateThought" && !entityExists(state, "thought", operation.thoughtId)) {
        addAIInsightMissingTargetWarning(warnings, insight.id, "patch.operations.thoughtId", "thought", operation.thoughtId);
      }

      if (operation.type === "updateProject" && !entityExists(state, "project", operation.projectId)) {
        addAIInsightMissingTargetWarning(warnings, insight.id, "patch.operations.projectId", "project", operation.projectId);
      }
    }
  }
}

function addNextActionReferenceWarning(
  warnings: AppStateInvariantWarning[],
  actionId: string,
  field: string,
  message: string
) {
  warnings.push(warning({
    code: "next_action_reference_missing",
    severity: "warning",
    entityType: "next_action_state",
    entityId: actionId,
    field,
    message
  }));
}

function checkNextActionId(warnings: AppStateInvariantWarning[], state: AppState, actionId: unknown, field: string) {
  const cleanActionId = text(actionId);
  if (!cleanActionId) return;

  const separatorIndex = cleanActionId.indexOf(":");
  if (separatorIndex <= 0) {
    addNextActionReferenceWarning(warnings, cleanActionId, field, `Next action id is not encoded as source:id: ${cleanActionId}.`);
    return;
  }

  const prefix = cleanActionId.slice(0, separatorIndex);
  const id = cleanActionId.slice(separatorIndex + 1);

  if (intrinsicNextActionPrefixes.has(prefix)) return;

  if (prefix === "thought" || prefix === "project" || prefix === "blocking_question") {
    if (!entityExists(state, prefix, id)) {
      addNextActionReferenceWarning(warnings, cleanActionId, field, `Next action ${cleanActionId} references missing ${prefix}: ${id}.`);
    }

    return;
  }

  if (prefix === "review_queue") {
    const reviewQueueIds = new Set(searchReviewQueue(state).map((item) => item.id));
    if (!reviewQueueIds.has(id)) {
      addNextActionReferenceWarning(warnings, cleanActionId, field, `Next action ${cleanActionId} references missing review queue item: ${id}.`);
    }

    return;
  }

  addNextActionReferenceWarning(warnings, cleanActionId, field, `Next action ${cleanActionId} has unknown source prefix: ${prefix}.`);
}

function checkNextActionReferences(warnings: AppStateInvariantWarning[], state: AppState) {
  const nextActionState = state.nextActionState;

  if (!nextActionState) return;

  for (const actionId of nextActionState.savedActionIds ?? []) {
    checkNextActionId(warnings, state, actionId, "savedActionIds");
  }

  for (const actionId of nextActionState.dismissedActionIds ?? []) {
    checkNextActionId(warnings, state, actionId, "dismissedActionIds");
  }

  checkNextActionId(warnings, state, nextActionState.selectedFocusActionId, "selectedFocusActionId");
}

function addInvariantCheckFailure(
  warnings: AppStateInvariantWarning[],
  field: string,
  error: unknown
) {
  warnings.push(warning({
    code: "invariant_check_failed",
    severity: "error",
    field,
    message: error instanceof Error
      ? `Invariant checker could not finish ${field}: ${error.message}.`
      : `Invariant checker could not finish ${field}.`
  }));
}

export function validateAppStateInvariants(state: AppState): AppStateInvariantWarning[] {
  const warnings: AppStateInvariantWarning[] = [];

  addDuplicateIdWarnings(warnings, "universes", state.universes);
  addDuplicateIdWarnings(warnings, "thoughts", state.thoughts);
  addDuplicateIdWarnings(warnings, "projects", state.projects);
  addDuplicateIdWarnings(warnings, "relationships", state.relationships);
  addDuplicateIdWarnings(warnings, "aiInsights", state.aiInsights);
  addDuplicateIdWarnings(warnings, "blockingQuestions", state.blockingQuestions ?? []);
  addDuplicateIdWarnings(warnings, "decisionRecords", state.decisionRecords ?? []);

  for (const universe of state.universes) {
    checkEnumField(warnings, "universe", universe.id, universe, "status", new Set(["active", "archived"]), {
      optional: true
    });
  }

  for (const thought of state.thoughts) {
    checkEnumField(warnings, "thought", thought.id, thought, "status", thoughtStatuses);
    checkEnumField(warnings, "thought", thought.id, thought, "type", thoughtTypes);
  }

  for (const project of state.projects) {
    checkEnumField(warnings, "project", project.id, project, "status", projectStatuses);
    checkEnumField(warnings, "project", project.id, project, "lifecycleStatus", projectLifecycleStatuses, {
      optional: true
    });
    checkEnumField(warnings, "project", project.id, project, "readiness", readinessValues);
  }

  for (const insight of state.aiInsights) {
    checkEnumField(warnings, "ai_insight", insight.id, insight, "status", aiInsightStatuses);
    checkEnumField(warnings, "ai_insight", insight.id, insight, "type", new Set([
      "classification",
      "next_action",
      "relationship",
      "project_readiness",
      "engineering_draft"
    ]));
  }

  for (const question of state.blockingQuestions ?? []) {
    checkEnumField(warnings, "blocking_question", question.id, question, "status", blockingQuestionStatuses);
  }

  for (const record of state.decisionRecords ?? []) {
    checkEnumField(warnings, "decision_record", record.id, record, "status", decisionRecordStatuses);
  }

  for (const relationship of state.relationships) {
    checkEnumField(warnings, "relationship", relationship.id, relationship, "sourceType", new Set(relationshipNodeTypes), {
      optional: true
    });
    checkEnumField(warnings, "relationship", relationship.id, relationship, "targetType", new Set(relationshipNodeTypes), {
      optional: true
    });
  }

  try {
    addRelationshipEndpointWarnings(warnings, state);
  } catch (error) {
    addInvariantCheckFailure(warnings, "relationships", error);
  }

  checkDirectReferences(warnings, state);
  checkAIInsightTargets(warnings, state);

  try {
    checkNextActionReferences(warnings, state);
  } catch (error) {
    addInvariantCheckFailure(warnings, "nextActionState", error);
  }

  for (const project of state.projects) {
    try {
      const handoff = evaluateProjectHandoff(project, state);
      if (project.lifecycleStatus === "handoff_ready" && handoff.readiness !== "ready") {
        warnings.push(warning({
          code: "invalid_handoff_ready",
          severity: "warning",
          entityType: "project",
          entityId: project.id,
          field: "lifecycleStatus",
          message: `Project ${project.id} is handoff_ready but handoff evaluation is ${handoff.readiness}.`
        }));
      }

      const computedReadiness = projectReadiness(project);
      if (project.readiness !== computedReadiness.value) {
        warnings.push(warning({
          code: "readiness_drift",
          severity: "info",
          entityType: "project",
          entityId: project.id,
          field: "readiness",
          message: `Project ${project.id} stores readiness ${project.readiness} but computed readiness is ${computedReadiness.value}.`
        }));
      }
    } catch (error) {
      warnings.push(warning({
        code: "invariant_check_failed",
        severity: "error",
        entityType: "project",
        entityId: project.id,
        message: error instanceof Error
          ? `Invariant checker could not evaluate project ${project.id}: ${error.message}.`
          : `Invariant checker could not evaluate project ${project.id}.`
      }));
    }
  }

  return warnings;
}
