import type { AppState, BlockingQuestion, BlockingQuestionStatus } from "./types";
import { id, now } from "./utils";

export interface BlockingQuestionActionResult {
  ok: boolean;
  state: AppState;
  error?: string;
}

export interface BlockingQuestionListOptions {
  status?: BlockingQuestionStatus | "all";
  searchText?: string;
}

export type BlockingQuestionInput = Pick<
  BlockingQuestion,
  "question" | "context" | "linkedThoughtIds" | "linkedProjectIds" | "linkedUniverseIds"
>;

export type BlockingQuestionPatch = Partial<Pick<
  BlockingQuestion,
  | "question"
  | "context"
  | "proposedResolution"
  | "finalResolution"
  | "status"
  | "linkedThoughtIds"
  | "linkedProjectIds"
  | "linkedUniverseIds"
>>;

const statuses: BlockingQuestionStatus[] = ["open", "in_review", "resolved", "archived"];

function questions(state: AppState) {
  return state.blockingQuestions ?? [];
}

function isStatus(value: unknown): value is BlockingQuestionStatus {
  return typeof value === "string" && statuses.includes(value as BlockingQuestionStatus);
}

function text(value: string | undefined) {
  return value?.trim() ?? "";
}

function searchHaystack(question: BlockingQuestion) {
  return [
    question.question,
    question.context,
    question.proposedResolution,
    question.finalResolution
  ].join(" ").toLowerCase();
}

export function listBlockingQuestions(state: AppState, options: BlockingQuestionListOptions = {}) {
  const status = options.status ?? "all";
  const searchText = text(options.searchText).toLowerCase();

  return questions(state).filter((question) => {
    const matchesStatus = status === "all" || question.status === status;
    const matchesSearch = !searchText || searchHaystack(question).includes(searchText);

    return matchesStatus && matchesSearch;
  });
}

export function createBlockingQuestion(state: AppState, input: BlockingQuestionInput): BlockingQuestionActionResult {
  const question = text(input.question);

  if (!question) {
    return { ok: false, state, error: "Question is required." };
  }

  const createdAt = now();
  const item: BlockingQuestion = {
    id: id("bq"),
    question,
    context: text(input.context),
    status: "open",
    linkedThoughtIds: input.linkedThoughtIds ?? [],
    linkedProjectIds: input.linkedProjectIds ?? [],
    linkedUniverseIds: input.linkedUniverseIds ?? [],
    createdAt,
    updatedAt: createdAt
  };

  return {
    ok: true,
    state: {
      ...state,
      blockingQuestions: [item, ...questions(state)]
    }
  };
}

export function updateBlockingQuestion(state: AppState, questionId: string, patch: BlockingQuestionPatch): BlockingQuestionActionResult {
  const existing = questions(state).find((question) => question.id === questionId);

  if (!existing) {
    return { ok: false, state, error: "Blocking question not found." };
  }

  if (patch.question !== undefined && !text(patch.question)) {
    return { ok: false, state, error: "Question is required." };
  }

  if (patch.status !== undefined && !isStatus(patch.status)) {
    return { ok: false, state, error: "Invalid blocking question status." };
  }

  const normalizedPatch: BlockingQuestionPatch = { ...patch };

  if (patch.question !== undefined) normalizedPatch.question = text(patch.question);
  if (patch.context !== undefined) normalizedPatch.context = text(patch.context);
  if (patch.proposedResolution !== undefined) normalizedPatch.proposedResolution = text(patch.proposedResolution);
  if (patch.finalResolution !== undefined) normalizedPatch.finalResolution = text(patch.finalResolution);

  return {
    ok: true,
    state: {
      ...state,
      blockingQuestions: questions(state).map((question) =>
        question.id === questionId ? { ...question, ...normalizedPatch, updatedAt: now() } : question
      )
    }
  };
}

export function resolveBlockingQuestion(state: AppState, questionId: string, finalResolution: string): BlockingQuestionActionResult {
  const resolution = text(finalResolution);

  if (!resolution) {
    return { ok: false, state, error: "Final resolution is required." };
  }

  return updateBlockingQuestion(state, questionId, {
    finalResolution: resolution,
    status: "resolved"
  });
}

export function archiveBlockingQuestion(state: AppState, questionId: string): BlockingQuestionActionResult {
  return updateBlockingQuestion(state, questionId, { status: "archived" });
}

export function deleteBlockingQuestion(state: AppState, questionId: string): BlockingQuestionActionResult {
  return {
    ok: true,
    state: {
      ...state,
      blockingQuestions: questions(state).filter((question) => question.id !== questionId)
    }
  };
}
