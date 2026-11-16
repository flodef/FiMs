import { useCallback, useEffect, useRef, useState } from "react";

const INSTANCE_LOCK = "fims-instance";

/**
 * Single active instance at a time (tabs AND installed-app windows), via a Web
 * Lock held for the instance's whole lifetime:
 * - atomic acquisition → two windows opened at once can't both be active;
 * - the browser releases the lock on close/crash → a paused instance
 *   re-activates by itself;
 * - « Use here » STEALS the lock (`steal`): works even if the active instance
 *   is frozen (mobile, battery saver, bfcache) — it discovers the steal
 *   (AbortError) on wake and pauses.
 * The manifest `launch_handler: focus-existing` also covers app relaunch.
 * Without Web Locks (very old browsers): always active.
 */
export function useSingleInstance(onActivate: () => void, enabled = true) {
  const [blocked, setBlocked] = useState<null | "busy" | "taken">(null);
  const steal = useRef<() => void>(() => {});
  const activate = useRef(onActivate);
  useEffect(() => {
    activate.current = onActivate;
  });

  useEffect(() => {
    if (!enabled) return;
    const locks = (navigator as Navigator & { locks?: LockManager }).locks;
    if (!locks) return;
    // Each attempt has a number: only the latest drives the state (a cancelled
    // wait or a stale hold must not overwrite anything).
    let attempt = 0;
    let release = () => {};
    let waiting: AbortController | null = null;
    let wasBlocked = false;

    const pause = (why: "busy" | "taken") => {
      setBlocked(why);
      wasBlocked = true;
    };

    function acquire(mode: "try" | "wait" | "steal") {
      const id = ++attempt;
      waiting?.abort();
      waiting = null;
      let opts: LockOptions;
      if (mode === "try") opts = { ifAvailable: true };
      else if (mode === "steal") opts = { steal: true };
      else {
        waiting = new AbortController();
        opts = { signal: waiting.signal };
      }
      locks!
        .request(INSTANCE_LOCK, opts, async lock => {
          if (id !== attempt) return; // stale attempt: release
          if (!lock) {
            // Held elsewhere: pause, and queue to take over automatically when
            // the other instance closes.
            pause("busy");
            queueMicrotask(() => acquire("wait"));
            return;
          }
          setBlocked(null);
          if (wasBlocked) {
            wasBlocked = false;
            activate.current(); // the other instance may have changed data
          }
          await new Promise<void>(resolve => (release = resolve));
        })
        .catch(() => {
          // AbortError: lock stolen by another window (or wait cancelled).
          if (id !== attempt) return;
          pause("taken");
          acquire("wait");
        });
    }

    steal.current = () => acquire("steal");
    acquire("try");
    return () => {
      attempt++; // any in-flight attempt becomes stale
      waiting?.abort();
      release();
      steal.current = () => {};
    };
  }, [enabled]);

  const takeOver = useCallback(() => steal.current(), []);

  return { blocked, takeOver };
}
