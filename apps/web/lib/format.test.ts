import { describe, it, expect } from "vitest";
import {
  formatCkb,
  formatDuration,
  isReduction,
  clampToReduction,
  translatePermission,
} from "./format";

describe("formatCkb", () => {
  it("formats whole and fractional CKB from shannons without floats", () => {
    expect(formatCkb("100000000")).toBe("1 CKB");
    expect(formatCkb("250000000")).toBe("2.5 CKB");
    expect(formatCkb("0")).toBe("0 CKB");
    expect(formatCkb("500000000")).toBe("5 CKB");
    expect(formatCkb("150000000")).toBe("1.5 CKB");
  });
});

describe("formatDuration", () => {
  it("reads hours and minutes naturally", () => {
    expect(formatDuration(60)).toBe("1 hour");
    expect(formatDuration(120)).toBe("2 hours");
    expect(formatDuration(15)).toBe("15 minutes");
    expect(formatDuration(1)).toBe("1 minute");
  });
});

describe("reduce-only guard", () => {
  it("accepts equal or smaller amounts only", () => {
    expect(isReduction("500000000", "200000000")).toBe(true);
    expect(isReduction("500000000", "500000000")).toBe(true);
    expect(isReduction("500000000", "600000000")).toBe(false);
  });

  it("clamps an attempted increase back to the previous value", () => {
    expect(clampToReduction("200000000", "900000000")).toBe("200000000");
    expect(clampToReduction("200000000", "100000000")).toBe("100000000");
  });
});

describe("translatePermission", () => {
  it("never shows a raw operation name alone", () => {
    const t = translatePermission("payments:request");
    expect(t.title).toBe("Request Fiber payments");
    expect(t.consequence).toMatch(/requires your approval/);
  });
});
