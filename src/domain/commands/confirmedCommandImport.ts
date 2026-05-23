import {
  executeDomainCommand,
  type DomainCommand,
  type DomainCommandContext,
  type DomainCommandWarning
} from "../commandLayer";
import { normalizeAppState } from "../appState";
import type { AppState } from "../types";
import {
  confirmImportedCommandForExecution,
  type CommandImportIssue
} from "./commandImport";

export interface ConfirmedCommandApplyOptions extends DomainCommandContext {
  confirmed: boolean;
}

export interface ConfirmedCommandApplyResult {
  ok: boolean;
  state: AppState;
  appliedCount: number;
  errors: CommandImportIssue[];
  warnings: CommandImportIssue[];
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

export function applyConfirmedCommandImport(
  state: AppState,
  commands: readonly DomainCommand[],
  options: ConfirmedCommandApplyOptions
): ConfirmedCommandApplyResult {
  if (!options.confirmed) {
    return {
      ok: false,
      state,
      appliedCount: 0,
      errors: [
        {
          code: "apply_requires_user_confirmation",
          message: "Imported commands can only be applied after explicit user confirmation."
        }
      ],
      warnings: []
    };
  }

  let nextState = cloneAppState(state);
  const warnings: CommandImportIssue[] = [];

  for (const command of commands) {
    const result = executeDomainCommand(
      nextState,
      confirmImportedCommandForExecution(command),
      {
        actor: options.actor,
        actorId: options.actorId
      }
    );

    warnings.push(...(result.warnings?.map((warning) => warningToIssue(warning, command)) ?? []));

    if (!result.ok) {
      return {
        ok: false,
        state,
        appliedCount: 0,
        errors: [
          {
            code: result.error.code,
            message: result.error.message,
            commandId: command.id,
            commandType: command.type,
            evidence: result.error.evidence
          }
        ],
        warnings
      };
    }

    nextState = result.state;
  }

  return {
    ok: true,
    state: normalizeAppState(nextState),
    appliedCount: commands.length,
    errors: [],
    warnings
  };
}
