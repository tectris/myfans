'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Shield, Users, FileText, Star } from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

type DashboardStats = {
  totalUsers: number
  totalPosts: number
  totalCreators: number
  recentUsers: Array<{
    id: string
    email: string
    username: string
    displayName: string | null
    role: string
    isActive: boolean
    createdAt: string
  }>
}

export default function AdminDashboardPage() {
  const { user } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/feed')
    }
  }, [user, router])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => api.get<DashboardStats>('/admin/dashboard'),
    enabled: user?.role === 'admin',
  })

  const stats = data?.data

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-surface-light rounded" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-surface-light rounded-md" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-7 h-7 text-primary" />
        <h1 className="text-xl font-bold">Painel Admin</h1>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-sm">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalUsers ?? 0}</p>
                <p className="text-sm text-muted">Usuarios</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary/10 rounded-sm">
                <FileText className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalPosts ?? 0}</p>
                <p className="text-sm text-muted">Posts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-warning/10 rounded-sm">
                <Star className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalCreators ?? 0}</p>
                <p className="text-sm text-muted">Criadores</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent users */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Usuarios recentes</h2>
        <Link href="/admin/users">
          <Button variant="outline" size="sm">Ver todos</Button>
        </Link>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-3 font-medium">Usuario</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Criado em</th>
              </tr>
            </thead>
            <tbody>
              {stats?.recentUsers.map((u) => (
                <tr key={u.id} className="border-b border-border/50 hover:bg-surface-light/50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium">{u.displayName || u.username}</p>
                      <p className="text-xs text-muted">@{u.username}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{u.email}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        u.role === 'admin' ? 'error' : u.role === 'creator' ? 'primary' : 'default'
                      }
                    >
                      {u.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={u.isActive ? 'success' : 'error'}>
                      {u.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
