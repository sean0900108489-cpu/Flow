import type { Project, Universe } from "../../domain/types";
import { readiness } from "../../domain/readiness";
import { readinessLabel } from "../../domain/labels";
import { join, lines } from "../../domain/utils";
import { SelectUniverse } from "../common/SelectUniverse";

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
