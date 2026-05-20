import { Metadata } from 'next'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/components/auth-provider'
import '@/app/globals.css'
import Image from 'next/image'
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
    <div className="min-h-screen bg-background text-foreground font-sans antialiased selection:bg-primary/30 selection:text-primary flex flex-col">
      <AuthProvider>
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/85 backdrop-blur-xl">
          <div className="flex h-14 items-center justify-between px-4 md:px-6 max-w-lg mx-auto">
            <Link href="/cliente" className="flex items-center gap-2.5 font-semibold text-foreground hover:opacity-90 transition-opacity">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-secondary/80 to-secondary border border-border/50 flex items-center justify-center shadow-md overflow-hidden">
                <Image
                  src="/logo-b.png"
                  alt="IBZ Logo"
                  width={36}
                  height={36}
                  className="w-full h-full object-contain scale-110"
                  priority
                />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold leading-tight tracking-tight">Barber Zac</span>
                <span className="text-[10px] text-muted-foreground font-normal leading-tight -mt-0.5">Instituto</span>
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
