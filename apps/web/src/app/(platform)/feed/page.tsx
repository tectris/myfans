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
    mutationFn: ({ postId, data }: { postId: string; data: Record<string, unknown> }) =>
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

  const likeMutation = useMutation({
    mutationFn: (postId: string) => api.post(`/posts/${postId}/like`, {}),
    onError: (e: any) => toast.error(e.message || 'Erro ao curtir'),
  })

  const bookmarkMutation = useMutation({
    mutationFn: (postId: string) => api.post(`/posts/${postId}/bookmark`, {}),
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar'),
  })

  const commentMutation = useMutation({
    mutationFn: ({ postId, content }: { postId: string; content: string }) =>
      api.post(`/posts/${postId}/comments`, { content }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      queryClient.invalidateQueries({ queryKey: ['comments', variables.postId] })
      toast.success('Comentario adicionado!')
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao comentar'),
  })

  const tipMutation = useMutation({
    mutationFn: ({ postId, creatorId, amount }: { postId: string; creatorId: string; amount: number }) =>
      api.post('/fancoins/tip', { creatorId, amount, referenceId: postId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fancoin-wallet'] })
      toast.success('Tip enviado com sucesso!')
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao enviar tip'),
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
                <Plus className="w-4 h-4 md:mr-1" />
                <span className="hidden md:inline">Novo post</span>
              </Button>
            </Link>
          )}
          {isAuthenticated && (
            <Link href="/explore">
              <Button variant="outline" size="sm">
                <TrendingUp className="w-4 h-4 md:mr-1" />
                <span className="hidden md:inline">Explorar</span>
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
            <FeedPostCard
              key={post.id}
              post={post}
              currentUserId={user?.id}
              isAuthenticated={isAuthenticated}
              onEdit={(postId, editData) => editMutation.mutate({ postId, data: editData })}
              onDelete={(postId) => deleteMutation.mutate(postId)}
              onLike={(postId) => likeMutation.mutate(postId)}
              onBookmark={(postId) => bookmarkMutation.mutate(postId)}
              onComment={(postId, content) => commentMutation.mutate({ postId, content })}
              onTip={(postId, creatorId, amount) => tipMutation.mutate({ postId, creatorId, amount })}
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

function FeedPostCard({
  post,
  currentUserId,
  isAuthenticated,
  onEdit,
  onDelete,
  onLike,
  onBookmark,
  onComment,
  onTip,
}: {
  post: any
  currentUserId?: string | null
  isAuthenticated: boolean
  onEdit: (postId: string, data: Record<string, unknown>) => void
  onDelete: (postId: string) => void
  onLike: (postId: string) => void
  onBookmark: (postId: string) => void
  onComment: (postId: string, content: string) => void
  onTip: (postId: string, creatorId: string, amount: number) => void
}) {
  const loginRedirect = () => { window.location.href = '/login' }

  const { data: commentsData } = useQuery({
    queryKey: ['comments', post.id],
    queryFn: async () => {
      const res = await api.get<any>(`/posts/${post.id}/comments`)
      return res.data
    },
  })

  const comments = commentsData?.comments || commentsData || []

  return (
    <PostCard
      post={post}
      currentUserId={currentUserId}
      onEdit={onEdit}
      onDelete={onDelete}
      onLike={isAuthenticated ? onLike : loginRedirect}
      onBookmark={isAuthenticated ? onBookmark : loginRedirect}
      onComment={isAuthenticated ? onComment : () => loginRedirect()}
      onTip={isAuthenticated ? onTip : () => loginRedirect()}
      comments={Array.isArray(comments) ? comments : []}
    />
  )
}
