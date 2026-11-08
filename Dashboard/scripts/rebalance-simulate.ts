// Live rebalance simulation — builds + simulates txs, NEVER sends.
// Run: HELIUS_API_KEY="$(pass helius/api-key)" JUPITER_API_KEY="$(pass jupiter/api-key)" bun scripts/rebalance-simulate.ts
import {
  buildKaminoTx,
  buildLendTx,
  buildSwapTx,
  fetchKaminoUsdg,
  fetchLendPositions,
  jupQuote,
  rpc,
  simulateTx,
  sizeUsdgForUsdt,
  walletTokenBalance,
  USDG_MINT,
  USDT_MINT,
} from "../src/lib/rebalance/live.js";
import { buildPlan } from "../src/lib/rebalance/plan.js";
import { buildAction } from "../src/lib/rebalance/server.js";

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

async function report(name: string, fn: () => Promise<{ txB64: string; size?: number; quote?: unknown }>) {
  try {
    const r = await fn();
    console.log(`\n=== ${name} ===`);
    console.log(`tx size: ${r.size ?? Buffer.from(r.txB64, "base64").length} bytes`);
    if (r.quote) console.log(`quote: ${JSON.stringify(r.quote)}`);
    if (!r.txB64) return; // quote-only check
    const sim = await simulateTx(r.txB64);
    console.log(`simulation: ${sim.ok ? "OK" : `ERR ${JSON.stringify(sim.err)}`} (units: ${sim.unitsConsumed ?? "?"})`);
    console.log("logs tail:");
    for (const l of sim.logsTail) console.log(`  ${l}`);
  } catch (e: any) {
    console.log(`\n=== ${name} ===`);
    console.log(`BUILD ERR: ${e?.message ?? e}`);
  }
}

const main = async () => {
  if (!process.env.HELIUS_API_KEY) throw new Error("HELIUS_API_KEY missing");
  if (!process.env.JUPITER_API_KEY) throw new Error("JUPITER_API_KEY missing");

  // (a) live plan
  console.log("— fetching live positions —");
  const [positions, kamino] = await Promise.all([fetchLendPositions(), fetchKaminoUsdg()]);
  console.log(`lend positions: ${JSON.stringify(positions, null, 1)}`);
  console.log(`kamino USDG: ${fmt(kamino.amount)} (reserve ${kamino.reserve})`);
  const plan = buildPlan(positions, kamino.amount);
  console.log("\nPLAN:", JSON.stringify(plan, null, 1));

  // wallet balances
  const conn = rpc();
  const [usdt, usdg] = await Promise.all([walletTokenBalance(conn, USDT_MINT), walletTokenBalance(conn, USDG_MINT)]);
  console.log(`\nwallet balances: USDT ${fmt(usdt)} · USDG ${fmt(usdg)}`);

  // (b) first stage of live plan — through buildAction (fresh-plan validation + simulate)
  if (plan.stages.length) {
    const s = plan.stages[0];
    await report(`live plan stage 0 (${s.type}) via buildAction`, async () => {
      const r = await buildAction(s);
      const first = Array.isArray(r) ? r[0] : r;
      return { txB64: first.tx, size: first.size, quote: first.quote };
    });
  } else {
    console.log("\nplan is empty — nothing to simulate for stage 0");
  }

  // (c) each builder with tiny amounts
  await report("kamino withdraw 1 USDG", () => buildKaminoTx("withdraw", 1, kamino.reserve));
  await report("jup ExactOut quote USDG->USDT 1 USDT (expected: no routes)", async () => {
    const q = await jupQuote(USDG_MINT, USDT_MINT, 1_000_000, "ExactOut");
    return { txB64: "", size: 0, quote: { inAmount: q.inAmount / 1e6, outAmount: q.outAmount / 1e6 } };
  });
  await report("swap sizing probe ExactIn ~1292 USDG->USDT", async () => {
    const sized = await sizeUsdgForUsdt(1292.53);
    return { txB64: "", size: 0, quote: sized };
  });
  await report("swap ExactIn 1 USDT→USDG", () => buildSwapTx(USDT_MINT, USDG_MINT, 1_000_000, "ExactIn"));
  await report("jupiter lend borrow 1 USDT vault50+52 combined", async () => {
    const r = await buildLendTx([
      { vaultId: 50, positionId: 161, deltaUsdt: 1 },
      { vaultId: 52, positionId: 124, deltaUsdt: 1 },
    ]);
    return { txB64: r[0].txB64, size: r[0].size, quote: { split: r.length > 1 } };
  });
  await report("kamino deposit 1 USDG", () => buildKaminoTx("deposit", 1, kamino.reserve));

  console.log("\ndone — nothing was sent");
  process.exit(0); // bigint-buffer native module crashes at teardown on Node 26 — exit before GC
};

main().catch(e => {
  console.error("FATAL:", e?.message ?? e);
  process.exit(1);
});
