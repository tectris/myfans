'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Bell, CheckCheck, Coins, Users, Heart, MessageCircle } from 'lucide-react'
import { timeAgo } from '@/lib/utils'

type Notification = {
  id: string
  type: string
  title: string
  body: string | null
  isRead: boolean
  createdAt: string
  data?: Record<string, unknown>
}

const typeIcons: Record<string, typeof Bell> = {
  tip_received: Coins,
  new_subscriber: Users,
  new_like: Heart,
  new_comment: MessageCircle,
}

export default function NotificationsPage() {
  const queryClient = useQueryClient()

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get<Notification[]>('/notifications')
      return res.data
    },
  })

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['unread-count'] })
    },
  })

  const markAllMutation = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['unread-count'] })
    },
  })

  const unreadCount = notifications?.filter((n) => !n.isRead).length || 0

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bell className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold">Notificacoes</h1>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-bold bg-primary text-white rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => markAllMutation.mutate()}
            loading={markAllMutation.isPending}
          >
            <CheckCheck className="w-4 h-4 mr-1" />
            Marcar tudo como lido
          </Button>
        )}
      </div>

      {notifications && notifications.length > 0 ? (
        <div className="space-y-2">
          {notifications.map((notif) => {
            const Icon = typeIcons[notif.type] || Bell
            return (
              <Card
                key={notif.id}
                className={`transition-colors ${!notif.isRead ? 'border-primary/30 bg-primary/5' : ''}`}
              >
                <CardContent className="py-3">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-full shrink-0 ${!notif.isRead ? 'bg-primary/20' : 'bg-surface-light'}`}>
                      <Icon className={`w-4 h-4 ${!notif.isRead ? 'text-primary' : 'text-muted'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notif.isRead ? 'font-semibold' : ''}`}>{notif.title}</p>
                      {notif.body && <p className="text-xs text-muted mt-0.5">{notif.body}</p>}
                      <p className="text-xs text-muted mt-1">{timeAgo(notif.createdAt)}</p>
                    </div>
                    {!notif.isRead && (
                      <button
                        onClick={() => markReadMutation.mutate(notif.id)}
                        className="text-xs text-primary hover:underline shrink-0"
                      >
                        Marcar como lido
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-12 text-muted">
          <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Nenhuma notificacao ainda</p>
        </div>
      )}
    </div>
  )
}
