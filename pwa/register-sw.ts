export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(console.warn);
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    setTimeout(() => window.location.reload(), 300);
  });
}

export async function forceUpdateSW() {
  const reg = await navigator.serviceWorker.getRegistration();
  reg?.active?.postMessage({ type: "SKIP_WAITING" });
}
