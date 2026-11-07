import { registerSW } from "virtual:pwa-register";

let registration: ServiceWorkerRegistration | undefined;

/** Registers the service worker; with autoUpdate the page reloads once a new version takes control. */
export function initPwa() {
  registerSW({
    immediate: true,
    onRegisteredSW: (_url, reg) => {
      registration = reg;
    },
  });
}

/** Asks the browser to fetch sw.js again; a new build installs, activates and reloads the page. */
export function checkForUpdate() {
  if (navigator.onLine) void registration?.update().catch(() => {});
}
