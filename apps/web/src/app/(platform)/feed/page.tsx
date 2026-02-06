'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PostCard } from '@/components/feed/post-card'
import { useAuthStore } from '@/lib/store'
import { Flame, TrendingUp, Plus } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function FeedPage() {
  const { user, isAuthenticated } = useAuthStore()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['feed', isAuthenticated ? 'personal' : 'public'],
    queryFn: async () => {
      const path = isAuthenticated ? '/feed' : '/feed/public'
      const res = await api.get<{ posts: any[]; total: number }>(path)
      return res.data
    },
  })

  const editMutation = useMutation({
    mutationFn: ({ postId, data }: { postId: string; data: { contentText: string } }) =>
      api.patch(`/posts/${postId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      toast.success('Post atualizado!')
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao editar'),
  })

  const deleteMutation = useMutation({
    mutationFn: (postId: string) => api.delete(`/posts/${postId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      toast.success('Post excluido!')
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao excluir'),
  })

  const isCreatorOrAdmin = user?.role === 'creator' || user?.role === 'admin'

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Flame className="w-6 h-6 text-primary" />
          {isAuthenticated ? 'Seu Feed' : 'Destaques'}
        </h1>
        <div className="flex gap-2">
          {isCreatorOrAdmin && (
            <Link href="/creator/content">
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Novo post
              </Button>
            </Link>
          )}
          {isAuthenticated && (
            <Link href="/explore">
              <Button variant="outline" size="sm">
                <TrendingUp className="w-4 h-4 mr-1" />
                Explorar
              </Button>
            </Link>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface border border-border rounded-md p-4 animate-pulse">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-surface-light rounded-full" />
                <div className="space-y-2">
                  <div className="w-32 h-3 bg-surface-light rounded" />
                  <div className="w-24 h-2 bg-surface-light rounded" />
                </div>
              </div>
              <div className="w-full h-48 bg-surface-light rounded" />
            </div>
          ))}
        </div>
      ) : data?.posts && data.posts.length > 0 ? (
        <div>
          {data.posts.map((post: any) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={user?.id}
              onEdit={(postId, editData) => editMutation.mutate({ postId, data: editData })}
              onDelete={(postId) => deleteMutation.mutate(postId)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <Flame className="w-16 h-16 text-muted mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Seu feed esta vazio</h2>
          <p className="text-muted text-sm mb-6">
            {isCreatorOrAdmin
              ? 'Crie seu primeiro post!'
              : 'Assine criadores para ver o conteudo deles aqui'}
          </p>
          {isCreatorOrAdmin ? (
            <Link href="/creator/content">
              <Button>
                <Plus className="w-4 h-4 mr-1" />
                Criar post
              </Button>
            </Link>
          ) : (
            <Link href="/explore">
              <Button>Explorar criadores</Button>
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
