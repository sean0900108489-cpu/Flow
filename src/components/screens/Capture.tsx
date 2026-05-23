import { useState } from "react";
import type { ThoughtItem, ThoughtType, Universe } from "../../domain/types";
import { useI18n } from "../../i18n";
import { SelectThoughtType } from "../common/SelectThoughtType";
import { SelectUniverse } from "../common/SelectUniverse";

export function Capture({
  universes,
  onAdd
}: {
  universes: Universe[];
  onAdd: (data: Pick<ThoughtItem, "title" | "content" | "type" | "universeId">) => void;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<ThoughtType>("inspiration");
  const [universeId, setUniverseId] = useState(universes[0]?.id ?? "");

  return (
    <section className="panel form">
      <h2>{t("Quick Capture")}</h2>
      <label>{t("Title")}<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("What came to mind...")} /></label>
      <label>{t("Content")}<textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={t("Add context...")} /></label>
      <div className="row">
        <label>{t("Type")}<SelectThoughtType value={type} onChange={setType} /></label>
        <label>{t("Universe")}<SelectUniverse value={universeId} universes={universes} onChange={setUniverseId} /></label>
      </div>
      <button onClick={() => { onAdd({ title, content, type, universeId }); setTitle(""); setContent(""); }}>{t("Save to Inbox")}</button>
    </section>
  );
}
