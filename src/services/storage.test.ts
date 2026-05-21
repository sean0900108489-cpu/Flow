import { afterEach, describe, expect, it } from "vitest";
import { seed } from "../data/seed";
import { loadState, saveState, STORAGE_KEY } from "./storage";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function installStorage(storage: Storage | undefined = new MemoryStorage()) {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage
  });

  return storage;
}

describe("storage", () => {
  afterEach(() => {
    installStorage(undefined);
  });

  it("falls back to normalized seed when localStorage JSON is malformed", () => {
    const storage = installStorage();
    storage?.setItem(STORAGE_KEY, "{not-json");

    const state = loadState();

    expect(state.projects[0].name).toBe("Todo Thought Universe MVP");
    expect(state.engineeringReadiness).toBeDefined();
    expect(state.nextActionState).toBeDefined();
  });

  it("falls back to normalized seed when localStorage shape is not AppState", () => {
    const storage = installStorage();
    storage?.setItem(STORAGE_KEY, JSON.stringify({ thoughts: [] }));

    const state = loadState();

    expect(state.universes.length).toBe(seed.universes.length);
    expect(state.blockingQuestions?.length).toBeGreaterThanOrEqual(3);
  });

  it("loads legacy AppState through migration/default initializers", () => {
    const storage = installStorage();
    const { blockingQuestions, decisionRecords, engineeringReadiness, nextActionState, ...legacyState } = seed;
    storage?.setItem(STORAGE_KEY, JSON.stringify(legacyState));

    const state = loadState();

    expect(state.blockingQuestions?.map((question) => question.id)).toEqual([
      "bq-thought-todo",
      "bq-universe-model",
      "bq-engineering-readiness"
    ]);
    expect(state.decisionRecords).toEqual([]);
    expect(state.engineeringReadiness).toMatchObject({
      note: "",
      manualConfidence: "medium",
      targetPhase: "exploration"
    });
    expect(state.nextActionState).toMatchObject({
      savedActionIds: [],
      dismissedActionIds: [],
      manualConfidence: "medium",
      focusMode: "decide"
    });
  });

  it("normalizes before saving and ignores unavailable storage", () => {
    const storage = installStorage();
    const { nextActionState, ...legacyState } = seed;

    saveState(legacyState);

    expect(JSON.parse(storage?.getItem(STORAGE_KEY) ?? "{}").nextActionState).toMatchObject({
      savedActionIds: [],
      dismissedActionIds: []
    });

    installStorage(undefined);
    expect(() => saveState(seed)).not.toThrow();
  });
});
