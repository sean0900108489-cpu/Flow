import {
  getAllowedDomainCommandSchema,
  supportedDomainCommandTypes,
  type DomainCommand,
  type DomainCommandTargetType
} from "../commandLayer";

export type CommandImportFormat =
  | "single_command"
  | "command_array"
  | "wrapped_payload"
  | "unknown";

export interface CommandImportIssue {
  code: string;
  message: string;
  commandId?: string;
  commandType?: string;
  path?: string;
  evidence?: unknown;
}

export interface CommandImportValidationResult {
  ok: boolean;
  commands: DomainCommand[];
  errors: CommandImportIssue[];
  warnings: CommandImportIssue[];
  sourceSummary: {
    format: CommandImportFormat;
    commandCount: number;
  };
}

const supportedTypes = new Set<string>(supportedDomainCommandTypes);
const schemaByType = new Map(
  getAllowedDomainCommandSchema().map((entry) => [entry.type, entry])
);

const genericHandoffUpdateTypes = new Set([
  "generic.update",
  "project.update",
  "project.updateDetails",
  "project.genericUpdate"
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

const relationshipTypes = new Set([
  "belongs_to",
  "depends_on",
  "supports",
  "blocks",
  "evolves_into",
  "related_to"
]);

const relationshipNodeTypes = new Set([
  "thought",
  "project",
  "universe",
  "blocking_question",
  "decision_record"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function issue(
  code: string,
  message: string,
  command: unknown,
  path: string,
  evidence?: unknown
): CommandImportIssue {
  const record = isRecord(command) ? command : {};

  return {
    code,
    message,
    ...(text(record.id) ? { commandId: text(record.id) } : {}),
    ...(text(record.type) ? { commandType: text(record.type) } : {}),
    path,
    ...(evidence !== undefined ? { evidence } : {})
  };
}

function hasAnyKey(payload: Record<string, unknown>, keys: Set<string>) {
  return Object.keys(payload).some((key) => keys.has(key));
}

function payloadRecord(
  command: Record<string, unknown>,
  path: string,
  errors: CommandImportIssue[],
  required = true
) {
  if (command.payload === undefined && !required) return undefined;

  if (!isRecord(command.payload)) {
    errors.push(issue(
      "missing_required_field",
      "Command payload must be an object.",
      command,
      `${path}.payload`
    ));
    return undefined;
  }

  return command.payload;
}

function requirePayloadString(
  payload: Record<string, unknown> | undefined,
  key: string,
  command: Record<string, unknown>,
  path: string,
  errors: CommandImportIssue[]
) {
  if (!payload || !text(payload[key])) {
    errors.push(issue(
      "missing_required_field",
      `Payload field ${key} is required.`,
      command,
      `${path}.payload.${key}`
    ));
  }
}

function validateTarget(
  command: Record<string, unknown>,
  expectedType: DomainCommandTargetType | "none",
  path: string,
  errors: CommandImportIssue[],
  warnings: CommandImportIssue[]
) {
  if (expectedType === "none") {
    if (command.target !== undefined) {
      warnings.push(issue(
        "unused_target",
        "This command type does not require a target; target will be ignored by the command layer.",
        command,
        `${path}.target`
      ));
    }
    return;
  }

  if (!isRecord(command.target)) {
    errors.push(issue(
      "missing_required_field",
      `Command requires a ${expectedType} target.`,
      command,
      `${path}.target`
    ));
    return;
  }

  if (command.target.type !== expectedType || !text(command.target.id)) {
    errors.push(issue(
      "invalid_target",
      `Command target must be ${expectedType}:{id}.`,
      command,
      `${path}.target`,
      command.target
    ));
  }
}

function unsafeGenericHandoffAttempt(command: Record<string, unknown>) {
  const payload = isRecord(command.payload) ? command.payload : undefined;
  const patch = payload && isRecord(payload.patch) ? payload.patch : payload;

  return genericHandoffUpdateTypes.has(text(command.type)) &&
    patch?.lifecycleStatus === "handoff_ready";
}

function validatePayloadShape(
  command: Record<string, unknown>,
  path: string,
  errors: CommandImportIssue[]
) {
  const commandType = text(command.type);

  if (
    commandType.startsWith("relationship.") &&
    isRecord(command.payload) &&
    hasAnyKey(command.payload, relationshipPayloadDirectRefKeys)
  ) {
    errors.push(issue(
      "relationship_command_cannot_update_direct_refs",
      "Relationship commands can only update graph relationships, not direct references.",
      command,
      `${path}.payload`
    ));
  }

  if (
    (commandType === "thought.assignUniverse" || commandType === "thought.linkProject") &&
    isRecord(command.payload) &&
    hasAnyKey(command.payload, directMembershipGraphKeys)
  ) {
    errors.push(issue(
      "direct_membership_command_cannot_update_graph",
      "Direct membership commands cannot create or update relationship graph edges.",
      command,
      `${path}.payload`
    ));
  }

  switch (commandType) {
    case "thought.classify": {
      const payload = payloadRecord(command, path, errors);
      requirePayloadString(payload, "type", command, path, errors);
      break;
    }
    case "thought.assignUniverse": {
      const payload = payloadRecord(command, path, errors);
      requirePayloadString(payload, "universeId", command, path, errors);
      break;
    }
    case "thought.linkProject": {
      const payload = payloadRecord(command, path, errors);
      requirePayloadString(payload, "projectId", command, path, errors);
      break;
    }
    case "project.promoteFromThought":
      payloadRecord(command, path, errors, false);
      break;
    case "project.updateReadiness": {
      const payload = payloadRecord(command, path, errors);
      requirePayloadString(payload, "readiness", command, path, errors);
      break;
    }
    case "aiInsight.review": {
      const payload = payloadRecord(command, path, errors);
      requirePayloadString(payload, "status", command, path, errors);
      break;
    }
    case "project.markHandoffReady":
    case "relationship.delete":
      payloadRecord(command, path, errors, false);
      break;
    case "relationship.create": {
      const payload = payloadRecord(command, path, errors);
      requirePayloadString(payload, "sourceType", command, path, errors);
      requirePayloadString(payload, "sourceId", command, path, errors);
      requirePayloadString(payload, "targetType", command, path, errors);
      requirePayloadString(payload, "targetId", command, path, errors);
      requirePayloadString(payload, "type", command, path, errors);

      if (payload && text(payload.type) && !relationshipTypes.has(text(payload.type))) {
        errors.push(issue(
          "invalid_payload",
          "Relationship type is invalid.",
          command,
          `${path}.payload.type`
        ));
      }

      for (const key of ["sourceType", "targetType"]) {
        if (payload && text(payload[key]) && !relationshipNodeTypes.has(text(payload[key]))) {
          errors.push(issue(
            "invalid_payload",
            `Relationship ${key} is invalid.`,
            command,
            `${path}.payload.${key}`
          ));
        }
      }
      break;
    }
    case "relationship.update":
      payloadRecord(command, path, errors);
      break;
  }
}

function validateCommand(
  value: unknown,
  path: string
): { command?: DomainCommand; errors: CommandImportIssue[]; warnings: CommandImportIssue[] } {
  const errors: CommandImportIssue[] = [];
  const warnings: CommandImportIssue[] = [];

  if (!isRecord(value)) {
    errors.push(issue("invalid_command", "Command must be an object.", value, path));
    return { errors, warnings };
  }

  const id = text(value.id);
  const type = text(value.type);

  if (!id) {
    errors.push(issue("missing_required_field", "Command id is required.", value, `${path}.id`));
  }

  if (!type) {
    errors.push(issue("missing_required_field", "Command type is required.", value, `${path}.type`));
  }

  if (unsafeGenericHandoffAttempt(value)) {
    errors.push(issue(
      "unsafe_generic_handoff_ready",
      "handoff_ready must be set through project.markHandoffReady.",
      value,
      `${path}.payload`
    ));
  }

  if (type && !supportedTypes.has(type)) {
    errors.push(issue(
      "unknown_command_type",
      `Unsupported command type: ${type}.`,
      value,
      `${path}.type`
    ));
  }

  const source = value.source;
  if (source !== "user" && source !== "ai") {
    errors.push(issue(
      "missing_required_field",
      "Command source must be user or ai.",
      value,
      `${path}.source`
    ));
  }

  const confirmedByUser = value.confirmedByUser;
  if (typeof confirmedByUser !== "boolean") {
    if (source === "ai" && value.requiresHumanConfirmation === true) {
      warnings.push(issue(
        "ai_command_requires_apply_confirmation",
        "AI-origin command will require explicit Apply confirmation before execution.",
        value,
        `${path}.confirmedByUser`
      ));
    } else {
      errors.push(issue(
        "missing_confirmation_metadata",
        "Command confirmedByUser boolean is required.",
        value,
        `${path}.confirmedByUser`
      ));
    }
  }

  const schema = schemaByType.get(type as never);
  if (schema) {
    validateTarget(value, schema.targetType, path, errors, warnings);
    validatePayloadShape(value, path, errors);
  }

  if (errors.length > 0) return { errors, warnings };

  return {
    command: {
      id,
      type,
      ...(isRecord(value.target)
        ? {
            target: {
              type: text(value.target.type) as DomainCommandTargetType,
              id: text(value.target.id)
            }
          }
        : {}),
      ...(value.payload !== undefined ? { payload: value.payload } : {}),
      source: source as DomainCommand["source"],
      confirmedByUser: typeof confirmedByUser === "boolean" ? confirmedByUser : false
    },
    errors,
    warnings
  };
}

function parsePayload(raw: string | unknown): {
  value?: unknown;
  errors: CommandImportIssue[];
} {
  if (typeof raw !== "string") return { value: raw, errors: [] };

  try {
    return { value: JSON.parse(raw), errors: [] };
  } catch (error) {
    return {
      errors: [
        {
          code: "invalid_json",
          message: error instanceof Error ? error.message : "Invalid JSON.",
          path: "$"
        }
      ]
    };
  }
}

function commandValues(value: unknown): {
  format: CommandImportFormat;
  values: unknown[];
  errors: CommandImportIssue[];
} {
  if (Array.isArray(value)) {
    return { format: "command_array", values: value, errors: [] };
  }

  if (isRecord(value) && Array.isArray(value.commands)) {
    return { format: "wrapped_payload", values: value.commands, errors: [] };
  }

  if (isRecord(value) && text(value.type)) {
    return { format: "single_command", values: [value], errors: [] };
  }

  return {
    format: "unknown",
    values: [],
    errors: [
      {
        code: "unknown_payload_format",
        message: "Import payload must be a command object, command array, or { commands: [...] }.",
        path: "$"
      }
    ]
  };
}

export function confirmImportedCommandForExecution(command: DomainCommand): DomainCommand {
  return {
    ...command,
    confirmedByUser: true
  };
}

export function validateCommandImport(raw: string | unknown): CommandImportValidationResult {
  const parsed = parsePayload(raw);

  if (parsed.errors.length > 0) {
    return {
      ok: false,
      commands: [],
      errors: parsed.errors,
      warnings: [],
      sourceSummary: {
        format: "unknown",
        commandCount: 0
      }
    };
  }

  const source = commandValues(parsed.value);
  const commands: DomainCommand[] = [];
  const errors = [...source.errors];
  const warnings: CommandImportIssue[] = [];

  source.values.forEach((value, index) => {
    const path = source.format === "wrapped_payload" ? `$.commands[${index}]` : `$[${index}]`;
    const result = validateCommand(value, path);

    errors.push(...result.errors);
    warnings.push(...result.warnings);
    if (result.command) commands.push(result.command);
  });

  return {
    ok: errors.length === 0,
    commands,
    errors,
    warnings,
    sourceSummary: {
      format: source.format,
      commandCount: source.values.length
    }
  };
}
