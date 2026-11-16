import { describe, expect, test } from "bun:test";
import {
  buildPlan,
  buildRestorePlan,
  buildTopupPlan,
  distributeRepayRaw,
  explainSimFailure,
  priorityMicroLamports,
  RESTORE_TOKENS,
  slippageBpsFor,
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

describe("distributeRepayRaw", () => {
  const share = (plannedRaw: number, capRaw = 1e12) => ({ plannedRaw, capRaw });

  test("exact cover: available == Σplanned repays everything", () => {
    const w = distributeRepayRaw(200, [share(120), share(80)]);
    expect(w).toEqual([120, 80]);
  });

  test("floor shares + remainder goes to the largest op — sum is exact", () => {
    // shares: floor(10×1/3)=3, floor(10×2/3)=6 → rem 1 → largest op (6→7)
    const w = distributeRepayRaw(10, [share(1), share(2)]);
    expect(w).toEqual([3, 7]);
    expect(w[0]! + w[1]!).toBe(10);
  });

  test("caps respected; capped excess flows to ops with headroom", () => {
    // op0 capped at 40, op1 takes its share + the remainder
    const w = distributeRepayRaw(100, [share(50, 40), share(50)]);
    expect(w[0]).toBe(40);
    expect(w[1]).toBe(60); // 100 − 40, under its cap
    expect(w[0]! + w[1]!).toBe(100);
  });

  test("all capped → sum below available (caller detects not wallet-limited)", () => {
    const w = distributeRepayRaw(300, [share(100, 60), share(200, 90)]);
    expect(w).toEqual([60, 90]);
    expect(w[0]! + w[1]!).toBe(150);
  });

  test("zero/negative available or empty ops → zeros", () => {
    expect(distributeRepayRaw(0, [share(100)])).toEqual([0]);
    expect(distributeRepayRaw(100, [])).toEqual([]);
    expect(distributeRepayRaw(-5, [share(100)])).toEqual([0]);
    expect(distributeRepayRaw(Number.NaN, [share(100)])).toEqual([0]);
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

describe("buildRestorePlan", () => {
  const vault = (over: Partial<import("./plan").RestoreVaultInput> = {}) => ({
    key: "JLP" as const,
    vaultId: 50,
    positionId: 161,
    collateralUsd: 150000,
    debt: 100000,
    debtPriceUsd: 1,
    supplyAmount: 40000,
    supplyPriceUsd: 3.5,
    liqThreshold: 0.9,
    target: 0.82,
    ...over,
  });
  const jlp = vault();
  const jupsol = vault({
    key: "JupSOL",
    vaultId: 52,
    positionId: 124,
    supplyAmount: 1200,
    supplyPriceUsd: 95,
    target: 0.7,
  });
  const base = { jlp, jupsol, kaminoUsdg: 50000 };

  test("jupsol from kamino → withdraw, swap-any, collateral deposit", () => {
    const p = buildRestorePlan({
      ...base,
      target: "jupsol",
      source: "kamino",
      amount: 60,
      sourceAmount: 61,
      sourceUsd: 61,
    });
    expect(p.error).toBeNull();
    expect(p.stages.map(s => s.type)).toEqual(["kamino-withdraw", "swap-any", "lend-collateral"]);
    const dep = p.stages[2];
    expect(dep.type === "lend-collateral" && dep.key === "JupSOL" && dep.amount).toBe(60);
    const w = p.stages[0];
    expect(w.type === "kamino-withdraw" && w.usdgOut).toBe(61);
    expect(p.positions[0].key).toBe("JupSOL");
    expect(p.positions[0].ltvAfter).toBeLessThan(p.positions[0].ltvBefore);
  });

  test("eurc from lend → collateral withdraw, swap-any, earn deposit", () => {
    const p = buildRestorePlan({
      ...base,
      target: "eurc",
      source: "lend",
      amount: 500,
      sourceAmount: 200,
      sourceUsd: 700,
    });
    expect(p.error).toBeNull();
    expect(p.stages.map(s => s.type)).toEqual(["lend-collateral", "swap-any", "earn-deposit"]);
    const wd = p.stages[0];
    expect(wd.type === "lend-collateral" && wd.amount).toBe(-200);
    expect(p.stages[2].type === "earn-deposit" && (p.stages[2] as any).amount).toBe(500);
  });

  test("usd from lend → JLP withdraw, swap to USDG, kamino deposit", () => {
    const p = buildRestorePlan({
      ...base,
      target: "usd",
      source: "lend",
      amount: 100,
      sourceAmount: 30,
      sourceUsd: 105,
    });
    expect(p.error).toBeNull();
    expect(p.stages.map(s => s.type)).toEqual(["lend-collateral", "swap-any", "kamino-deposit"]);
    const sw = p.stages[1];
    expect(sw.type === "swap-any" && sw.inToken).toBe("jlp");
    expect(sw.type === "swap-any" && sw.outToken).toBe("usdg");
  });

  test("jlp from kamino → withdraw, swap to JLP, collateral deposit", () => {
    const p = buildRestorePlan({
      ...base,
      target: "jlp",
      source: "kamino",
      amount: 10,
      sourceAmount: 35,
      sourceUsd: 35,
    });
    expect(p.error).toBeNull();
    expect(p.stages.map(s => s.type)).toEqual(["kamino-withdraw", "swap-any", "lend-collateral"]);
    const dep = p.stages[2];
    expect(dep.type === "lend-collateral" && dep.key === "JLP" && dep.amount).toBe(10);
  });

  test("invalid combos rejected", () => {
    expect(
      buildRestorePlan({ ...base, target: "usd", source: "kamino", amount: 10, sourceAmount: 10, sourceUsd: 10 }).error,
    ).not.toBeNull();
    expect(
      buildRestorePlan({ ...base, target: "jlp", source: "lend", amount: 10, sourceAmount: 10, sourceUsd: 10 }).error,
    ).not.toBeNull();
    // jupsol/eurc accept both sources
    for (const t of ["jupsol", "eurc"] as const) {
      for (const s of ["kamino", "lend"] as const) {
        const p = buildRestorePlan({ ...base, target: t, source: s, amount: 10, sourceAmount: 10, sourceUsd: 10 });
        expect(p.error).toBeNull();
      }
    }
  });

  test("20k USD cap + insufficient kamino", () => {
    expect(
      buildRestorePlan({ ...base, target: "jlp", source: "kamino", amount: 10, sourceAmount: 6000, sourceUsd: 21000 })
        .error,
    ).toContain("20,000");
    expect(
      buildRestorePlan({
        ...base,
        target: "jlp",
        source: "kamino",
        amount: 10,
        sourceAmount: 150,
        sourceUsd: 150,
        kaminoUsdg: 100,
      }).error,
    ).toContain("Insufficient Kamino USDG");
    expect(
      buildRestorePlan({ ...base, target: "usd", source: "lend", amount: 10_001, sourceAmount: 10, sourceUsd: 10 })
        .error,
    ).toContain("10,000");
  });

  test("JLP withdraw danger guard", () => {
    const risky = vault({ collateralUsd: 120000, debt: 100000 }); // ltv ~0.833, liqT 0.9 → guard at 0.855
    const p = buildRestorePlan({
      ...base,
      jlp: risky,
      target: "usd",
      source: "lend",
      amount: 100,
      sourceAmount: 900, // −3,150 USD collateral → LTV ≈ 0.86 > 0.855
      sourceUsd: 3150,
    });
    expect(p.error).toContain("LTV");
  });

  test("JLP withdraw ceiling follows collateral factor over the spec guard", () => {
    // CF 0.9 → ceiling 0.8955, above the old 0.95×liqT cap of 0.855
    const highCf = vault({ collateralUsd: 120000, debt: 100000, collateralFactor: 0.9 });
    const p = buildRestorePlan({
      ...base,
      jlp: highCf,
      target: "usd",
      source: "lend",
      amount: 100,
      sourceAmount: 1445, // −5,057.5 USD collateral → LTV ≈ 0.87: over 0.855, under 0.8955
      sourceUsd: 5057.5,
    });
    expect(p.error).toBeNull();
  });
});

describe("slippageBpsFor", () => {
  const USDT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
  const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

  test("stable↔stable stays at 1 bp", () => {
    expect(slippageBpsFor(RESTORE_TOKENS.usdg.mint, USDT)).toBe(1);
    expect(slippageBpsFor(USDC, USDT)).toBe(1);
  });
  test("volatile pairs get 5 bps", () => {
    expect(slippageBpsFor(RESTORE_TOKENS.usdg.mint, RESTORE_TOKENS.jupsol.mint)).toBe(5);
    expect(slippageBpsFor(RESTORE_TOKENS.jlp.mint, USDT)).toBe(5); // volatile side wins
    expect(slippageBpsFor(RESTORE_TOKENS.jlp.mint, RESTORE_TOKENS.eurc.mint)).toBe(5);
  });
});

describe("explainSimFailure", () => {
  const JUP = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
  const jupLogs = [
    `Program ${JUP} invoke [1]`,
    "Program log: Instruction: SharedAccountsRoute",
    `Program ${JUP} consumed 42000 of 200000 compute units`,
    `Program ${JUP} failed: custom program error: 0x1771`,
  ];

  test("Jupiter Custom 6001 → slippage message", () => {
    const err = { InstructionError: [1, { Custom: 6001 }] };
    const msg = explainSimFailure(err, jupLogs, 5)!;
    expect(msg).toContain("0.05%");
    expect(msg).toContain("nothing was sent");
    expect(msg).toContain("Tap Resume");
    // 1 bp → 0.01%
    expect(explainSimFailure(err, jupLogs, 1)).toContain("0.01%");
    // log-based detection (custom program error 0x1771 = 6001)
    expect(explainSimFailure("Custom 6001", jupLogs)).toContain("the allowed slippage");
  });

  test("token insufficient funds → balance message", () => {
    const logs = ["Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA failed: custom program error: 0x1"];
    expect(explainSimFailure({ InstructionError: [0, { Custom: 1 }] }, logs)).toContain("Not enough balance");
    expect(explainSimFailure("oops", ["Program log: Error: insufficient funds"])).toContain("Not enough balance");
    // Jupiter InsufficientFunds (Custom 6024 / 0x1788)
    const jupNoFunds = [`Program ${JUP} invoke [1]`, `Program ${JUP} failed: custom program error: 0x1788`];
    expect(explainSimFailure({ InstructionError: [3, { Custom: 6024 }] }, jupNoFunds)).toContain("Not enough balance");
  });

  test("unrecognised error → null (raw output kept)", () => {
    expect(explainSimFailure({ InstructionError: [0, { Custom: 9999 }] }, ["Program xyz failed"])).toBeNull();
    // Custom 6001 without the Jupiter program id → not a slippage error
    expect(explainSimFailure({ InstructionError: [0, { Custom: 6001 }] }, ["Program xyz failed"])).toBeNull();
  });
});
