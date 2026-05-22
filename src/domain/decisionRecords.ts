import type { AppState, DecisionRecord, DecisionRecordStatus } from "./types";
import {
  isBlockingQuestionArchived,
  isBlockingQuestionResolved
} from "./semantics/questionDecisionSemantics";
import { removeRelationshipsForNode } from "./relationships/relationshipGraph";
import { removeDeletedNodeReferences } from "./mutations/referenceCleanup";
import { id, now } from "./utils";

export interface DecisionRecordActionResult {
  state: AppState;
  ok: boolean;
  decisionRecordId?: string;
  error?: string;
}

export const decisionRecordNotFoundError = "decision_record_not_found";

export interface DecisionRecordListOptions {
  searchText?: string;
  status?: DecisionRecordStatus | "all";
  universeId?: string | "all";
  sourceBlockingQuestionId?: string;
}

export type DecisionRecordInput = Pick<DecisionRecord, "title" | "decision"> &
  Partial<Pick<
    DecisionRecord,
    | "rationale"
    | "consequences"
    | "status"
    | "sourceBlockingQuestionId"
    | "linkedThoughtIds"
    | "linkedProjectIds"
    | "linkedUniverseIds"
    | "supersedesDecisionId"
  >>;

export type DecisionRecordPatch = Partial<Pick<
  DecisionRecord,
  | "title"
  | "decision"
  | "rationale"
  | "consequences"
  | "status"
  | "linkedThoughtIds"
  | "linkedProjectIds"
  | "linkedUniverseIds"
  | "supersedesDecisionId"
>>;

const statuses: DecisionRecordStatus[] = ["proposed", "accepted", "superseded", "archived"];

function records(state: AppState) {
  return state.decisionRecords ?? [];
}

function text(value: string | undefined) {
  return value?.trim() ?? "";
}

function unique(values: string[] | undefined) {
  return Array.from(new Set(values ?? []));
}

function isStatus(value: unknown): value is DecisionRecordStatus {
  return typeof value === "string" && statuses.includes(value as DecisionRecordStatus);
}

function searchHaystack(record: DecisionRecord) {
  return [
    record.title,
    record.decision,
    record.rationale,
    record.consequences
  ].join(" ").toLowerCase();
}

function timestamp(value: string) {
  return Date.parse(value) || 0;
}

function compareRecords(a: DecisionRecord, b: DecisionRecord) {
  const byUpdatedAt = timestamp(b.updatedAt) - timestamp(a.updatedAt);

  if (byUpdatedAt !== 0) return byUpdatedAt;

  return a.id.localeCompare(b.id);
}

function normalizeInput(input: DecisionRecordInput) {
  return {
    ...input,
    title: text(input.title),
    decision: text(input.decision),
    rationale: text(input.rationale),
    consequences: text(input.consequences),
    status: input.status ?? "proposed",
    linkedThoughtIds: unique(input.linkedThoughtIds),
    linkedProjectIds: unique(input.linkedProjectIds),
    linkedUniverseIds: unique(input.linkedUniverseIds)
  };
}

function normalizePatch(patch: DecisionRecordPatch): DecisionRecordPatch {
  const normalized: DecisionRecordPatch = { ...patch };

  if (patch.title !== undefined) normalized.title = text(patch.title);
  if (patch.decision !== undefined) normalized.decision = text(patch.decision);
  if (patch.rationale !== undefined) normalized.rationale = text(patch.rationale);
  if (patch.consequences !== undefined) normalized.consequences = text(patch.consequences);
  if (patch.linkedThoughtIds !== undefined) normalized.linkedThoughtIds = unique(patch.linkedThoughtIds);
  if (patch.linkedProjectIds !== undefined) normalized.linkedProjectIds = unique(patch.linkedProjectIds);
  if (patch.linkedUniverseIds !== undefined) normalized.linkedUniverseIds = unique(patch.linkedUniverseIds);
  if (patch.supersedesDecisionId !== undefined) normalized.supersedesDecisionId = text(patch.supersedesDecisionId);

  return normalized;
}

export function listDecisionRecords(state: AppState, options: DecisionRecordListOptions = {}) {
  const searchText = text(options.searchText).toLowerCase();
  const status = options.status ?? "all";
  const universeId = options.universeId ?? "all";

  return records(state)
    .filter((record) => status === "all" || record.status === status)
    .filter((record) => universeId === "all" || record.linkedUniverseIds?.includes(universeId))
    .filter((record) =>
      !options.sourceBlockingQuestionId ||
      record.sourceBlockingQuestionId === options.sourceBlockingQuestionId
    )
    .filter((record) => !searchText || searchHaystack(record).includes(searchText))
    .sort(compareRecords);
}

export function createDecisionRecord(state: AppState, input: DecisionRecordInput): DecisionRecordActionResult {
  const normalized = normalizeInput(input);

  if (!normalized.title) {
    return { state, ok: false, error: "Decision title is required." };
  }

  if (!normalized.decision) {
    return { state, ok: false, error: "Decision is required." };
  }

  if (!isStatus(normalized.status)) {
    return { state, ok: false, error: "Invalid decision record status." };
  }

  const createdAt = now();
  const item: DecisionRecord = {
    id: id("decision"),
    title: normalized.title,
    decision: normalized.decision,
    rationale: normalized.rationale,
    consequences: normalized.consequences,
    status: normalized.status,
    sourceBlockingQuestionId: normalized.sourceBlockingQuestionId,
    linkedThoughtIds: normalized.linkedThoughtIds,
    linkedProjectIds: normalized.linkedProjectIds,
    linkedUniverseIds: normalized.linkedUniverseIds,
    supersedesDecisionId: normalized.supersedesDecisionId,
    createdAt,
    updatedAt: createdAt
  };

  return {
    state: {
      ...state,
      decisionRecords: [item, ...records(state)]
    },
    ok: true,
    decisionRecordId: item.id
  };
}

export function updateDecisionRecord(
  state: AppState,
  decisionRecordId: string,
  patch: DecisionRecordPatch
): DecisionRecordActionResult {
  const existing = records(state).find((record) => record.id === decisionRecordId);

  if (!existing) {
    return { state, ok: false, error: "Decision record not found." };
  }

  if (patch.title !== undefined && !text(patch.title)) {
    return { state, ok: false, error: "Decision title is required." };
  }

  if (patch.decision !== undefined && !text(patch.decision)) {
    return { state, ok: false, error: "Decision is required." };
  }

  if (patch.status !== undefined && !isStatus(patch.status)) {
    return { state, ok: false, error: "Invalid decision record status." };
  }

  const normalizedPatch = normalizePatch(patch);

  return {
    state: {
      ...state,
      decisionRecords: records(state).map((record) =>
        record.id === decisionRecordId ? { ...record, ...normalizedPatch, updatedAt: now() } : record
      )
    },
    ok: true,
    decisionRecordId
  };
}

export function acceptDecisionRecord(state: AppState, decisionRecordId: string) {
  const record = records(state).find((item) => item.id === decisionRecordId);
  const result = updateDecisionRecord(state, decisionRecordId, { status: "accepted" });

  if (!result.ok || !record?.sourceBlockingQuestionId) return result;

  return {
    ...result,
    state: {
      ...result.state,
      blockingQuestions: (result.state.blockingQuestions ?? []).map((question) =>
        question.id === record.sourceBlockingQuestionId && !isBlockingQuestionArchived(question)
          ? {
              ...question,
              status: "resolved" as const,
              finalResolution: text(question.finalResolution) || record.decision,
              decisionNote: text(question.decisionNote) || text(record.rationale) || record.decision,
              updatedAt: now()
            }
          : question
      )
    }
  };
}

export function supersedeDecisionRecord(
  state: AppState,
  decisionRecordId: string,
  supersededById?: string
) {
  const result = updateDecisionRecord(state, decisionRecordId, { status: "superseded" });

  if (!result.ok || !supersededById) return result;

  return updateDecisionRecord(result.state, supersededById, { supersedesDecisionId: decisionRecordId });
}

export function archiveDecisionRecord(state: AppState, decisionRecordId: string) {
  return updateDecisionRecord(state, decisionRecordId, { status: "archived" });
}

export function deleteDecisionRecord(state: AppState, decisionRecordId: string): DecisionRecordActionResult {
  const decisionRecord = records(state).find((item) => item.id === decisionRecordId);

  if (!decisionRecord) {
    return { state, ok: false, error: decisionRecordNotFoundError };
  }

  const relationshipCleanup = removeRelationshipsForNode(state, { id: decisionRecordId, type: "decision_record" });
  const referenceCleanup = removeDeletedNodeReferences(relationshipCleanup.state, {
    id: decisionRecordId,
    type: "decision_record"
  });

  return {
    state: {
      ...referenceCleanup,
      decisionRecords: (referenceCleanup.decisionRecords ?? []).filter((record) => record.id !== decisionRecordId)
    },
    ok: true
  };
}

export function createDecisionFromBlockingQuestion(
  state: AppState,
  blockingQuestionId: string
): DecisionRecordActionResult {
  const question = (state.blockingQuestions ?? []).find((item) => item.id === blockingQuestionId);

  if (!question) {
    return { state, ok: false, error: "Blocking question not found." };
  }

  const decision = text(question.finalResolution) || text(question.proposedResolution);

  if (!decision) {
    return {
      state,
      ok: false,
      error: "Blocking question needs a resolution before creating a decision."
    };
  }

  return createDecisionRecord(state, {
    title: question.question,
    decision,
    rationale: question.context,
    status: isBlockingQuestionResolved(question) ? "accepted" : "proposed",
    sourceBlockingQuestionId: question.id,
    linkedThoughtIds: question.linkedThoughtIds,
    linkedProjectIds: question.linkedProjectIds,
    linkedUniverseIds: question.linkedUniverseIds
  });
}
