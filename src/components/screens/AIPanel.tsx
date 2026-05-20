import { CheckCircle2, XCircle } from "lucide-react";
import type { AIInsight } from "../../domain/types";

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
