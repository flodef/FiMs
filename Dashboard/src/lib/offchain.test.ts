import { describe, expect, test } from "bun:test";
import { DEFAULT_OFFCHAIN, offchainFromStored, validateOffchain } from "./offchain.js";

describe("validateOffchain", () => {
  test("accepts exactly {xBTC, ZEC} finite >= 0", () => {
    expect(validateOffchain({ xBTC: 0.5, ZEC: 2 })).toEqual({ ok: true, data: { xBTC: 0.5, ZEC: 2 } });
    expect(validateOffchain({ xBTC: 0, ZEC: 0 })).toEqual({ ok: true, data: { xBTC: 0, ZEC: 0 } });
    expect(validateOffchain({ xBTC: 1e9, ZEC: 1e9 })).toEqual({ ok: true, data: { xBTC: 1e9, ZEC: 1e9 } });
  });

  test("rejects other keys, missing keys, bad values", () => {
    expect(validateOffchain({ xBTC: 1, ZEC: 1, extra: 0 }).ok).toBe(false);
    expect(validateOffchain({ xBTC: 1 }).ok).toBe(false);
    expect(validateOffchain({}).ok).toBe(false);
    for (const bad of [-1, NaN, Infinity, "abc", 1e9 + 1]) {
      expect(validateOffchain({ xBTC: bad, ZEC: 1 }).ok).toBe(false);
      expect(validateOffchain({ xBTC: 1, ZEC: bad }).ok).toBe(false);
    }
  });
});

describe("offchainFromStored", () => {
  test("defaults when absent/malformed", () => {
    expect(offchainFromStored(null)).toEqual(DEFAULT_OFFCHAIN);
    expect(offchainFromStored(undefined)).toEqual(DEFAULT_OFFCHAIN);
    expect(offchainFromStored({ xBTC: -1, ZEC: 2 })).toEqual(DEFAULT_OFFCHAIN);
    expect(offchainFromStored({ xBTC: "x", ZEC: 2 })).toEqual(DEFAULT_OFFCHAIN);
    expect(offchainFromStored({ ZEC: 5 })).toEqual(DEFAULT_OFFCHAIN);
  });

  test("returns stored values when valid", () => {
    expect(offchainFromStored({ xBTC: 0.1, ZEC: 3 })).toEqual({ xBTC: 0.1, ZEC: 3 });
  });
});
