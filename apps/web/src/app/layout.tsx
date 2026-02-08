import type { Metadata, Viewport } from 'next'
import { Providers } from '@/lib/providers'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'FanDreams — Crie, compartilhe, monetize', template: '%s | FanDreams' },
  description:
    'A plataforma de monetizacao para criadores de conteudo com menor taxa do mercado. Gamificacao, FanCoins e muito mais.',
  keywords: ['criadores', 'monetizacao', 'conteudo', 'assinatura', 'fancoins'],
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0F0F0F',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
