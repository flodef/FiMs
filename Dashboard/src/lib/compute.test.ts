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
