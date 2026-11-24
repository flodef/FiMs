/**
 * Jupiter price v3 (api.jup.ag) — replaces the deprecated lite-api.jup.ag.
 * Custom function used by PriceCache!D formulas: JUPPRICE(mint, refresh).
 *
 * Prices are cached 60 s in script cache (key "jupPrices"). On a cache miss a
 * single batched request covers every mint in Tokens!C2:C plus the requested
 * one. Set script property JUPITER_API_KEY to enable the x-api-key header
 * (keyless is rate-limited to 0.5 req/s).
 *
 * @customfunction
 * @param {string} mint - token mint address
 * @param {boolean} [refresh] - unused, kept for sheet-formula compatibility
 * @return {number} usdPrice
 */
function JUPPRICE(mint, refresh) {
  if (!mint) throw new Error("JUPPRICE: empty mint");
  mint = String(mint);
  const cache = CacheService.getScriptCache();
  const hit = readJupCache(cache);
  if (Object.prototype.hasOwnProperty.call(hit, mint)) return hit[mint];

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    // re-check under the lock — another call may have just populated it
    const fresh = readJupCache(cache);
    if (Object.prototype.hasOwnProperty.call(fresh, mint)) return fresh[mint];

    const mints = collectJupMints(mint);
    const prices = fetchJupPrices(mints);
    const merged = readJupCache(cache);
    for (const m of Object.keys(prices)) merged[m] = prices[m];
    cache.put("jupPrices", JSON.stringify(merged), 60);
    if (!Object.prototype.hasOwnProperty.call(merged, mint)) {
      throw new Error("No Jupiter price for " + mint);
    }
    return merged[mint];
  } finally {
    lock.releaseLock();
  }
}

/** Parse the shared "jupPrices" script-cache entry ({} on miss/corruption). */
function readJupCache(cache) {
  const raw = cache.get("jupPrices");
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : {};
  } catch (e) {
    return {};
  }
}

/** All mints the sheet may price: Tokens!C2:C plus the requested one, deduped, ≤50. */
function collectJupMints(extra) {
  const mints = [];
  const seen = {};
  const add = function (m) {
    m = m && String(m).trim();
    if (m && !seen[m] && mints.length < 50) {
      seen[m] = true;
      mints.push(m);
    }
  };
  try {
    const values = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName("Tokens")
      .getRange("C2:C")
      .getValues();
    for (let i = 0; i < values.length; ++i) add(values[i][0]);
  } catch (e) {
    // Tokens sheet unavailable — still try the requested mint alone
  }
  add(extra);
  return mints;
}

/** One batched GET to api.jup.ag/price/v3. Returns {mint: usdPrice}, usdPrice > 0 only. */
function fetchJupPrices(mints) {
  if (!mints.length) return {};
  const url = "https://api.jup.ag/price/v3?ids=" + encodeURIComponent(mints.join(","));
  const headers = {};
  const apiKey = PropertiesService.getScriptProperties().getProperty("JUPITER_API_KEY");
  if (apiKey) headers["x-api-key"] = apiKey;
  const res = UrlFetchApp.fetch(url, {
    method: "get",
    headers: headers,
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  if (code !== 200) throw new Error("Jupiter price API HTTP " + code);
  let data;
  try {
    data = JSON.parse(res.getContentText());
  } catch (e) {
    throw new Error("Jupiter price API: invalid JSON");
  }
  const out = {};
  for (const m of mints) {
    const p = data && data[m] && Number(data[m].usdPrice);
    if (p > 0) out[m] = p;
  }
  return out;
}

/**
 * One-shot migration: rewrite PriceCache!D ImportJSON(lite-api) formulas to
 * JUPPRICE(mint, refresh). Guarded by script property JUP_PRICE_MIGRATED=1.
 */
function migrateJupiterPrice() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty("JUP_PRICE_MIGRATED") === "1") return;

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("PriceCache");
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  if (lastRow < 3) return;

  const re = /INDEX\(ImportJSON\("https:\/\/lite-api\.jup\.ag\/price\/v3\?ids="&(.+?)&\$D\$1,,"noHeaders,noInherit"\),3\)/;
  const range = sheet.getRange(2, 4, lastRow - 1, 1); // D2:D(lastRow)
  const formulas = range.getFormulas();
  let changed = 0;
  for (let i = 0; i < formulas.length; ++i) {
    const f = formulas[i][0];
    if (typeof f !== "string" || f.indexOf("lite-api.jup.ag") === -1) continue;
    const next = f.replace(re, function (_, mintExpr) {
      return "JUPPRICE(" + mintExpr + ",$D$1)";
    });
    if (next !== f) {
      sheet.getRange(i + 2, 4).setFormula(next);
      ++changed;
    }
  }
  props.setProperty("JUP_PRICE_MIGRATED", "1");
  Logger.log("migrateJupiterPrice: rewrote " + changed + " PriceCache formulas");
}
