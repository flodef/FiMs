import { describe, expect, test } from "bun:test";
import { fetchDefi } from "./defi.js";

// batchGet response with one valueRange per requested range, in order.
// Ranges (positional): Price!A1:R, Wallet!D5, FiMsData!B1, FiMsData!B2,
// Dashboard!B12, PriceCache!C2:C, FiMsData!B14:B17, Wallet!C3:C5,
// PriceCache!B2, FiMsData!B3, Wallet!A2:K
const VALUE_RANGES = [
  {
    values: [
      ["Date", "FiMs Liquidity Provider (FLiP)", "Jupiter Staked SOL (JUPSOL)"],
      [3.4, 3.5, 80],
      [3.3, 3.4, 79],
    ],
  },
  { values: [[12345.6]] }, // Wallet!D5 jlpTotal
  { values: [[10]] }, // FiMsData!B1 fimsSol
  { values: [[20]] }, // FiMsData!B2 fimsToken
  { values: [[999]] }, // Dashboard!B12 total
  { values: [[46000], [46001]] }, // PriceCache!C2:C serials
  { values: [[1], [2], [3], [4]] }, // FiMsData!B14:B17 imported
  { values: [[5], [6], [7]] }, // Wallet!C3:C5 walletPrices
  { values: [[1.09]] }, // PriceCache!B2 eurUsd
  { values: [[42]] }, // FiMsData!B3 fimsLp
  {
    // Wallet!A2:K — A underlying, B token, G amount (idx6), J mint (idx9), K cache (idx10)
    values: [
      ["FSOL", "SOL", null, null, null, null, 1.5, null, null, "mint-sol", 0.5],
      ["FIMS", "EURC", null, null, null, null, 200, null, null, "mint-eurc", 190],
    ],
  },
];

const stubFetch = (impl: (url: string) => Promise<Response>) => {
  const orig = globalThis.fetch;
  let seen = "";
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    seen = String(input);
    return impl(seen);
  }) as unknown as typeof fetch;
  return {
    url: () => seen,
    restore: () => {
      globalThis.fetch = orig;
    },
  };
};

describe("fetchDefi", () => {
  test("maps positional ranges; Wallet!A2:K is last, Tokens!A2:C gone", async () => {
    const f = stubFetch(async () => new Response(JSON.stringify({ valueRanges: VALUE_RANGES }), { status: 200 }));
    try {
      const d = await fetchDefi("key");
      const url = f.url();
      // 11 ranges requested, Wallet!A2:K last, no Tokens range
      expect((url.match(/ranges=/g) ?? []).length).toBe(11);
      expect(url).not.toContain("Tokens");
      expect(url.indexOf(encodeURIComponent("Wallet!A2:K"))).toBeGreaterThan(
        url.indexOf(encodeURIComponent("FiMsData!B3")),
      );

      expect(d.jlpTotal).toBe(12345.6);
      expect(d.fimsSol).toBe(10);
      expect(d.fimsToken).toBe(20);
      expect(d.total).toBe(999);
      expect(d.imported).toEqual({ fimsUsd: 1, jupsol: 2, fimsEurc: 3, jlp: 4 });
      expect(d.walletPrices).toEqual({ jupsol: 5, eurc: 6, jlp: 7 });
      expect(d.eurUsd).toBe(1.09);
      expect(d.fimsLp).toBe(42);
      expect(d.walletRows).toEqual([
        { underlying: "FSOL", token: "SOL", amount: 1.5, mint: "mint-sol", cache: 0.5 },
        { underlying: "FIMS", token: "EURC", amount: 200, mint: "mint-eurc", cache: 190 },
      ]);
      expect("tokens" in d).toBe(false);
      expect(d.priceHeaders).toEqual(["Date", "FiMs Liquidity Provider (FLiP)", "Jupiter Staked SOL (JUPSOL)"]);
      expect(d.priceLastUpdated).toBeGreaterThan(0);
    } finally {
      f.restore();
    }
  });
});
