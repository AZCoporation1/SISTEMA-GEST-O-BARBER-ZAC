import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { Providers } from '@/components/providers'

export const metadata: Metadata = {
  title: 'Sistema de Gestão | Barber Zac',
  description: 'ERP operacional premium do Instituto Barber Zac — estoque, financeiro, vendas, comissões e relatórios.',
  robots: 'noindex, nofollow',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <Providers>
          {children}
        </Providers>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  )
}
