import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Login | Barber Zac',
  description: 'Acesse o Sistema de Gestão do Instituto Barber Zac',
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
