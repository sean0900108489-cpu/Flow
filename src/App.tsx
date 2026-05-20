import React, { useMemo, useState } from "react";
import { Brain, Search } from "lucide-react";
import type { AppState, Project, ThoughtItem } from "./domain/types";
import { readinessLabel, typeLabel } from "./domain/labels";
import { id, now } from "./domain/utils";
import { readiness } from "./domain/readiness";
import { seed } from "./data/seed";
import { loadState, saveState } from "./services/storage";
import {
  AIPanel,
  AppStateTransfer,
  Capture,
  Dashboard,
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

  const save = (next: AppState) => {
    setState(next);
    saveState(next);
  };

  const thought = state.thoughts.find((x) => x.id === selectedThoughtId) ?? state.thoughts[0];
  const project = state.projects.find((x) => x.id === selectedProjectId) ?? state.projects[0];

  const filteredThoughts = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return state.thoughts;
    return state.thoughts.filter((x) =>
      `${x.title} ${x.content} ${x.nextAction} ${typeLabel[x.type]}`.toLowerCase().includes(q)
    );
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

  const ai = (targetId: string) => {
    const t = state.thoughts.find((x) => x.id === targetId);
    const p = state.projects.find((x) => x.id === targetId);
    const content = t
      ? [
          `分類建議：${/網站|系統|app|專案|建立|做/.test(t.title + t.content) ? "專案" : "靈感"}`,
          `宇宙建議：${state.universes.find((u) => u.id === t.universeId)?.name ?? state.universes[0]?.name}`,
          "下一步建議：補上 why、outcome、nextAction；如果範圍清楚，就升級為 Project。"
        ].join("\n")
      : p
        ? [
            `工程準備度：${readiness(p).score}% / ${readinessLabel[readiness(p).value]}`,
            readiness(p).missing.length ? `缺少：${readiness(p).missing.join(", ")}` : "必要欄位已具備。",
            `下一步建議：${p.nextAction || "確認 screens/dataObjects/flowSteps 後匯出 EngineeringFlowInput。"}`
          ].join("\n")
        : "沒有可分析目標。";

    save({
      ...state,
      aiInsights: [
        {
          id: id("ai"),
          targetId,
          type: p ? "project_readiness" : "classification",
          content,
          status: "draft",
          createdAt: now()
        },
        ...state.aiInsights
      ]
    });
  };

  const acceptAI = (aiId: string, status: "accepted" | "rejected") => {
    save({
      ...state,
      aiInsights: state.aiInsights.map((x) => x.id === aiId ? { ...x, status } : x)
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
            setScreen={setScreen}
            selectThought={setSelectedThoughtId}
            selectProject={setSelectedProjectId}
          />
        )}

        {screen === "capture" && (
          <Capture universes={state.universes} onAdd={addThought} />
        )}

        {screen === "inbox" && (
          <ThoughtList
            thoughts={filteredThoughts.filter((x) => x.status === "inbox")}
            universes={state.universes}
            onSelect={(tid) => {
              setSelectedThoughtId(tid);
              setScreen("thought");
            }}
          />
        )}

        {screen === "thought" && thought && (
          <ThoughtDetail
            thought={thought}
            universes={state.universes}
            onUpdate={(patch) => updateThought(thought.id, patch)}
            onAI={() => ai(thought.id)}
            onConvert={convertToProject}
          />
        )}

        {screen === "project" && project && (
          <ProjectDetail
            project={project}
            universes={state.universes}
            onUpdate={(patch) => updateProject(project.id, patch)}
            onAI={() => ai(project.id)}
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
            onAdd={() => save({
              ...state,
              universes: [
                { id: id("universe"), name: "新的宇宙", description: "", purpose: "", focus: "secondary" },
                ...state.universes
              ]
            })}
            onUpdate={(uid, patch) => save({
              ...state,
              universes: state.universes.map((u) => u.id === uid ? { ...u, ...patch } : u)
            })}
          />
        )}

        <section className="panel">
          <h2>所有想法</h2>
          <ThoughtList
            compact
            thoughts={filteredThoughts}
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
