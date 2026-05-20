import { useState } from "react";
import type { ThoughtItem, ThoughtType, Universe } from "../../domain/types";
import { SelectThoughtType } from "../common/SelectThoughtType";
import { SelectUniverse } from "../common/SelectUniverse";

export function Capture({
  universes,
  onAdd
}: {
  universes: Universe[];
  onAdd: (data: Pick<ThoughtItem, "title" | "content" | "type" | "universeId">) => void;
}) {
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
