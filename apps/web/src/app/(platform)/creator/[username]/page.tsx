'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PostCard } from '@/components/feed/post-card'
import { LevelBadge } from '@/components/gamification/level-badge'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { Users, MapPin, Calendar, Shield, Crown, Star, Camera, ImagePlus, UserPlus, UserCheck, Share2, Link2, Copy, Check as CheckIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useState, useRef } from 'react'

export default function CreatorProfilePage() {
  const { username } = useParams<{ username: string }>()
  const { user, isAuthenticated, setUser } = useAuthStore()
  const queryClient = useQueryClient()
  const [subscribing, setSubscribing] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const shareRef = useRef<HTMLDivElement>(null)

  const { data: profile } = useQuery({
    queryKey: ['profile', username],
    queryFn: async () => {
      const res = await api.get<any>(`/users/${username}`)
      return res.data
    },
  })

  const { data: subscription } = useQuery({
    queryKey: ['subscription-check', profile?.id],
    queryFn: async () => {
      const res = await api.get<{ isSubscribed: boolean }>(`/subscriptions/check/${profile.id}`)
      return res.data
    },
    enabled: !!profile?.id && isAuthenticated && profile.id !== user?.id,
  })

  const { data: postsData } = useQuery({
    queryKey: ['creator-posts', profile?.id],
    queryFn: async () => {
      const res = await api.get<{ posts: any[]; total: number }>(`/posts/creator/${profile.id}`)
      return res.data
    },
    enabled: !!profile?.id,
  })

  const editMutation = useMutation({
    mutationFn: ({ postId, data }: { postId: string; data: Record<string, unknown> }) =>
      api.patch(`/posts/${postId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-posts'] })
      toast.success('Post atualizado!')
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao editar'),
  })

  const deleteMutation = useMutation({
    mutationFn: (postId: string) => api.delete(`/posts/${postId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-posts'] })
      toast.success('Post excluido!')
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao excluir'),
  })

  const likeMutation = useMutation({
    mutationFn: (postId: string) => api.post(`/posts/${postId}/like`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['creator-posts'] }),
    onError: (e: any) => toast.error(e.message || 'Erro ao curtir'),
  })

  const bookmarkMutation = useMutation({
    mutationFn: (postId: string) => api.post(`/posts/${postId}/bookmark`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['creator-posts'] }),
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar'),
  })

  const commentMutation = useMutation({
    mutationFn: ({ postId, content }: { postId: string; content: string }) =>
      api.post(`/posts/${postId}/comments`, { content }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['creator-posts'] })
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
      queryClient.invalidateQueries({ queryKey: ['creator-posts'] })
      toast.success('Tip enviado com sucesso!')
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao enviar tip'),
  })

  const avatarMutation = useMutation({
    mutationFn: (file: File) => api.upload<{ url: string }>('/upload/avatar', file),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['profile', username] })
      if (user && res.data?.url) {
        setUser({ ...user, avatarUrl: res.data.url })
      }
      toast.success('Foto de perfil atualizada!')
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao enviar imagem'),
  })

  const coverMutation = useMutation({
    mutationFn: (file: File) => api.upload<{ url: string }>('/upload/cover', file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', username] })
      toast.success('Imagem de capa atualizada!')
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao enviar imagem'),
  })

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Apenas imagens sao aceitas')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem deve ter no maximo 5MB')
      return
    }
    avatarMutation.mutate(file)
  }

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Apenas imagens sao aceitas')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Imagem deve ter no maximo 10MB')
      return
    }
    coverMutation.mutate(file)
  }

  async function handleSubscribe() {
    if (!isAuthenticated) {
      window.location.href = '/login'
      return
    }
    setSubscribing(true)
    try {
      await api.post('/subscriptions', { creatorId: profile.id })
      toast.success(`Voce agora assina ${profile.displayName || profile.username}!`)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSubscribing(false)
    }
  }

  function handleFollow() {
    if (!isAuthenticated) {
      window.location.href = '/login'
      return
    }
    handleSubscribe()
  }

  function handleCopyLink() {
    const url = `${window.location.origin}/creator/${username}`
    navigator.clipboard.writeText(url)
    setLinkCopied(true)
    toast.success('Link copiado!')
    setTimeout(() => setLinkCopied(false), 2000)
    setShareOpen(false)
  }

  function handleShareWhatsApp() {
    const url = `${window.location.origin}/creator/${username}`
    const text = `Confira o perfil de ${profile?.displayName || username} no MyFans!`
    window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank')
    setShareOpen(false)
  }

  if (!profile) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 animate-pulse">
        <div className="h-48 bg-surface rounded-md mb-6" />
        <div className="h-6 w-48 bg-surface rounded mb-2" />
        <div className="h-4 w-32 bg-surface rounded" />
      </div>
    )
  }

  const isOwner = user?.id === profile.id
  const isSubscribed = subscription?.isSubscribed

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Cover */}
      <div
        className={`h-48 md:h-56 rounded-md overflow-hidden bg-gradient-to-br from-primary/30 to-secondary/30 relative ${isOwner ? 'group cursor-pointer' : ''}`}
        onClick={() => isOwner && coverInputRef.current?.click()}
      >
        {profile.coverUrl && (
          <img src={profile.coverUrl} alt="" className="w-full h-full object-cover" />
        )}
        {isOwner && (
          <>
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="text-white text-sm flex items-center gap-2">
                <ImagePlus className="w-5 h-5" />
                {coverMutation.isPending ? 'Enviando...' : 'Alterar capa'}
              </div>
            </div>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleCoverChange}
              className="hidden"
            />
          </>
        )}
      </div>

      {/* Profile info */}
      <div className="relative px-4 -mt-12 mb-6">
        <div className="flex flex-col md:flex-row md:items-end gap-4">
          <div
            className={`relative shrink-0 ${isOwner ? 'group cursor-pointer' : ''}`}
            onClick={() => isOwner && avatarInputRef.current?.click()}
          >
            <Avatar
              src={profile.avatarUrl}
              alt={profile.displayName || profile.username}
              size="xl"
              verified={profile.creator?.isVerified}
            />
            {isOwner && (
              <>
                <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-5 h-5 text-white" />
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{profile.displayName || profile.username}</h1>
            <p className="text-muted">@{profile.username}</p>
          </div>
          <div className="flex gap-2">
            {isOwner ? (
              <Link href="/settings">
                <Button variant="outline">Editar perfil</Button>
              </Link>
            ) : (
              <>
                {isSubscribed ? (
                  <Button variant="outline" disabled>
                    <UserCheck className="w-4 h-4 mr-1" /> Seguindo
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={handleFollow} loading={subscribing}>
                      <UserPlus className="w-4 h-4 mr-1" />
                      Seguir
                    </Button>
                    {profile.creator?.subscriptionPrice && Number(profile.creator.subscriptionPrice) > 0 && (
                      <Button onClick={handleSubscribe} loading={subscribing}>
                        <Crown className="w-4 h-4 mr-1" />
                        Assinar {formatCurrency(profile.creator.subscriptionPrice)}/mes
                      </Button>
                    )}
                  </>
                )}
              </>
            )}
            {/* Share */}
            <div className="relative" ref={shareRef}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShareOpen(!shareOpen)}
                className="p-2"
              >
                <Share2 className="w-4 h-4" />
              </Button>
              {shareOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShareOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 bg-surface border border-border rounded-sm shadow-lg py-1 min-w-[180px]">
                    <button
                      onClick={handleCopyLink}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-light transition-colors"
                    >
                      {linkCopied ? <CheckIcon className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                      Copiar link
                    </button>
                    <button
                      onClick={handleShareWhatsApp}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-light transition-colors"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      WhatsApp
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {profile.bio && <p className="mt-4 text-sm">{profile.bio}</p>}

        <div className="flex items-center gap-4 mt-3 text-sm text-muted">
          {profile.creator?.category && <Badge variant="primary">{profile.creator.category}</Badge>}
          <span className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            {formatNumber(profile.creator?.totalSubscribers || 0)} assinantes
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            Desde {new Date(profile.createdAt).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
          </span>
        </div>

        {profile.gamification && (
          <div className="mt-4">
            <LevelBadge
              level={profile.gamification.level}
              tier={profile.gamification.fanTier}
              xp={profile.gamification.xp}
            />
          </div>
        )}
      </div>

      {/* Subscription tiers */}
      {profile.creator?.tiers && profile.creator.tiers.length > 0 && !isOwner && !isSubscribed && (
        <div className="mb-8">
          <h2 className="font-bold text-lg mb-3">Planos de assinatura</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {profile.creator.tiers.map((tier: any) => (
              <Card key={tier.id} hover>
                <CardContent>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold">{tier.name}</h3>
                    <span className="text-primary font-bold">{formatCurrency(tier.price)}/mes</span>
                  </div>
                  {tier.description && <p className="text-sm text-muted mb-3">{tier.description}</p>}
                  {tier.benefits && (
                    <ul className="text-sm space-y-1">
                      {(tier.benefits as string[]).map((b, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <Star className="w-3 h-3 text-primary" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Posts */}
      <div>
        <h2 className="font-bold text-lg mb-4">Posts</h2>
        {postsData?.posts && postsData.posts.length > 0 ? (
          <div>
            {postsData.posts.map((post: any) => (
              <CreatorPostCard
                key={post.id}
                post={post}
                currentUserId={user?.id}
                isAuthenticated={isAuthenticated}
                onEdit={(postId, data) => editMutation.mutate({ postId, data })}
                onDelete={(postId) => deleteMutation.mutate(postId)}
                onLike={(postId) => likeMutation.mutate(postId)}
                onBookmark={(postId) => bookmarkMutation.mutate(postId)}
                onComment={(postId, content) => commentMutation.mutate({ postId, content })}
                onTip={(postId, creatorId, amount) => tipMutation.mutate({ postId, creatorId, amount })}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted">
            <p>{isOwner ? 'Voce ainda nao publicou nenhum post' : 'Nenhum post publico disponivel'}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function CreatorPostCard({
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
      isAuthenticated={isAuthenticated}
      onEdit={onEdit}
      onDelete={onDelete}
      onLike={onLike}
      onBookmark={onBookmark}
      onComment={onComment}
      onTip={onTip}
      comments={Array.isArray(comments) ? comments : []}
    />
  )
}
