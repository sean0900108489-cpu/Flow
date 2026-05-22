import { useState, type FocusEvent, type MouseEvent } from "react";
import {
  Archive,
  Brain,
  CircleHelp,
  ClipboardCheck,
  Download,
  FolderKanban,
  Gauge,
  Info,
  GitBranch,
  Inbox,
  ListChecks,
  ListTodo,
  Network,
  Plus,
  Rocket,
  Search,
  ScrollText,
  Wand2
} from "lucide-react";

type NavTooltip = {
  label: string;
  top: number;
};

export function Nav({ screen, setScreen }: { screen: string; setScreen: (screen: string) => void }) {
  const [tooltip, setTooltip] = useState<NavTooltip | null>(null);
  const items = [
    ["dashboard", FolderKanban, "Dashboard"],
    ["global-search", Search, "Global Search"],
    ["review-queue", ClipboardCheck, "Review Queue"],
    ["engineering-readiness", Gauge, "Engineering Readiness"],
    ["capture", Plus, "Quick Capture"],
    ["inbox", Inbox, "Idea Inbox"],
    ["thought-triage", ListChecks, "Thought Triage"],
    ["next-actions", ListTodo, "Next Actions"],
    ["archived", Archive, "Archived Items"],
    ["thought", Brain, "Thought Detail"],
    ["projects", FolderKanban, "Projects"],
    ["project", Rocket, "Project Detail"],
    ["ai", Wand2, "AI Planning Panel"],
    ["relationships", GitBranch, "Relationships"],
    ["relationship-explorer", Network, "Relationship Explorer"],
    ["engineering-handoff", Rocket, "Engineering Handoff"],
    ["blocking-questions", CircleHelp, "Blocking Questions"],
    ["decision-records", ScrollText, "Decision Records"],
    ["export", Download, "Engineering Export"],
    ["transfer", Download, "App State Transfer"],
    ["deployment-status", Info, "Deployment Status"],
    ["universes", FolderKanban, "Universes"]
  ] as const;

  const showTooltip =
    (label: string) => (event: FocusEvent<HTMLButtonElement> | MouseEvent<HTMLButtonElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      setTooltip({ label, top: rect.top + rect.height / 2 });
    };
  const hideTooltip = () => setTooltip(null);

  return (
    <>
      <nav>
        {items.map(([key, Icon, label]) => (
          <button
            key={key}
            type="button"
            aria-label={label}
            aria-current={screen === key ? "page" : undefined}
            className={screen === key ? "active" : ""}
            data-tooltip={label}
            title={label}
            onBlur={hideTooltip}
            onClick={() => setScreen(key)}
            onFocus={showTooltip(label)}
            onMouseEnter={showTooltip(label)}
            onMouseLeave={hideTooltip}
          >
            <Icon size={18} />
            <span className="nav-label">{label}</span>
          </button>
        ))}
      </nav>
      {tooltip && (
        <span className="nav-tooltip" style={{ top: tooltip.top }}>
          {tooltip.label}
        </span>
      )}
    </>
  );
}

export function title(screen: string) {
  return {
    dashboard: "Universe Dashboard",
    "global-search": "Global Search Center",
    "review-queue": "Review Queue Center",
    "engineering-readiness": "Engineering Readiness Center",
    capture: "Quick Capture",
    inbox: "Idea Inbox",
    "thought-triage": "Thought Triage Center",
    "next-actions": "Next Action Center",
    archived: "Archived Items",
    thought: "Thought Detail",
    projects: "Projects",
    project: "Project Detail",
    "universe-detail": "Universe Detail Center",
    ai: "AI Planning Panel",
    relationships: "Relationship Map",
    "relationship-explorer": "Relationship Explorer",
    "engineering-handoff": "Engineering Handoff Center",
    "blocking-questions": "Decision Center",
    "decision-records": "Decision Records Center",
    export: "Engineering Handoff Export",
    transfer: "App State Transfer",
    "deployment-status": "Deployment Status",
    universes: "Universe Management"
  }[screen] ?? "Thought Universe";
}
