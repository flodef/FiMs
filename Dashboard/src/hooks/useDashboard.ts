import { useCallback, useEffect, useRef, useState } from "react";
import { fixtureMode, loadFixtureInputs } from "../lib/fixture";
import { checkForUpdate } from "../lib/pwa";
import type { Inputs } from "../lib/types";

const LS_KEY = "fims-dash:inputs:v1";

export type AuthState = "unknown" | "authed" | "anon";

function loadCache(): Inputs | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Inputs) : null;
  } catch {
    return null;
  }
}

function saveCache(inputs: Inputs) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(inputs));
  } catch {
    // storage full/blocked — ignore
  }
}

export function useDashboard() {
  const [inputs, setInputs] = useState<Inputs | null>(() => loadCache());
  const [auth, setAuth] = useState<AuthState>("unknown");
  const [offline, setOffline] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const inflight = useRef(false);

  const refresh = useCallback(async (): Promise<"ok" | "offline" | "expired" | "busy"> => {
    if (inflight.current) return "busy";
    inflight.current = true;
    try {
      if (fixtureMode()) {
        const fx = await loadFixtureInputs();
        if (fx) {
          setInputs(fx);
          setAuth("authed");
          setOffline(false);
          setSessionExpired(false);
        }
        return "ok";
      }
      const res = await fetch("/api/dashboard", { headers: { accept: "application/json" } });
      if (res.status === 401) {
        setAuth("anon");
        setSessionExpired(true);
        return "expired";
      }
      if (res.ok) {
        const data = (await res.json()) as Inputs;
        saveCache(data);
        setInputs(data);
        setAuth("authed");
        setOffline(false);
        setSessionExpired(false);
        return "ok";
      }
      setOffline(true);
      return "offline";
    } catch {
      setOffline(true);
      return "offline";
    } finally {
      inflight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const first = window.setTimeout(() => void refresh(), 0);
    const tick = setInterval(() => setNow(new Date()), 60_000);
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 5 * 60_000);
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      checkForUpdate();
      void refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearTimeout(first);
      clearInterval(tick);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  return { inputs, auth, offline, sessionExpired, loading, now, refresh, setAuth };
}
