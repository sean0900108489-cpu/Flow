import React, { useMemo, useState } from "react";
import { Brain, Search } from "lucide-react";
import type { AppState, BlockingQuestion, Project, ThoughtItem } from "./domain/types";
import { filterThoughts } from "./domain/listQuery";
import {
  archiveBlockingQuestion,
  createBlockingQuestion,
  deleteBlockingQuestion,
  resolveBlockingQuestion,
  updateBlockingQuestion,
  type BlockingQuestionActionResult
} from "./domain/blockingQuestions";
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
import { markProjectHandoffReady } from "./domain/engineeringHandoff";
import { id, now } from "./domain/utils";
import { readiness } from "./domain/readiness";
import { seed } from "./data/seed";
import { loadState, saveState } from "./services/storage";
import { applyAiInsightPatch } from "./services/applyAiPatch";
import { generateProjectReadinessInsight, generateThoughtClassificationInsight } from "./services/aiMock";
import {
  AIPanel,
  AppStateTransfer,
  ArchivedItems,
  BlockingQuestionsCenter,
  Capture,
  Dashboard,
  EngineeringHandoffCenter,
  Export,
  Nav,
  ProjectDetail,
  Relationships,
  ThoughtDetail,
  ThoughtList,
  Universes,
  title
} from "./components";
import "./style.css";

export function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [screen, setScreen] = useState("dashboard");
  const [selectedThoughtId, setSelectedThoughtId] = useState("t-1");
  const [selectedProjectId, setSelectedProjectId] = useState("p-1");
  const [query, setQuery] = useState("");
  const [universeError, setUniverseError] = useState("");

  const save = (next: AppState) => {
    setState(next);
    saveState(next);
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

  const thought = state.thoughts.find((x) => x.id === selectedThoughtId) ?? state.thoughts[0];
  const project = state.projects.find((x) => x.id === selectedProjectId) ?? state.projects[0];
  const activeProjects = state.projects.filter((x) => x.status !== "archived");
  const archivedThoughts = state.thoughts.filter((x) => x.status === "archived");
  const archivedProjects = state.projects.filter((x) => x.status === "archived");
  const activeUniverses = state.universes.filter(isUniverseActive);

  const filteredThoughts = useMemo(() => {
    return filterThoughts(state.thoughts, { searchText: query });
  }, [query, state.thoughts]);

  const updateThought = (thoughtId: string, patch: Partial<ThoughtItem>) => {
    save({
      ...state,
      thoughts: state.thoughts.map((x) => x.id === thoughtId ? { ...x, ...patch, updatedAt: now() } : x)
    });
  };

  const updateProject = (projectId: string, patch: Partial<Project>) => {
    save({
      ...state,
      projects: state.projects.map((x) => {
        if (x.id !== projectId) return x;
        const next = { ...x, ...patch, updatedAt: now() };
        return { ...next, readiness: readiness(next).value };
      })
    });
  };

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

  const handleMarkProjectHandoffReady = (projectId: string) => {
    const result = markProjectHandoffReady(state, projectId);

    if (result.ok) {
      save(result.state);
    }

    return { ok: result.ok, error: result.error };
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

  const addThought = (data: Pick<ThoughtItem, "title" | "content" | "type" | "universeId">) => {
    const item: ThoughtItem = {
      id: id("thought"),
      title: data.title || "未命名想法",
      content: data.content,
      type: data.type,
      status: "inbox",
      universeId: data.universeId,
      why: "",
      outcome: "",
      nextAction: "",
      createdAt: now(),
      updatedAt: now()
    };
    save({ ...state, thoughts: [item, ...state.thoughts] });
    setSelectedThoughtId(item.id);
    setScreen("thought");
  };

  const convertToProject = () => {
    if (!thought) return;
    const p: Project = {
      id: id("project"),
      sourceThoughtId: thought.id,
      universeId: thought.universeId,
      status: "active",
      name: thought.title,
      intent: thought.content || thought.outcome,
      users: ["Sean / 創作者本人"],
      features: thought.nextAction ? [thought.nextAction] : [],
      screens: [],
      dataObjects: ["ThoughtItem", "Universe", "Project"],
      flowSteps: ["確認目標", "整理核心功能", "定義資料模型", "產生工程輸入"],
      unknowns: [],
      nextAction: thought.nextAction || "補上專案下一步。",
      readiness: "needs_clarification",
      createdAt: now(),
      updatedAt: now()
    };
    p.readiness = readiness(p).value;
    save({
      ...state,
      thoughts: state.thoughts.map((x) => x.id === thought.id ? { ...x, type: "project", status: "active", projectId: p.id, updatedAt: now() } : x),
      projects: [p, ...state.projects],
      relationships: [{ id: id("rel"), sourceId: thought.id, targetId: p.id, type: "evolves_into", description: "ThoughtItem 升級為 Project。" }, ...state.relationships]
    });
    setSelectedProjectId(p.id);
    setScreen("project");
  };

  const archiveThought = (thoughtId: string) => {
    save({
      ...state,
      thoughts: state.thoughts.map((x) => x.id === thoughtId ? { ...x, status: "archived", updatedAt: now() } : x)
    });
    setScreen("dashboard");
  };

  const visibleThoughts = filteredThoughts.filter((x) => x.status !== "archived");
  const thoughtUniverseOptions = thought
    ? universeOptionsForItemUniverseIds(state.universes, [thought.universeId])
    : activeUniverses;
  const projectUniverseOptions = project
    ? universeOptionsForItemUniverseIds(state.universes, [project.universeId])
    : activeUniverses;

  const restoreThought = (thoughtId: string) => {
    save({
      ...state,
      thoughts: state.thoughts.map((x) => x.id === thoughtId && x.status === "archived"
        ? { ...x, status: "inbox", updatedAt: now() }
        : x)
    });
  };

  const deleteThought = (thoughtId: string, nextScreen = "dashboard") => {
    if (!window.confirm("Delete this thought?")) return;

    save({
      ...state,
      thoughts: state.thoughts.filter((x) => x.id !== thoughtId),
      projects: state.projects.map((x) => x.sourceThoughtId === thoughtId ? { ...x, sourceThoughtId: undefined, updatedAt: now() } : x),
      relationships: state.relationships.filter((x) => x.sourceId !== thoughtId && x.targetId !== thoughtId),
      aiInsights: state.aiInsights.filter((x) => x.targetId !== thoughtId)
    });
    setSelectedThoughtId(state.thoughts.find((x) => x.id !== thoughtId)?.id ?? "");
    setScreen(nextScreen);
  };

  const archiveProject = (projectId: string) => {
    save({
      ...state,
      projects: state.projects.map((x) => x.id === projectId ? { ...x, status: "archived", updatedAt: now() } : x)
    });
    setScreen("dashboard");
  };

  const restoreProject = (projectId: string) => {
    save({
      ...state,
      projects: state.projects.map((x) => x.id === projectId && x.status === "archived"
        ? { ...x, status: "active", updatedAt: now() }
        : x)
    });
  };

  const deleteProject = (projectId: string, nextScreen = "dashboard") => {
    if (!window.confirm("Delete this project?")) return;

    save({
      ...state,
      projects: state.projects.filter((x) => x.id !== projectId),
      thoughts: state.thoughts.map((x) => x.projectId === projectId ? { ...x, projectId: undefined, updatedAt: now() } : x),
      relationships: state.relationships.filter((x) => x.sourceId !== projectId && x.targetId !== projectId),
      aiInsights: state.aiInsights.filter((x) => x.targetId !== projectId)
    });
    setSelectedProjectId(state.projects.find((x) => x.id !== projectId)?.id ?? "");
    setScreen(nextScreen);
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
    const insight = state.aiInsights.find((x) => x.id === aiId);
    const patchedState = status === "accepted" && insight ? applyAiInsightPatch(state, insight) : state;

    save({
      ...patchedState,
      aiInsights: patchedState.aiInsights.map((x) => x.id === aiId ? { ...x, status } : x)
    });
  };

  return (
    <div className="shell">
      <aside>
        <div className="brand" onClick={() => setScreen("dashboard")}>
          <Brain />
          <div>
            <strong>Thought Universe</strong>
            <span>思想管理系統</span>
          </div>
        </div>
        <Nav screen={screen} setScreen={setScreen} />
        <button className="ghost full" onClick={() => save(seed)}>重置 Demo</button>
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

        {screen === "dashboard" && (
          <Dashboard
            state={state}
            activeProjects={activeProjects}
            setScreen={setScreen}
            selectThought={setSelectedThoughtId}
            selectProject={setSelectedProjectId}
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

        {screen === "thought" && thought && (
          <ThoughtDetail
            thought={thought}
            universes={thoughtUniverseOptions}
            onUpdate={(patch) => updateThought(thought.id, patch)}
            onAI={() => ai(thought.id)}
            onConvert={convertToProject}
            onArchive={() => archiveThought(thought.id)}
            onDelete={() => deleteThought(thought.id)}
          />
        )}

        {screen === "project" && project && (
          <ProjectDetail
            project={project}
            universes={projectUniverseOptions}
            onUpdate={(patch) => updateProject(project.id, patch)}
            onAI={() => ai(project.id)}
            onArchive={() => archiveProject(project.id)}
            onDelete={() => deleteProject(project.id)}
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
          <Relationships state={state} />
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
          />
        )}

        {screen === "export" && project && (
          <Export project={project} universe={state.universes.find((x) => x.id === project.universeId)} />
        )}

        {screen === "transfer" && (
          <AppStateTransfer
            state={state}
            onImport={(nextState) => {
              save(nextState);
              setSelectedThoughtId(nextState.thoughts[0]?.id ?? "");
              setSelectedProjectId(nextState.projects[0]?.id ?? "");
              setScreen("dashboard");
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
    </div>
  );
}
