import { describe, it, expect } from "vitest";
import { canTransition, assertTransition } from "./state";

describe("session state machine", () => {
  it("allows the lifecycle path", () => {
    expect(canTransition("REQUESTED", "REVIEWED")).toBe(true);
    expect(canTransition("REVIEWED", "ACTIVE")).toBe(true);
    expect(canTransition("ACTIVE", "EXPIRED")).toBe(true);
    expect(canTransition("ACTIVE", "REVOKED")).toBe(true);
  });

  it("rejects illegal transitions", () => {
    expect(canTransition("ACTIVE", "REVIEWED")).toBe(false);
    expect(canTransition("REVOKED", "ACTIVE")).toBe(false);
    expect(canTransition("EXPIRED", "ACTIVE")).toBe(false);
    expect(() => assertTransition("REVOKED", "ACTIVE")).toThrow(/illegal session transition/);
  });
});
