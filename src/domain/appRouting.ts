export const screenRoutes: Record<string, string> = {
  dashboard: "/",
  "global-search": "/global-search",
  "review-queue": "/review-queue",
  "engineering-readiness": "/engineering-readiness",
  capture: "/capture",
  inbox: "/inbox",
  "thought-triage": "/thought-triage",
  "next-actions": "/next-actions",
  archived: "/archived",
  thought: "/thought",
  projects: "/projects",
  project: "/project",
  "universe-detail": "/universe-detail",
  ai: "/ai",
  relationships: "/relationships",
  "relationship-explorer": "/relationship-explorer",
  "engineering-handoff": "/engineering-handoff",
  "blocking-questions": "/blocking-questions",
  "decision-records": "/decision-records",
  export: "/export",
  transfer: "/transfer",
  universes: "/universes",
  "deployment-status": "/deployment-status"
};

const routeScreens = new Map(Object.entries(screenRoutes).map(([screen, route]) => [route, screen]));

export function pathForScreen(screen: string) {
  return screenRoutes[screen] ?? screenRoutes.dashboard;
}

export function screenForPath(pathname: string) {
  const normalized = pathname.replace(/\/+$/, "") || "/";

  return routeScreens.get(normalized) ?? "dashboard";
}
