import { describe, it, expect } from "vitest";
import { addAmounts, subAmounts, cmpAmounts, lteAmounts, gtAmounts, isValidAmount } from "./money";

describe("money", () => {
  it("validates integer strings only", () => {
    expect(isValidAmount("0")).toBe(true);
    expect(isValidAmount("100000000")).toBe(true);
    expect(isValidAmount("1.5")).toBe(false);
    expect(isValidAmount("-1")).toBe(false);
    expect(isValidAmount("01")).toBe(false);
    expect(isValidAmount("")).toBe(false);
  });

  it("adds without floating point across large values", () => {
    expect(addAmounts("9007199254740993", "1")).toBe("9007199254740994");
  });

  it("subtracts and rejects underflow", () => {
    expect(subAmounts("500000000", "200000000")).toBe("300000000");
    expect(() => subAmounts("1", "2")).toThrow(/underflow/);
  });

  it("compares as integers, not strings", () => {
    expect(cmpAmounts("9", "100")).toBe(-1);
    expect(lteAmounts("100000000", "100000000")).toBe(true);
    expect(gtAmounts("1000000000", "100000000")).toBe(true);
  });

  it("throws on invalid input", () => {
    expect(() => addAmounts("1.5", "1")).toThrow(/invalid amount/);
  });
});
