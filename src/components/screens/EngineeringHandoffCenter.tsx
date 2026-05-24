import { useMemo, useState } from "react";
import type { AppState, Project } from "../../domain/types";
import {
  buildProjectHandoffPackage,
  listProjectHandoffStatuses,
  type ProjectHandoffReadiness,
  type ProjectHandoffStatus
} from "../../domain/engineeringHandoff";
import { useI18n } from "../../i18n";
import { downloadJson } from "../../services/appStateTransfer";

const handoffLabel: Record<ProjectHandoffReadiness, string> = {
  ready: "ready",
  needs_clarification: "needs clarification",
  blocked: "blocked"
};

function ProjectHandoffCard({
  project,
  status,
  state,
  onViewProject,
  onMarkProjectHandoffReady,
  onNotice
}: {
  project: Project;
  status: ProjectHandoffStatus;
  state: AppState;
  onViewProject: (projectId: string) => void;
  onMarkProjectHandoffReady: (projectId: string) => { ok: boolean; error?: string };
  onNotice: (message: string, preview?: string) => void;
}) {
  const { t } = useI18n();
  const jsonForProject = () => JSON.stringify(buildProjectHandoffPackage(project.id, state), null, 2);

  const copyHandoffJson = async () => {
    const json = jsonForProject();

    try {
      await navigator.clipboard?.writeText(json);
    } catch {
      // The visible preview below is the fallback when clipboard access is unavailable.
    }

    onNotice("Handoff JSON copied", json);
  };

  const downloadHandoffJson = () => {
    const json = jsonForProject();

    downloadJson(`engineering-handoff-${project.id}.json`, json);
    onNotice("Handoff JSON prepared", json);
  };

  const markReady = () => {
    const result = onMarkProjectHandoffReady(project.id);
    onNotice(result.ok ? "Project marked handoff_ready" : result.error ?? "Project is not ready for engineering handoff.");
  };

  return (
    <article className="card handoff-card">
      <div className="line">
        <strong>{project.name || t("Untitled Project")}</strong>
        <span className={`badge handoff-${status.readiness}`}>{t(handoffLabel[status.readiness])}</span>
      </div>
      <div className="bar"><div style={{ width: `${status.score}%` }} /></div>
      <p>{status.summary}</p>
      <div className="chips">
        <span>{t("score {score}", { score: status.score })}</span>
        <span>{t("status {status}", { status: t(project.status) })}</span>
        <span>{t("lifecycle {status}", { status: t(project.lifecycleStatus ?? "planning") })}</span>
      </div>
      {status.missing.length > 0 && (
        <div className="mini-list">
          <strong>{t("Missing")}</strong>
          <ul>{status.missing.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      )}
      {status.warnings.length > 0 && (
        <div className="mini-list warn-lite">
          <strong>{t("Warnings")}</strong>
          <ul>{status.warnings.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      )}
      <div className="actions">
        <button className="ghost" onClick={() => onViewProject(project.id)}>{t("View Project")}</button>
        <button className="restore" disabled={status.readiness !== "ready"} onClick={markReady}>{t("Mark Handoff Ready")}</button>
        <button className="ghost" onClick={copyHandoffJson}>{t("Copy Handoff JSON")}</button>
        <button className="ghost" onClick={downloadHandoffJson}>{t("Download Handoff JSON")}</button>
      </div>
    </article>
  );
}

export function EngineeringHandoffCenter({
  state,
  onViewProject,
  onMarkProjectHandoffReady
}: {
  state: AppState;
  onViewProject: (projectId: string) => void;
  onMarkProjectHandoffReady: (projectId: string) => { ok: boolean; error?: string };
}) {
  const { t } = useI18n();
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState("");
  const statuses = useMemo(() => listProjectHandoffStatuses(state), [state]);
  const statusByProject = new Map(statuses.map((status) => [status.projectId, status]));

  const notify = (message: string, nextPreview = preview) => {
    setNotice(message);
    setPreview(nextPreview);
  };

  const renderSection = (title: string, readiness: ProjectHandoffReadiness) => {
    const projects = state.projects.filter((project) => statusByProject.get(project.id)?.readiness === readiness);

    return (
      <section className="panel stack">
        <div className="head">
          <div>
            <h2>{t(title)}</h2>
            <p className="muted">{t("{count} projects", { count: projects.length })}</p>
          </div>
        </div>
        {projects.length === 0 ? (
          <div className="notice">{t("No projects in this section.")}</div>
        ) : (
          <div className="cards">
            {projects.map((project) => {
              const status = statusByProject.get(project.id);

              if (!status) return null;

              return (
                <ProjectHandoffCard
                  key={project.id}
                  project={project}
                  status={status}
                  state={state}
                  onViewProject={onViewProject}
                  onMarkProjectHandoffReady={onMarkProjectHandoffReady}
                  onNotice={notify}
                />
              );
            })}
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="stack">
      <section className="panel hero">
        <div className="head">
          <div>
            <h2>{t("Engineering Handoff Center")}</h2>
            <p className="muted">{t("Review project readiness before exporting to engineering.")}</p>
          </div>
        </div>
        {notice && <div className="notice">{t(notice)}</div>}
        {preview && <pre className="json">{preview}</pre>}
      </section>

      {renderSection("Ready for handoff", "ready")}
      {renderSection("Needs clarification", "needs_clarification")}
      {renderSection("Blocked", "blocked")}
    </div>
  );
}
