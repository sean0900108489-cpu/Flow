import { normalizeAppState } from "./appState";
import { buildDomainIndex } from "./domainIndex";
import { markProjectHandoffReady } from "./engineeringHandoff";
import { setAiInsightStatus } from "./mutations/aiPatchMutations";
import { updateThought } from "./mutations/appMutations";
import {
  linkThoughtToProject,
  promoteThoughtToProject,
  updateProjectDetails
} from "./projectActions";
import {
  createTypedRelationship,
  isSupportedRelationshipType,
  relationshipNodeTypes,
  resolveRelationshipEndpoint
} from "./relationships/relationshipGraph";
import type {
  AIInsight,
  AppState,
  Project,
  Readiness,
  Relationship,
  RelationshipNodeType,
  ThoughtStatus,
  ThoughtType
} from "./types";
import {
  validateAppStateInvariants,
  type AppStateInvariantWarning
} from "./validation/appStateInvariants";
import {
  checkCommandAgainstConstraints,
  type ConstraintCheckResult
} from "./engine/constraintRuntime";

export type DomainCommandSource = "user" | "ai";

export type DomainCommandTargetType =
  | "thought"
  | "project"
  | "relationship"
  | "aiInsight";

export interface DomainCommandTarget {
  type: DomainCommandTargetType;
  id: string;
}

export interface DomainCommand {
  id: string;
  type: string;
  target?: DomainCommandTarget;
  payload?: unknown;
  source: DomainCommandSource;
  confirmedByUser: boolean;
}

export interface DomainCommandContext {
  actor?: DomainCommandSource;
  actorId?: string;
}

export type DomainCommandErrorCode =
  | "ai_command_requires_user_confirmation"
  | "invalid_command_type"
  | "invalid_target"
  | "invalid_payload"
  | "forbidden_generic_handoff_ready"
  | "handoff_preflight_failed"
  | "relationship_command_cannot_update_direct_refs"
  | "direct_membership_command_cannot_update_graph"
  | "constraint_preflight_failed"
  | "mutation_failed";

export type DomainCommandWarning =
  | AppStateInvariantWarning
  | {
      code: string;
      message: string;
      evidence?: unknown[];
    };

export type CommandResult =
  | {
      ok: true;
      state: AppState;
      commandId: string;
      events?: Array<unknown>;
      warnings?: Array<DomainCommandWarning>;
    }
  | {
      ok: false;
      state: AppState;
      commandId?: string;
      error: {
        code: DomainCommandErrorCode;
        message: string;
        evidence?: Array<unknown>;
      };
      warnings?: Array<DomainCommandWarning>;
    };

export const supportedDomainCommandTypes = [
  "thought.classify",
  "thought.assignUniverse",
  "thought.linkProject",
  "project.promoteFromThought",
  "project.updateReadiness",
  "aiInsight.review",
  "project.markHandoffReady",
  "relationship.create",
  "relationship.update",
  "relationship.delete"
] as const;

export type SupportedDomainCommandType = typeof supportedDomainCommandTypes[number];

export interface DomainCommandSchemaEntry {
  type: SupportedDomainCommandType;
  targetType: DomainCommandTargetType | "none";
  payloadRequirements: string[];
  requiresUserConfirmation: true;
  safetyNotes: string[];
}

const allowedDomainCommandSchema = [
  {
    type: "thought.classify",
    targetType: "thought",
    payloadRequirements: ["type: ThoughtType", "optional status: ThoughtStatus"],
    requiresUserConfirmation: true,
    safetyNotes: ["Updates Thought type/status only through updateThought."]
  },
  {
    type: "thought.assignUniverse",
    targetType: "thought",
    payloadRequirements: ["universeId: existing Universe id"],
    requiresUserConfirmation: true,
    safetyNotes: ["Updates direct Thought.universeId only; does not create graph edges."]
  },
  {
    type: "thought.linkProject",
    targetType: "thought",
    payloadRequirements: ["projectId: existing Project id"],
    requiresUserConfirmation: true,
    safetyNotes: ["Updates direct thought/project membership only; does not create graph edges."]
  },
  {
    type: "project.promoteFromThought",
    targetType: "thought",
    payloadRequirements: ["optional title", "optional description", "optional nextAction"],
    requiresUserConfirmation: true,
    safetyNotes: ["Uses the existing thought-to-project promotion owner."]
  },
  {
    type: "project.updateReadiness",
    targetType: "project",
    payloadRequirements: ["readiness: Readiness"],
    requiresUserConfirmation: true,
    safetyNotes: ["Updates content maturity only; cannot set lifecycleStatus handoff_ready."]
  },
  {
    type: "aiInsight.review",
    targetType: "aiInsight",
    payloadRequirements: ["status: accepted | rejected"],
    requiresUserConfirmation: true,
    safetyNotes: ["Reviewing AI insight drafts still validates patch targets before state changes."]
  },
  {
    type: "project.markHandoffReady",
    targetType: "project",
    payloadRequirements: ["no payload required"],
    requiresUserConfirmation: true,
    safetyNotes: ["Only guarded handoff command can set lifecycleStatus handoff_ready."]
  },
  {
    type: "relationship.create",
    targetType: "none",
    payloadRequirements: [
      "sourceType: RelationshipNodeType",
      "sourceId: existing endpoint id",
      "targetType: RelationshipNodeType",
      "targetId: existing endpoint id",
      "type: supported relationship type",
      "optional description"
    ],
    requiresUserConfirmation: true,
    safetyNotes: ["Creates graph relationship only; does not update direct refs."]
  },
  {
    type: "relationship.update",
    targetType: "relationship",
    payloadRequirements: [
      "optional sourceType/sourceId",
      "optional targetType/targetId",
      "optional type",
      "optional description"
    ],
    requiresUserConfirmation: true,
    safetyNotes: ["Updates graph relationship only; direct refs are forbidden in payload."]
  },
  {
    type: "relationship.delete",
    targetType: "relationship",
    payloadRequirements: ["no payload required"],
    requiresUserConfirmation: true,
    safetyNotes: ["Deletes graph relationship only; direct refs are not repaired or modified."]
  }
] as const satisfies readonly DomainCommandSchemaEntry[];

export function getAllowedDomainCommandSchema(): readonly DomainCommandSchemaEntry[] {
  return allowedDomainCommandSchema;
}

const thoughtTypes: readonly ThoughtType[] = [
  "inspiration",
  "task",
  "project",
  "goal",
  "question",
  "note"
];

const thoughtStatuses: readonly ThoughtStatus[] = [
  "inbox",
  "active",
  "paused",
  "done",
  "archived"
];

const readinessValues: readonly Readiness[] = [
  "not_ready",
  "needs_clarification",
  "draftable",
  "ready_for_engineering"
];

const relationshipPayloadDirectRefKeys = new Set([
  "projectId",
  "linkedThoughtIds",
  "linkedProjectIds",
  "linkedUniverseIds",
  "sourceThoughtId",
  "universeId"
]);

const directMembershipGraphKeys = new Set([
  "relationship",
  "relationshipId",
  "relationshipType",
  "sourceId",
  "sourceType",
  "targetId",
  "targetType",
  "createRelationship",
  "graphEdge"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCommandResult(value: Record<string, unknown> | CommandResult): value is CommandResult {
  return typeof (value as { ok?: unknown }).ok === "boolean" &&
    "state" in value;
}

function commandId(command: unknown) {
  return isRecord(command) && typeof command.id === "string" && command.id.trim()
    ? command.id
    : undefined;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function fail(
  state: AppState,
  command: unknown,
  code: DomainCommandErrorCode,
  message: string,
  evidence: unknown[] = [],
  warnings: DomainCommandWarning[] = []
): CommandResult {
  return {
    ok: false,
    state,
    ...(commandId(command) ? { commandId: commandId(command) } : {}),
    error: {
      code,
      message,
      ...(evidence.length > 0 ? { evidence } : {})
    },
    ...(warnings.length > 0 ? { warnings } : {})
  };
}

function ok(
  state: AppState,
  command: DomainCommand,
  events: unknown[] = [],
  warnings: DomainCommandWarning[] = []
): CommandResult {
  const normalized = normalizeAppState(state);
  const invariantWarnings = validateAppStateInvariants(normalized);
  const allWarnings = [...warnings, ...invariantWarnings];

  return {
    ok: true,
    state: normalized,
    commandId: command.id,
    ...(events.length > 0 ? { events } : {}),
    ...(allWarnings.length > 0 ? { warnings: allWarnings } : {})
  };
}

function payloadRecord(state: AppState, command: DomainCommand): Record<string, unknown> | CommandResult {
  if (!isRecord(command.payload)) {
    return fail(state, command, "invalid_payload", "Command payload must be an object.");
  }

  return command.payload;
}

function target(
  state: AppState,
  command: DomainCommand,
  type: DomainCommandTargetType
): DomainCommandTarget | CommandResult {
  if (!command.target || command.target.type !== type || !text(command.target.id)) {
    return fail(state, command, "invalid_target", `Command requires a ${type} target.`);
  }

  return command.target;
}

function hasAnyKey(payload: Record<string, unknown>, keys: Set<string>) {
  return Object.keys(payload).some((key) => keys.has(key));
}

function assertRelationshipPayloadDoesNotTouchDirectRefs(
  state: AppState,
  command: DomainCommand,
  payload: Record<string, unknown>
): CommandResult | undefined {
  if (hasAnyKey(payload, relationshipPayloadDirectRefKeys)) {
    return fail(
      state,
      command,
      "relationship_command_cannot_update_direct_refs",
      "Relationship commands can only update graph relationships, not direct references."
    );
  }

  return undefined;
}

function assertDirectMembershipPayloadDoesNotTouchGraph(
  state: AppState,
  command: DomainCommand,
  payload: Record<string, unknown>
): CommandResult | undefined {
  if (hasAnyKey(payload, directMembershipGraphKeys)) {
    return fail(
      state,
      command,
      "direct_membership_command_cannot_update_graph",
      "Direct membership commands cannot create or update relationship graph edges."
    );
  }

  return undefined;
}

function unknownSourceOrConfirmation(command: unknown) {
  if (!isRecord(command)) return true;
  if (command.source !== "user" && command.source !== "ai") return true;

  return typeof command.confirmedByUser !== "boolean";
}

function isSuggestedMetadataOnly(command: unknown) {
  return isRecord(command) &&
    command.requiresHumanConfirmation === true &&
    (command.source !== "user" && command.source !== "ai");
}

function assertCommandEnvelope(state: AppState, command: unknown): CommandResult | undefined {
  if (!isRecord(command)) {
    return fail(state, command, "invalid_payload", "Command must be an object.");
  }

  if (!text(command.id)) {
    return fail(state, command, "invalid_payload", "Command id is required.");
  }

  if (!text(command.type)) {
    return fail(state, command, "invalid_command_type", "Command type is required.");
  }

  if (isSuggestedMetadataOnly(command)) {
    return fail(
      state,
      command,
      "invalid_payload",
      "Suggested command metadata cannot be executed directly."
    );
  }

  if (unknownSourceOrConfirmation(command)) {
    return fail(
      state,
      command,
      "invalid_payload",
      "Command source and confirmedByUser fields are required."
    );
  }

  if (command.confirmedByUser !== true) {
    const code = command.source === "ai"
      ? "ai_command_requires_user_confirmation"
      : "invalid_payload";

    return fail(
      state,
      command,
      code,
      "State-changing domain commands require explicit user confirmation."
    );
  }

  return undefined;
}

function ensureThought(state: AppState, id: string) {
  return buildDomainIndex(state).thoughtById[id];
}

function ensureProject(state: AppState, id: string) {
  return buildDomainIndex(state).projectById[id];
}

function ensureRelationship(state: AppState, id: string) {
  return buildDomainIndex(state).relationshipById[id];
}

function ensureAiInsight(state: AppState, id: string) {
  return buildDomainIndex(state).aiInsightById[id];
}

function thoughtClassify(state: AppState, command: DomainCommand): CommandResult {
  const commandTarget = target(state, command, "thought");
  if ("ok" in commandTarget) return commandTarget;
  if (!ensureThought(state, commandTarget.id)) {
    return fail(state, command, "invalid_target", "Thought target was not found.", [commandTarget]);
  }

  const payload = payloadRecord(state, command);
  if (isCommandResult(payload)) return payload;

  const type = text(payload.type);
  if (!thoughtTypes.includes(type as ThoughtType)) {
    return fail(state, command, "invalid_payload", "Payload type must be a valid ThoughtType.");
  }

  const status = payload.status === undefined ? undefined : text(payload.status);
  if (status !== undefined && !thoughtStatuses.includes(status as ThoughtStatus)) {
    return fail(state, command, "invalid_payload", "Payload status must be a valid ThoughtStatus.");
  }

  const result = updateThought(state, commandTarget.id, {
    type: type as ThoughtType,
    ...(status !== undefined ? { status: status as ThoughtStatus } : {})
  });

  return result.ok
    ? ok(result.state, command, [{ type: command.type, target: commandTarget }])
    : fail(state, command, "mutation_failed", result.error ?? "Thought classification failed.");
}

function thoughtAssignUniverse(state: AppState, command: DomainCommand): CommandResult {
  const commandTarget = target(state, command, "thought");
  if ("ok" in commandTarget) return commandTarget;
  if (!ensureThought(state, commandTarget.id)) {
    return fail(state, command, "invalid_target", "Thought target was not found.", [commandTarget]);
  }

  const payload = payloadRecord(state, command);
  if (isCommandResult(payload)) return payload;

  const graphGuard = assertDirectMembershipPayloadDoesNotTouchGraph(state, command, payload);
  if (graphGuard) return graphGuard;

  const universeId = text(payload.universeId);
  if (!universeId || !buildDomainIndex(state).universeById[universeId]) {
    return fail(state, command, "invalid_target", "Universe target was not found.", [{ universeId }]);
  }

  const result = updateThought(state, commandTarget.id, { universeId });

  return result.ok
    ? ok(result.state, command, [{ type: command.type, target: commandTarget }])
    : fail(state, command, "mutation_failed", result.error ?? "Universe assignment failed.");
}

function thoughtLinkProject(state: AppState, command: DomainCommand): CommandResult {
  const commandTarget = target(state, command, "thought");
  if ("ok" in commandTarget) return commandTarget;
  if (!ensureThought(state, commandTarget.id)) {
    return fail(state, command, "invalid_target", "Thought target was not found.", [commandTarget]);
  }

  const payload = payloadRecord(state, command);
  if (isCommandResult(payload)) return payload;

  const graphGuard = assertDirectMembershipPayloadDoesNotTouchGraph(state, command, payload);
  if (graphGuard) return graphGuard;

  const projectId = text(payload.projectId);
  if (!projectId || !ensureProject(state, projectId)) {
    return fail(state, command, "invalid_target", "Project target was not found.", [{ projectId }]);
  }

  const result = linkThoughtToProject(state, projectId, commandTarget.id);

  return result.ok
    ? ok(result.state, command, [{ type: command.type, target: commandTarget, projectId }])
    : fail(state, command, "mutation_failed", result.error ?? "Thought project link failed.");
}

function projectPromoteFromThought(state: AppState, command: DomainCommand): CommandResult {
  const commandTarget = target(state, command, "thought");
  if ("ok" in commandTarget) return commandTarget;
  if (!ensureThought(state, commandTarget.id)) {
    return fail(state, command, "invalid_target", "Thought target was not found.", [commandTarget]);
  }

  const payload = command.payload === undefined ? {} : payloadRecord(state, command);
  if (isCommandResult(payload)) return payload;

  const promoted = promoteThoughtToProject(state, commandTarget.id, {
    ...(payload.title !== undefined ? { title: text(payload.title) } : {}),
    ...(payload.description !== undefined ? { description: text(payload.description) } : {}),
    ...(payload.nextAction !== undefined ? { nextAction: text(payload.nextAction) } : {})
  });

  return promoted.ok
    ? ok(promoted.state, command, [{ type: command.type, thoughtId: commandTarget.id, projectId: promoted.projectId }])
    : fail(state, command, "mutation_failed", promoted.error ?? "Thought promotion failed.");
}

function projectUpdateReadiness(state: AppState, command: DomainCommand): CommandResult {
  const commandTarget = target(state, command, "project");
  if ("ok" in commandTarget) return commandTarget;
  if (!ensureProject(state, commandTarget.id)) {
    return fail(state, command, "invalid_target", "Project target was not found.", [commandTarget]);
  }

  const payload = payloadRecord(state, command);
  if (isCommandResult(payload)) return payload;

  const readiness = text(payload.readiness);
  if (!readinessValues.includes(readiness as Readiness)) {
    return fail(state, command, "invalid_payload", "Payload readiness must be a valid Readiness value.");
  }

  const result = updateProjectDetails(state, commandTarget.id, { readiness: readiness as Readiness });

  return result.ok
    ? ok(result.state, command, [{ type: command.type, target: commandTarget }])
    : fail(state, command, "mutation_failed", result.error ?? "Project readiness update failed.");
}

function aiInsightReview(state: AppState, command: DomainCommand): CommandResult {
  const commandTarget = target(state, command, "aiInsight");
  if ("ok" in commandTarget) return commandTarget;
  const insight = ensureAiInsight(state, commandTarget.id) as Readonly<AIInsight> | undefined;
  if (!insight) {
    return fail(state, command, "invalid_target", "AI insight target was not found.", [commandTarget]);
  }

  const payload = payloadRecord(state, command);
  if (isCommandResult(payload)) return payload;

  const status = text(payload.status);
  if (status !== "accepted" && status !== "rejected") {
    return fail(state, command, "invalid_payload", "AI insight review status must be accepted or rejected.");
  }

  const result = setAiInsightStatus(state, insight.id, status);
  if (result.statusChanged) {
    return ok(
      result.state,
      command,
      [{ type: command.type, target: commandTarget, status }],
      result.warnings.map((message) => ({ code: "ai_patch_warning", message }))
    );
  }

  const code = result.error === "target_missing" || result.error === "unsupported_target_type"
    ? "invalid_target"
    : result.error === "invalid_patch" || result.error === "invalid_value" || result.error === "no_allowed_changes"
      ? "invalid_payload"
      : "mutation_failed";

  return fail(
    state,
    command,
    code,
    result.error ?? "AI insight review failed.",
    [commandTarget, ...result.warnings]
  );
}

function projectMarkHandoffReady(state: AppState, command: DomainCommand): CommandResult {
  const commandTarget = target(state, command, "project");
  if ("ok" in commandTarget) return commandTarget;
  if (!ensureProject(state, commandTarget.id)) {
    return fail(state, command, "invalid_target", "Project target was not found.", [commandTarget]);
  }

  const result = markProjectHandoffReady(state, commandTarget.id);

  return result.ok
    ? ok(result.state, command, [{ type: command.type, target: commandTarget }])
    : fail(state, command, "handoff_preflight_failed", result.error ?? "Project handoff preflight failed.");
}

function relationshipNodeType(value: unknown): RelationshipNodeType | undefined {
  return typeof value === "string" && relationshipNodeTypes.includes(value as RelationshipNodeType)
    ? value as RelationshipNodeType
    : undefined;
}

function relationshipCreate(state: AppState, command: DomainCommand): CommandResult {
  const payload = payloadRecord(state, command);
  if (isCommandResult(payload)) return payload;

  const directRefGuard = assertRelationshipPayloadDoesNotTouchDirectRefs(state, command, payload);
  if (directRefGuard) return directRefGuard;

  const sourceType = relationshipNodeType(payload.sourceType);
  const targetType = relationshipNodeType(payload.targetType);
  const sourceId = text(payload.sourceId);
  const targetId = text(payload.targetId);
  const type = text(payload.type);

  if (!sourceType || !targetType || !sourceId || !targetId) {
    return fail(state, command, "invalid_payload", "Relationship create requires source and target endpoints.");
  }

  if (!isSupportedRelationshipType(type)) {
    return fail(state, command, "invalid_payload", "Relationship type is invalid.");
  }

  const result = createTypedRelationship(state, {
    sourceType,
    sourceId,
    targetType,
    targetId,
    type,
    description: text(payload.description)
  });

  return result.ok
    ? ok(result.state, command, [{ type: command.type, relationshipId: result.relationshipId }])
    : fail(state, command, "invalid_target", result.error ?? "Relationship create failed.");
}

function relationshipUpdate(state: AppState, command: DomainCommand): CommandResult {
  const commandTarget = target(state, command, "relationship");
  if ("ok" in commandTarget) return commandTarget;
  const existing = ensureRelationship(state, commandTarget.id);
  if (!existing) {
    return fail(state, command, "invalid_target", "Relationship target was not found.", [commandTarget]);
  }

  const payload = payloadRecord(state, command);
  if (isCommandResult(payload)) return payload;

  const directRefGuard = assertRelationshipPayloadDoesNotTouchDirectRefs(state, command, payload);
  if (directRefGuard) return directRefGuard;

  const nextSourceType = payload.sourceType === undefined
    ? existing.sourceType
    : relationshipNodeType(payload.sourceType);
  const nextTargetType = payload.targetType === undefined
    ? existing.targetType
    : relationshipNodeType(payload.targetType);
  const nextSourceId = payload.sourceId === undefined ? existing.sourceId : text(payload.sourceId);
  const nextTargetId = payload.targetId === undefined ? existing.targetId : text(payload.targetId);
  const nextType = payload.type === undefined ? existing.type : text(payload.type);

  if (!nextSourceId || !nextTargetId || !isSupportedRelationshipType(nextType)) {
    return fail(state, command, "invalid_payload", "Relationship update payload is invalid.");
  }

  if (payload.sourceType !== undefined && !nextSourceType || payload.targetType !== undefined && !nextTargetType) {
    return fail(state, command, "invalid_payload", "Relationship endpoint type is invalid.");
  }

  const source = resolveRelationshipEndpoint(state, nextSourceId, nextSourceType);
  const targetResolution = resolveRelationshipEndpoint(state, nextTargetId, nextTargetType);
  if (source.status !== "resolved" || targetResolution.status !== "resolved") {
    return fail(state, command, "invalid_target", "Relationship endpoint target was not found.", [
      source,
      targetResolution
    ]);
  }

  if (nextSourceId === nextTargetId && nextSourceType === nextTargetType) {
    return fail(state, command, "invalid_payload", "Relationship source and target must be different.");
  }

  const duplicate = state.relationships.some((relationship) =>
    relationship.id !== existing.id &&
    relationship.sourceId === nextSourceId &&
    relationship.targetId === nextTargetId &&
    relationship.type === nextType &&
    (relationship.sourceType ?? source.node?.type) === nextSourceType &&
    (relationship.targetType ?? targetResolution.node?.type) === nextTargetType
  );
  if (duplicate) {
    return fail(state, command, "invalid_payload", "Relationship already exists.");
  }

  const updated: Relationship = {
    ...existing,
    sourceId: nextSourceId,
    sourceType: nextSourceType,
    targetId: nextTargetId,
    targetType: nextTargetType,
    type: nextType,
    ...(payload.description !== undefined ? { description: text(payload.description) } : {})
  };

  return ok(
    {
      ...state,
      relationships: state.relationships.map((relationship) =>
        relationship.id === existing.id ? updated : relationship
      )
    },
    command,
    [{ type: command.type, target: commandTarget }]
  );
}

function relationshipDelete(state: AppState, command: DomainCommand): CommandResult {
  const commandTarget = target(state, command, "relationship");
  if ("ok" in commandTarget) return commandTarget;
  const existing = ensureRelationship(state, commandTarget.id);
  if (!existing) {
    return fail(state, command, "invalid_target", "Relationship target was not found.", [commandTarget]);
  }

  if (isRecord(command.payload)) {
    const directRefGuard = assertRelationshipPayloadDoesNotTouchDirectRefs(state, command, command.payload);
    if (directRefGuard) return directRefGuard;
  }

  return ok(
    {
      ...state,
      relationships: state.relationships.filter((relationship) => relationship.id !== existing.id)
    },
    command,
    [{ type: command.type, target: commandTarget }]
  );
}

function constraintFailureCode(check: ConstraintCheckResult): DomainCommandErrorCode {
  const codes = new Set(check.issues.map((item) => item.code));

  if (codes.has("handoff_ready_requires_guarded_command")) {
    return "forbidden_generic_handoff_ready";
  }

  if (codes.has("relationship_command_cannot_update_direct_refs")) {
    return "relationship_command_cannot_update_direct_refs";
  }

  if (codes.has("direct_membership_command_cannot_update_graph")) {
    return "direct_membership_command_cannot_update_graph";
  }

  if (codes.has("unsupported_command_type")) {
    return "invalid_command_type";
  }

  return "constraint_preflight_failed";
}

export function executeDomainCommand(
  state: AppState,
  command: DomainCommand,
  ctx: DomainCommandContext = {}
): CommandResult {
  const envelopeError = assertCommandEnvelope(state, command);
  if (envelopeError) return envelopeError;

  const constraintCheck = checkCommandAgainstConstraints(state, command, ctx);
  if (!constraintCheck.allowed) {
    return fail(
      state,
      command,
      constraintFailureCode(constraintCheck),
      constraintCheck.disabledReason ?? "Command blocked by ConstraintRuntime.",
      constraintCheck.evidence ?? constraintCheck.issues
    );
  }

  switch (command.type) {
    case "thought.classify":
      return thoughtClassify(state, command);
    case "thought.assignUniverse":
      return thoughtAssignUniverse(state, command);
    case "thought.linkProject":
      return thoughtLinkProject(state, command);
    case "project.promoteFromThought":
      return projectPromoteFromThought(state, command);
    case "project.updateReadiness":
      return projectUpdateReadiness(state, command);
    case "aiInsight.review":
      return aiInsightReview(state, command);
    case "project.markHandoffReady":
      return projectMarkHandoffReady(state, command);
    case "relationship.create":
      return relationshipCreate(state, command);
    case "relationship.update":
      return relationshipUpdate(state, command);
    case "relationship.delete":
      return relationshipDelete(state, command);
    default:
      return fail(state, command, "invalid_command_type", `Unsupported command type: ${command.type}.`);
  }
}
