'use client'

import React from "react";
import { useInstallPrompt } from "@/pwa/useInstallPrompt";
import { Download } from "lucide-react";

export default function PWAInstallButton() {
  const { supported, installed, promptInstall } = useInstallPrompt();
  if (!supported || installed) return null;

  return (
    <button
      onClick={promptInstall}
      className="pwa-install-btn"
      aria-label="Instalar aplicativo"
    >
      <Download size={15} strokeWidth={2} />
      <span>Instalar App</span>
    </button>
  );
}
