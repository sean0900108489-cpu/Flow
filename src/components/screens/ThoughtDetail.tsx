import type { ThoughtItem, ThoughtStatus, Universe } from "../../domain/types";
import { SelectThoughtType } from "../common/SelectThoughtType";
import { SelectUniverse } from "../common/SelectUniverse";

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
