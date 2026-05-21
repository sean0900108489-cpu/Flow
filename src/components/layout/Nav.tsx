import {
  Archive,
  Brain,
  CircleHelp,
  ClipboardCheck,
  Download,
  FolderKanban,
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

export function Nav({ screen, setScreen }: { screen: string; setScreen: (screen: string) => void }) {
  const items = [
    ["dashboard", FolderKanban, "Dashboard"],
    ["global-search", Search, "Global Search"],
    ["review-queue", ClipboardCheck, "Review Queue"],
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
    ["universes", FolderKanban, "Universes"]
  ] as const;

  return (
    <nav>
      {items.map(([key, Icon, label]) => (
        <button key={key} className={screen === key ? "active" : ""} onClick={() => setScreen(key)}>
          <Icon size={18} />
          {label}
        </button>
      ))}
    </nav>
  );
}

export function title(screen: string) {
  return {
    dashboard: "Universe Dashboard",
    "global-search": "Global Search Center",
    "review-queue": "Review Queue Center",
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
    "blocking-questions": "Blocking Questions Center",
    "decision-records": "Decision Records Center",
    export: "Engineering Handoff Export",
    transfer: "App State Transfer",
    universes: "Universe Management"
  }[screen] ?? "Thought Universe";
}
