import React, { useEffect, useMemo, useState } from "react";
import { Brain, RotateCcw, Search } from "lucide-react";
import type { AppState, BlockingQuestion, Project, ThoughtItem } from "./domain/types";
import type { GlobalSearchResult } from "./domain/globalSearch";
import { searchReviewQueue, type ReviewQueueItem } from "./domain/reviewQueue";
import { filterThoughts } from "./domain/listQuery";
import { pathForScreen, screenForPath } from "./domain/appRouting";
import {
  archiveBlockingQuestion,
  createBlockingQuestion,
  deleteBlockingQuestion,
  resolveBlockingQuestion,
  updateBlockingQuestion,
  type BlockingQuestionActionResult
} from "./domain/blockingQuestions";
import {
  acceptDecisionRecord,
  archiveDecisionRecord,
  createDecisionFromBlockingQuestion,
  createDecisionRecord,
  deleteDecisionRecord,
  supersedeDecisionRecord,
  updateDecisionRecord,
  type DecisionRecordActionResult,
  type DecisionRecordInput,
  type DecisionRecordPatch
} from "./domain/decisionRecords";
import {
  archiveUniverse,
  createUniverse,
  deleteUniverse,
  isUniverseActive,
  restoreUniverse,
  updateUniverse,
  universeOptionsForItemUniverseIds,
  type UniverseActionResult
} from "./domain/universeActions";
import { executeDomainCommand, type DomainCommand } from "./domain/commandLayer";
import {
  updateEngineeringReadinessAssessment,
  type EngineeringReadinessPatch
} from "./domain/engineeringReadiness";
import {
  createProject,
  promoteThoughtToProject,
  unlinkThoughtFromProject,
  updateProjectDetails,
  type ProjectActionResult,
  type ProjectDetailsPatch
} from "./domain/projectActions";
import {
  clearDismissedNextActions,
  clearFocusNextAction,
  completeNextAction,
  dismissNextAction,
  pinNextAction,
  setNextActionForSource,
  updateNextActionState,
  type NextActionItem,
  type NextActionSourceType,
  type NextActionStatePatch
} from "./domain/nextActions";
import {
  markThoughtTriaged,
  updateThoughtTriage,
  type ThoughtTriagePatch,
  type ThoughtTriageResult
} from "./domain/thoughtTriage";
import {
  createRelationshipSafe,
  type CreateRelationshipSafeInput,
  type CreateRelationshipSafeResult,
  type RelationshipNode
} from "./domain/relationshipExplorer";
import {
  archiveProject as archiveProjectMutation,
  archiveThought as archiveThoughtMutation,
  createThought,
  deleteProject as deleteProjectMutation,
  deleteThought as deleteThoughtMutation,
  restoreProject as restoreProjectMutation,
  restoreThought as restoreThoughtMutation,
  updateThought as updateThoughtMutation,
  type SafeMutationResult
} from "./domain/mutations/appMutations";
import { id, now } from "./domain/utils";
import { normalizeAppState } from "./domain/appState";
import { seed } from "./data/seed";
import { loadState, saveState } from "./services/storage";
import { generateProjectReadinessInsight, generateThoughtClassificationInsight } from "./services/aiMock";
import { AiChatDock } from "./components/layout/AiChatDock";
import {
  AIPanel,
  AppStateTransfer,
  ArchivedItems,
  BlockingQuestionsCenter,
  Capture,
  Dashboard,
  DecisionRecordsCenter,
  DeploymentStatus,
  EngineeringHandoffCenter,
  EngineeringReadinessCenter,
  Export,
  GlobalSearchCenter,
  Nav,
  NextActionCenter,
  ProjectDetail,
  Projects,
  RelationshipExplorer,
  ReviewQueueCenter,
  Relationships,
  ThoughtDetail,
  ThoughtList,
  ThoughtTriageCenter,
  UniverseDetailCenter,
  Universes,
  title
} from "./components";
import "./style.css";

export function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [screen, setScreen] = useState(() =>
    typeof window === "undefined" ? "dashboard" : screenForPath(window.location.pathname)
  );
  const [selectedThoughtId, setSelectedThoughtId] = useState("t-1");
  const [selectedProjectId, setSelectedProjectId] = useState("p-1");
  const [selectedUniverseId, setSelectedUniverseId] = useState("u-thought");
  const [query, setQuery] = useState("");
  const [universeError, setUniverseError] = useState("");
  const [systemMessage, setSystemMessage] = useState("");
  const [isAiChatDockOpen, setIsAiChatDockOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const path = pathForScreen(screen);

    if (window.location.pathname !== path) {
      window.history.replaceState(null, "", path);
    }
  }, [screen]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const onPopState = () => setScreen(screenForPath(window.location.pathname));

    window.addEventListener("popstate", onPopState);

    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const save = (next: AppState) => {
    const normalized = normalizeAppState(next);

    setState(normalized);
    saveState(normalized);

    return normalized;
  };

  const runConfirmedDomainCommand = (
    command: Omit<DomainCommand, "id" | "source" | "confirmedByUser">
  ) => {
    const result = executeDomainCommand(
      state,
      {
        ...command,
        id: id("cmd"),
        source: "user",
        confirmedByUser: true
      },
      { actorId: "local-ui" }
    );

    if (!result.ok) {
      const message = `${result.error.code}: ${result.error.message}`;
      setSystemMessage(message);
      return { ok: false, error: message };
    }

    setSystemMessage("");
    save(result.state);
    return { ok: true };
  };

  const applyUniverseResult = (result: UniverseActionResult) => {
    if (!result.ok) {
      setUniverseError(result.error ?? "Universe action failed.");
      return false;
    }

    setUniverseError("");
    save(result.state);
    return true;
  };

  const applyBlockingQuestionResult = (result: BlockingQuestionActionResult) => {
    if (result.ok) {
      save(result.state);
    }

    return { ok: result.ok, error: result.error };
  };

  const applyDecisionRecordResult = (result: DecisionRecordActionResult) => {
    if (result.ok) {
      save(result.state);
    }

    return {
      state: result.state,
      ok: result.ok,
      decisionRecordId: result.decisionRecordId,
      error: result.error
    };
  };

  const applyProjectResult = (result: ProjectActionResult) => {
    if (result.ok) {
      save(result.state);
    }

    return { ok: result.ok, error: result.error, projectId: result.projectId };
  };

  const applyThoughtTriageResult = (result: ThoughtTriageResult) => {
    if (result.ok) {
      save(result.state);
    }

    return { ok: result.ok, error: result.error };
  };

  const applySafeMutationResult = (result: SafeMutationResult) => {
    if (!result.ok) {
      setSystemMessage(result.error ?? "Mutation failed.");
      return false;
    }

    setSystemMessage("");
    save(result.state);
    return true;
  };

  const thought = state.thoughts.find((x) => x.id === selectedThoughtId) ?? state.thoughts[0];
  const project = state.projects.find((x) => x.id === selectedProjectId) ?? state.projects[0];
  const selectedUniverse = state.universes.find((x) => x.id === selectedUniverseId) ?? state.universes[0];
  const activeProjects = state.projects.filter((x) => x.status !== "archived");
  const archivedThoughts = state.thoughts.filter((x) => x.status === "archived");
  const archivedProjects = state.projects.filter((x) => x.status === "archived");
  const activeUniverses = state.universes.filter(isUniverseActive);

  const filteredThoughts = useMemo(() => {
    return filterThoughts(state.thoughts, { searchText: query });
  }, [query, state.thoughts]);

  const updateThought = (thoughtId: string, patch: Partial<ThoughtItem>) => {
    applySafeMutationResult(updateThoughtMutation(state, thoughtId, patch));
  };

  const updateProject = (projectId: string, patch: ProjectDetailsPatch) =>
    applyProjectResult(updateProjectDetails(state, projectId, patch));

  const handleCreateUniverse = (input: { name: string; description?: string }) =>
    applyUniverseResult(createUniverse(state, input));

  const handleUpdateUniverse = (universeId: string, patch: { name?: string; description?: string }) => {
    applyUniverseResult(updateUniverse(state, universeId, patch));
  };

  const handleArchiveUniverse = (universeId: string) => {
    applyUniverseResult(archiveUniverse(state, universeId));
  };

  const handleRestoreUniverse = (universeId: string) => {
    applyUniverseResult(restoreUniverse(state, universeId));
  };

  const handleDeleteUniverse = (universeId: string) => {
    if (!window.confirm("Delete this universe?")) return;
    applyUniverseResult(deleteUniverse(state, universeId, "blockIfInUse"));
  };

  const handleDetachDeleteUniverse = (universeId: string) => {
    if (!window.confirm("Detach linked items and delete this universe?")) return;
    applyUniverseResult(deleteUniverse(state, universeId, "detach"));
  };

  const handleViewUniverse = (universeId: string) => {
    setSelectedUniverseId(universeId);
    setScreen("universe-detail");
  };

  const handleMarkProjectHandoffReady = (projectId: string) => {
    return runConfirmedDomainCommand({
      type: "project.markHandoffReady",
      target: { type: "project", id: projectId }
    });
  };

  const handleCreateBlockingQuestion = (input: { question: string; context?: string }) =>
    applyBlockingQuestionResult(createBlockingQuestion(state, input));

  const handleUpdateBlockingQuestion = (questionId: string, patch: Partial<BlockingQuestion>) =>
    applyBlockingQuestionResult(updateBlockingQuestion(state, questionId, patch));

  const handleResolveBlockingQuestion = (questionId: string, finalResolution: string) =>
    applyBlockingQuestionResult(resolveBlockingQuestion(state, questionId, finalResolution));

  const handleArchiveBlockingQuestion = (questionId: string) =>
    applyBlockingQuestionResult(archiveBlockingQuestion(state, questionId));

  const handleDeleteBlockingQuestion = (questionId: string) =>
    applyBlockingQuestionResult(deleteBlockingQuestion(state, questionId));

  const handleCreateDecisionRecord = (input: DecisionRecordInput) =>
    applyDecisionRecordResult(createDecisionRecord(state, input));

  const handleUpdateDecisionRecord = (decisionRecordId: string, patch: DecisionRecordPatch) =>
    applyDecisionRecordResult(updateDecisionRecord(state, decisionRecordId, patch));

  const handleAcceptDecisionRecord = (decisionRecordId: string) =>
    applyDecisionRecordResult(acceptDecisionRecord(state, decisionRecordId));

  const handleSupersedeDecisionRecord = (decisionRecordId: string) =>
    applyDecisionRecordResult(supersedeDecisionRecord(state, decisionRecordId));

  const handleArchiveDecisionRecord = (decisionRecordId: string) =>
    applyDecisionRecordResult(archiveDecisionRecord(state, decisionRecordId));

  const handleDeleteDecisionRecord = (decisionRecordId: string) =>
    applyDecisionRecordResult(deleteDecisionRecord(state, decisionRecordId));

  const handleCreateDecisionFromBlockingQuestion = (questionId: string) =>
    applyDecisionRecordResult(createDecisionFromBlockingQuestion(state, questionId));

  const handleUpdateEngineeringReadiness = (patch: EngineeringReadinessPatch) => {
    const result = updateEngineeringReadinessAssessment(state, patch);

    if (result.ok) {
      save(result.state);
    }

    return { ok: result.ok, error: result.error };
  };

  const handleCreateRelationshipSafe = (input: CreateRelationshipSafeInput): CreateRelationshipSafeResult => {
    const result = createRelationshipSafe(state, input);

    if (result.ok) {
      save(result.state);
    }

    return result;
  };

  const handleViewRelationshipNode = (node: RelationshipNode) => {
    if (node.type === "thought") {
      setSelectedThoughtId(node.id);
      setScreen("thought");
      return;
    }

    if (node.type === "project") {
      setSelectedProjectId(node.id);
      setScreen("project");
      return;
    }

    if (node.type === "universe") {
      setSelectedUniverseId(node.id);
      setScreen("universe-detail");
      return;
    }

    if (node.type === "blocking_question") {
      setScreen("blocking-questions");
      return;
    }

    setScreen("decision-records");
  };

  const handleOpenGlobalSearchResult = (result: GlobalSearchResult) => {
    if (result.type === "command" && result.targetId) {
      setScreen(result.targetId);
      return;
    }

    if (result.type === "thought" && result.targetId) {
      setSelectedThoughtId(result.targetId);
      setScreen("thought");
      return;
    }

    if (result.type === "project" && result.targetId) {
      setSelectedProjectId(result.targetId);
      setScreen("project");
      return;
    }

    if (result.type === "universe" && result.targetId) {
      setSelectedUniverseId(result.targetId);
      setScreen("universe-detail");
      return;
    }

    if (result.type === "blocking_question") {
      setScreen("blocking-questions");
      return;
    }

    if (result.type === "decision_record") {
      setScreen("decision-records");
      return;
    }

    if (result.type === "relationship") {
      setScreen("relationship-explorer");
      return;
    }

    if (result.type === "next_action") {
      if (result.targetType === "thought" && result.targetId) {
        setSelectedThoughtId(result.targetId);
        setScreen("thought");
        return;
      }

      if (result.targetType === "project" && result.targetId) {
        setSelectedProjectId(result.targetId);
        setScreen("project");
        return;
      }

      setScreen("next-actions");
    }
  };

  const handleOpenReviewQueueItem = (item: ReviewQueueItem) => {
    if (item.type === "ai_insight") {
      if (item.targetType === "thought" && item.targetId) {
        setSelectedThoughtId(item.targetId);
        setScreen("thought");
        return;
      }

      if (item.targetType === "project" && item.targetId) {
        setSelectedProjectId(item.targetId);
        setScreen("project");
        return;
      }

      setScreen("ai");
      return;
    }

    if (item.type === "decision_record") {
      setScreen("decision-records");
      return;
    }

    if (item.type === "blocking_question") {
      setScreen("blocking-questions");
      return;
    }

    if (item.type === "handoff_candidate") {
      setSelectedProjectId(item.sourceId);
      setScreen("project");
    }
  };

  const addThought = (data: Pick<ThoughtItem, "title" | "content" | "type" | "universeId">) => {
    const result = createThought(state, data);

    if (applySafeMutationResult(result) && result.thoughtId) {
      setSelectedThoughtId(result.thoughtId);
      setScreen("thought");
    }
  };

  const handleCreateProject = (input: {
    title: string;
    description?: string;
    universeId?: string;
    nextAction?: string;
    linkedThoughtIds?: string[];
  }) => {
    const result = createProject(state, input);
    const applied = applyProjectResult(result);

    if (applied.ok && applied.projectId) {
      setSelectedProjectId(applied.projectId);
    }

    return applied;
  };

  const handlePromoteThoughtToProject = (thoughtId: string) => {
    const result = promoteThoughtToProject(state, thoughtId);
    const applied = applyProjectResult(result);

    if (applied.ok && applied.projectId) {
      setSelectedProjectId(applied.projectId);
      setScreen("project");
    }

    return applied;
  };

  const handleUnlinkThoughtFromProject = (projectId: string, thoughtId: string) =>
    applyProjectResult(unlinkThoughtFromProject(state, projectId, thoughtId));

  const handleCompleteNextAction = (item: NextActionItem) => {
    const result = completeNextAction(state, item);

    if (result.ok) {
      save(result.state);
    }

    return { ok: result.ok, error: result.error };
  };

  const handleSetNextActionForSource = (
    sourceType: NextActionSourceType,
    sourceId: string,
    nextAction: string
  ) => {
    const result = setNextActionForSource(state, sourceType, sourceId, nextAction);

    if (result.ok) {
      save(result.state);
    }

    return { ok: result.ok, error: result.error };
  };

  const applyNextActionResult = (result: { state: AppState; ok: boolean; error?: string }) => {
    if (result.ok) {
      save(result.state);
    }

    return { ok: result.ok, error: result.error };
  };

  const handleUpdateNextActionState = (patch: NextActionStatePatch) =>
    applyNextActionResult(updateNextActionState(state, patch));

  const handlePinNextAction = (actionId: string) =>
    applyNextActionResult(pinNextAction(state, actionId));

  const handleDismissNextAction = (actionId: string) =>
    applyNextActionResult(dismissNextAction(state, actionId));

  const handleClearDismissedNextActions = () =>
    applyNextActionResult(clearDismissedNextActions(state));

  const handleClearFocusNextAction = () =>
    applyNextActionResult(clearFocusNextAction(state));

  const handleUpdateThoughtTriage = (thoughtId: string, patch: ThoughtTriagePatch) =>
    applyThoughtTriageResult(updateThoughtTriage(state, thoughtId, patch));

  const handleMarkThoughtTriaged = (thoughtId: string) =>
    applyThoughtTriageResult(markThoughtTriaged(state, thoughtId));

  const handleViewNextActionSource = (item: NextActionItem) => {
    if (item.sourceType === "thought") {
      setSelectedThoughtId(item.sourceId);
      setScreen("thought");
      return;
    }

    if (item.sourceType === "project") {
      setSelectedProjectId(item.sourceId);
      setScreen("project");
      return;
    }

    if (item.sourceType === "blocking_question") {
      setScreen("blocking-questions");
      return;
    }

    if (item.sourceType === "review_queue") {
      setScreen("review-queue");
      return;
    }

    if (item.sourceType === "engineering_readiness") {
      setScreen("engineering-readiness");
      return;
    }

    setScreen("capture");
  };

  const archiveThought = (thoughtId: string, nextScreen = "dashboard") => {
    if (applySafeMutationResult(archiveThoughtMutation(state, thoughtId))) {
      setScreen(nextScreen);
    }
  };

  const visibleThoughts = filteredThoughts.filter((x) => x.status !== "archived");
  const thoughtUniverseOptions = thought
    ? universeOptionsForItemUniverseIds(state.universes, [thought.universeId])
    : activeUniverses;
  const projectUniverseOptions = project
    ? universeOptionsForItemUniverseIds(state.universes, [project.universeId])
    : activeUniverses;
  const aiDraftCount = state.aiInsights.filter((insight) => insight.status === "draft").length;
  const reviewQueueCount = searchReviewQueue(state).length;

  const restoreThought = (thoughtId: string) => {
    applySafeMutationResult(restoreThoughtMutation(state, thoughtId));
  };

  const deleteThought = (thoughtId: string, nextScreen = "dashboard") => {
    if (!window.confirm("Delete this thought?")) return;
    const result = deleteThoughtMutation(state, thoughtId);

    if (applySafeMutationResult(result)) {
      setSelectedThoughtId(result.state.thoughts.find((x) => x.id !== thoughtId)?.id ?? "");
      setScreen(nextScreen);
    }
  };

  const archiveProject = (projectId: string) => {
    if (applySafeMutationResult(archiveProjectMutation(state, projectId))) {
      setScreen("dashboard");
    }
  };

  const restoreProject = (projectId: string) => {
    applySafeMutationResult(restoreProjectMutation(state, projectId));
  };

  const deleteProject = (projectId: string, nextScreen = "dashboard") => {
    if (!window.confirm("Delete this project?")) return;
    const result = deleteProjectMutation(state, projectId);

    if (applySafeMutationResult(result)) {
      setSelectedProjectId(result.state.projects.find((x) => x.id !== projectId)?.id ?? "");
      setScreen(nextScreen);
    }
  };

  const ai = (targetId: string) => {
    const t = state.thoughts.find((x) => x.id === targetId);
    const p = state.projects.find((x) => x.id === targetId);
    const draft = t
      ? generateThoughtClassificationInsight(t, state.universes)
      : p
        ? generateProjectReadinessInsight(p)
        : undefined;

    if (!draft) return;

    save({
      ...state,
      aiInsights: [
        {
          id: id("ai"),
          createdAt: now(),
          ...draft
        },
        ...state.aiInsights
      ]
    });
  };

  const acceptAI = (aiId: string, status: "accepted" | "rejected") => {
    return runConfirmedDomainCommand({
      type: "aiInsight.review",
      target: { type: "aiInsight", id: aiId },
      payload: { status }
    });
  };

  return (
    <div className="shell">
	      <aside>
	        <button
	          type="button"
	          className="brand"
	          aria-label="Thought Universe dashboard"
	          data-tooltip="Thought Universe"
	          title="Thought Universe"
	          onClick={() => setScreen("dashboard")}
	        >
	          <Brain />
	          <div>
	            <strong>Thought Universe</strong>
	            <span>思想管理系統</span>
	          </div>
	        </button>
	        <Nav screen={screen} setScreen={setScreen} />
	        <button
	          type="button"
	          className="ghost full sidebar-reset"
	          aria-label="Reset demo"
	          data-tooltip="Reset Demo"
	          title="Reset Demo"
	          onClick={() => save(seed)}
	        >
	          <RotateCcw size={18} />
	          <span className="nav-label">重置 Demo</span>
	        </button>
	      </aside>

      <main>
        <header>
          <div>
            <h1>{title(screen)}</h1>
            <p>想法 → 宇宙 → 任務/專案 → 下一步 → 工程交接</p>
          </div>
          <label className="search">
            <Search size={16} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜尋想法..." />
          </label>
        </header>

        {systemMessage && <div className="notice app-notice">{systemMessage}</div>}

        {screen === "dashboard" && (
          <Dashboard
            state={state}
            activeProjects={activeProjects}
            setScreen={setScreen}
            selectThought={setSelectedThoughtId}
            selectProject={setSelectedProjectId}
          />
        )}

        {screen === "global-search" && (
          <GlobalSearchCenter
            state={state}
            onOpenGlobalSearchResult={handleOpenGlobalSearchResult}
          />
        )}

        {screen === "review-queue" && (
          <ReviewQueueCenter
            state={state}
            onSetAiInsight={acceptAI}
            onAcceptDecisionRecord={handleAcceptDecisionRecord}
            onRejectDecisionRecord={handleSupersedeDecisionRecord}
            onResolveBlockingQuestion={handleResolveBlockingQuestion}
            onUpdateBlockingQuestion={handleUpdateBlockingQuestion}
            onMarkProjectHandoffReady={handleMarkProjectHandoffReady}
            onOpenReviewItem={handleOpenReviewQueueItem}
            onOpenDecisionCenter={() => setScreen("blocking-questions")}
          />
        )}

        {screen === "engineering-readiness" && (
          <EngineeringReadinessCenter
            state={state}
            onUpdateAssessment={handleUpdateEngineeringReadiness}
            onOpenDecisionCenter={() => setScreen("blocking-questions")}
            onOpenReviewQueue={() => setScreen("review-queue")}
          />
        )}

        {screen === "capture" && (
          <Capture universes={activeUniverses} onAdd={addThought} />
        )}

        {screen === "inbox" && (
          <ThoughtList
            thoughts={filteredThoughts.filter((x) => x.status === "inbox")}
            universes={state.universes}
            showControls
            onSelect={(tid) => {
              setSelectedThoughtId(tid);
              setScreen("thought");
            }}
          />
        )}

        {screen === "thought-triage" && (
          <ThoughtTriageCenter
            state={state}
            universes={state.universes}
            onUpdateTriage={handleUpdateThoughtTriage}
            onMarkTriaged={handleMarkThoughtTriaged}
            onPromote={handlePromoteThoughtToProject}
            onArchive={(thoughtId) => archiveThought(thoughtId, "thought-triage")}
            onViewThought={(thoughtId) => {
              setSelectedThoughtId(thoughtId);
              setScreen("thought");
            }}
          />
        )}

        {screen === "thought" && thought && (
          <ThoughtDetail
            thought={thought}
            universes={thoughtUniverseOptions}
            onUpdate={(patch) => updateThought(thought.id, patch)}
            onAI={() => ai(thought.id)}
            onPromote={() => handlePromoteThoughtToProject(thought.id)}
            onArchive={() => archiveThought(thought.id)}
            onDelete={() => deleteThought(thought.id)}
          />
        )}

        {screen === "projects" && (
          <Projects
            projects={activeProjects}
            universes={activeUniverses}
            onCreate={handleCreateProject}
            onViewProject={(projectId) => {
              setSelectedProjectId(projectId);
              setScreen("project");
            }}
          />
        )}

        {screen === "next-actions" && (
          <NextActionCenter
            state={state}
            universes={state.universes}
            onCompleteNextAction={handleCompleteNextAction}
            onSetNextActionForSource={handleSetNextActionForSource}
            onUpdateNextActionState={handleUpdateNextActionState}
            onPinNextAction={handlePinNextAction}
            onDismissNextAction={handleDismissNextAction}
            onClearDismissedNextActions={handleClearDismissedNextActions}
            onClearFocusNextAction={handleClearFocusNextAction}
            onViewSource={handleViewNextActionSource}
            onOpenDecisionCenter={() => setScreen("blocking-questions")}
            onOpenReviewQueue={() => setScreen("review-queue")}
            onOpenEngineeringReadiness={() => setScreen("engineering-readiness")}
          />
        )}

        {screen === "project" && project && (
          <ProjectDetail
            project={project}
            universes={projectUniverseOptions}
            thoughts={state.thoughts}
            onUpdate={(patch) => updateProject(project.id, patch)}
            onAI={() => ai(project.id)}
            onArchive={() => archiveProject(project.id)}
            onDelete={() => deleteProject(project.id)}
            onViewThought={(thoughtId) => {
              setSelectedThoughtId(thoughtId);
              setScreen("thought");
            }}
            onUnlinkThought={(thoughtId) => handleUnlinkThoughtFromProject(project.id, thoughtId)}
          />
        )}

        {screen === "archived" && (
          <ArchivedItems
            thoughts={archivedThoughts}
            projects={archivedProjects}
            universes={state.universes}
            onRestoreThought={restoreThought}
            onDeleteThought={(thoughtId) => deleteThought(thoughtId, "archived")}
            onRestoreProject={restoreProject}
            onDeleteProject={(projectId) => deleteProject(projectId, "archived")}
          />
        )}

        {screen === "ai" && (
          <AIPanel
            insights={state.aiInsights}
            onThought={() => thought && ai(thought.id)}
            onProject={() => project && ai(project.id)}
            onSet={acceptAI}
          />
        )}

        {screen === "relationships" && (
          <Relationships
            state={state}
            onOpenRelationshipExplorer={() => setScreen("relationship-explorer")}
          />
        )}

        {screen === "relationship-explorer" && (
          <RelationshipExplorer
            state={state}
            onCreateRelationshipSafe={handleCreateRelationshipSafe}
            onViewRelationshipNode={handleViewRelationshipNode}
          />
        )}

        {screen === "universe-detail" && (
          <UniverseDetailCenter
            state={state}
            universeId={selectedUniverse?.id ?? ""}
            onViewThought={(thoughtId) => {
              setSelectedThoughtId(thoughtId);
              setScreen("thought");
            }}
            onViewProject={(projectId) => {
              setSelectedProjectId(projectId);
              setScreen("project");
            }}
            onOpenNextActionCenter={() => setScreen("next-actions")}
            onOpenBlockingQuestions={() => setScreen("blocking-questions")}
            onOpenDecisionRecords={() => setScreen("decision-records")}
            onOpenRelationshipExplorer={() => setScreen("relationship-explorer")}
          />
        )}

        {screen === "engineering-handoff" && (
          <EngineeringHandoffCenter
            state={state}
            onViewProject={(projectId) => {
              setSelectedProjectId(projectId);
              setScreen("project");
            }}
            onMarkProjectHandoffReady={handleMarkProjectHandoffReady}
          />
        )}

        {screen === "blocking-questions" && (
          <BlockingQuestionsCenter
            state={state}
            onCreate={handleCreateBlockingQuestion}
            onUpdate={handleUpdateBlockingQuestion}
            onResolve={handleResolveBlockingQuestion}
            onArchive={handleArchiveBlockingQuestion}
            onDelete={handleDeleteBlockingQuestion}
            onCreateDecisionFromBlockingQuestion={handleCreateDecisionFromBlockingQuestion}
            onOpenDecisionRecords={() => setScreen("decision-records")}
          />
        )}

        {screen === "decision-records" && (
          <DecisionRecordsCenter
            state={state}
            onCreateDecisionRecord={handleCreateDecisionRecord}
            onUpdateDecisionRecord={handleUpdateDecisionRecord}
            onAcceptDecisionRecord={handleAcceptDecisionRecord}
            onSupersedeDecisionRecord={handleSupersedeDecisionRecord}
            onArchiveDecisionRecord={handleArchiveDecisionRecord}
            onDeleteDecisionRecord={handleDeleteDecisionRecord}
            onCreateDecisionFromBlockingQuestion={handleCreateDecisionFromBlockingQuestion}
          />
        )}

        {screen === "export" && project && (
          <Export project={project} universe={state.universes.find((x) => x.id === project.universeId)} />
        )}

        {screen === "transfer" && (
          <AppStateTransfer
            state={state}
            onImport={(nextState) => {
              const normalized = save(nextState);

              setSelectedThoughtId(normalized.thoughts[0]?.id ?? "");
              setSelectedProjectId(normalized.projects[0]?.id ?? "");
              setSelectedUniverseId(normalized.universes[0]?.id ?? "");
              setSystemMessage("App State imported successfully. Decision, readiness, and next action data were normalized.");
              setScreen("dashboard");
            }}
          />
        )}

        {screen === "deployment-status" && (
          <DeploymentStatus
            state={state}
            projectId={project?.id}
            onApplyImportedCommands={(nextState, message) => {
              save(nextState);
              setSystemMessage(message);
            }}
          />
        )}

        {screen === "universes" && (
          <Universes
            universes={state.universes}
            thoughts={state.thoughts}
            projects={state.projects}
            error={universeError}
            onCreate={handleCreateUniverse}
            onUpdate={handleUpdateUniverse}
            onArchive={handleArchiveUniverse}
            onRestore={handleRestoreUniverse}
            onDelete={handleDeleteUniverse}
            onDetachDelete={handleDetachDeleteUniverse}
            onViewUniverse={handleViewUniverse}
          />
        )}

        <section className="panel">
          <h2>所有想法</h2>
          <ThoughtList
            compact
            thoughts={visibleThoughts}
            universes={state.universes}
            onSelect={(tid) => {
              setSelectedThoughtId(tid);
              setScreen("thought");
            }}
          />
        </section>
      </main>

      <AiChatDock
        isOpen={isAiChatDockOpen}
        currentScreenLabel={title(screen)}
        selectedThoughtTitle={thought?.title}
        selectedProjectTitle={project?.name}
        aiDraftCount={aiDraftCount}
        reviewQueueCount={reviewQueueCount}
        onOpenChange={setIsAiChatDockOpen}
        onOpenAiPanel={() => setScreen("ai")}
        onOpenReviewQueue={() => setScreen("review-queue")}
      />
    </div>
  );
}
