import { describe, it, expect } from "vitest";
import { isGrantable, isHighRisk, isNeverExposed, inVocabulary } from "./permissions";

describe("permission vocabulary", () => {
  it("marks safe reads and user writes as grantable", () => {
    expect(isGrantable("node:read")).toBe(true);
    expect(isGrantable("payments:request")).toBe(true);
  });

  it("does not grant high-risk permissions in this build", () => {
    expect(isGrantable("channels:open")).toBe(false);
    expect(isHighRisk("channels:open")).toBe(true);
    expect(inVocabulary("channels:open")).toBe(true);
  });

  it("keeps never-exposed permissions out of the vocabulary entirely", () => {
    expect(inVocabulary("raw-rpc")).toBe(false);
    expect(isNeverExposed("raw-rpc")).toBe(true);
    expect(isNeverExposed("private-key:export")).toBe(true);
    expect(isGrantable("admin:unrestricted")).toBe(false);
  });
});
