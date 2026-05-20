import { describe, expect, it } from "vitest";
import { seed } from "../data/seed";
import { parseAppStateJson, stringifyAppState, validateAppState } from "./appStateTransfer";

describe("app state transfer", () => {
  it("validates seed state", () => {
    const result = validateAppState(seed);

    expect(result.ok).toBe(true);
    expect(result.state?.thoughts.length).toBeGreaterThan(0);
  });

  it("rejects invalid shape", () => {
    const result = validateAppState({ thoughts: [] });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("universes");
  });

  it("round trips app state json", () => {
    const json = stringifyAppState(seed);
    const result = parseAppStateJson(json);

    expect(result.ok).toBe(true);
    expect(result.state?.projects[0].name).toBe("Todo Thought Universe MVP");
    expect(result.state?.projects[0].status).toBe("active");
  });
});
