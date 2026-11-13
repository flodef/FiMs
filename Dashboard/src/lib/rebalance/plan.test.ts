import { describe, expect, test } from "bun:test";
import {
  buildPlan,
  buildTopupPlan,
  distributeRepay,
  priorityMicroLamports,
  TOPUP_MAX_USDT,
  type PlanPositionInput,
} from "./plan";

const pos = (over: Partial<PlanPositionInput>): PlanPositionInput => ({
  key: "JLP",
  vaultId: 50,
  positionId: 161,
  collateralUsd: 150000,
  debt: 100000,
  debtPriceUsd: 1,
  target: 0.82,
  ...over,
});

const JLP_DEFICIT = pos({
  key: "JLP",
  vaultId: 50,
  positionId: 161,
  collateralUsd: 150000,
  debt: 126292.28,
  target: 0.82,
});
const JUPSOL_DEFICIT = pos({
  key: "JupSOL",
  vaultId: 52,
  positionId: 124,
  collateralUsd: 110000,
  debt: 82313.79,
  target: 0.7,
});

describe("rebalance plan", () => {
  test("both deficit: withdraw → swap ExactOut → repay both", () => {
    const plan = buildPlan([JLP_DEFICIT, JUPSOL_DEFICIT], 20000);
    expect(plan.error).toBeNull();
    expect(plan.stages.map(s => s.type)).toEqual(["kamino-withdraw", "swap", "lend"]);

    const jlp = plan.positions.find(p => p.key === "JLP")!;
    const jupsol = plan.positions.find(p => p.key === "JupSOL")!;
    const repayJlp = 126292.28 * (1 - 0.82 / (126292.28 / 150000));
    const repayJupsol = 82313.79 * (1 - 0.7 / (82313.79 / 110000));
    expect(jlp.repayUsdt).toBeCloseTo(repayJlp, 6);
    expect(jupsol.repayUsdt).toBeCloseTo(repayJupsol, 6);
    expect(jlp.ltvAfter).toBeCloseTo(0.82, 10);
    expect(jupsol.ltvAfter).toBeCloseTo(0.7, 10);

    const total = repayJlp + repayJupsol;
    const [wd, sw, lend] = plan.stages;
    expect(wd).toMatchObject({
      type: "kamino-withdraw",
      amountUsdg: expect.closeTo(total, 6) as number,
      usdtOut: expect.closeTo(total, 6) as number,
    });
    expect(sw).toMatchObject({ type: "swap", pair: "usdg-usdt", mode: "ExactIn" });
    if (sw.type === "swap") expect(sw.amount).toBeCloseTo(total, 6);
    if (lend.type === "lend") {
      expect(lend.ops).toHaveLength(2);
      expect(lend.ops.find(o => o.key === "JLP")!.deltaUsdt).toBeCloseTo(-repayJlp, 6);
      expect(lend.ops.find(o => o.key === "JupSOL")!.deltaUsdt).toBeCloseTo(-repayJupsol, 6);
    }
  });

  test("both margin: borrow → swap ExactIn → deposit", () => {
    const jlp = pos({ collateralUsd: 200000, debt: 100000, target: 0.82 }); // ltv .5 → borrow 64000
    const jupsol = pos({
      key: "JupSOL",
      vaultId: 52,
      positionId: 124,
      collateralUsd: 150000,
      debt: 80000,
      target: 0.7,
    }); // borrow 25000
    const plan = buildPlan([jlp, jupsol], 0);
    expect(plan.error).toBeNull();
    expect(plan.stages.map(s => s.type)).toEqual(["lend", "swap", "kamino-deposit"]);
    const [lend, sw, dep] = plan.stages;
    if (lend.type === "lend") {
      expect(lend.ops.find(o => o.key === "JLP")!.deltaUsdt).toBeCloseTo(64000, 6);
      expect(lend.ops.find(o => o.key === "JupSOL")!.deltaUsdt).toBeCloseTo(25000, 6);
    }
    if (sw.type === "swap") {
      expect(sw).toMatchObject({ pair: "usdt-usdg", mode: "ExactIn" });
      expect(sw.amount).toBeCloseTo(89000, 6);
    }
    expect(dep).toMatchObject({ type: "kamino-deposit", amountUsdg: expect.closeTo(89000, 6) as number });
    expect(plan.positions.every(p => Math.abs(p.ltvAfter - p.target) < 1e-9)).toBe(true);
  });

  test("mixed D>M: net lend, then withdraw+swap+repay remainder", () => {
    const jlp = pos({ collateralUsd: 150000, debt: 140000, target: 0.82 }); // ltv .9333 → repay ≈17000
    const jupsol = pos({
      key: "JupSOL",
      vaultId: 52,
      positionId: 124,
      collateralUsd: 120000,
      debt: 80000,
      target: 0.7,
    }); // borrow 4000
    const plan = buildPlan([jlp, jupsol], 20000);
    expect(plan.error).toBeNull();
    const D = plan.positions.find(p => p.key === "JLP")!.repayUsdt;
    const M = plan.positions.find(p => p.key === "JupSOL")!.borrowUsdt;
    expect(D).toBeGreaterThan(M);
    expect(plan.stages.map(s => s.type)).toEqual(["lend", "kamino-withdraw", "swap", "lend"]);
    const [l1, wd, sw, l2] = plan.stages;
    if (l1.type === "lend") {
      expect(l1.ops.find(o => o.key === "JupSOL")!.deltaUsdt).toBeCloseTo(M, 6);
      expect(l1.ops.find(o => o.key === "JLP")!.deltaUsdt).toBeCloseTo(-M, 6);
    }
    const rest = D - M;
    expect(wd).toMatchObject({
      type: "kamino-withdraw",
      amountUsdg: expect.closeTo(rest, 6) as number,
      usdtOut: expect.closeTo(rest, 6) as number,
    });
    if (sw.type === "swap")
      expect(sw).toMatchObject({ pair: "usdg-usdt", mode: "ExactIn", amount: expect.closeTo(rest, 6) as number });
    if (l2.type === "lend") expect(l2.ops[0].deltaUsdt).toBeCloseTo(-rest, 6);
  });

  test("mixed M>D: net lend, then swap ExactIn + deposit remainder", () => {
    const jlp = pos({ collateralUsd: 140000, debt: 90000, target: 0.82 }); // ltv .6429 → borrow 24800
    const jupsol = pos({
      key: "JupSOL",
      vaultId: 52,
      positionId: 124,
      collateralUsd: 110000,
      debt: 82313.79,
      target: 0.7,
    }); // repay ≈5311
    const plan = buildPlan([jlp, jupsol], 0);
    expect(plan.error).toBeNull();
    const D = plan.positions.find(p => p.key === "JupSOL")!.repayUsdt;
    const M = plan.positions.find(p => p.key === "JLP")!.borrowUsdt;
    expect(M).toBeGreaterThan(D);
    expect(plan.stages.map(s => s.type)).toEqual(["lend", "swap", "kamino-deposit"]);
    const [l1, sw, dep] = plan.stages;
    if (l1.type === "lend") {
      expect(l1.ops.find(o => o.key === "JLP")!.deltaUsdt).toBeCloseTo(M, 6);
      expect(l1.ops.find(o => o.key === "JupSOL")!.deltaUsdt).toBeCloseTo(-D, 6);
    }
    const rest = M - D;
    if (sw.type === "swap")
      expect(sw).toMatchObject({ pair: "usdt-usdg", mode: "ExactIn", amount: expect.closeTo(rest, 6) as number });
    expect(dep).toMatchObject({ type: "kamino-deposit", amountUsdg: expect.closeTo(rest, 6) as number });
  });

  test("already at target → empty plan", () => {
    const a = pos({ collateralUsd: 100000, debt: 82000, target: 0.82 }); // ltv exactly .82
    const b = pos({ key: "JupSOL", vaultId: 52, positionId: 124, collateralUsd: 110000, debt: 77000, target: 0.7 }); // ltv exactly .7
    const plan = buildPlan([a, b], 5000);
    expect(plan.stages).toHaveLength(0);
    expect(plan.error).toBeNull();
    expect(plan.positions.every(p => p.repayUsdt === 0 && p.borrowUsdt === 0)).toBe(true);
  });

  test("sub-1-USDT delta is ignored", () => {
    // ltv = 0.820005 → repay ≈ 0.5 USDT < 1
    const a = pos({ collateralUsd: 100000, debt: 82000.5, target: 0.82 });
    const b = pos({ key: "JupSOL", vaultId: 52, positionId: 124, collateralUsd: 110000, debt: 77000, target: 0.7 });
    const plan = buildPlan([a, b], 5000);
    expect(plan.stages).toHaveLength(0);
    expect(plan.positions.find(p => p.key === "JLP")!.ltvAfter).toBeCloseTo(0.820005, 6);
  });

  test("insufficient Kamino balance flags error", () => {
    const plan = buildPlan([JLP_DEFICIT, JUPSOL_DEFICIT], 100);
    expect(plan.error).toContain("Insufficient Kamino USDG");
  });
});

describe("distributeRepay", () => {
  const share = (planned: number, debt = 1e9, freshRepay = planned) => ({ planned, debt, freshRepay });

  test("exact cover: available == Σplanned repays everything", () => {
    const w = distributeRepay(200, [share(120), share(80)]);
    expect(w[0]).toBeCloseTo(120, 9);
    expect(w[1]).toBeCloseTo(80, 9);
  });

  test("surplus: capped at freshRepay × 1.001 per position", () => {
    // available 250 > 200 planned → each capped at 100×1.001-style bound
    const w = distributeRepay(250, [share(100), share(100)]);
    expect(w[0]).toBeCloseTo(100 * 1.001, 9);
    expect(w[1]).toBeCloseTo(100 * 1.001, 9);
    expect(w[0]! + w[1]!).toBeCloseTo(200.2, 9);
  });

  test("shortfall: split proportionally to planned amounts", () => {
    const w = distributeRepay(150, [share(120), share(80)]);
    expect(w[0]).toBeCloseTo(90, 9); // 150 × 120/200
    expect(w[1]).toBeCloseTo(60, 9); // 150 × 80/200
  });

  test("debt cap wins over proportional share", () => {
    const w = distributeRepay(200, [share(100, 50), share(100)]);
    expect(w[0]).toBe(50);
    expect(w[1]).toBeCloseTo(100, 9); // share 100 < freshRepay×1.001
  });

  test("zero/negative available or empty ops → zeros", () => {
    expect(distributeRepay(0, [share(100)])).toEqual([0]);
    expect(distributeRepay(100, [])).toEqual([]);
    expect(distributeRepay(-5, [share(100)])).toEqual([0]);
  });
});

describe("top-up plan", () => {
  test("valid amount → withdraw → swap → spend-transfer, all purpose topup", () => {
    const plan = buildTopupPlan(50, 200_000);
    expect(plan.error).toBeNull();
    expect(plan.stages.map(s => s.type)).toEqual(["kamino-withdraw", "swap", "spend-transfer"]);
    expect(plan.stages.every(s => s.purpose === "topup")).toBe(true);
    const [wd, sw, tr] = plan.stages;
    expect(wd).toMatchObject({ type: "kamino-withdraw", usdtOut: 50, amountUsdg: 50 });
    expect(sw).toMatchObject({ type: "swap", pair: "usdg-usdt", amount: 50 });
    expect(tr).toMatchObject({ type: "spend-transfer", usdt: 50 });
  });

  test("bounds: below 1, above 10k, NaN → error, no stages", () => {
    for (const bad of [0, 0.5, TOPUP_MAX_USDT + 1, Number.NaN, Infinity]) {
      const plan = buildTopupPlan(bad, 200_000);
      expect(plan.error).not.toBeNull();
      expect(plan.stages).toHaveLength(0);
    }
    expect(buildTopupPlan(1, 200_000).error).toBeNull();
    expect(buildTopupPlan(TOPUP_MAX_USDT, 200_000).error).toBeNull();
  });

  test("insufficient Kamino USDG → error", () => {
    const plan = buildTopupPlan(500, 100);
    expect(plan.error).toContain("Insufficient Kamino USDG");
    expect(plan.stages).toHaveLength(0);
  });
});

describe("priorityMicroLamports", () => {
  test("fixed 1-lamport fee spread over the CU limit", () => {
    expect(priorityMicroLamports(100_000)).toBe(10); // 10 µL × 100k CU = 1 lamport
    expect(priorityMicroLamports(107_399)).toBe(9); // 0.97 → charged 1 lamport
    expect(priorityMicroLamports(1_400_000)).toBe(1); // min 1 µL/CU
  });

  test("huge CU limit floors to 1 µL/CU; degenerate input → 1", () => {
    expect(priorityMicroLamports(2e9)).toBe(1);
    expect(priorityMicroLamports(0)).toBe(1);
    expect(priorityMicroLamports(Number.NaN)).toBe(1);
    expect(priorityMicroLamports(-5)).toBe(1);
  });
});
