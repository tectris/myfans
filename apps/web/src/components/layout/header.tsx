'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/lib/store'
import { api } from '@/lib/api'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { FancoinDrawer } from '@/components/fancoins/fancoin-drawer'
import { Search, Bell, MessageCircle, Flame, Coins } from 'lucide-react'

export function Header() {
  const { user, isAuthenticated } = useAuthStore()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const { data: walletData } = useQuery({
    queryKey: ['fancoin-wallet'],
    queryFn: () => api.get<{ balance: string }>('/fancoins/wallet'),
    enabled: isAuthenticated,
  })

  const balance = walletData?.data ? Number(walletData.data.balance) : 0

  return (
    <>
      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl">
              <Flame className="w-7 h-7 text-primary" />
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                MyFans
              </span>
            </Link>
          </div>

          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                placeholder="Buscar criadores..."
                className="w-full pl-10 pr-4 py-2 rounded-full bg-surface-light border border-border text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warning/10 hover:bg-warning/20 transition-colors"
                >
                  <Coins className="w-4 h-4 text-warning" />
                  <span className="text-sm font-semibold text-warning">
                    {balance.toLocaleString()}
                  </span>
                </button>
                <Link
                  href="/messages"
                  className="p-2 rounded-full hover:bg-surface-light transition-colors relative"
                >
                  <MessageCircle className="w-5 h-5 text-muted" />
                </Link>
                <Link
                  href="/notifications"
                  className="p-2 rounded-full hover:bg-surface-light transition-colors relative"
                >
                  <Bell className="w-5 h-5 text-muted" />
                </Link>
                <Link href={`/creator/${user?.username}`}>
                  <Avatar src={user?.avatarUrl} alt={user?.displayName || user?.username || ''} size="sm" />
                </Link>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button variant="ghost" size="sm">
                    Entrar
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="sm">Criar conta</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>
      <FancoinDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  )
}
