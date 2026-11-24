export const WALLET = "58kZBjjtHShTtXFmygr3ZT8VSU4dH28PanRAdouHbToh";
/** second FiMs wallet — its balances count toward the sheet Wallet!K cache */
export const WALLET2 = "FiMsyZhiBnpEvucssiCDXgiiK3kwUSmRxmr8keV3nJJF";
export const KAMINO_MARKET = "47tfyEG9SsdEnUm9cw5kY9BXngQGqu3LBoop9j5uTAv8";
/** Jupiter Spend card address — server-side only, never client-supplied */
export const SPEND_ADDRESS = "9eu9NmhU3VRi57oGTyEp1zKZD8ecYrr3jSxA3VxZNvwT";
export const DEFI_SHEET_ID = "1enXnuwZExO92B5FxPB8s2Rhqlxl1p9nUY9tRaHtV1kI";
export const SHEETS_REFERER = "https://www.fims.fi";

/** Tokens!A2:C — symbol → mint map for live Jupiter prices (stable sheet data). */
export const TOKENS: { symbol: string; name: string; mint: string }[] = [
  { symbol: "FSOL", name: "FiMs SOL", mint: "6hoGUYo5VengrsRtyyvs2y7KPf4mwWdv7V8C7GJg6Uy" },
  { symbol: "FiMs", name: "FiMs Token", mint: "D84wZMJRoievKkRaquXXrYSMuU5mA46RznCSrJ9HSK1u" },
  { symbol: "FLiP", name: "FiMs Liquidity Provider", mint: "FLiPpMfKenthVe7XHAE41msm5t63R5EwpUi5Swo5qjpN" },
  { symbol: "ZEC", name: "Zcash", mint: "A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS" },
  { symbol: "xBTC", name: "OKX Wrapped BTC", mint: "CtzPWv73Sn1dMGVU3ZtLv9yWSyUAanBni19YWDaznnkn" },
  { symbol: "ETH", name: "Ether", mint: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs" },
  { symbol: "SOL", name: "Solana", mint: "So11111111111111111111111111111111111111112" },
  { symbol: "JUP", name: "Jupiter", mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN" },
  { symbol: "JUPSOL", name: "Jupiter Staked SOL", mint: "jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v" },
  { symbol: "JLP", name: "Jupiter Perps LP", mint: "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4" },
  { symbol: "DSOL", name: "Drift Staked SOL", mint: "Dso1bDeDjCQxTrWHqUUi63oBvV7Mdm6WaobLbQ7gnPQ" },
  { symbol: "PYUSD", name: "Paypal USD", mint: "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo" },
  { symbol: "USDS", name: "USDS", mint: "USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA" },
  { symbol: "USDT", name: "USD Tether", mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB" },
  { symbol: "USDC", name: "USD Circle", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" },
  { symbol: "EURC", name: "Euro Circle", mint: "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr" },
];

/** Wallet!A2:B8 — the sheet's total rows (underlying, priced token, mint). */
export const WALLET_ROWS: { underlying: string; token: string; mint: string }[] = [
  { underlying: "FSOL", token: "SOL", mint: "So11111111111111111111111111111111111111112" },
  { underlying: "FSOL", token: "JUPSOL", mint: "jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v" },
  { underlying: "FIMS", token: "EURC", mint: "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr" },
  { underlying: "FLIP", token: "JLP", mint: "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4" },
  { underlying: "FSOL", token: "JUP", mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN" },
  { underlying: "FIMS", token: "xBTC", mint: "CtzPWv73Sn1dMGVU3ZtLv9yWSyUAanBni19YWDaznnkn" },
  { underlying: "FIMS", token: "ZEC", mint: "A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS" },
];

/** Jupiter stake program — staked-JUP positions (getStakedJup equivalent). */
export const JUP_STAKE_PROGRAM = "voTpe3tHQ7AjQHMapgSue2HJFAh2cGsdokqN3XqmVSj";

export const LTV_TARGETS: Record<string, number> = { EURC: 0, JLP: 0.82, JupSOL: 0.7 };
export const DANGER_RATIO = 0.95;

export const JUP_STAKED = 17876.704897;
export const MULTIPLY_G7 = 2172184.69 / 2000286.9583778;
export const MULTIPLY_INIT_L9 = 212289.450885;
export const MULTIPLY_B17 = 3261.53;
export const MULTIPLY_CHANGE_RATE = 241.47;
export const MULTIPLY_C19 = 205094.17945312502;
export const START_DATE = { y: 2024, m: 11, d: 15 }; // A17, Europe/Paris

export const FETCH_TIMEOUT_MS = 8000;
export const DEFI_TIMEOUT_MS = 20000;
/** |impact| per imported item / total correction below this is normal drift — corrected silently */
export const SHEET_SYNC_TOLERANCE_EUR = 50;

/** Danger-alert e-mail recipient (cron) */
export const ALERT_EMAIL = "flodef@pm.me";
