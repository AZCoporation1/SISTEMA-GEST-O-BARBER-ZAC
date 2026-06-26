'use client'

import { useEffect, useState } from 'react'

/**
 * Non-invasive update banner displayed when a new Service Worker is activated.
 * Does NOT interrupt sales, forms, or active operations.
 * The user can choose when to reload.
 */
export function UpdateBanner() {
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    const handler = () => setShowBanner(true)
    window.addEventListener('sw-update-available', handler)
    return () => window.removeEventListener('sw-update-available', handler)
  }, [])

  if (!showBanner) return null

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 20px',
        borderRadius: 10,
        background: 'var(--bg-elevated, #1a2332)',
        border: '1px solid var(--accent, #3b82f6)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        color: 'var(--text-primary, #fff)',
        fontSize: 13,
        fontWeight: 500,
        animation: 'slideUp 0.3s ease-out',
      }}
    >
      <span>Nova versão disponível</span>
      <button
        onClick={() => window.location.reload()}
        style={{
          padding: '5px 14px',
          borderRadius: 6,
          background: 'var(--accent, #3b82f6)',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        Atualizar agora
      </button>
      <button
        onClick={() => setShowBanner(false)}
        aria-label="Fechar"
        style={{
          padding: '2px 6px',
          background: 'transparent',
          color: 'var(--text-muted, #888)',
          border: 'none',
          cursor: 'pointer',
          fontSize: 16,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  )
}
