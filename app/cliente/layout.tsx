import { Metadata } from 'next'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/components/auth-provider'
import '@/app/globals.css'
import { Scissors } from 'lucide-react'
import CustomerProfileMenu from '@/components/customer/CustomerProfileMenu'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Agendamento - Instituto Barber Zac',
  description: 'Agende seu horário no Instituto Barber Zac',
}

export default function ClienteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans antialiased selection:bg-zinc-800 selection:text-zinc-100 flex flex-col">
      <AuthProvider>
        <header className="sticky top-0 z-50 w-full border-b border-zinc-800/40 bg-[#0a0a0a]/85 backdrop-blur-xl">
          <div className="flex h-14 items-center justify-between px-4 md:px-6 max-w-lg mx-auto">
            <Link href="/cliente" className="flex items-center gap-2.5 font-semibold text-zinc-100 hover:opacity-90 transition-opacity">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-zinc-700/80 to-zinc-900 border border-zinc-700/50 flex items-center justify-center shadow-md">
                <Scissors className="w-4 h-4 text-zinc-300" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold leading-tight tracking-tight">Barber Zac</span>
                <span className="text-[10px] text-zinc-500 font-normal leading-tight -mt-0.5">Instituto</span>
              </div>
            </Link>
            <CustomerProfileMenu />
          </div>
        </header>
        
        <main className="flex-1 w-full max-w-lg mx-auto px-4 py-4 flex flex-col">
          {children}
        </main>
        <Toaster />
      </AuthProvider>
    </div>
  )
}
