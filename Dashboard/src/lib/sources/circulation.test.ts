import { afterEach, describe, expect, test } from "bun:test";
import { fetchCirculation } from "./circulation.js";

const OK = {
  computedAt: "2026-11-24T16:07:34.344Z",
  FSOL: { members: 1000.91345, tontine: 0, total: 1000.91345 },
  FiMs: { members: 161503.308, tontine: 92.9, total: 161596.208 },
  FLiP: { members: 13305.86277, tontine: 0, total: 13305.86277 },
};

const stubFetch = (impl: () => Promise<Response>) => {
  const orig = globalThis.fetch;
  globalThis.fetch = impl as unknown as typeof fetch;
  return () => {
    globalThis.fetch = orig;
  };
};

describe("fetchCirculation", () => {
  afterEach(() => {
    // fetch restored per-test via stubFetch cleanup below
  });

  test("returns parsed buckets on 200", async () => {
    const restore = stubFetch(async () => new Response(JSON.stringify(OK), { status: 200 }));
    try {
      const r = await fetchCirculation("https://example.test/circulation");
      expect(r.FSOL.total).toBe(1000.91345);
      expect(r.FiMs.total).toBe(161596.208);
      expect("FLIP" in r).toBe(false); // wire key is FLiP, not FLIP
      expect(r.FLiP.total).toBe(13305.86277);
      expect(r.computedAt).toBe(OK.computedAt);
    } finally {
      restore();
    }
  });

  test("throws on HTTP error", async () => {
    const restore = stubFetch(async () => new Response("nope", { status: 503 }));
    try {
      await expect(fetchCirculation("https://example.test/circulation")).rejects.toThrow("HTTP 503");
    } finally {
      restore();
    }
  });

  test("throws when a bucket is missing", async () => {
    const { FLiP: _drop, ...partial } = OK;
    const restore = stubFetch(async () => new Response(JSON.stringify(partial), { status: 200 }));
    try {
      await expect(fetchCirculation("https://example.test/circulation")).rejects.toThrow("validation");
    } finally {
      restore();
    }
  });

  test("throws when a total is non-finite", async () => {
    const bad = { ...OK, FSOL: { members: 1, tontine: 0, total: Number.NaN } };
    const restore = stubFetch(async () => new Response(JSON.stringify(bad), { status: 200 }));
    try {
      await expect(fetchCirculation("https://example.test/circulation")).rejects.toThrow("validation");
    } finally {
      restore();
    }
  });
});
