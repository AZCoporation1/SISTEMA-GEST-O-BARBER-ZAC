import { Metadata } from 'next'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/components/auth-provider'
import '@/app/globals.css'
import { CalendarRange } from 'lucide-react'
import CustomerProfileMenu from '@/components/customer/CustomerProfileMenu'

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
        <header className="sticky top-0 z-50 w-full border-b border-zinc-800/50 bg-[#0a0a0a]/80 backdrop-blur-md">
          <div className="flex h-16 items-center justify-between px-4 md:px-6 max-w-md mx-auto">
            <div className="flex items-center gap-2 font-semibold text-zinc-100">
              <div className="w-8 h-8 rounded bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-800 flex items-center justify-center shadow-inner">
                <CalendarRange className="w-4 h-4 text-zinc-300" />
              </div>
              <span>Instituto Barber Zac</span>
            </div>
            <CustomerProfileMenu />
          </div>
        </header>
        
        <main className="flex-1 w-full max-w-md mx-auto p-4 flex flex-col">
          {children}
        </main>
        <Toaster />
      </AuthProvider>
    </div>
  )
}
