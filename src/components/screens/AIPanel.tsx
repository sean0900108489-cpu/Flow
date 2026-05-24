import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import type { AIInsight } from "../../domain/types";
import { useI18n } from "../../i18n";

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
  const { t } = useI18n();
  const [message, setMessage] = useState("");

  const reviewInsight = (id: string, status: "accepted" | "rejected") => {
    const result = onSet(id, status);

    setMessage(result.ok
      ? status === "accepted" ? "AI draft accepted." : "AI draft rejected."
      : result.error ?? "AI draft review failed."
    );
  };

  return (
    <section className="panel">
      <div className="head">
        <h2>{t("AI Panel")}</h2>
        <div className="actions">
          <button className="ghost" onClick={onThought}>{t("Analyze current Thought")}</button>
          <button onClick={onProject}>{t("Analyze current Project")}</button>
        </div>
      </div>
      <p className="muted">{t("MVP uses mock AI. AIInsight is a draft and needs human accept/reject.")}</p>
      {message && <div className={message.includes("failed") || message.includes(":") ? "warn" : "notice"}>{t(message)}</div>}
      <div className="stack">
        {insights.length === 0 && <p className="muted">{t("No AI suggestions yet.")}</p>}
        {insights.map((x) => {
          const changes = proposedChanges(x);

          return (
            <div className={`insight ${x.status}`} key={x.id}>
              <div className="head">
                <strong>{t(x.type)}</strong>
                <span className="badge">{t(x.status)}</span>
              </div>
              <pre>{x.content}</pre>
              {changes.length > 0 && (
                <div className="patch">
                  <strong>{t("Proposed changes")}</strong>
                  <ul>
                    {changes.map((change) => <li key={change}>{change}</li>)}
                  </ul>
                </div>
              )}
              {x.status === "draft" && (
                <div className="actions">
                  <button onClick={() => reviewInsight(x.id, "accepted")}><CheckCircle2 size={16} />{t("Accept")}</button>
                  <button className="ghost" onClick={() => reviewInsight(x.id, "rejected")}><XCircle size={16} />{t("Reject")}</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
