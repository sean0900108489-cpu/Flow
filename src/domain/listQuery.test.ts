import { describe, expect, it } from "vitest";
import type { Project, ThoughtItem } from "./types";
import { filterProjects, filterThoughts, sortProjects, sortThoughts } from "./listQuery";

const thought = (patch: Partial<ThoughtItem> & Pick<ThoughtItem, "id" | "title">): ThoughtItem => {
  const { id, title, ...rest } = patch;

  return {
    id,
    title,
    content: "",
    type: "note",
    status: "inbox",
    universeId: "u-1",
    why: "",
    outcome: "",
    nextAction: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...rest
  };
};

const project = (patch: Partial<Project> & Pick<Project, "id" | "name">): Project => {
  const { id, name, ...rest } = patch;

  return {
    id,
    universeId: "u-1",
    status: "active",
    name,
    intent: "",
    users: [],
    features: [],
    screens: [],
    dataObjects: [],
    flowSteps: [],
    unknowns: [],
    nextAction: "",
    readiness: "needs_clarification",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...rest
  };
};

describe("list query utilities", () => {
  it("searches thought title, content, why, desired outcome, and next action", () => {
    const thoughts = [
      thought({ id: "t-title", title: "Title match" }),
      thought({ id: "t-content", title: "Content holder", content: "Content keyword" }),
      thought({ id: "t-why", title: "Why holder", why: "Because keyword" }),
      thought({ id: "t-outcome", title: "Outcome holder", outcome: "Desired keyword" }),
      thought({ id: "t-next", title: "Next holder", nextAction: "Next keyword" })
    ];

    expect(filterThoughts(thoughts, { searchText: "title" }).map((item) => item.id)).toEqual(["t-title"]);
    expect(filterThoughts(thoughts, { searchText: "content keyword" }).map((item) => item.id)).toEqual(["t-content"]);
    expect(filterThoughts(thoughts, { searchText: "because keyword" }).map((item) => item.id)).toEqual(["t-why"]);
    expect(filterThoughts(thoughts, { searchText: "desired keyword" }).map((item) => item.id)).toEqual(["t-outcome"]);
    expect(filterThoughts(thoughts, { searchText: "next keyword" }).map((item) => item.id)).toEqual(["t-next"]);
  });

  it("searches thoughts case-insensitively", () => {
    const thoughts = [thought({ id: "t-1", title: "Mixed Case Thought" })];

    expect(filterThoughts(thoughts, { searchText: "mixed case" })).toHaveLength(1);
  });

  it("filters thoughts by type", () => {
    const thoughts = [
      thought({ id: "t-task", title: "Task", type: "task" }),
      thought({ id: "t-note", title: "Note", type: "note" })
    ];

    expect(filterThoughts(thoughts, { type: "task" }).map((item) => item.id)).toEqual(["t-task"]);
  });

  it("filters thoughts by universe", () => {
    const thoughts = [
      thought({ id: "t-1", title: "Main", universeId: "u-1" }),
      thought({ id: "t-2", title: "Other", universeId: "u-2" })
    ];

    expect(filterThoughts(thoughts, { universeId: "u-2" }).map((item) => item.id)).toEqual(["t-2"]);
  });

  it("filters archived thought status", () => {
    const thoughts = [
      thought({ id: "t-active", title: "Active", status: "active" }),
      thought({ id: "t-archived", title: "Archived", status: "archived" })
    ];

    expect(filterThoughts(thoughts, { status: "archived" }).map((item) => item.id)).toEqual(["t-archived"]);
  });

  it("searches projects", () => {
    const projects = [
      project({ id: "p-1", name: "Project Alpha" }),
      project({ id: "p-2", name: "Project Beta", intent: "Findable planning description" })
    ];

    expect(filterProjects(projects, { searchText: "findable" }).map((item) => item.id)).toEqual(["p-2"]);
  });

  it("filters projects by status", () => {
    const projects = [
      project({ id: "p-active", name: "Active", status: "active" }),
      project({ id: "p-archived", name: "Archived", status: "archived" })
    ];

    expect(filterProjects(projects, { status: "archived" }).map((item) => item.id)).toEqual(["p-archived"]);
  });

  it("sorts titles ascending", () => {
    const thoughts = [
      thought({ id: "t-z", title: "Zebra thought" }),
      thought({ id: "t-a", title: "Apple thought" })
    ];
    const projects = [
      project({ id: "p-z", name: "Zebra project" }),
      project({ id: "p-a", name: "Apple project" })
    ];

    expect(sortThoughts(thoughts, "title_asc").map((item) => item.id)).toEqual(["t-a", "t-z"]);
    expect(sortProjects(projects, "title_asc").map((item) => item.id)).toEqual(["p-a", "p-z"]);
  });

  it("sorts updated descending with fallback without crashing", () => {
    const thoughts = [
      thought({ id: "t-old", title: "Old", updatedAt: "2026-01-01T00:00:00.000Z" }),
      thought({ id: "t-new", title: "New", updatedAt: "2026-01-03T00:00:00.000Z" }),
      thought({ id: "t-fallback", title: "Fallback", updatedAt: "", createdAt: "2026-01-02T00:00:00.000Z" })
    ];

    expect(sortThoughts(thoughts, "updated_desc").map((item) => item.id)).toEqual(["t-new", "t-fallback", "t-old"]);
  });
});
