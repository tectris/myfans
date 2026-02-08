'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore, useThemeStore } from '@/lib/store'
import { api } from '@/lib/api'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { FancoinDrawer } from '@/components/fancoins/fancoin-drawer'
import { Search, Bell, MessageCircle, Flame, Coins, X, Sun, Moon } from 'lucide-react'

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export function Header() {
  const { user, isAuthenticated } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchExpanded, setSearchExpanded] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const debouncedQuery = useDebounce(searchQuery, 300)

  const { data: searchResults } = useQuery({
    queryKey: ['header-search', debouncedQuery],
    queryFn: async () => {
      const res = await api.get<any[]>(`/discover/search/users?q=${encodeURIComponent(debouncedQuery)}`)
      return res.data
    },
    enabled: debouncedQuery.length >= 2,
  })

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
        if (!searchQuery) setSearchExpanded(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [searchQuery])

  useEffect(() => {
    if (searchExpanded && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [searchExpanded])

  const { data: walletData } = useQuery({
    queryKey: ['fancoin-wallet'],
    queryFn: () => api.get<{ balance: string }>('/fancoins/wallet'),
    enabled: isAuthenticated,
  })

  const { data: unreadData } = useQuery({
    queryKey: ['unread-count'],
    queryFn: async () => {
      const res = await api.get<{ count: number }>('/notifications/unread-count')
      return res.data
    },
    enabled: isAuthenticated,
    refetchInterval: 30000,
  })

  const balance = walletData?.data ? Number(walletData.data.balance) : 0
  const unreadCount = unreadData?.count || 0

  function closeSearch() {
    setSearchExpanded(false)
    setSearchOpen(false)
    setSearchQuery('')
  }

  return (
    <>
      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href={isAuthenticated ? '/feed' : '/'} className="flex items-center gap-2 font-bold text-lg">
              <Flame className="w-6 h-6 text-primary" />
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                FanDreams
              </span>
            </Link>
          </div>

          {/* Search - icon that expands */}
          <div className="hidden md:flex flex-1 justify-center" ref={searchRef}>
            {searchExpanded ? (
              <div className="relative w-full max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setSearchOpen(true)
                  }}
                  onFocus={() => searchQuery.length >= 2 && setSearchOpen(true)}
                  placeholder="Buscar criadores..."
                  className="w-full pl-10 pr-10 py-1.5 rounded-full bg-surface-light border border-border text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
                />
                <button
                  onClick={closeSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
                {searchOpen && debouncedQuery.length >= 2 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-border rounded-md shadow-xl max-h-80 overflow-y-auto z-50">
                    {searchResults && searchResults.length > 0 ? (
                      searchResults.map((u: any) => (
                        <Link
                          key={u.id}
                          href={`/creator/${u.username}`}
                          onClick={closeSearch}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-surface-light transition-colors"
                        >
                          <Avatar src={u.avatarUrl} alt={u.displayName || u.username} size="sm" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{u.displayName || u.username}</p>
                            <p className="text-xs text-muted">@{u.username}</p>
                          </div>
                        </Link>
                      ))
                    ) : (
                      <div className="px-4 py-6 text-center text-sm text-muted">
                        Nenhum usuario encontrado
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setSearchExpanded(true)}
                className="p-2 rounded-full hover:bg-surface-light transition-colors text-muted hover:text-foreground"
              >
                <Search className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-surface-light transition-colors text-muted hover:text-foreground"
              title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            {isAuthenticated ? (
              <>
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warning/10 hover:bg-warning/20 transition-colors"
                >
                  <Coins className="w-3.5 h-3.5 text-warning" />
                  <span className="text-xs font-semibold text-warning">
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
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] flex items-center justify-center px-1 text-[9px] font-bold bg-error text-white rounded-full">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
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
