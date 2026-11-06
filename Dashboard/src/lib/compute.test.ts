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
