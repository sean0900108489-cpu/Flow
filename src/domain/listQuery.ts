import type { Project, ProjectStatus, ThoughtItem, ThoughtStatus, ThoughtType } from "./types";

export type ListSortBy = "updated_desc" | "updated_asc" | "title_asc" | "title_desc";

export interface ThoughtFilterOptions {
  searchText?: string;
  type?: ThoughtType | "all";
  status?: ThoughtStatus | "all";
  universeId?: string | "all";
}

export interface ProjectFilterOptions {
  searchText?: string;
  status?: ProjectStatus | string | "all";
  universeId?: string | "all";
}

type ThoughtSearchable = ThoughtItem & { desiredOutcome?: string };
type ProjectSearchable = Project & { title?: string; description?: string; lifecycleStatus?: string };

function normalize(value: unknown) {
  return String(value ?? "").toLowerCase().trim();
}

function includesSearch(fields: unknown[], searchText?: string) {
  const query = normalize(searchText);
  if (!query) return true;
  return fields.some((field) => normalize(field).includes(query));
}

function stableSort<T>(items: T[], compare: (left: T, right: T, leftIndex: number, rightIndex: number) => number) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => compare(left.item, right.item, left.index, right.index) || left.index - right.index)
    .map(({ item }) => item);
}

function timeValue(item: { updatedAt?: string; createdAt?: string }) {
  const raw = item.updatedAt || item.createdAt;
  const timestamp = raw ? Date.parse(raw) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function compareTime(
  left: { updatedAt?: string; createdAt?: string },
  right: { updatedAt?: string; createdAt?: string },
  direction: "asc" | "desc",
  leftIndex: number,
  rightIndex: number
) {
  const leftTime = timeValue(left);
  const rightTime = timeValue(right);

  if (leftTime === undefined && rightTime === undefined) return leftIndex - rightIndex;
  if (leftTime === undefined) return 1;
  if (rightTime === undefined) return -1;

  return direction === "desc" ? rightTime - leftTime : leftTime - rightTime;
}

function compareTitle(leftTitle: string, rightTitle: string, direction: "asc" | "desc") {
  return direction === "desc"
    ? rightTitle.localeCompare(leftTitle)
    : leftTitle.localeCompare(rightTitle);
}

export function filterThoughts(thoughts: ThoughtItem[], options: ThoughtFilterOptions = {}) {
  return thoughts.filter((thought) => {
    const searchable = thought as ThoughtSearchable;
    const matchesSearch = includesSearch(
      [thought.title, thought.content, thought.why, thought.outcome, searchable.desiredOutcome, thought.nextAction],
      options.searchText
    );
    const matchesType = !options.type || options.type === "all" || thought.type === options.type;
    const matchesStatus = !options.status || options.status === "all" || thought.status === options.status;
    const matchesUniverse =
      !options.universeId || options.universeId === "all" || thought.universeId === options.universeId;

    return matchesSearch && matchesType && matchesStatus && matchesUniverse;
  });
}

export function filterProjects(projects: Project[], options: ProjectFilterOptions = {}) {
  return projects.filter((project) => {
    const searchable = project as ProjectSearchable;
    const matchesSearch = includesSearch(
      [
        project.name,
        searchable.title,
        project.intent,
        searchable.description,
        project.nextAction,
        project.readiness,
        project.status,
        searchable.lifecycleStatus
      ],
      options.searchText
    );
    const matchesStatus = !options.status || options.status === "all" || project.status === options.status;
    const matchesUniverse =
      !options.universeId || options.universeId === "all" || project.universeId === options.universeId;

    return matchesSearch && matchesStatus && matchesUniverse;
  });
}

export function sortThoughts(thoughts: ThoughtItem[], sortBy: ListSortBy = "updated_desc") {
  if (sortBy === "title_asc" || sortBy === "title_desc") {
    return stableSort(thoughts, (left, right) => compareTitle(normalize(left.title), normalize(right.title), sortBy === "title_asc" ? "asc" : "desc"));
  }

  return stableSort(thoughts, (left, right, leftIndex, rightIndex) =>
    compareTime(left, right, sortBy === "updated_asc" ? "asc" : "desc", leftIndex, rightIndex)
  );
}

export function sortProjects(projects: Project[], sortBy: ListSortBy = "updated_desc") {
  if (sortBy === "title_asc" || sortBy === "title_desc") {
    return stableSort(projects, (left, right) => compareTitle(normalize(left.name), normalize(right.name), sortBy === "title_asc" ? "asc" : "desc"));
  }

  return stableSort(projects, (left, right, leftIndex, rightIndex) =>
    compareTime(left, right, sortBy === "updated_asc" ? "asc" : "desc", leftIndex, rightIndex)
  );
}
