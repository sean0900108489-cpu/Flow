import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import type { AIInsight } from "../../domain/types";

function formatPatchValue(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "string") return `"${value}"`;
  return JSON.stringify(value);
}

function proposedChanges(insight: AIInsight) {
  return insight.patch?.operations.flatMap((operation) => {
    const target = operation.type === "updateThought" ? "thought" : "project";

    return Object.entries(operation.patch)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${target}.${key}: ${formatPatchValue(value)}`);
  }) ?? [];
}

export function AIPanel({
  insights,
  onThought,
  onProject,
  onSet
}: {
  insights: AIInsight[];
  onThought: () => void;
  onProject: () => void;
  onSet: (id: string, status: "accepted" | "rejected") => { ok: boolean; error?: string };
}) {
  const [message, setMessage] = useState("");

  const reviewInsight = (id: string, status: "accepted" | "rejected") => {
    const result = onSet(id, status);

    setMessage(result.ok
      ? `AI draft ${status}.`
      : result.error ?? "AI draft review failed."
    );
  };

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
      {message && <div className={message.includes("failed") || message.includes(":") ? "warn" : "notice"}>{message}</div>}
      <div className="stack">
        {insights.length === 0 && <p className="muted">尚無 AI 建議。</p>}
        {insights.map((x) => {
          const changes = proposedChanges(x);

          return (
            <div className={`insight ${x.status}`} key={x.id}>
              <div className="head">
                <strong>{x.type}</strong>
                <span className="badge">{x.status}</span>
              </div>
              <pre>{x.content}</pre>
              {changes.length > 0 && (
                <div className="patch">
                  <strong>Proposed changes</strong>
                  <ul>
                    {changes.map((change) => <li key={change}>{change}</li>)}
                  </ul>
                </div>
              )}
              {x.status === "draft" && (
                <div className="actions">
                  <button onClick={() => reviewInsight(x.id, "accepted")}><CheckCircle2 size={16} />接受</button>
                  <button className="ghost" onClick={() => reviewInsight(x.id, "rejected")}><XCircle size={16} />拒絕</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
