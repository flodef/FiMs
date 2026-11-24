import { describe, expect, test } from "bun:test";
import fixture from "./__fixtures__/sheet-2026-11-06.json";
import { computeDashboard } from "./compute.js";
import { convert, priceMapFromCells } from "./convert.js";
import type { Inputs } from "./types.js";

const inputs = fixture as unknown as Inputs;
// Price today serial date at 18:13 Europe/Paris (CET = UTC+1)
const now = new Date("2026-11-06T18:13:00+01:00");
const r = computeDashboard(inputs, now);
const c = r.cells;

const close = (got: number | undefined, exp: number, rel = 1e-6) => {
  expect(got, `cell value`).toBeDefined();
  expect(Math.abs((got as number) - exp)).toBeLessThanOrEqual(Math.abs(exp) * rel + 1e-9);
};

describe("computeDashboard vs Strategy sheet 2026-11-06", () => {
  test("borrow/lend table D2:I5", () => {
    close(c.E2, 0.0288);
    close(c.E3, -0.0624);
    close(c.E4, 0.1016);
    close(c.E5, 0.0392);
    close(c.F2, 0);
    close(c.F3, 208606.07);
    close(c.F4, 207983.3286);
    close(c.G3, -35.663065117808216);
    close(c.G4, 57.893441604821916);
    close(c.H3, -32.07225540289958);
    close(c.H4, 52.06432030362775);
    close(c.H5, 19.992064900728174);
    close(c.I3, -962.1676620869873);
    close(c.I4, 1561.9296091088327);
    close(c.I5, 599.7619470218453);
  });

  test("jupsol + forecasts + totals", () => {
    close(c.M1, 95.62094120494406);
    close(c.M2, 1.18394498);
    close(c.M4, 27.77);
    close(c.M5, 43.03724620848844);
    close(c.B2, 90.8, 1e-4);
    close(c.B3, 2724, 4e-4);
  });

  test("fims block F7:G15", () => {
    close(c.F7, 0.21898114119333068);
    close(c.F8, 0.001256823695101396);
    close(c.F9, 0.006550000000061118);
    close(c.F10, -5.049999999959255);
    close(c.F11, 0);
    close(c.F12, 192510.68999999997);
    close(c.F13, 15.189884580821916);
    close(c.F14, 176859.42489522634);
    close(c.G15, 877053.2025323268);
  });

  test("prices I7:I15", () => {
    close(c.I7, 67831.96344244339);
    close(c.I8, 80.76468317382795);
    close(c.I9, 98.3733323757025);
    close(c.I10, 1221.7029698525846);
    close(c.I11, 3.7803224821790886);
    close(c.I12, 0.21983014023306338);
    close(c.I13, 1.11196);
    close(c.I14, 1.1913069767082651);
    close(c.I15, 0.899312924925357);
  });

  test("ltv ratios + liquidation prices", () => {
    close(c.D9, 1.0246341463414634);
    close(c.D11, 3.549535826962123);
    close(c.D12, 1.0615714285714286);
    close(c.D14, 92.21509911727605);
  });

  test("fims eurc/usd rows", () => {
    close(c.B15, 173122.8101730278);
    close(c.C15, 192505.64);
    close(c.B16, -622.741399999999);
    close(c.C16, -560.0393899061107);
  });

  test("multiply L8:M15", () => {
    close(c.L8, 22098.771299977838);
    close(c.M8, 83540.48197384023);
    close(c.M9, 815191.4913983999);
    close(c.L10, 22098.771299977838);
    close(c.M10, 83540.48197384023);
    close(c.L11, 0);
    close(c.M11, 0);
    close(c.M12, 0);
    close(c.M13, -1013.6466895729499, 5e-3);
    close(c.L13, -268.1376243300424, 5e-3);
    close(c.M14, c.M13 as number, 1e-9);
    close(c.L15, -190190.67958502215);
    close(c.M15, -0.4538578304582791, 5e-3);
  });

  test("converter 90 EUR", () => {
    const out = convert(90, "EUR", priceMapFromCells(c));
    expect(out.USD).toBe(100.07);
    expect(out.FIMS).toBe(75.54);
  });

  test("status", () => {
    expect(r.status).toBe("warn");
    expect(r.stale).toBe(false);
    expect(r.collaterals.map(x => [x.token, x.level])).toEqual([
      ["JLP", "warn"],
      ["JupSOL", "warn"],
    ]);
  });
});

describe("extra positions", () => {
  const base = computeDashboard(fixture as unknown as Inputs, now);
  const i15 = base.cells.I15 as number;

  const withExtras = (extraPositions: NonNullable<Inputs["extraPositions"]>) =>
    computeDashboard({ ...(fixture as unknown as Inputs), extraPositions }, now);

  test("empty extras leave B2/B3 identical", () => {
    const r0 = computeDashboard({ ...(fixture as unknown as Inputs), extraPositions: [] }, now);
    expect(r0.cells.B2).toBe(base.cells.B2);
    expect(r0.cells.B3).toBe(base.cells.B3);
    expect(r0.extras.rows).toEqual([]);
  });

  test("manual USD position adds amount*apy/365*I15 to perDay", () => {
    const r1 = withExtras([
      { id: 1, origin: "manual", token: "USD", source: "Manual", amount: 1000, apy: 0.1, unit: "USD" },
    ]);
    const expected = (1000 * 0.1) / 365;
    expect(r1.extras.perDay).toBeCloseTo(expected * i15, 10);
    // B2 = round((base + extrasPerDay) * 100) / 100 → within half a cent of base + delta
    expect(Math.abs((r1.cells.B2 as number) - ((base.cells.B2 as number) + expected * i15))).toBeLessThanOrEqual(0.011);
    expect(r1.cells.B2 as number).toBeGreaterThan(base.cells.B2 as number);
    expect(r1.extras.rows[0].noPrice).toBe(false);
  });

  test("EURC unit prices at par", () => {
    const r5 = withExtras([
      { id: 5, origin: "manual", token: "EURC", source: "Manual", amount: 1000, apy: 0.0365, unit: "EURC" },
    ]);
    expect(r5.extras.rows[0].perDay).toBeCloseTo(0.1, 10);
    expect(r5.extras.rows[0].noPrice).toBe(false);
  });

  test("unknown unit gives 0 + noPrice", () => {
    const r2 = withExtras([
      { id: 2, origin: "manual", token: "XXX", source: "Manual", amount: 100, apy: 0.1, unit: "NOPE" },
    ]);
    expect(r2.extras.rows[0].perDay).toBe(0);
    expect(r2.extras.rows[0].noPrice).toBe(true);
    expect(r2.cells.B2).toBe(base.cells.B2);
  });

  test("extra borrow row without target uses danger rule only", () => {
    const r3 = withExtras([
      {
        id: 3,
        origin: "jupiter",
        token: "XYZ",
        source: "Jupiter Borrow",
        amount: 1000,
        apy: 0.05,
        ltv: 0.97,
        liqThreshold: 1.0,
        unit: "USD",
      },
    ]);
    const c3 = r3.collaterals.find(x => x.token === "XYZ");
    expect(c3).toBeDefined();
    expect(c3!.target).toBeNull();
    expect(c3!.level).toBe("danger"); // 0.97 >= 0.95*1.0
    const r4 = withExtras([
      {
        id: 4,
        origin: "jupiter",
        token: "XYZ",
        source: "Jupiter Borrow",
        amount: 1000,
        apy: 0.05,
        ltv: 0.5,
        liqThreshold: 1.0,
        unit: "USD",
      },
    ]);
    expect(r4.collaterals.find(x => x.token === "XYZ")!.level).toBe("ok");
  });

  test("maxLtv (collateral factor) drives the danger rule", () => {
    const mk = (ltv: number) =>
      withExtras([
        {
          id: 9,
          origin: "jupiter",
          token: "JLP",
          source: "Jupiter Borrow",
          amount: 100,
          apy: 0.1,
          ltv,
          liqThreshold: 1.0, // fallback cap would be 0.95 — maxLtv must win
          maxLtv: 0.85,
          unit: "JLP",
        },
      ]).collaterals.find(x => x.id === 9)!;
    expect(mk(0.851).level).toBe("danger"); // >= maxLtv 0.85
    const below = mk(0.84);
    expect(below.level).toBe("warn"); // above the 0.82 target, below maxLtv
    expect(below.maxLtv).toBe(0.85);
  });

  test("extra collateral liqPriceEur comes from its own entry rows", () => {
    const r6 = withExtras([
      {
        id: 6,
        origin: "jupiter",
        token: "JLP",
        source: "Jupiter Borrow",
        amount: 100,
        apy: 0.1,
        ltv: 0.5,
        liqThreshold: 0.9,
        unit: "JLP",
      },
      {
        id: 6,
        origin: "jupiter",
        token: "USDT JLP",
        source: "Jupiter Borrow",
        amount: 50,
        apy: -0.05,
        unit: "USDT",
      },
    ]);
    const c6 = r6.collaterals.find(x => x.id === 6);
    expect(c6).toBeDefined();
    // 50 USDT × I15 / (0.9 × 100 JLP) — not the base JLP D11 value
    expect(c6!.liqPriceEur).toBeCloseTo((50 * i15) / (0.9 * 100), 10);
    // base JLP keeps the sheet liquidation price
    const baseJlp = r6.collaterals.find(x => x.token === "JLP" && x.id == null);
    expect(baseJlp!.liqPriceEur).toBeCloseTo(c.D11 as number, 10);
  });

  test("repayToTarget for base collaterals above target", () => {
    const jlp = r.collaterals.find(x => x.token === "JLP" && x.id == null)!;
    const jupsol = r.collaterals.find(x => x.token === "JupSOL" && x.id == null)!;
    const debtJlp = inputs.positions.find(p => p.token === "USDT JLP")?.amount ?? 0;
    const debtJupsol = inputs.positions.find(p => p.token === "USDT JupSOL")?.amount ?? 0;
    expect(jlp.repayUnit).toBe("USDT");
    expect(jlp.repayToTarget).toBeCloseTo(debtJlp * (1 - 0.82 / jlp.ltv), 6);
    expect(jupsol.repayUnit).toBe("USDT");
    expect(jupsol.repayToTarget).toBeCloseTo(debtJupsol * (1 - 0.7 / jupsol.ltv), 6);
    // sanity vs the sheet amounts quoted in the spec
    expect(debtJlp).toBeCloseTo(126292.28, 2);
    expect(debtJupsol).toBeCloseTo(82313.79, 2);
  });

  test("repayToTarget for extras and null cases", () => {
    // extra above target: 50 USDT debt, ltv 0.9 > target 0.82
    const r7 = withExtras([
      {
        id: 7,
        origin: "jupiter",
        token: "JLP",
        source: "Jupiter Borrow",
        amount: 100,
        apy: 0.1,
        ltv: 0.9,
        liqThreshold: 0.95,
        unit: "JLP",
      },
      {
        id: 7,
        origin: "jupiter",
        token: "USDT JLP",
        source: "Jupiter Borrow",
        amount: 50,
        apy: -0.05,
        unit: "USDT",
      },
    ]);
    const c7 = r7.collaterals.find(x => x.id === 7)!;
    expect(c7.repayUnit).toBe("USDT");
    expect(c7.repayToTarget).toBeCloseTo(50 * (1 - 0.82 / 0.9), 10);

    // extra at/below target → null
    const r8 = withExtras([
      {
        id: 8,
        origin: "jupiter",
        token: "JLP",
        source: "Jupiter Borrow",
        amount: 100,
        apy: 0.1,
        ltv: 0.5,
        liqThreshold: 0.9,
        unit: "JLP",
      },
      {
        id: 8,
        origin: "jupiter",
        token: "USDT JLP",
        source: "Jupiter Borrow",
        amount: 50,
        apy: -0.05,
        unit: "USDT",
      },
    ]);
    expect(r8.collaterals.find(x => x.id === 8)!.repayToTarget).toBeNull();
  });
});

describe("sheet sync correction", () => {
  const baseInputs = fixture as unknown as Inputs;
  const base = computeDashboard(baseInputs, now);
  const posAmt = (token: string) =>
    baseInputs.positions.find(p => p.token.toLowerCase() === token.toLowerCase())?.amount ?? 0;
  const live = {
    jupsol: posAmt("JupSOL"), // Strategy B13
    jlp: posAmt("JLP"), // Strategy B10
    fimsEurc: base.cells.B15 as number, // Strategy B15
    fimsUsd: base.cells.B16 as number, // Strategy B16
  };
  const walletPrices = { jupsol: 85.93, eurc: 1.101, jlp: 3.5059 };
  const eurUsd = 1.101;
  const withSync = (imported: typeof live) =>
    computeDashboard({ ...baseInputs, defi: { ...baseInputs.defi, imported, walletPrices, eurUsd } }, now);

  test("live == imported → zero correction, in sync", () => {
    const r2 = withSync({ ...live });
    expect(r2.fims.totalCorrection).toBe(0);
    expect(r2.sheetSync.inSync).toBe(true);
    expect(r2.fims.sheetTotal).toBe(base.fims.total); // fixture: no correction applied
    expect(r2.fims.total).toBe(base.fims.total);
    expect(r2.cells.F14).toBe(r2.fims.total);
  });

  test("stale FiMs USD import → +9626/eurUsd correction, out of sync", () => {
    const r3 = withSync({ ...live, fimsUsd: live.fimsUsd - 9626 });
    const expected = 9626 / eurUsd;
    expect(r3.fims.totalCorrection).toBeCloseTo(expected, 6);
    expect(r3.sheetSync.inSync).toBe(false);
    expect(r3.fims.total).toBeCloseTo((base.fims.sheetTotal as number) + expected, 6);
    expect(r3.cells.F14).toBeCloseTo(r3.fims.total, 6);
    const usd = r3.sheetSync.items.find(i => i.label === "FiMs USD")!;
    expect(usd.sheet).toBeCloseTo(live.fimsUsd - 9626, 6);
    expect(usd.live).toBeCloseTo(live.fimsUsd, 6);
    expect(usd.impactEur).toBeCloseTo(expected, 6);
    // the other three items stayed in sync
    expect(r3.sheetSync.items.filter(i => i.label !== "FiMs USD").every(i => i.impactEur === 0)).toBe(true);
  });

  test("missing sync fields → no correction, in sync (old cache/fixtures)", () => {
    expect(base.sheetSync.inSync).toBe(true);
    expect(base.sheetSync.items).toEqual([]);
    expect(base.fims.totalCorrection).toBe(0);
  });
});

describe("fimsJlpDiff", () => {
  const baseInputs = fixture as unknown as Inputs;
  const jlpAmt = baseInputs.positions.find(p => p.token.toLowerCase() === "jlp")?.amount ?? 0;

  test("undefined without fimsLp; JLP − fimsLp with it", () => {
    const noLp = computeDashboard(baseInputs, now);
    expect(noLp.fims.fimsJlpDiff).toBeUndefined();

    const withLp = computeDashboard({ ...baseInputs, defi: { ...baseInputs.defi, fimsLp: 13305.86 } }, now);
    expect(withLp.fims.fimsJlpDiff).toBeCloseTo(jlpAmt - 13305.86, 6);
  });
});

describe("fims.diff (wallet balances count toward the diff)", () => {
  const baseInputs = fixture as unknown as Inputs;

  test("no walletTokens → diff equals the sheet diffs, no diffWallet", () => {
    const r = computeDashboard(baseInputs, now);
    expect(r.fims.diff.jupsol).toBe(r.fims.fimsSolDiff);
    expect(r.fims.diff.eurc).toBe(r.fims.fimsEurcDiff);
    expect(r.fims.diff.usd).toBe(r.fims.usd.usdAmount);
    expect(r.fims.diff.jlp).toBeUndefined(); // fixture lacks fimsLp
    expect(r.fims.diffWallet).toBeUndefined();
  });

  test("walletTokens add to every diff", () => {
    const walletTokens = { jupsol: 0.606, jlp: 0, eurc: 1.5, usdg: 12 };
    const r = computeDashboard({ ...baseInputs, walletTokens, defi: { ...baseInputs.defi, fimsLp: 13305.86 } }, now);
    expect(r.fims.diff.jupsol).toBeCloseTo(r.fims.fimsSolDiff + 0.606, 9);
    expect(r.fims.diff.eurc).toBeCloseTo(r.fims.fimsEurcDiff + 1.5, 9);
    expect(r.fims.diff.usd).toBeCloseTo(r.fims.usd.usdAmount + 12, 9);
    expect(r.fims.diff.jlp).toBeCloseTo((r.fims.fimsJlpDiff ?? 0) + 0, 9);
    expect(r.fims.diffWallet).toEqual(walletTokens);
    // a wallet JLP balance only counts when the FLiP diff exists
    const r2 = computeDashboard({ ...baseInputs, walletTokens: { ...walletTokens, jlp: 42 } }, now);
    expect(r2.fims.diff.jlp).toBeUndefined();
  });
});

// ---- Live Wallet total (LIVE-SPEC) — golden reproduction of Dashboard!B12 ----
import snap from "./__fixtures__/wallet-snap-2026-11-24.json";

// Tokens!A2:C reference rows (symbol → mint) — stable sheet data
const SNAP_TOKENS = [
  ["FSOL", "FiMs SOL", "6hoGUYo5VengrsRtyyvs2y7KPf4mwWdv7V8C7GJg6Uy"],
  ["FiMs", "FiMs Token", "D84wZMJRoievKkRaquXXrYSMuU5mA46RznCSrJ9HSK1u"],
  ["FLiP", "FiMs Liquidity Provider", "FLiPpMfKenthVe7XHAE41msm5t63R5EwpUi5Swo5qjpN"],
  ["ZEC", "Zcash", "A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS"],
  ["xBTC", "OKX Wrapped BTC", "CtzPWv73Sn1dMGVU3ZtLv9yWSyUAanBni19YWDaznnkn"],
  ["ETH", "Ether", "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs"],
  ["SOL", "Solana", "So11111111111111111111111111111111111111112"],
  ["JUP", "Jupiter", "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"],
  ["JUPSOL", "Jupiter Staked SOL", "jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v"],
  ["JLP", "Jupiter Perps LP", "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4"],
  ["DSOL", "Drift Staked SOL", "Dso1bDeDjCQxTrWHqUUi63oBvV7Mdm6WaobLbQ7gnPQ"],
  ["PYUSD", "Paypal USD", "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo"],
  ["USDS", "USDS", "USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA"],
  ["USDT", "USD Tether", "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"],
  ["USDC", "USD Circle", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"],
  ["EURC", "Euro Circle", "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr"],
].map(([symbol, name, mint]) => ({ symbol, name, mint }));

const snapVr = (snap as { valueRanges: { range: string; values?: unknown[][] }[] }).valueRanges;
const snapVals = (range: string): unknown[][] => snapVr.find(v => v.range === range)?.values ?? [];
const snapNum = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

// FiMsData!B1:B18 → fimsSol, fimsToken, fimsLp, …, B14 fimsUsd, B15 jupsol, B16 fimsEurc, B17 jlp
const snapFims = snapVals("FiMsData!B1:B18").map(r => snapNum(r[0]));
const snapImp = {
  fimsUsd: snapFims[13],
  jupsol: snapFims[14],
  fimsEurc: snapFims[15],
  jlp: snapFims[16],
};
// PriceCache!B2 = the "EUR to USD (EURC)" row's price (first row of A2:B18)
const snapPriceCache = snapVals("PriceCache!A2:B18");
const snapEurUsd = snapNum(snapPriceCache[0]?.[1]);
// PriceCache!A2:B18 names == Price!B1:R1 headers (same "Name (SYM)" format, same order)
const snapHeaders = ["Date", ...snapPriceCache.map(r => String(r[0] ?? ""))];
const snapToday = [0, ...snapPriceCache.map(r => snapNum(r[1]))];
// Wallet!C3:C5 = the JUPSOL/EURC/JLP rows' own Price column (snapshot rows 2-4)
const snapWalletRowsRaw = snapVals("Wallet!A2:K8");
const snapWalletPrices = {
  jupsol: snapNum(snapWalletRowsRaw[1]?.[2]),
  eurc: snapNum(snapWalletRowsRaw[2]?.[2]),
  jlp: snapNum(snapWalletRowsRaw[3]?.[2]),
};
const snapWalletRows = snapWalletRowsRaw.map(r => ({
  underlying: String(r[0] ?? ""),
  token: String(r[1] ?? ""),
  mint: String(r[9] ?? ""),
  amount: snapNum(r[6]),
  cache: snapNum(r[10]),
}));
const SNAP_TOTAL = snapNum(snapVals("Dashboard!B12")[0]?.[0]);

const SNAP_STAKED_JUP = 395650.136468; // sheet G6−K6 = getStakedJup(wallet1)
const SNAP_JLP_TOTAL = snapNum(snapWalletRowsRaw[3]?.[3]); // Wallet!D5

/** Inputs reproducing the sheet: no live overrides, balances = cache, live positions = imported. */
const walletInputs = (
  over: Partial<Inputs["defi"]> = {},
  posOver: Record<string, number> = {},
  top: Partial<Pick<Inputs, "stakedJup" | "offchain">> = {},
): Inputs => ({
  fetchedAt: now.getTime(),
  stakedJup: SNAP_STAKED_JUP,
  offchain: { xBTC: 0.00044489, ZEC: 0.92 },
  ...top,
  positions: [
    { source: "Jupiter Borrow", token: "JupSOL", amount: snapImp.jupsol + (posOver.jupsol ?? 0), apy: 0 },
    { source: "Jupiter Borrow", token: "JLP", amount: snapImp.jlp + (posOver.jlp ?? 0), apy: 0 },
    // the Strategy sheet denominates EURC in USD → B15 = amount/eurUsd must equal fimsEurc
    { source: "Jupiter Earn", token: "EURC", amount: snapImp.fimsEurc * snapEurUsd, apy: 0 },
    // FiMs USD (B16) = USDG − USDT strategy sums → -fimsUsd via a USDT debt row
    { source: "Kamino Borrow", token: "USDT JLP", amount: -snapImp.fimsUsd, apy: 0 },
  ],
  sanctum: { jupsolRatio: 1.18, jupsolApy: 0.07, jupsolApySource: "sanctum" },
  defi: {
    priceHeaders: snapHeaders,
    priceRows: [snapToday, snapToday, snapToday],
    jlpDayAverage: 0,
    jlpTotal: 0,
    fimsSol: snapFims[0],
    fimsToken: snapFims[1],
    total: SNAP_TOTAL,
    priceLastUpdated: 0,
    imported: { ...snapImp },
    walletPrices: { ...snapWalletPrices },
    eurUsd: snapEurUsd,
    fimsLp: snapFims[2],
    tokens: SNAP_TOKENS,
    walletRows: snapWalletRows.map(r => ({ ...r })),
    ...over,
  },
  sources: {
    jupiter: { ok: true, stale: false, at: 0 },
    kamino: { ok: true, stale: false, at: 0 },
    sanctum: { ok: true, stale: false, at: 0 },
    defi: { ok: true, stale: false, at: 0 },
  },
});

describe("live wallet total (LIVE-SPEC)", () => {
  test("golden: sheet values reproduce Dashboard!B12", () => {
    const res = computeDashboard(walletInputs(), now);
    expect(Math.abs(res.fims.total - SNAP_TOTAL)).toBeLessThan(1e-6);
    expect(res.fims.sheetTotal).toBe(SNAP_TOTAL);
    expect(res.fims.totalCorrection).toBeCloseTo(0, 6);
  });

  test("+1 JLP live position → total rises by exactly price(JLP)", () => {
    const base = computeDashboard(walletInputs(), now).fims.total;
    const up = computeDashboard(walletInputs({}, { jlp: 1 }), now).fims.total;
    const jlpPrice = Math.max(...snapToday.filter((_, i) => snapHeaders[i].toLowerCase().includes("(jlp)")));
    expect(up - base).toBeCloseTo(jlpPrice, 6);
  });

  test("wallet balance JUP +100 → total rises by 100·price(JUP)", () => {
    const jupMint = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN";
    const jupCache = snapWalletRows.find(r => r.mint === jupMint)!.cache;
    const base = computeDashboard(walletInputs(), now).fims.total;
    const cacheMap = Object.fromEntries(snapWalletRows.map(r => [r.mint, r.cache]));
    expect(computeDashboard(walletInputs({ walletBalances: cacheMap }), now).fims.total).toBeCloseTo(base, 6);
    // a mint absent from fetched balances counts as 0 (closed account), not the stale cache
    const { [jupMint]: _jup, ...withoutJup } = cacheMap;
    const gone = computeDashboard(walletInputs({ walletBalances: withoutJup }), now).fims.total;
    const up = computeDashboard(walletInputs({ walletBalances: { ...cacheMap, [jupMint]: jupCache + 100 } }), now).fims
      .total;
    const jupPrice = Math.max(...snapToday.filter((_, i) => snapHeaders[i].toLowerCase().includes("(jup)")));
    expect(up - base).toBeCloseTo(100 * jupPrice, 6);
    expect(base - gone).toBeCloseTo(jupCache * jupPrice, 6);
  });

  test("JUP live price ×2 → total moves by amount_JUP·ΔP", () => {
    const base = computeDashboard(walletInputs(), now).fims.total;
    const jupIdx = snapHeaders.findIndex(h => h.toLowerCase().includes("(jup)"));
    const doubled = [...snapToday];
    doubled[jupIdx] *= 2;
    const up = computeDashboard(walletInputs({ priceRows: [doubled, snapToday, snapToday] }), now).fims.total;
    const jupRow = snapWalletRows.find(r => r.token === "JUP")!;
    const deltaP = snapToday[jupIdx]; // ×2 − ×1
    expect(up - base).toBeCloseTo(jupRow.amount * deltaP, 4);
  });

  test("no walletRows → old sheetTotal+correction path", () => {
    const res = computeDashboard(walletInputs({ walletRows: undefined }), now);
    // imported values equal live → correction ≈ 0, total = sheetTotal
    expect(res.fims.total).toBeCloseTo(SNAP_TOTAL, 4);
    // and jlpTotal stays the sheet value (0 in this fixture)
    expect(res.multiply.jlpTotal).toBe(0);
  });

  test("+1000 staked JUP → total rises by 1000·price(JUP)", () => {
    const base = computeDashboard(walletInputs(), now).fims.total;
    const up = computeDashboard(walletInputs({}, {}, { stakedJup: SNAP_STAKED_JUP + 1000 }), now).fims.total;
    const jupPrice = Math.max(...snapToday.filter((_, i) => snapHeaders[i].toLowerCase().includes("(jup)")));
    expect(up - base).toBeCloseTo(1000 * jupPrice, 6);
  });

  test("off-chain ZEC +1 → total rises by price(ZEC)", () => {
    const base = computeDashboard(walletInputs(), now).fims.total;
    const up = computeDashboard(walletInputs({}, {}, { offchain: { xBTC: 0.00044489, ZEC: 1.92 } }), now).fims.total;
    const zecPrice = Math.max(...snapToday.filter((_, i) => snapHeaders[i].toLowerCase().includes("(zec)")));
    expect(up - base).toBeCloseTo(zecPrice, 6);
  });

  test("jlpTotal live = sheet Wallet!D5 on snapshot values", () => {
    const res = computeDashboard(walletInputs(), now);
    expect(SNAP_JLP_TOTAL).toBeGreaterThan(0);
    expect(res.multiply.jlpTotal).toBeCloseTo(SNAP_JLP_TOTAL, 4);
  });
});
