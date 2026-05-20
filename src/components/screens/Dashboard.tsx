import type { AppState, Project } from "../../domain/types";
import { readiness } from "../../domain/readiness";
import { readinessLabel } from "../../domain/labels";
import { Metric } from "../common/Metric";

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
