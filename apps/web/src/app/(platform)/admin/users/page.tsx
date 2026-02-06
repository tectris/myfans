'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Shield, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { toast } from 'sonner'

type User = {
  id: string
  email: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  role: string
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
}

export default function AdminUsersPage() {
  const { user } = useAuthStore()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/feed')
    }
  }, [user, router])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', page, search],
    queryFn: () =>
      api.get<User[]>(`/admin/users?page=${page}&limit=20&search=${encodeURIComponent(search)}`),
    enabled: user?.role === 'admin',
  })

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, updates }: { userId: string; updates: Record<string, unknown> }) =>
      api.patch(`/admin/users/${userId}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
      toast.success('Usuario atualizado!')
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao atualizar'),
  })

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  function changeRole(userId: string, role: string) {
    updateUserMutation.mutate({ userId, updates: { role } })
  }

  function toggleActive(userId: string, isActive: boolean) {
    updateUserMutation.mutate({ userId, updates: { isActive: !isActive } })
  }

  const users = data?.data ?? []
  const meta = data?.meta

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-7 h-7 text-primary" />
        <h1 className="text-xl font-bold">Gerenciar Usuarios</h1>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por username ou email..."
            className="w-full pl-10 pr-4 py-2.5 rounded-sm bg-surface border border-border text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          />
        </div>
        <Button type="submit" size="md">
          Buscar
        </Button>
      </form>

      {/* Users table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-3 font-medium">Usuario</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Ultimo login</th>
                <th className="px-4 py-3 font-medium">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="h-4 bg-surface-light rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                : users.map((u) => (
                    <tr key={u.id} className="border-b border-border/50 hover:bg-surface-light/50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{u.displayName || u.username}</p>
                          <p className="text-xs text-muted">@{u.username}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted">{u.email}</td>
                      <td className="px-4 py-3">
                        <select
                          value={u.role}
                          onChange={(e) => changeRole(u.id, e.target.value)}
                          className="bg-surface border border-border rounded-sm px-2 py-1 text-xs"
                        >
                          <option value="fan">fan</option>
                          <option value="creator">creator</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={u.isActive ? 'success' : 'error'}>
                          {u.isActive ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted text-xs">
                        {u.lastLoginAt
                          ? new Date(u.lastLoginAt).toLocaleDateString('pt-BR')
                          : 'Nunca'}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant={u.isActive ? 'danger' : 'primary'}
                          size="sm"
                          onClick={() => toggleActive(u.id, u.isActive)}
                        >
                          {u.isActive ? 'Desativar' : 'Ativar'}
                        </Button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-sm text-muted">
              Total: {meta.total} usuarios
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm">Pagina {page}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={!meta.hasMore}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
