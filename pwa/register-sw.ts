export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(console.warn);
  });
  // [PERF] Instead of forcing a reload (which interrupts sales/forms),
  // dispatch a custom event so the UI can show a non-invasive update banner.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.dispatchEvent(new CustomEvent("sw-update-available"));
  });
}

export async function forceUpdateSW() {
  const reg = await navigator.serviceWorker.getRegistration();
  reg?.active?.postMessage({ type: "SKIP_WAITING" });
}
