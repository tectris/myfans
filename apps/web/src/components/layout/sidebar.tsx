'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Compass,
  MessageCircle,
  Coins,
  BarChart3,
  Settings,
  Plus,
  Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/store'

const fanLinks = [
  { href: '/feed', icon: Home, label: 'Feed' },
  { href: '/explore', icon: Compass, label: 'Explorar' },
  { href: '/messages', icon: MessageCircle, label: 'Mensagens' },
  { href: '/wallet', icon: Coins, label: 'FanCoins' },
  { href: '/settings', icon: Settings, label: 'Configuracoes' },
]

const creatorLinks = [
  { href: '/creator/dashboard', icon: BarChart3, label: 'Dashboard' },
  { href: '/creator/content', icon: Plus, label: 'Novo post' },
  { href: '/feed', icon: Home, label: 'Feed' },
  { href: '/explore', icon: Compass, label: 'Explorar' },
  { href: '/messages', icon: MessageCircle, label: 'Mensagens' },
  { href: '/wallet', icon: Coins, label: 'FanCoins' },
  { href: '/settings', icon: Settings, label: 'Configuracoes' },
]

const adminLinks = [
  { href: '/admin', icon: Shield, label: 'Admin' },
  { href: '/creator/content', icon: Plus, label: 'Novo post' },
  { href: '/feed', icon: Home, label: 'Feed' },
  { href: '/explore', icon: Compass, label: 'Explorar' },
  { href: '/messages', icon: MessageCircle, label: 'Mensagens' },
  { href: '/wallet', icon: Coins, label: 'FanCoins' },
  { href: '/settings', icon: Settings, label: 'Configuracoes' },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, isAuthenticated } = useAuthStore()

  if (!isAuthenticated) return null

  const links =
    user?.role === 'admin'
      ? adminLinks
      : user?.role === 'creator'
        ? creatorLinks
        : fanLinks

  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 sticky top-16 h-[calc(100vh-4rem)] py-4 px-3 border-r border-border">
      <nav className="space-y-1">
        {links.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(link.href + '/')
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted hover:text-foreground hover:bg-surface-light',
              )}
            >
              <link.icon className="w-5 h-5" />
              {link.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
