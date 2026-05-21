import { useState } from "react";
import type { Project, Universe } from "../../domain/types";
import { engineeringInput } from "../../services/exportEngineeringInput";

export function Export({ project, universe }: { project: Project; universe?: Universe }) {
  const [message, setMessage] = useState("");
  const json = JSON.stringify(engineeringInput(project, universe), null, 2);
  const copy = async () => {
    await navigator.clipboard.writeText(json);
    setMessage("EngineeringFlowInput JSON copied.");
  };
  const download = () => {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, "-").toLowerCase()}-engineering-flow-input.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage("EngineeringFlowInput JSON download started.");
  };
  return (
    <section className="panel">
      <div className="head">
        <div>
          <h2>Engineering Handoff Export</h2>
          <p className="muted">匯出 EngineeringFlowInput 草稿。</p>
        </div>
        <div className="actions">
          <button className="ghost" onClick={copy}>複製 JSON</button>
          <button onClick={download}>下載 JSON</button>
        </div>
      </div>
      <div className="notice">Project-by-project export keeps the EngineeringFlowInput schema stable for handoff.</div>
      {message && <div className="notice">{message}</div>}
      <pre className="json">{json}</pre>
    </section>
  );
}
