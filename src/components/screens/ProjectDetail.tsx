import { useEffect, useMemo, useState } from "react";
import type { Project, ProjectLifecycleStatus, ProjectStatus, ThoughtItem, Universe } from "../../domain/types";
import { readiness } from "../../domain/readiness";
import { readinessLabel } from "../../domain/labels";
import { join, lines } from "../../domain/utils";
import { useI18n } from "../../i18n";
import { SelectUniverse } from "../common/SelectUniverse";

function projectDraft(project: Project) {
  return {
    name: project.name,
    intent: project.intent,
    universeId: project.universeId,
    users: join(project.users),
    features: join(project.features),
    screens: join(project.screens),
    dataObjects: join(project.dataObjects),
    flowSteps: join(project.flowSteps),
    unknowns: join(project.unknowns),
    nextAction: project.nextAction,
    status: project.status,
    lifecycleStatus: project.lifecycleStatus ?? "planning" as ProjectLifecycleStatus
  };
}

export function ProjectDetail({
  project,
  universes,
  thoughts,
  onUpdate,
  onAI,
  onArchive,
  onDelete,
  onViewThought,
  onUnlinkThought
}: {
  project: Project;
  universes: Universe[];
  thoughts: ThoughtItem[];
  onUpdate: (patch: Partial<Project>) => { ok: boolean; error?: string };
  onAI: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onViewThought: (thoughtId: string) => void;
  onUnlinkThought: (thoughtId: string) => { ok: boolean; error?: string };
}) {
  const { t } = useI18n();
  const r = readiness(project);
  const [draft, setDraft] = useState(() => projectDraft(project));
  const [notice, setNotice] = useState("");
  const linkedThoughts = useMemo(() => {
    const ids = new Set([
      ...(project.linkedThoughtIds ?? []),
      ...(project.sourceThoughtId ? [project.sourceThoughtId] : []),
      ...thoughts.filter((thought) => thought.projectId === project.id).map((thought) => thought.id)
    ]);

    return thoughts.filter((thought) => ids.has(thought.id));
  }, [project, thoughts]);

  useEffect(() => {
    setDraft(projectDraft(project));
  }, [project.id, project.updatedAt]);

  const updateDraft = (patch: Partial<typeof draft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const saveProject = () => {
    const result = onUpdate({
      name: draft.name,
      intent: draft.intent,
      universeId: draft.universeId,
      users: lines(draft.users),
      features: lines(draft.features),
      screens: lines(draft.screens),
      dataObjects: lines(draft.dataObjects),
      flowSteps: lines(draft.flowSteps),
      unknowns: lines(draft.unknowns),
      nextAction: draft.nextAction,
      status: draft.status as ProjectStatus,
      lifecycleStatus: draft.lifecycleStatus as ProjectLifecycleStatus
    });

    setNotice(result.ok ? "Project saved." : result.error ?? "Project could not be saved.");
  };

  const unlinkThought = (thoughtId: string) => {
    const result = onUnlinkThought(thoughtId);
    setNotice(result.ok ? "Thought unlinked." : result.error ?? "Thought could not be unlinked.");
  };

  return (
    <section className="panel form">
      <div className="head">
        <div>
          <h2>{t("Project Detail")}</h2>
          <p className="muted">
            {t("狀態：{status} · 工程準備度：{score}% · {readiness}", {
              status: project.status === "archived" ? t("archived") : t("active"),
              score: r.score,
              readiness: readinessLabel[r.value]
            })}
          </p>
        </div>
        <div className="actions">
          <button className="ghost" onClick={onAI}>{t("AI Readiness suggestion")}</button>
          {project.status !== "archived" && <button className="ghost" onClick={onArchive}>{t("Archive Project")}</button>}
          <button className="danger" onClick={onDelete}>{t("Delete Project")}</button>
        </div>
      </div>
      {notice && <div className={notice.includes("could not") ? "warn" : "notice"}>{t(notice)}</div>}
      <div className="bar"><div style={{ width: `${r.score}%` }} /></div>
      {r.missing.length > 0 && <div className="warn">{t("Missing fields: {fields}", { fields: r.missing.join(", ") })}</div>}
      <label>{t("Title")}<input value={draft.name} onChange={(e) => updateDraft({ name: e.target.value })} /></label>
      <label>{t("Description")}<textarea value={draft.intent} onChange={(e) => updateDraft({ intent: e.target.value })} /></label>
      <div className="row">
        <label>{t("Universe")}<SelectUniverse value={draft.universeId} universes={universes} onChange={(v) => updateDraft({ universeId: v })} /></label>
        <label>{t("Status")}
          <select value={draft.status} onChange={(e) => updateDraft({ status: e.target.value as ProjectStatus })}>
            <option value="active">{t("active")}</option>
            <option value="archived">{t("archived")}</option>
          </select>
        </label>
        <label>{t("Lifecycle")}
          <select value={draft.lifecycleStatus} onChange={(e) => updateDraft({ lifecycleStatus: e.target.value as ProjectLifecycleStatus })}>
            <option value="planning">{t("planning")}</option>
            {project.lifecycleStatus === "handoff_ready" && <option value="handoff_ready" disabled>{t("handoff_ready")}</option>}
            <option value="blocked">{t("blocked")}</option>
          </select>
        </label>
      </div>
      <label>{t("Users，一行一個")}<textarea value={draft.users} onChange={(e) => updateDraft({ users: e.target.value })} /></label>
      <label>{t("Core Features，一行一個")}<textarea value={draft.features} onChange={(e) => updateDraft({ features: e.target.value })} /></label>
      <label>{t("Screens，一行一個")}<textarea value={draft.screens} onChange={(e) => updateDraft({ screens: e.target.value })} /></label>
      <label>{t("Data Objects，一行一個")}<textarea value={draft.dataObjects} onChange={(e) => updateDraft({ dataObjects: e.target.value })} /></label>
      <label>{t("Flow Steps，一行一個")}<textarea value={draft.flowSteps} onChange={(e) => updateDraft({ flowSteps: e.target.value })} /></label>
      <label>{t("Unknowns，一行一個")}<textarea value={draft.unknowns} onChange={(e) => updateDraft({ unknowns: e.target.value })} /></label>
      <label>{t("Next Action")}<input value={draft.nextAction} onChange={(e) => updateDraft({ nextAction: e.target.value })} /></label>
      <div className="actions">
        <button onClick={saveProject}>{t("Save Project")}</button>
      </div>

      <section className="mini-list">
        <div className="line">
          <strong>{t("Linked Thoughts")}</strong>
          <span className="badge">{linkedThoughts.length}</span>
        </div>
        {linkedThoughts.length === 0 ? (
          <p>{t("No linked thoughts yet.")}</p>
        ) : (
          linkedThoughts.map((thought) => (
            <div className="line" key={thought.id}>
              <span>{thought.title}</span>
              <div className="actions">
                <button className="ghost" onClick={() => onViewThought(thought.id)}>{t("View Thought")}</button>
                <button className="ghost" onClick={() => unlinkThought(thought.id)}>{t("Unlink")}</button>
              </div>
            </div>
          ))
        )}
      </section>
    </section>
  );
}
