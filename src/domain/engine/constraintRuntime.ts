import type {
  DomainCommand,
  DomainCommandContext,
  DomainCommandSource
} from "../commandLayer";
import type { AppState } from "../types";

export type ConstraintSeverity = "info" | "warning" | "error";

export interface ConstraintIssue {
  code: string;
  message: string;
  severity: ConstraintSeverity;
  evidence?: unknown[];
}

export interface ConstraintCheckResult {
  allowed: boolean;
  severity: ConstraintSeverity;
  issues: ConstraintIssue[];
  disabledReason?: string;
  evidence?: unknown[];
}

const supportedCommandTypes = new Set([
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
]);

const genericHandoffUpdateTypes = new Set([
  "generic.update",
  "project.update",
  "project.updateDetails",
  "project.genericUpdate",
  "project.lifecycle.update",
  "project.lifecycleUpdate"
]);

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

const directMembershipCommandTypes = new Set([
  "thought.assignUniverse",
  "thought.linkProject",
  "thought.unlinkProject"
]);

const derivedStateKeys = new Set([
  "reviewItems",
  "ReviewItems",
  "reports",
  "appHealthReport",
  "projectReadinessReport",
  "thoughtProgressionReport",
  "derivedReviewQueue",
  "AIPlanningContext",
  "aiPlanningContext",
  "EngineeringHandoffPackage",
  "engineeringHandoffPackage",
  "engineeringHandoffPackageExport",
  "requiredSoftwarePlan",
  "projectEvolutionPlan"
]);

const destructiveMaintenanceCommandTypes = new Set([
  "appState.reset",
  "appState.deleteAll",
  "maintenance.reset",
  "maintenance.deleteAll",
  "maintenance.purge"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function issue(
  code: string,
  message: string,
  evidence: unknown[] = []
): ConstraintIssue {
  return {
    code,
    message,
    severity: "error",
    ...(evidence.length > 0 ? { evidence } : {})
  };
}

function payloadRecords(command: DomainCommand) {
  const records: Record<string, unknown>[] = [];

  if (isRecord(command.payload)) {
    records.push(command.payload);
    if (isRecord(command.payload.patch)) records.push(command.payload.patch);
  }

  return records;
}

function foundKeys(payload: Record<string, unknown>, keys: Set<string>) {
  return Object.keys(payload).filter((key) => keys.has(key));
}

function commandActor(ctx: DomainCommandContext): DomainCommandSource | undefined {
  return ctx.actor === "user" || ctx.actor === "ai" ? ctx.actor : undefined;
}

function lifecycleHandoffAttempt(command: DomainCommand) {
  if (command.type === "project.markHandoffReady") return false;

  return payloadRecords(command).some((payload) => payload.lifecycleStatus === "handoff_ready");
}

function requiresGuardedHandoffCommand(command: DomainCommand) {
  if (command.type === "project.markHandoffReady") return false;

  if (genericHandoffUpdateTypes.has(command.type)) {
    return lifecycleHandoffAttempt(command);
  }

  return lifecycleHandoffAttempt(command);
}

function persistedDerivedStateKeys(command: DomainCommand) {
  const keys = new Set<string>();

  for (const payload of payloadRecords(command)) {
    for (const key of foundKeys(payload, derivedStateKeys)) {
      keys.add(key);
    }
  }

  return [...keys];
}

function hasExplicitDestructiveConfirmation(command: DomainCommand) {
  if (!isRecord(command.payload)) return false;

  return command.payload.confirmDestructive === true ||
    command.payload.confirmation === "explicit" ||
    command.payload.destructiveConfirmation === true;
}

function resultFromIssues(issues: ConstraintIssue[]): ConstraintCheckResult {
  if (issues.length === 0) {
    return {
      allowed: true,
      severity: "info",
      issues: []
    };
  }

  return {
    allowed: false,
    severity: "error",
    issues,
    disabledReason: issues[0].message,
    evidence: issues.flatMap((item) => item.evidence ?? [{ code: item.code }])
  };
}

export function checkCommandAgainstConstraints(
  state: AppState,
  command: DomainCommand,
  ctx: DomainCommandContext = {}
): ConstraintCheckResult {
  void state;

  const issues: ConstraintIssue[] = [];

  if (commandActor(ctx) === "ai" && supportedCommandTypes.has(command.type)) {
    issues.push(issue(
      "ai_actor_cannot_execute_canonical_mutation",
      "AI actors cannot execute canonical mutation commands directly.",
      [{ actor: ctx.actor, commandType: command.type }]
    ));
  }

  if (requiresGuardedHandoffCommand(command)) {
    issues.push(issue(
      "handoff_ready_requires_guarded_command",
      "handoff_ready must be set through project.markHandoffReady.",
      [{ commandType: command.type }]
    ));
  }

  if (command.type.startsWith("relationship.")) {
    const blockedKeys = payloadRecords(command)
      .flatMap((payload) => foundKeys(payload, relationshipPayloadDirectRefKeys));

    if (blockedKeys.length > 0) {
      issues.push(issue(
        "relationship_command_cannot_update_direct_refs",
        "Relationship commands can only update graph relationships, not direct references.",
        [{ commandType: command.type, keys: [...new Set(blockedKeys)] }]
      ));
    }
  }

  if (directMembershipCommandTypes.has(command.type)) {
    const blockedKeys = payloadRecords(command)
      .flatMap((payload) => foundKeys(payload, directMembershipGraphKeys));

    if (blockedKeys.length > 0) {
      issues.push(issue(
        "direct_membership_command_cannot_update_graph",
        "Direct membership commands cannot create or update relationship graph edges.",
        [{ commandType: command.type, keys: [...new Set(blockedKeys)] }]
      ));
    }
  }

  const derivedKeys = persistedDerivedStateKeys(command);
  if (derivedKeys.length > 0) {
    issues.push(issue(
      "derived_state_persistence_forbidden",
      "Derived reports and planning packages must not be persisted into AppState.",
      [{ commandType: command.type, keys: derivedKeys }]
    ));
  }

  if (
    destructiveMaintenanceCommandTypes.has(command.type) &&
    !hasExplicitDestructiveConfirmation(command)
  ) {
    issues.push(issue(
      "destructive_maintenance_requires_confirmation",
      "Destructive maintenance commands require explicit destructive confirmation metadata.",
      [{ commandType: command.type }]
    ));
  }

  if (!supportedCommandTypes.has(command.type)) {
    issues.push(issue(
      "unsupported_command_type",
      `Unsupported command type: ${command.type}.`,
      [{ commandType: command.type }]
    ));
  }

  return resultFromIssues(issues);
}

export function getCommandDisabledReason(
  state: AppState,
  command: DomainCommand,
  ctx: DomainCommandContext = {}
): string | undefined {
  return checkCommandAgainstConstraints(state, command, ctx).disabledReason;
}

export const ScopeGuard = {
  checkCommandAgainstConstraints,
  getCommandDisabledReason
};
