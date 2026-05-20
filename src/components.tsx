import React, { useState } from "react";
import {
  Brain,
  FolderKanban,
  Inbox,
  Plus,
  Rocket,
  Wand2,
  Download,
  GitBranch,
  CheckCircle2,
  XCircle
} from "lucide-react";
import type {
  AIInsight,
  AppState,
  Project,
  ThoughtItem,
  ThoughtStatus,
  ThoughtType,
  Universe
} from "./domain/types";
import { readiness } from "./domain/readiness";
import { readinessLabel, statusLabel, typeLabel } from "./domain/labels";
import { join, lines } from "./domain/utils";
import { engineeringInput } from "./services/exportEngineeringInput";
import { downloadJson, parseAppStateJson, stringifyAppState } from "./services/appStateTransfer";

export function Nav({ screen, setScreen }: { screen: string; setScreen: (screen: string) => void }) {
  const items = [
    ["dashboard", FolderKanban, "Dashboard"],
    ["capture", Plus, "Quick Capture"],
    ["inbox", Inbox, "Idea Inbox"],
    ["thought", Brain, "Thought Detail"],
    ["project", Rocket, "Project Detail"],
    ["ai", Wand2, "AI Planning Panel"],
    ["relationships", GitBranch, "Relationships"],
    ["export", Download, "Engineering Export"],
    ["transfer", Download, "App State Transfer"],
    ["universes", FolderKanban, "Universes"]
  ] as const;

  return (
    <nav>
      {items.map(([key, Icon, label]) => (
        <button key={key} className={screen === key ? "active" : ""} onClick={() => setScreen(key)}>
          <Icon size={18} />
          {label}
        </button>
      ))}
    </nav>
  );
}

export function title(screen: string) {
  return {
    dashboard: "Universe Dashboard",
    capture: "Quick Capture",
    inbox: "Idea Inbox",
    thought: "Thought Detail",
    project: "Project Detail",
    ai: "AI Planning Panel",
    relationships: "Relationship Map",
    export: "Engineering Handoff Export",
    transfer: "App State Transfer",
    universes: "Universe Management"
  }[screen] ?? "Thought Universe";
}

export function Dashboard({
  state,
  activeProjects,
  setScreen,
  selectThought,
  selectProject
}: {
  state: AppState;
  activeProjects: Project[];
  setScreen: (screen: string) => void;
  selectThought: (id: string) => void;
  selectProject: (id: string) => void;
}) {
  const active = state.thoughts.filter((x) => x.status === "active");
  const inbox = state.thoughts.filter((x) => x.status === "inbox");

  return (
    <section className="grid two">
      <div className="panel hero">
        <h2>我現在想做什麼？</h2>
        <p>優先看 Active Thought、Project Readiness、Next Action。</p>
        <div className="metrics">
          <Metric label="Inbox" value={inbox.length} />
          <Metric label="Active" value={active.length} />
          <Metric label="Universes" value={state.universes.length} />
          <Metric label="Projects" value={activeProjects.length} />
        </div>
      </div>

      <div className="panel">
        <h2>目前下一步</h2>
        <div className="stack">
          {active.map((t) => (
            <button className="item" key={t.id} onClick={() => { selectThought(t.id); setScreen("thought"); }}>
              <strong>{t.title}</strong>
              <span>{t.nextAction || "尚未設定下一步"}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>Universes</h2>
        <div className="cards">
          {state.universes.map((u) => (
            <div className="card" key={u.id}>
              <strong>{u.name}</strong>
              <p>{u.purpose || u.description}</p>
              <div className="chips">
                <span>{u.focus}</span>
                <span>{state.thoughts.filter((t) => t.universeId === u.id).length} thoughts</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>Projects</h2>
        <div className="stack">
          {activeProjects.map((p) => {
            const r = readiness(p);
            return (
              <button className="item" key={p.id} onClick={() => { selectProject(p.id); setScreen("project"); }}>
                <strong>{p.name}</strong>
                <span>{r.score}% · {readinessLabel[r.value]}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export function Capture({ universes, onAdd }: { universes: Universe[]; onAdd: (data: Pick<ThoughtItem, "title" | "content" | "type" | "universeId">) => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<ThoughtType>("inspiration");
  const [universeId, setUniverseId] = useState(universes[0]?.id ?? "");

  return (
    <section className="panel form">
      <h2>快速捕捉想法</h2>
      <label>標題<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="我現在想到..." /></label>
      <label>內容<textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="補充脈絡..." /></label>
      <div className="row">
        <label>類型<SelectThoughtType value={type} onChange={setType} /></label>
        <label>Universe<SelectUniverse value={universeId} universes={universes} onChange={setUniverseId} /></label>
      </div>
      <button onClick={() => { onAdd({ title, content, type, universeId }); setTitle(""); setContent(""); }}>儲存到 Inbox</button>
    </section>
  );
}

export function ThoughtList({
  thoughts,
  universes,
  onSelect,
  compact = false
}: {
  thoughts: ThoughtItem[];
  universes: Universe[];
  onSelect: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "compact" : "panel"}>
      <div className="stack">
        {thoughts.length === 0 && <p className="muted">沒有想法。</p>}
        {thoughts.map((t) => {
          const u = universes.find((x) => x.id === t.universeId);
          return (
            <button className="item" key={t.id} onClick={() => onSelect(t.id)}>
              <div className="line">
                <strong>{t.title}</strong>
                <span className={`badge ${t.type}`}>{typeLabel[t.type]}</span>
              </div>
              <span>{t.nextAction || t.content || "尚未設定下一步"}</span>
              <div className="chips">
                <span>{statusLabel[t.status]}</span>
                {u && <span>{u.name}</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ThoughtDetail({
  thought,
  universes,
  onUpdate,
  onAI,
  onConvert,
  onArchive,
  onDelete
}: {
  thought: ThoughtItem;
  universes: Universe[];
  onUpdate: (patch: Partial<ThoughtItem>) => void;
  onAI: () => void;
  onConvert: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <section className="panel form">
      <div className="head">
        <h2>Thought Detail</h2>
        <div className="actions">
          <button className="ghost" onClick={onAI}>AI 建議</button>
          {thought.status !== "archived" && <button className="ghost" onClick={onArchive}>Archive Thought</button>}
          <button className="danger" onClick={onDelete}>Delete Thought</button>
          <button onClick={onConvert}>升級為 Project</button>
        </div>
      </div>
      <label>標題<input value={thought.title} onChange={(e) => onUpdate({ title: e.target.value })} /></label>
      <label>內容<textarea value={thought.content} onChange={(e) => onUpdate({ content: e.target.value })} /></label>
      <div className="row">
        <label>類型<SelectThoughtType value={thought.type} onChange={(v) => onUpdate({ type: v })} /></label>
        <label>狀態
          <select value={thought.status} onChange={(e) => onUpdate({ status: e.target.value as ThoughtStatus })}>
            <option value="inbox">Inbox</option>
            <option value="active">進行中</option>
            <option value="paused">暫停</option>
            <option value="done">完成</option>
            <option value="archived">封存</option>
          </select>
        </label>
        <label>Universe<SelectUniverse value={thought.universeId} universes={universes} onChange={(v) => onUpdate({ universeId: v })} /></label>
      </div>
      <label>Why / 原因<textarea value={thought.why} onChange={(e) => onUpdate({ why: e.target.value })} /></label>
      <label>Desired Outcome / 想達成什麼<textarea value={thought.outcome} onChange={(e) => onUpdate({ outcome: e.target.value })} /></label>
      <label>Next Action / 下一步<input value={thought.nextAction} onChange={(e) => onUpdate({ nextAction: e.target.value })} /></label>
    </section>
  );
}

export function ProjectDetail({
  project,
  universes,
  onUpdate,
  onAI,
  onArchive,
  onDelete
}: {
  project: Project;
  universes: Universe[];
  onUpdate: (patch: Partial<Project>) => void;
  onAI: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const r = readiness(project);
  return (
    <section className="panel form">
      <div className="head">
        <div>
          <h2>Project Detail</h2>
          <p className="muted">狀態：{project.status === "archived" ? "封存" : "進行中"} · 工程準備度：{r.score}% · {readinessLabel[r.value]}</p>
        </div>
        <div className="actions">
          <button className="ghost" onClick={onAI}>AI Readiness 建議</button>
          {project.status !== "archived" && <button className="ghost" onClick={onArchive}>Archive Project</button>}
          <button className="danger" onClick={onDelete}>Delete Project</button>
        </div>
      </div>
      <div className="bar"><div style={{ width: `${r.score}%` }} /></div>
      {r.missing.length > 0 && <div className="warn">缺少欄位：{r.missing.join(", ")}</div>}
      <label>名稱<input value={project.name} onChange={(e) => onUpdate({ name: e.target.value })} /></label>
      <label>Intent<textarea value={project.intent} onChange={(e) => onUpdate({ intent: e.target.value })} /></label>
      <label>Universe<SelectUniverse value={project.universeId} universes={universes} onChange={(v) => onUpdate({ universeId: v })} /></label>
      <label>Users，一行一個<textarea value={join(project.users)} onChange={(e) => onUpdate({ users: lines(e.target.value) })} /></label>
      <label>Core Features，一行一個<textarea value={join(project.features)} onChange={(e) => onUpdate({ features: lines(e.target.value) })} /></label>
      <label>Screens，一行一個<textarea value={join(project.screens)} onChange={(e) => onUpdate({ screens: lines(e.target.value) })} /></label>
      <label>Data Objects，一行一個<textarea value={join(project.dataObjects)} onChange={(e) => onUpdate({ dataObjects: lines(e.target.value) })} /></label>
      <label>Flow Steps，一行一個<textarea value={join(project.flowSteps)} onChange={(e) => onUpdate({ flowSteps: lines(e.target.value) })} /></label>
      <label>Unknowns，一行一個<textarea value={join(project.unknowns)} onChange={(e) => onUpdate({ unknowns: lines(e.target.value) })} /></label>
      <label>Next Action<input value={project.nextAction} onChange={(e) => onUpdate({ nextAction: e.target.value })} /></label>
    </section>
  );
}

export function AIPanel({
  insights,
  onThought,
  onProject,
  onSet
}: {
  insights: AIInsight[];
  onThought: () => void;
  onProject: () => void;
  onSet: (id: string, status: "accepted" | "rejected") => void;
}) {
  return (
    <section className="panel">
      <div className="head">
        <h2>AI Planning Panel</h2>
        <div className="actions">
          <button className="ghost" onClick={onThought}>分析目前 Thought</button>
          <button onClick={onProject}>分析目前 Project</button>
        </div>
      </div>
      <p className="muted">MVP 使用 mock AI。AIInsight 是 draft，需要人工接受或拒絕。</p>
      <div className="stack">
        {insights.length === 0 && <p className="muted">尚無 AI 建議。</p>}
        {insights.map((x) => (
          <div className={`insight ${x.status}`} key={x.id}>
            <div className="head">
              <strong>{x.type}</strong>
              <span className="badge">{x.status}</span>
            </div>
            <pre>{x.content}</pre>
            {x.status === "draft" && (
              <div className="actions">
                <button onClick={() => onSet(x.id, "accepted")}><CheckCircle2 size={16} />接受</button>
                <button className="ghost" onClick={() => onSet(x.id, "rejected")}><XCircle size={16} />拒絕</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export function Relationships({ state }: { state: AppState }) {
  const name = (targetId: string) =>
    state.thoughts.find((x) => x.id === targetId)?.title ||
    state.projects.find((x) => x.id === targetId)?.name ||
    state.universes.find((x) => x.id === targetId)?.name ||
    targetId;

  return (
    <section className="panel">
      <h2>Relationships</h2>
      <div className="stack">
        {state.relationships.map((r) => (
          <div className="rel" key={r.id}>
            <strong>{name(r.sourceId)}</strong>
            <span>{r.type}</span>
            <strong>{name(r.targetId)}</strong>
            <p>{r.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Export({ project, universe }: { project: Project; universe?: Universe }) {
  const json = JSON.stringify(engineeringInput(project, universe), null, 2);
  const copy = () => navigator.clipboard.writeText(json);
  const download = () => {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, "-").toLowerCase()}-engineering-flow-input.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="panel">
      <div className="head">
        <div>
          <h2>Engineering Handoff Export</h2>
          <p className="muted">匯出 EngineeringFlowInput 草稿。</p>
        </div>
        <div className="actions">
          <button className="ghost" onClick={copy}>複製 JSON</button>
          <button onClick={download}>下載 JSON</button>
        </div>
      </div>
      <pre className="json">{json}</pre>
    </section>
  );
}

export function Universes({
  universes,
  onAdd,
  onUpdate
}: {
  universes: Universe[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<Universe>) => void;
}) {
  return (
    <section className="panel">
      <div className="head">
        <h2>Universe Management</h2>
        <button onClick={onAdd}>新增 Universe</button>
      </div>
      <div className="stack">
        {universes.map((u) => (
          <div className="card form" key={u.id}>
            <label>名稱<input value={u.name} onChange={(e) => onUpdate(u.id, { name: e.target.value })} /></label>
            <label>描述<textarea value={u.description} onChange={(e) => onUpdate(u.id, { description: e.target.value })} /></label>
            <label>Purpose<textarea value={u.purpose} onChange={(e) => onUpdate(u.id, { purpose: e.target.value })} /></label>
            <label>Focus
              <select value={u.focus} onChange={(e) => onUpdate(u.id, { focus: e.target.value as Universe["focus"] })}>
                <option value="main">main</option>
                <option value="secondary">secondary</option>
                <option value="someday">someday</option>
              </select>
            </label>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AppStateTransfer({
  state,
  onImport
}: {
  state: AppState;
  onImport: (state: AppState) => void;
}) {
  const [importText, setImportText] = useState("");
  const [message, setMessage] = useState("");
  const json = stringifyAppState(state);

  const copy = async () => {
    await navigator.clipboard.writeText(json);
    setMessage("已複製完整 App State JSON。");
  };

  const download = () => {
    downloadJson("todo-thought-universe-app-state.json", json);
    setMessage("已下載完整 App State JSON。");
  };

  const runImport = () => {
    const result = parseAppStateJson(importText);

    if (!result.ok || !result.state) {
      setMessage(`匯入失敗：${result.error ?? "Invalid app state."}`);
      return;
    }

    onImport(result.state);
  };

  return (
    <section className="panel">
      <div className="head">
        <div>
          <h2>App State Transfer</h2>
          <p className="muted">匯出或匯入完整 local-first app state，包含 universes、thoughts、projects、relationships、aiInsights。</p>
        </div>
        <div className="actions">
          <button className="ghost" onClick={copy}>複製 App State</button>
          <button onClick={download}>下載 App State</button>
        </div>
      </div>

      {message && <div className="notice">{message}</div>}

      <div className="form">
        <label>
          匯入 App State JSON
          <textarea
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            placeholder="貼上 todo-thought-universe-app-state.json 內容..."
          />
        </label>
        <button onClick={runImport}>匯入並覆蓋目前資料</button>
      </div>

      <h3>目前 App State JSON</h3>
      <pre className="json">{json}</pre>
    </section>
  );
}

export function SelectThoughtType({ value, onChange }: { value: ThoughtType; onChange: (value: ThoughtType) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as ThoughtType)}>
      <option value="inspiration">靈感</option>
      <option value="task">任務</option>
      <option value="project">專案</option>
      <option value="goal">目標</option>
      <option value="question">問題</option>
      <option value="note">筆記</option>
    </select>
  );
}

export function SelectUniverse({ value, universes, onChange }: { value: string; universes: Universe[]; onChange: (value: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {universes.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
    </select>
  );
}
