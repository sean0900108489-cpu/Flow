import {
  executeDomainCommand,
  type CommandResult,
  type DomainCommand,
  type DomainCommandContext,
  type DomainCommandWarning
} from "../commandLayer";
import type { AppState } from "../types";
import {
  confirmImportedCommandForExecution,
  type CommandImportIssue
} from "./commandImport";

export interface CommandDryRunAffectedEntity {
  type: string;
  id: string;
  label?: string;
}

export interface CommandDryRunPreview {
  summary: string;
  affectedEntities: CommandDryRunAffectedEntity[];
  expectedChanges: string[];
}

export interface CommandDryRunCommandResult {
  commandId?: string;
  commandType: string;
  ok: boolean;
  errors: CommandImportIssue[];
  warnings: CommandImportIssue[];
  preview: CommandDryRunPreview;
}

export interface CommandDryRunResult {
  ok: boolean;
  results: CommandDryRunCommandResult[];
  aggregate: {
    commandCount: number;
    executableCount: number;
    blockedCount: number;
    warningCount: number;
  };
}

function cloneAppState(state: AppState): AppState {
  return JSON.parse(JSON.stringify(state)) as AppState;
}

function warningToIssue(warning: DomainCommandWarning, command: DomainCommand): CommandImportIssue {
  const code = "code" in warning && typeof warning.code === "string"
    ? warning.code
    : "command_warning";
  const message = "message" in warning && typeof warning.message === "string"
    ? warning.message
    : "Command produced a warning.";

  return {
    code,
    message,
    commandId: command.id,
    commandType: command.type,
    evidence: "evidence" in warning ? warning.evidence : undefined
  };
}

function resultErrorToIssue(result: CommandResult, command: DomainCommand): CommandImportIssue[] {
  if (result.ok) return [];

  return [
    {
      code: result.error.code,
      message: result.error.message,
      commandId: command.id,
      commandType: command.type,
      evidence: result.error.evidence
    }
  ];
}

function targetAffectedEntity(command: DomainCommand): CommandDryRunAffectedEntity[] {
  const entities: CommandDryRunAffectedEntity[] = [];

  if (command.target) {
    entities.push({
      type: command.target.type,
      id: command.target.id
    });
  }

  const payload = typeof command.payload === "object" && command.payload !== null && !Array.isArray(command.payload)
    ? command.payload as Record<string, unknown>
    : undefined;

  if (command.type === "relationship.create" && payload) {
    for (const side of ["source", "target"] as const) {
      const type = payload[`${side}Type`];
      const id = payload[`${side}Id`];
      if (typeof type === "string" && typeof id === "string") {
        entities.push({ type, id, label: `${side} endpoint` });
      }
    }
  }

  return entities;
}

function countChanges(before: AppState, after: AppState) {
  const changes: string[] = [];
  const collections = [
    ["universes", before.universes.length, after.universes.length],
    ["thoughts", before.thoughts.length, after.thoughts.length],
    ["projects", before.projects.length, after.projects.length],
    ["relationships", before.relationships.length, after.relationships.length],
    ["aiInsights", before.aiInsights.length, after.aiInsights.length],
    ["blockingQuestions", before.blockingQuestions?.length ?? 0, after.blockingQuestions?.length ?? 0],
    ["decisionRecords", before.decisionRecords?.length ?? 0, after.decisionRecords?.length ?? 0]
  ] as const;

  for (const [name, beforeCount, afterCount] of collections) {
    if (beforeCount !== afterCount) {
      changes.push(`${name} count ${beforeCount} -> ${afterCount}`);
    }
  }

  return changes;
}

function targetedFieldChanges(before: AppState, after: AppState, command: DomainCommand) {
  const changes: string[] = [];
  const target = command.target;
  if (!target) return changes;

  if (target.type === "thought") {
    const beforeThought = before.thoughts.find((thought) => thought.id === target.id);
    const afterThought = after.thoughts.find((thought) => thought.id === target.id);
    if (beforeThought && afterThought) {
      if (beforeThought.type !== afterThought.type) changes.push(`thought type ${beforeThought.type} -> ${afterThought.type}`);
      if (beforeThought.status !== afterThought.status) changes.push(`thought status ${beforeThought.status} -> ${afterThought.status}`);
      if (beforeThought.universeId !== afterThought.universeId) changes.push(`thought universe ${beforeThought.universeId} -> ${afterThought.universeId}`);
      if (beforeThought.projectId !== afterThought.projectId) changes.push(`thought project ${beforeThought.projectId ?? "none"} -> ${afterThought.projectId ?? "none"}`);
    }
  }

  if (target.type === "project") {
    const beforeProject = before.projects.find((project) => project.id === target.id);
    const afterProject = after.projects.find((project) => project.id === target.id);
    if (beforeProject && afterProject) {
      if (beforeProject.readiness !== afterProject.readiness) changes.push(`project readiness ${beforeProject.readiness} -> ${afterProject.readiness}`);
      if (beforeProject.lifecycleStatus !== afterProject.lifecycleStatus) {
        changes.push(`project lifecycle ${beforeProject.lifecycleStatus ?? "planning"} -> ${afterProject.lifecycleStatus ?? "planning"}`);
      }
    }
  }

  if (target.type === "aiInsight") {
    const beforeInsight = before.aiInsights.find((insight) => insight.id === target.id);
    const afterInsight = after.aiInsights.find((insight) => insight.id === target.id);
    if (beforeInsight && afterInsight && beforeInsight.status !== afterInsight.status) {
      changes.push(`AI insight status ${beforeInsight.status} -> ${afterInsight.status}`);
    }
  }

  return changes;
}

function buildPreview(
  before: AppState,
  after: AppState,
  command: DomainCommand,
  result: CommandResult
): CommandDryRunPreview {
  if (!result.ok) {
    return {
      summary: `${command.type} would be blocked by the domain command layer.`,
      affectedEntities: targetAffectedEntity(command),
      expectedChanges: ["No state changes would be committed for this command."]
    };
  }

  const expectedChanges = [
    ...targetedFieldChanges(before, after, command),
    ...countChanges(before, after)
  ];

  return {
    summary: `${command.type} would execute through executeDomainCommand.`,
    affectedEntities: targetAffectedEntity(command),
    expectedChanges: expectedChanges.length > 0
      ? expectedChanges
      : ["No structural count change detected; command may update existing fields only."]
  };
}

export function dryRunCommandImport(
  state: AppState,
  commands: readonly DomainCommand[],
  ctx: DomainCommandContext = { actorId: "command-import-dry-run" }
): CommandDryRunResult {
  let simulatedState = cloneAppState(state);

  const results = commands.map((command) => {
    const beforeCommandState = cloneAppState(simulatedState);
    const executableCommand = confirmImportedCommandForExecution(command);
    const result = executeDomainCommand(simulatedState, executableCommand, ctx);
    const errors = resultErrorToIssue(result, command);
    const warnings = result.warnings?.map((warning) => warningToIssue(warning, command)) ?? [];

    if (result.ok) {
      simulatedState = result.state;
    }

    return {
      commandId: command.id,
      commandType: command.type,
      ok: result.ok,
      errors,
      warnings,
      preview: buildPreview(beforeCommandState, result.state, command, result)
    };
  });

  const executableCount = results.filter((result) => result.ok).length;
  const blockedCount = results.length - executableCount;
  const warningCount = results.reduce((count, result) => count + result.warnings.length, 0);

  return {
    ok: blockedCount === 0,
    results,
    aggregate: {
      commandCount: results.length,
      executableCount,
      blockedCount,
      warningCount
    }
  };
}
