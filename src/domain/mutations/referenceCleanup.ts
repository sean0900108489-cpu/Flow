import type { AppState, Project, RelationshipNodeType, ThoughtItem } from "../types";
import type { RelationshipNodeRef } from "../relationships/relationshipGraph";
import { now } from "../utils";

function withoutId(values: string[] | undefined, id: string) {
  return (values ?? []).filter((value) => value !== id);
}

function nextActionPrefix(type: RelationshipNodeType) {
  if (type === "thought") return "thought";
  if (type === "project") return "project";
  if (type === "blocking_question") return "blocking_question";

  return undefined;
}

function withoutDeletedThoughtProjectReferences(project: Project, thoughtId: string, timestamp: string): Project {
  const linkedThoughtIds = withoutId(project.linkedThoughtIds, thoughtId);
  const sourceChanged = project.sourceThoughtId === thoughtId;
  const linkedChanged = linkedThoughtIds.length !== (project.linkedThoughtIds ?? []).length;

  return sourceChanged || linkedChanged
    ? {
        ...project,
        sourceThoughtId: sourceChanged ? undefined : project.sourceThoughtId,
        linkedThoughtIds,
        updatedAt: timestamp
      }
    : project;
}

function withoutDeletedProjectThoughtReference(
  thought: ThoughtItem,
  projectId: string,
  timestamp: string
): ThoughtItem {
  return thought.projectId === projectId
    ? { ...thought, projectId: undefined, updatedAt: timestamp }
    : thought;
}

function removeNextActionReferences(state: AppState, node: RelationshipNodeRef): AppState {
  const prefix = nextActionPrefix(node.type);

  if (!prefix || !state.nextActionState) return state;

  const actionId = `${prefix}:${node.id}`;

  return {
    ...state,
    nextActionState: {
      ...state.nextActionState,
      savedActionIds: withoutId(state.nextActionState.savedActionIds, actionId),
      dismissedActionIds: withoutId(state.nextActionState.dismissedActionIds, actionId),
      selectedFocusActionId: state.nextActionState.selectedFocusActionId === actionId
        ? undefined
        : state.nextActionState.selectedFocusActionId,
      updatedAt: now()
    }
  };
}

function removeThoughtReferences(state: AppState, thoughtId: string): AppState {
  const timestamp = now();

  return {
    ...state,
    projects: state.projects.map((project) =>
      withoutDeletedThoughtProjectReferences(project, thoughtId, timestamp)
    ),
    blockingQuestions: state.blockingQuestions?.map((question) => {
      const linkedThoughtIds = withoutId(question.linkedThoughtIds, thoughtId);

      return linkedThoughtIds.length !== (question.linkedThoughtIds ?? []).length
        ? { ...question, linkedThoughtIds, updatedAt: now() }
        : question;
    }),
    decisionRecords: state.decisionRecords?.map((record) => {
      const linkedThoughtIds = withoutId(record.linkedThoughtIds, thoughtId);

      return linkedThoughtIds.length !== (record.linkedThoughtIds ?? []).length
        ? { ...record, linkedThoughtIds, updatedAt: now() }
        : record;
    }),
    aiInsights: state.aiInsights.filter((insight) => insight.targetId !== thoughtId)
  };
}

function removeProjectReferences(state: AppState, projectId: string): AppState {
  const timestamp = now();

  return {
    ...state,
    thoughts: state.thoughts.map((thought) =>
      withoutDeletedProjectThoughtReference(thought, projectId, timestamp)
    ),
    blockingQuestions: state.blockingQuestions?.map((question) => {
      const linkedProjectIds = withoutId(question.linkedProjectIds, projectId);

      return linkedProjectIds.length !== (question.linkedProjectIds ?? []).length
        ? { ...question, linkedProjectIds, updatedAt: now() }
        : question;
    }),
    decisionRecords: state.decisionRecords?.map((record) => {
      const linkedProjectIds = withoutId(record.linkedProjectIds, projectId);

      return linkedProjectIds.length !== (record.linkedProjectIds ?? []).length
        ? { ...record, linkedProjectIds, updatedAt: now() }
        : record;
    }),
    aiInsights: state.aiInsights.filter((insight) => insight.targetId !== projectId)
  };
}

function removeUniverseReferences(state: AppState, universeId: string): AppState {
  return {
    ...state,
    thoughts: state.thoughts.map((thought) =>
      thought.universeId === universeId
        ? { ...thought, universeId: "", updatedAt: now() }
        : thought
    ),
    projects: state.projects.map((project) =>
      project.universeId === universeId
        ? { ...project, universeId: "", updatedAt: now() }
        : project
    ),
    blockingQuestions: state.blockingQuestions?.map((question) => {
      const linkedUniverseIds = withoutId(question.linkedUniverseIds, universeId);

      return linkedUniverseIds.length !== (question.linkedUniverseIds ?? []).length
        ? { ...question, linkedUniverseIds, updatedAt: now() }
        : question;
    }),
    decisionRecords: state.decisionRecords?.map((record) => {
      const linkedUniverseIds = withoutId(record.linkedUniverseIds, universeId);

      return linkedUniverseIds.length !== (record.linkedUniverseIds ?? []).length
        ? { ...record, linkedUniverseIds, updatedAt: now() }
        : record;
    })
  };
}

function removeBlockingQuestionReferences(state: AppState, questionId: string): AppState {
  return {
    ...state,
    decisionRecords: state.decisionRecords?.map((record) =>
      record.sourceBlockingQuestionId === questionId
        ? { ...record, sourceBlockingQuestionId: undefined, updatedAt: now() }
        : record
    )
  };
}

function removeDecisionRecordReferences(state: AppState, decisionRecordId: string): AppState {
  return {
    ...state,
    decisionRecords: state.decisionRecords?.map((record) =>
      record.supersedesDecisionId === decisionRecordId
        ? { ...record, supersedesDecisionId: undefined, updatedAt: now() }
        : record
    )
  };
}

export function removeDeletedNodeReferences(state: AppState, node: RelationshipNodeRef): AppState {
  const cleanedState =
    node.type === "thought" ? removeThoughtReferences(state, node.id) :
    node.type === "project" ? removeProjectReferences(state, node.id) :
    node.type === "universe" ? removeUniverseReferences(state, node.id) :
    node.type === "blocking_question" ? removeBlockingQuestionReferences(state, node.id) :
    removeDecisionRecordReferences(state, node.id);

  return removeNextActionReferences(cleanedState, node);
}
