import { useState } from "react";
import type { ThoughtItem, ThoughtStatus, Universe } from "../../domain/types";
import { useI18n } from "../../i18n";
import { SelectThoughtType } from "../common/SelectThoughtType";
import { SelectUniverse } from "../common/SelectUniverse";

export function ThoughtDetail({
  thought,
  universes,
  onUpdate,
  onAI,
  onPromote,
  onArchive,
  onDelete
}: {
  thought: ThoughtItem;
  universes: Universe[];
  onUpdate: (patch: Partial<ThoughtItem>) => void;
  onAI: () => void;
  onPromote: () => { ok: boolean; error?: string };
  onArchive: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const [error, setError] = useState("");

  const promote = () => {
    const result = onPromote();
    setError(result.ok ? "" : result.error ?? "Could not promote thought.");
  };

  return (
    <section className="panel form">
      <div className="head">
        <h2>{t("Thought Detail")}</h2>
        <div className="actions">
          <button className="ghost" onClick={onAI}>{t("AI suggestion")}</button>
          {thought.status !== "archived" && <button className="ghost" onClick={onArchive}>{t("Archive Thought")}</button>}
          <button className="danger" onClick={onDelete}>{t("Delete Thought")}</button>
          <button onClick={promote}>{t("Promote to Project")}</button>
        </div>
      </div>
      {error && <div className="warn">{t(error)}</div>}
      {thought.projectId && <div className="notice">{t("Linked to project: {id}", { id: thought.projectId })}</div>}
      <label>{t("標題")}<input value={thought.title} onChange={(e) => onUpdate({ title: e.target.value })} /></label>
      <label>{t("內容")}<textarea value={thought.content} onChange={(e) => onUpdate({ content: e.target.value })} /></label>
      <div className="row">
        <label>{t("類型")}<SelectThoughtType value={thought.type} onChange={(v) => onUpdate({ type: v })} /></label>
        <label>{t("狀態")}
          <select value={thought.status} onChange={(e) => onUpdate({ status: e.target.value as ThoughtStatus })}>
            <option value="inbox">{t("inbox")}</option>
            <option value="active">{t("active")}</option>
            <option value="paused">{t("paused")}</option>
            <option value="done">{t("done")}</option>
            <option value="archived">{t("archived")}</option>
          </select>
        </label>
        <label>{t("Universe")}<SelectUniverse value={thought.universeId} universes={universes} onChange={(v) => onUpdate({ universeId: v })} /></label>
      </div>
      <label>{t("Why / 原因")}<textarea value={thought.why} onChange={(e) => onUpdate({ why: e.target.value })} /></label>
      <label>{t("Desired Outcome / 想達成什麼")}<textarea value={thought.outcome} onChange={(e) => onUpdate({ outcome: e.target.value })} /></label>
      <label>{t("Next Action / 下一步")}<input value={thought.nextAction} onChange={(e) => onUpdate({ nextAction: e.target.value })} /></label>
    </section>
  );
}
