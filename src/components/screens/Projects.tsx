import { useState } from "react";
import type { Project, Universe } from "../../domain/types";
import { useI18n } from "../../i18n";

interface CreateProjectForm {
  title: string;
  description: string;
  universeId: string;
  nextAction: string;
}

export function Projects({
  projects,
  universes,
  onCreate,
  onViewProject
}: {
  projects: Project[];
  universes: Universe[];
  onCreate: (input: CreateProjectForm) => { ok: boolean; error?: string; projectId?: string };
  onViewProject: (projectId: string) => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState<CreateProjectForm>({
    title: "",
    description: "",
    universeId: universes[0]?.id ?? "",
    nextAction: ""
  });
  const [notice, setNotice] = useState("");

  const updateForm = (patch: Partial<CreateProjectForm>) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const create = () => {
    const result = onCreate(form);

    if (!result.ok) {
      setNotice(result.error ?? "Project could not be created.");
      return;
    }

    setNotice("Project created.");
    setForm({
      title: "",
      description: "",
      universeId: form.universeId,
      nextAction: ""
    });
  };

  const universeName = (universeId: string) =>
    universes.find((universe) => universe.id === universeId)?.name ?? t("No universe");

  return (
    <div className="stack">
      <section className="panel form">
        <div className="head">
          <div>
            <h2>{t("Create Project")}</h2>
            <p className="muted">{t("Create an independent project without starting from a thought.")}</p>
          </div>
        </div>
        {notice && <div className="notice">{t(notice)}</div>}
        <label>{t("Title")}<input value={form.title} onChange={(event) => updateForm({ title: event.target.value })} /></label>
        <label>{t("Description")}<textarea value={form.description} onChange={(event) => updateForm({ description: event.target.value })} /></label>
        <label>{t("Universe")}
          <select value={form.universeId} onChange={(event) => updateForm({ universeId: event.target.value })}>
            <option value="">{t("No universe")}</option>
            {universes.map((universe) => (
              <option key={universe.id} value={universe.id}>{universe.name}</option>
            ))}
          </select>
        </label>
        <label>{t("Next Action")}<input value={form.nextAction} onChange={(event) => updateForm({ nextAction: event.target.value })} /></label>
        <div className="actions">
          <button onClick={create}>{t("Create Project")}</button>
        </div>
      </section>

      <section className="panel stack">
        <div className="head">
          <div>
            <h2>{t("Project List")}</h2>
            <p className="muted">{t("{count} active projects", { count: projects.length })}</p>
          </div>
        </div>
        <div className="cards">
          {projects.length === 0 ? (
            <div className="notice">{t("No projects yet.")}</div>
          ) : (
            projects.map((project) => (
              <article className="card project-card" key={project.id}>
                <div className="line">
                  <strong>{project.name || t("Untitled Project")}</strong>
                  <span className="badge">{t(project.lifecycleStatus ?? project.status)}</span>
                </div>
                <p>{project.intent || t("No description yet.")}</p>
                <div className="mini-list">
                  <p>{t("Universe: {name}", { name: universeName(project.universeId) })}</p>
                  <p>{t("Next Action: {action}", { action: project.nextAction || t("Not set") })}</p>
                  <p>{t("Linked thoughts: {count}", { count: project.linkedThoughtIds?.length ?? 0 })}</p>
                </div>
                <div className="actions">
                  <button className="ghost" onClick={() => onViewProject(project.id)}>{t("View Project")}</button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
