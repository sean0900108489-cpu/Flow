import {
  Archive,
  Brain,
  CircleHelp,
  Download,
  FolderKanban,
  GitBranch,
  Inbox,
  Plus,
  Rocket,
  Wand2
} from "lucide-react";

export function Nav({ screen, setScreen }: { screen: string; setScreen: (screen: string) => void }) {
  const items = [
    ["dashboard", FolderKanban, "Dashboard"],
    ["capture", Plus, "Quick Capture"],
    ["inbox", Inbox, "Idea Inbox"],
    ["archived", Archive, "Archived Items"],
    ["thought", Brain, "Thought Detail"],
    ["projects", FolderKanban, "Projects"],
    ["project", Rocket, "Project Detail"],
    ["ai", Wand2, "AI Planning Panel"],
    ["relationships", GitBranch, "Relationships"],
    ["engineering-handoff", Rocket, "Engineering Handoff"],
    ["blocking-questions", CircleHelp, "Blocking Questions"],
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
    capture: "Quick Capture",
    inbox: "Idea Inbox",
    archived: "Archived Items",
    thought: "Thought Detail",
    projects: "Projects",
    project: "Project Detail",
    ai: "AI Planning Panel",
    relationships: "Relationship Map",
    "engineering-handoff": "Engineering Handoff Center",
    "blocking-questions": "Blocking Questions Center",
    export: "Engineering Handoff Export",
    transfer: "App State Transfer",
    universes: "Universe Management"
  }[screen] ?? "Thought Universe";
}
