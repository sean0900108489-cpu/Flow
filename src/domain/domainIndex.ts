import type {
  AIInsight,
  AppState,
  BlockingQuestion,
  DecisionRecord,
  Project,
  Relationship,
  ThoughtItem,
  Universe
} from "./types";

type EntityWithId = { id: string };

export type DomainNodeType =
  | "thought"
  | "project"
  | "universe"
  | "relationship"
  | "aiInsight"
  | "blockingQuestion"
  | "decisionRecord";

export type DomainEntityById<T extends EntityWithId> = Readonly<Record<string, Readonly<T>>>;

export type DomainNode =
  | { id: string; type: "thought"; entity: Readonly<ThoughtItem> }
  | { id: string; type: "project"; entity: Readonly<Project> }
  | { id: string; type: "universe"; entity: Readonly<Universe> }
  | { id: string; type: "relationship"; entity: Readonly<Relationship> }
  | { id: string; type: "aiInsight"; entity: Readonly<AIInsight> }
  | { id: string; type: "blockingQuestion"; entity: Readonly<BlockingQuestion> }
  | { id: string; type: "decisionRecord"; entity: Readonly<DecisionRecord> };

export interface DomainIndex {
  universeById: DomainEntityById<Universe>;
  thoughtById: DomainEntityById<ThoughtItem>;
  projectById: DomainEntityById<Project>;
  relationshipById: DomainEntityById<Relationship>;
  aiInsightById: DomainEntityById<AIInsight>;
  blockingQuestionById: DomainEntityById<BlockingQuestion>;
  decisionRecordById: DomainEntityById<DecisionRecord>;
  resolveNode(id: string): DomainNode | undefined;
  inferNodeTypeById(id: string): DomainNodeType | undefined;
}

export const domainNodeResolutionPriority = [
  "thought",
  "project",
  "universe",
  "relationship",
  "aiInsight",
  "blockingQuestion",
  "decisionRecord"
] as const satisfies readonly DomainNodeType[];

function freezeEntity<T extends EntityWithId>(entity: T): Readonly<T> {
  const clone: Record<string, unknown> = { ...entity };

  for (const [key, value] of Object.entries(clone)) {
    if (Array.isArray(value)) {
      clone[key] = Object.freeze([...value]);
    }
  }

  return Object.freeze(clone) as Readonly<T>;
}

function indexById<T extends EntityWithId>(items: readonly T[] | undefined): DomainEntityById<T> {
  const byId: Record<string, Readonly<T>> = {};

  for (const item of items ?? []) {
    // Duplicate ids inside one collection keep the first source-order entity.
    // Cross-entity ambiguity is handled by domainNodeResolutionPriority.
    if (!Object.prototype.hasOwnProperty.call(byId, item.id)) {
      byId[item.id] = freezeEntity(item);
    }
  }

  return Object.freeze(byId);
}

function getById<T extends EntityWithId>(
  byId: DomainEntityById<T>,
  id: string
): Readonly<T> | undefined {
  return Object.prototype.hasOwnProperty.call(byId, id) ? byId[id] : undefined;
}

export function buildDomainIndex(state: AppState): Readonly<DomainIndex> {
  const universeById = indexById(state.universes);
  const thoughtById = indexById(state.thoughts);
  const projectById = indexById(state.projects);
  const relationshipById = indexById(state.relationships);
  const aiInsightById = indexById(state.aiInsights);
  const blockingQuestionById = indexById(state.blockingQuestions);
  const decisionRecordById = indexById(state.decisionRecords);

  function resolveNode(id: string): DomainNode | undefined {
    const thought = getById(thoughtById, id);
    if (thought) return { id, type: "thought", entity: thought };

    const project = getById(projectById, id);
    if (project) return { id, type: "project", entity: project };

    const universe = getById(universeById, id);
    if (universe) return { id, type: "universe", entity: universe };

    const relationship = getById(relationshipById, id);
    if (relationship) return { id, type: "relationship", entity: relationship };

    const aiInsight = getById(aiInsightById, id);
    if (aiInsight) return { id, type: "aiInsight", entity: aiInsight };

    const blockingQuestion = getById(blockingQuestionById, id);
    if (blockingQuestion) return { id, type: "blockingQuestion", entity: blockingQuestion };

    const decisionRecord = getById(decisionRecordById, id);
    if (decisionRecord) return { id, type: "decisionRecord", entity: decisionRecord };

    return undefined;
  }

  function inferNodeTypeById(id: string): DomainNodeType | undefined {
    return resolveNode(id)?.type;
  }

  return Object.freeze({
    universeById,
    thoughtById,
    projectById,
    relationshipById,
    aiInsightById,
    blockingQuestionById,
    decisionRecordById,
    resolveNode,
    inferNodeTypeById
  });
}
