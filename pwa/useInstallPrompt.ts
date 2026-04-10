import { useEffect, useState, useCallback } from "react";

export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<any>(null);
  const [supported, setSupported] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: any) => {
      e.preventDefault();
      setDeferred(e);
      setSupported(true);
    };
    const onInstalled = () => setInstalled(true);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return;
    const outcome = await deferred.prompt();
    setDeferred(null);
    return outcome;
  }, [deferred]);

  return { supported, installed, promptInstall };
}
