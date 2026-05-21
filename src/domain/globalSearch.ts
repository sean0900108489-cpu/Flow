import { listNextActions } from "./nextActions";
import { resolveRelationshipNode } from "./relationshipExplorer";
import type { AppState, Relationship } from "./types";

export type GlobalSearchResultType =
  | "thought"
  | "project"
  | "universe"
  | "blocking_question"
  | "decision_record"
  | "relationship"
  | "next_action"
  | "command";

export type GlobalSearchResult = {
  id: string;
  type: GlobalSearchResultType;
  title: string;
  subtitle?: string;
  body?: string;
  status?: string;
  universeId?: string;
  targetId?: string;
  targetType?: string;
  score: number;
  updatedAt?: string;
};

export type GlobalSearchOptions = {
  searchText?: string;
  type?: GlobalSearchResultType | "all";
  universeId?: string | "all";
  status?: string | "all";
};

export type GlobalSearchResultCounts = {
  total: number;
  thoughts: number;
  projects: number;
  universes: number;
  blockingQuestions: number;
  decisionRecords: number;
  relationships: number;
  nextActions: number;
  commands: number;
};

const commands: Array<{ id: string; title: string; screen: string; subtitle: string }> = [
  { id: "command:dashboard", title: "Open Dashboard", screen: "dashboard", subtitle: "Go to Universe Dashboard" },
  { id: "command:capture", title: "Open Quick Capture", screen: "capture", subtitle: "Capture a new thought" },
  { id: "command:review-queue", title: "Open Review Queue", screen: "review-queue", subtitle: "Review drafts and pending decisions" },
  { id: "command:engineering-readiness", title: "Open Engineering Readiness", screen: "engineering-readiness", subtitle: "Review engineering phase readiness" },
  { id: "command:thought-triage", title: "Open Thought Triage", screen: "thought-triage", subtitle: "Review inbox thoughts" },
  { id: "command:next-actions", title: "Open Next Action Center", screen: "next-actions", subtitle: "Choose the next action" },
  { id: "command:projects", title: "Open Projects", screen: "projects", subtitle: "Manage projects" },
  { id: "command:universes", title: "Open Universes", screen: "universes", subtitle: "Manage universes" },
  { id: "command:archived", title: "Open Archived Items", screen: "archived", subtitle: "Restore or delete archived items" },
  { id: "command:blocking-questions", title: "Open Decision Center", screen: "blocking-questions", subtitle: "Review blockers and core decisions" },
  { id: "command:decision-records", title: "Open Decision Records", screen: "decision-records", subtitle: "Review decisions" },
  { id: "command:engineering-handoff", title: "Open Engineering Handoff", screen: "engineering-handoff", subtitle: "Review handoff readiness" },
  { id: "command:relationship-explorer", title: "Open Relationship Explorer", screen: "relationship-explorer", subtitle: "Inspect impact map" },
  { id: "command:transfer", title: "Open App State Transfer", screen: "transfer", subtitle: "Import or export app state" },
  { id: "command:export", title: "Open Engineering Export", screen: "export", subtitle: "Export engineering handoff JSON" }
];

function clean(value: string | undefined) {
  return value?.trim() ?? "";
}

function firstValue(values: string[] | undefined) {
  return values?.find((value) => clean(value));
}

function timestamp(value: string | undefined) {
  return value ? Date.parse(value) || 0 : 0;
}

function haystack(result: GlobalSearchResult) {
  return [
    result.title,
    result.subtitle,
    result.body,
    result.status,
    result.type
  ].join(" ");
}

function typeBoost(type: GlobalSearchResultType) {
  if (type === "command") return 6;
  if (type === "relationship") return 3;
  if (type === "next_action") return 2;
  return 5;
}

function scoreResult(result: GlobalSearchResult, query: string) {
  if (!query) return result.score || 1;

  const title = result.title.toLowerCase();
  const subtitle = (result.subtitle ?? "").toLowerCase();
  const body = (result.body ?? "").toLowerCase();
  const status = (result.status ?? "").toLowerCase();
  const type = result.type.toLowerCase();

  const boost = typeBoost(result.type);

  if (title === query) return 100 + boost;
  if (title.includes(query)) return 75 + boost;
  if (subtitle.includes(query)) return 45 + boost;
  if (body.includes(query)) return 30 + boost;
  if (status.includes(query) || type.includes(query)) return 15 + boost;

  return 0;
}

function compareResults(a: GlobalSearchResult, b: GlobalSearchResult) {
  const byScore = b.score - a.score;
  if (byScore !== 0) return byScore;

  const byUpdatedAt = timestamp(b.updatedAt) - timestamp(a.updatedAt);
  if (byUpdatedAt !== 0) return byUpdatedAt;

  return a.title.localeCompare(b.title) || a.type.localeCompare(b.type) || a.id.localeCompare(b.id);
}

function relationshipUniverseId(state: AppState, relationship: Relationship) {
  const source = resolveRelationshipNode(state, relationship.sourceId, relationship.sourceType);
  const target = resolveRelationshipNode(state, relationship.targetId, relationship.targetType);

  if (source?.universeId && target?.universeId && source.universeId === target.universeId) {
    return source.universeId;
  }

  return source?.universeId ?? target?.universeId;
}

function relationshipTitle(state: AppState, relationship: Relationship) {
  const source = resolveRelationshipNode(state, relationship.sourceId, relationship.sourceType);
  const target = resolveRelationshipNode(state, relationship.targetId, relationship.targetType);

  return {
    sourceTitle: source?.title ?? relationship.sourceId,
    sourceType: source?.type ?? relationship.sourceType ?? "thought",
    targetTitle: target?.title ?? relationship.targetId,
    targetType: target?.type ?? relationship.targetType ?? "thought"
  };
}

export function buildGlobalSearchIndex(state: AppState): GlobalSearchResult[] {
  const thoughts: GlobalSearchResult[] = state.thoughts.map((thought) => ({
    id: `thought:${thought.id}`,
    type: "thought",
    title: clean(thought.title) || "Untitled thought",
    subtitle: `${thought.type} thought`,
    body: [
      thought.content,
      thought.why,
      thought.outcome,
      thought.nextAction,
      thought.type,
      thought.status,
      thought.universeId
    ].join(" "),
    status: thought.status,
    universeId: thought.universeId,
    targetId: thought.id,
    targetType: "thought",
    score: 1,
    updatedAt: thought.updatedAt
  }));

  const projects: GlobalSearchResult[] = state.projects.map((project) => ({
    id: `project:${project.id}`,
    type: "project",
    title: clean(project.name) || "Untitled project",
    subtitle: `${project.readiness} project`,
    body: [
      project.intent,
      project.nextAction,
      project.status,
      project.lifecycleStatus,
      project.readiness,
      project.universeId,
      `linked thoughts ${(project.linkedThoughtIds ?? []).length}`,
      project.users.join(" "),
      project.features.join(" "),
      project.screens.join(" "),
      project.dataObjects.join(" "),
      project.flowSteps.join(" "),
      project.unknowns.join(" ")
    ].join(" "),
    status: project.lifecycleStatus ?? project.status,
    universeId: project.universeId,
    targetId: project.id,
    targetType: "project",
    score: 1,
    updatedAt: project.updatedAt
  }));

  const universes: GlobalSearchResult[] = state.universes.map((universe) => ({
    id: `universe:${universe.id}`,
    type: "universe",
    title: clean(universe.name) || "Untitled universe",
    subtitle: universe.focus,
    body: [universe.description, universe.purpose, universe.status ?? "active"].join(" "),
    status: universe.status ?? "active",
    universeId: universe.id,
    targetId: universe.id,
    targetType: "universe",
    score: 1
  }));

  const blockingQuestions: GlobalSearchResult[] = (state.blockingQuestions ?? []).map((question) => ({
    id: `blocking_question:${question.id}`,
    type: "blocking_question",
    title: clean(question.question) || "Untitled blocking question",
    subtitle: "Blocking question",
    body: [
      question.context,
      question.proposedResolution,
      question.finalResolution,
      question.status,
      (question.linkedUniverseIds ?? []).join(" ")
    ].join(" "),
    status: question.status,
    universeId: firstValue(question.linkedUniverseIds),
    targetId: question.id,
    targetType: "blocking_question",
    score: 1,
    updatedAt: question.updatedAt
  }));

  const decisionRecords: GlobalSearchResult[] = (state.decisionRecords ?? []).map((record) => ({
    id: `decision_record:${record.id}`,
    type: "decision_record",
    title: clean(record.title) || "Untitled decision record",
    subtitle: "Decision record",
    body: [
      record.decision,
      record.rationale,
      record.consequences,
      record.status,
      (record.linkedUniverseIds ?? []).join(" ")
    ].join(" "),
    status: record.status,
    universeId: firstValue(record.linkedUniverseIds),
    targetId: record.id,
    targetType: "decision_record",
    score: 1,
    updatedAt: record.updatedAt
  }));

  const relationships: GlobalSearchResult[] = state.relationships.map((relationship) => {
    const titles = relationshipTitle(state, relationship);

    return {
      id: `relationship:${relationship.id}`,
      type: "relationship",
      title: `${titles.sourceTitle} ${relationship.type} ${titles.targetTitle}`,
      subtitle: `${titles.sourceType} -> ${titles.targetType}`,
      body: [
        relationship.description,
        relationship.type,
        relationship.sourceType,
        relationship.targetType,
        titles.sourceTitle,
        titles.targetTitle
      ].join(" "),
      status: relationship.type,
      universeId: relationshipUniverseId(state, relationship),
      targetId: relationship.id,
      targetType: "relationship",
      score: 1
    };
  });

  const nextActions: GlobalSearchResult[] = listNextActions(state).map((action) => ({
    id: `next_action:${action.id}`,
    type: "next_action",
    title: action.title,
    subtitle: action.actionText,
    body: [action.sourceType, action.sourceStatus, action.reason].join(" "),
    status: action.status,
    universeId: action.universeId,
    targetId: action.sourceId,
    targetType: action.sourceType,
    score: 1,
    updatedAt: action.updatedAt
  }));

  const commandResults: GlobalSearchResult[] = commands.map((command) => ({
    id: command.id,
    type: "command",
    title: command.title,
    subtitle: command.subtitle,
    status: "command",
    targetId: command.screen,
    targetType: "screen",
    score: 1
  }));

  return [
    ...thoughts,
    ...projects,
    ...universes,
    ...blockingQuestions,
    ...decisionRecords,
    ...relationships,
    ...nextActions,
    ...commandResults
  ].sort(compareResults);
}

export function searchGlobal(state: AppState, options: GlobalSearchOptions = {}) {
  const searchText = clean(options.searchText).toLowerCase();
  const type = options.type ?? "all";
  const universeId = options.universeId ?? "all";
  const status = options.status ?? "all";

  return buildGlobalSearchIndex(state)
    .filter((result) => type === "all" || result.type === type)
    .filter((result) => universeId === "all" || result.universeId === universeId)
    .filter((result) => status === "all" || result.status === status)
    .map((result) => ({ ...result, score: scoreResult(result, searchText) }))
    .filter((result) => {
      if (!searchText) return true;
      return result.score > 0 || haystack(result).toLowerCase().includes(searchText);
    })
    .sort(compareResults);
}

export function getGlobalSearchResultCounts(results: GlobalSearchResult[]): GlobalSearchResultCounts {
  return {
    total: results.length,
    thoughts: results.filter((result) => result.type === "thought").length,
    projects: results.filter((result) => result.type === "project").length,
    universes: results.filter((result) => result.type === "universe").length,
    blockingQuestions: results.filter((result) => result.type === "blocking_question").length,
    decisionRecords: results.filter((result) => result.type === "decision_record").length,
    relationships: results.filter((result) => result.type === "relationship").length,
    nextActions: results.filter((result) => result.type === "next_action").length,
    commands: results.filter((result) => result.type === "command").length
  };
}
