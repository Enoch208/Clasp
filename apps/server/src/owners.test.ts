import { describe, expect, it } from "vitest";
import { parseOwnerKeys } from "./owners";

const KEY = "a".repeat(64);

describe("parseOwnerKeys", () => {
  it("is open when nothing is configured", () => {
    expect(parseOwnerKeys(undefined)).toBeNull();
    expect(parseOwnerKeys(" , ")).toBeNull();
  });

  it("accepts 0x-prefixed, quoted and upper-case keys", () => {
    expect(parseOwnerKeys(`0x${KEY.toUpperCase()}, "${KEY}"`)).toEqual([KEY, KEY]);
  });

  it("refuses to start rather than silently falling back to open mode", () => {
    expect(() => parseOwnerKeys(`${KEY},not-a-key`)).toThrow(/invalid key/);
  });
});
