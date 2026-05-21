import type {
  AppState,
  BlockingQuestion,
  BlockingQuestionImpactLevel,
  BlockingQuestionOption,
  BlockingQuestionStatus
} from "./types";
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

export interface BlockingQuestionSummary {
  openCount: number;
  decidedCount: number;
  unresolvedCount: number;
  highestImpactUnresolved?: BlockingQuestion;
  suggestedNextDecision?: BlockingQuestion;
  allCoreDecided: boolean;
  readinessMessage: string;
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
  | "impactLevel"
  | "decisionNote"
  | "possibleOptions"
  | "preferredOptionId"
  | "linkedThoughtIds"
  | "linkedProjectIds"
  | "linkedUniverseIds"
>>;

const statuses: BlockingQuestionStatus[] = ["open", "in_review", "resolved", "archived"];
const impactLevels: BlockingQuestionImpactLevel[] = ["low", "medium", "high", "blocking"];
const coreTimestamp = "2026-01-01T00:00:00.000Z";

const coreBlockingQuestions: BlockingQuestion[] = [
  {
    id: "bq-thought-todo",
    question: "ThoughtItem 和 TodoItem 是否應該分開？",
    context: "This controls whether task workflows become their own object or stay inside ThoughtItem.type.",
    proposedResolution: "Start merged, then split TodoItem later only if task-specific workflow becomes complex.",
    finalResolution: "TodoItem 不獨立，task 暫時維持為 ThoughtItem 的一種 type。",
    status: "resolved",
    impactLevel: "blocking",
    decisionNote: "The current app can move faster by keeping task as a ThoughtItem type until repeated task behavior exists.",
    possibleOptions: [
      {
        id: "keep-separate",
        label: "keep separate",
        description: "Model ThoughtItem and TodoItem as separate first-class records from the start."
      },
      {
        id: "merge-into-one-item-with-type",
        label: "merge into one Item with type",
        description: "Use one item model and distinguish task, project, goal, question, and note through type."
      },
      {
        id: "start-merged-split-later",
        label: "start merged, split later",
        description: "Ship the merged model now and split once task behavior proves it needs its own lifecycle."
      }
    ],
    preferredOptionId: "merge-into-one-item-with-type",
    linkedThoughtIds: ["t-1"],
    linkedProjectIds: ["p-1"],
    linkedUniverseIds: ["u-thought"],
    createdAt: coreTimestamp,
    updatedAt: coreTimestamp
  },
  {
    id: "bq-universe-model",
    question: "Universe 是標籤、資料夾，還是獨立物件？",
    context: "This decides how thoughts, projects, relationships, and AI context are grouped across the app.",
    proposedResolution: "Universe should be an independent object that can group thoughts, projects, and relationships.",
    finalResolution: "Universe 是可建立、編輯、封存、刪除的一級物件。",
    status: "resolved",
    impactLevel: "blocking",
    decisionNote: "A first-class Universe keeps grouping, review, and handoff context portable.",
    possibleOptions: [
      {
        id: "tag",
        label: "tag",
        description: "Treat Universe as lightweight labels attached to items."
      },
      {
        id: "folder",
        label: "folder",
        description: "Treat Universe as a containment folder with one primary location per item."
      },
      {
        id: "independent-object",
        label: "independent object",
        description: "Make Universe a first-class object with metadata, status, and relationships."
      },
      {
        id: "hybrid",
        label: "hybrid",
        description: "Use Universe as an object while allowing tag-like cross references later."
      }
    ],
    preferredOptionId: "independent-object",
    linkedThoughtIds: ["t-1", "t-2"],
    linkedProjectIds: ["p-1"],
    linkedUniverseIds: ["u-thought", "u-ai"],
    createdAt: coreTimestamp,
    updatedAt: coreTimestamp
  },
  {
    id: "bq-engineering-readiness",
    question: "專案什麼時候可以進入工程階段？",
    context: "This decides whether a project can be treated as engineering-ready or still needs product clarification.",
    proposedResolution: "A project can enter engineering handoff when core model decisions, next action, and review blockers are resolved.",
    status: "in_review",
    impactLevel: "blocking",
    decisionNote: "Review Queue Center now exists; the remaining readiness decision should confirm the minimum architecture threshold.",
    possibleOptions: [
      {
        id: "after-core-data-model-decision",
        label: "after core data model decision",
        description: "Only proceed once object boundaries and data model tradeoffs are decided."
      },
      {
        id: "after-first-workflow-prototype",
        label: "after first workflow prototype",
        description: "Proceed after the primary capture-to-handoff workflow proves usable."
      },
      {
        id: "after-review-queue-confirms-minimum-architecture",
        label: "after review queue confirms minimum architecture",
        description: "Proceed when the review queue shows no unresolved blocking architecture questions."
      }
    ],
    preferredOptionId: "after-review-queue-confirms-minimum-architecture",
    linkedThoughtIds: ["t-1"],
    linkedProjectIds: ["p-1"],
    linkedUniverseIds: ["u-thought"],
    createdAt: coreTimestamp,
    updatedAt: coreTimestamp
  }
];

function questions(state: AppState) {
  return state.blockingQuestions ?? [];
}

function isStatus(value: unknown): value is BlockingQuestionStatus {
  return typeof value === "string" && statuses.includes(value as BlockingQuestionStatus);
}

function isImpactLevel(value: unknown): value is BlockingQuestionImpactLevel {
  return typeof value === "string" && impactLevels.includes(value as BlockingQuestionImpactLevel);
}

function text(value: string | undefined) {
  return value?.trim() ?? "";
}

function copyOptions(options: BlockingQuestionOption[] | undefined) {
  return (options ?? []).map((option) => ({ ...option }));
}

function copyQuestion(question: BlockingQuestion): BlockingQuestion {
  return {
    ...question,
    linkedThoughtIds: [...(question.linkedThoughtIds ?? [])],
    linkedProjectIds: [...(question.linkedProjectIds ?? [])],
    linkedUniverseIds: [...(question.linkedUniverseIds ?? [])],
    possibleOptions: copyOptions(question.possibleOptions)
  };
}

function coreMatch(question: BlockingQuestion) {
  return coreBlockingQuestions.find((coreQuestion) =>
    coreQuestion.id === question.id || coreQuestion.question === question.question
  );
}

function validPreferredOptionId(options: BlockingQuestionOption[], preferredOptionId: string | undefined) {
  if (!preferredOptionId) return undefined;
  return options.some((option) => option.id === preferredOptionId) ? preferredOptionId : undefined;
}

function normalizeQuestion(question: BlockingQuestion): BlockingQuestion {
  const coreQuestion = coreMatch(question);
  const possibleOptions = question.possibleOptions?.length
    ? copyOptions(question.possibleOptions)
    : copyOptions(coreQuestion?.possibleOptions);
  const preferredOptionId = validPreferredOptionId(
    possibleOptions,
    question.preferredOptionId ?? coreQuestion?.preferredOptionId
  );

  return {
    ...question,
    context: question.context ?? coreQuestion?.context ?? "",
    proposedResolution: question.proposedResolution ?? coreQuestion?.proposedResolution,
    finalResolution: question.finalResolution ?? coreQuestion?.finalResolution,
    status: isStatus(question.status) ? question.status : coreQuestion?.status ?? "open",
    impactLevel: isImpactLevel(question.impactLevel) ? question.impactLevel : coreQuestion?.impactLevel ?? "medium",
    decisionNote: question.decisionNote ?? question.finalResolution ?? question.proposedResolution ?? coreQuestion?.decisionNote ?? "",
    possibleOptions,
    preferredOptionId,
    linkedThoughtIds: question.linkedThoughtIds ?? coreQuestion?.linkedThoughtIds ?? [],
    linkedProjectIds: question.linkedProjectIds ?? coreQuestion?.linkedProjectIds ?? [],
    linkedUniverseIds: question.linkedUniverseIds ?? coreQuestion?.linkedUniverseIds ?? [],
    createdAt: question.createdAt ?? coreQuestion?.createdAt ?? now(),
    updatedAt: question.updatedAt ?? coreQuestion?.updatedAt ?? now()
  };
}

function impactRank(question: BlockingQuestion) {
  return {
    blocking: 4,
    high: 3,
    medium: 2,
    low: 1
  }[question.impactLevel ?? "medium"];
}

function timestamp(value: string | undefined) {
  return value ? Date.parse(value) || 0 : 0;
}

function compareDecisionPriority(a: BlockingQuestion, b: BlockingQuestion) {
  const byImpact = impactRank(b) - impactRank(a);
  if (byImpact !== 0) return byImpact;

  const byUpdated = timestamp(b.updatedAt) - timestamp(a.updatedAt);
  if (byUpdated !== 0) return byUpdated;

  return a.question.localeCompare(b.question) || a.id.localeCompare(b.id);
}

export function defaultBlockingQuestions() {
  return coreBlockingQuestions.map(copyQuestion);
}

export function normalizeBlockingQuestions(blockingQuestions: BlockingQuestion[] | undefined) {
  return blockingQuestions === undefined
    ? defaultBlockingQuestions()
    : blockingQuestions.map(normalizeQuestion);
}

export function normalizeAppState(state: AppState): AppState {
  return {
    ...state,
    blockingQuestions: normalizeBlockingQuestions(state.blockingQuestions),
    decisionRecords: state.decisionRecords ?? []
  };
}

export function getBlockingQuestionSummary(state: AppState): BlockingQuestionSummary {
  const normalizedQuestions = normalizeBlockingQuestions(state.blockingQuestions).filter(
    (question) => question.status !== "archived"
  );
  const unresolved = normalizedQuestions
    .filter((question) => question.status === "open" || question.status === "in_review")
    .sort(compareDecisionPriority);
  const decided = normalizedQuestions.filter((question) => question.status === "resolved");
  const allCoreDecided = coreBlockingQuestions.every((coreQuestion) =>
    normalizedQuestions.some((question) => question.id === coreQuestion.id && question.status === "resolved")
  );

  return {
    openCount: unresolved.length,
    decidedCount: decided.length,
    unresolvedCount: unresolved.length,
    highestImpactUnresolved: unresolved[0],
    suggestedNextDecision: unresolved[0],
    allCoreDecided,
    readinessMessage: allCoreDecided
      ? "Engineering readiness improved. Ready to evaluate engineering phase."
      : "Not fully ready for engineering while core blocking decisions remain open."
  };
}

function searchHaystack(question: BlockingQuestion) {
  return [
    question.question,
    question.context,
    question.proposedResolution,
    question.finalResolution,
    question.decisionNote,
    question.impactLevel,
    question.preferredOptionId,
    ...(question.possibleOptions ?? []).flatMap((option) => [option.label, option.description])
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
    impactLevel: "medium",
    decisionNote: "",
    possibleOptions: [],
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

  if (patch.impactLevel !== undefined && !isImpactLevel(patch.impactLevel)) {
    return { ok: false, state, error: "Invalid blocking question impact level." };
  }

  const normalizedPatch: BlockingQuestionPatch = { ...patch };

  if (patch.question !== undefined) normalizedPatch.question = text(patch.question);
  if (patch.context !== undefined) normalizedPatch.context = text(patch.context);
  if (patch.proposedResolution !== undefined) normalizedPatch.proposedResolution = text(patch.proposedResolution);
  if (patch.finalResolution !== undefined) normalizedPatch.finalResolution = text(patch.finalResolution);
  if (patch.decisionNote !== undefined) normalizedPatch.decisionNote = text(patch.decisionNote);
  if (patch.preferredOptionId !== undefined) normalizedPatch.preferredOptionId = text(patch.preferredOptionId) || undefined;
  if (patch.possibleOptions !== undefined) {
    normalizedPatch.possibleOptions = patch.possibleOptions.map((option) => ({
      id: text(option.id),
      label: text(option.label),
      description: text(option.description)
    })).filter((option) => option.id && option.label);
  }

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
