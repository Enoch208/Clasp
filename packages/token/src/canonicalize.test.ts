import { describe, it, expect } from "vitest";
import { canonicalize } from "./canonicalize";

describe("canonicalize", () => {
  it("serializes object keys in a stable order regardless of insertion order", () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe(canonicalize({ a: 2, b: 1 }));
    expect(canonicalize({ a: 2, b: 1 })).toBe('{"a":2,"b":1}');
  });

  it("sorts nested object keys but preserves array order", () => {
    expect(canonicalize({ z: { y: 1, x: 2 }, a: [3, 1, 2] })).toBe('{"a":[3,1,2],"z":{"x":2,"y":1}}');
  });

  it("handles primitives and null", () => {
    expect(canonicalize("hi")).toBe('"hi"');
    expect(canonicalize(42)).toBe("42");
    expect(canonicalize(true)).toBe("true");
    expect(canonicalize(null)).toBe("null");
  });

  it("omits undefined-valued keys so the output stays valid JSON", () => {
    expect(canonicalize({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  it("produces identical output for deeply reordered equal structures", () => {
    const left = { sessionId: "s1", limits: { max: "100", min: "1" }, perms: ["a", "b"] };
    const right = { perms: ["a", "b"], limits: { min: "1", max: "100" }, sessionId: "s1" };
    expect(canonicalize(left)).toBe(canonicalize(right));
  });
});
