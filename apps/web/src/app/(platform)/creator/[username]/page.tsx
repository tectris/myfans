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
import { SubscribeDrawer } from '@/components/subscription/subscribe-drawer'
import { PpvUnlockDrawer } from '@/components/feed/ppv-unlock-drawer'
import { LevelBadge } from '@/components/gamification/level-badge'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { Users, Calendar, Crown, Star, Camera, ImagePlus, UserPlus, UserCheck, Share2, FileText, Eye, Image, Video, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

export default function CreatorProfilePage() {
  const { username } = useParams<{ username: string }>()
  const { user, isAuthenticated, setUser } = useAuthStore()
  const queryClient = useQueryClient()
  const [subscribing, setSubscribing] = useState(false)
  const [subscribeDrawerOpen, setSubscribeDrawerOpen] = useState(false)
  const [selectedTier, setSelectedTier] = useState<any>(null)
  const [ppvDrawerOpen, setPpvDrawerOpen] = useState(false)
  const [ppvPost, setPpvPost] = useState<any>(null)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const searchParams = useSearchParams()
  const subscriptionStatus = searchParams.get('subscription')

  useEffect(() => {
    if (subscriptionStatus === 'pending') {
      toast.info('Assinatura em processamento. Voce sera notificado quando for confirmada.')
      queryClient.invalidateQueries({ queryKey: ['subscription-status'] })
    }
  }, [subscriptionStatus, queryClient])

  const { data: profile } = useQuery({
    queryKey: ['profile', username],
    queryFn: async () => {
      const res = await api.get<any>(`/users/${username}`)
      return res.data
    },
  })

  const { data: subscription } = useQuery({
    queryKey: ['subscription-status', profile?.id],
    queryFn: async () => {
      const res = await api.get<{
        isSubscribed: boolean
        subscription: {
          id: string
          status: string
          pricePaid: string
          currentPeriodEnd: string | null
          cancelledAt: string | null
          autoRenew: boolean
          isCancelled: boolean
          createdAt: string
        } | null
      }>(`/subscriptions/status/${profile.id}`)
      return res.data
    },
    enabled: !!profile?.id && isAuthenticated && profile.id !== user?.id,
  })

  const { data: followData } = useQuery({
    queryKey: ['follow-check', profile?.id],
    queryFn: async () => {
      const res = await api.get<{ isFollowing: boolean }>(`/users/${profile.id}/follow`)
      return res.data
    },
    enabled: !!profile?.id && isAuthenticated && profile.id !== user?.id,
  })

  const { data: postsData, error: postsError } = useQuery({
    queryKey: ['creator-posts', profile?.id],
    queryFn: async () => {
      const res = await api.get<{ posts: any[]; total: number }>(`/posts/creator/${profile.id}`)
      console.log('[creator-posts] API response:', { total: res.data?.total, postCount: res.data?.posts?.length, visibilities: res.data?.posts?.map((p: any) => p.visibility) })
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

  const toggleVisibilityMutation = useMutation({
    mutationFn: (postId: string) => api.patch(`/posts/${postId}/toggle-visibility`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-posts'] })
      toast.success('Visibilidade atualizada!')
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao alterar visibilidade'),
  })

  const tipMutation = useMutation({
    mutationFn: ({ postId, creatorId, amount }: { postId: string; creatorId: string; amount: number }) =>
      api.post('/fancoins/tip', { creatorId, amount, referenceId: postId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fancoin-wallet'] })
      queryClient.invalidateQueries({ queryKey: ['fancoin-transactions'] })
      queryClient.invalidateQueries({ queryKey: ['creator-posts'] })
      toast.success('Tip enviado com sucesso!')
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao enviar tip'),
  })

  const followMutation = useMutation({
    mutationFn: () => api.post(`/users/${profile.id}/follow`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-check', profile?.id] })
      queryClient.invalidateQueries({ queryKey: ['profile', username] })
      toast.success(`Voce agora segue ${profile.displayName || profile.username}!`)
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao seguir'),
  })

  const unfollowMutation = useMutation({
    mutationFn: () => api.delete(`/users/${profile.id}/follow`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-check', profile?.id] })
      queryClient.invalidateQueries({ queryKey: ['profile', username] })
      toast.success('Voce deixou de seguir')
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao deixar de seguir'),
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

  const cancelMutation = useMutation({
    mutationFn: (subscriptionId: string) => api.delete(`/subscriptions/${subscriptionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-status', profile?.id] })
      setCancelModalOpen(false)
      toast.success('Assinatura cancelada. Acesso mantido ate o fim do periodo.')
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao cancelar assinatura'),
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

  function handleFollow() {
    if (!isAuthenticated) {
      window.location.href = '/login'
      return
    }
    if (followData?.isFollowing) {
      unfollowMutation.mutate()
    } else {
      followMutation.mutate()
    }
  }

  function handleSubscribe(tier?: any) {
    if (!isAuthenticated) {
      window.location.href = '/login'
      return
    }
    setSelectedTier(tier || null)
    setSubscribeDrawerOpen(true)
  }

  function handlePpvUnlock(post: any) {
    if (!isAuthenticated) {
      window.location.href = '/login'
      return
    }
    setPpvPost(post)
    setPpvDrawerOpen(true)
  }

  async function handleShare() {
    const url = `${window.location.origin}/creator/${username}`
    const shareData = {
      title: `${profile?.displayName || username} no FanDreams`,
      text: `Confira o perfil de ${profile?.displayName || username} no FanDreams!`,
      url,
    }

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData)
      } catch {
        // User cancelled
      }
    } else {
      navigator.clipboard.writeText(url)
      toast.success('Link copiado!')
    }
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
  const isFollowing = followData?.isFollowing

  // Count media from posts
  const mediaStats = (postsData?.posts || []).reduce(
    (acc: { photos: number; videos: number }, post: any) => {
      if (post.media) {
        for (const m of post.media) {
          if (m.mediaType === 'image') acc.photos++
          if (m.mediaType === 'video') acc.videos++
        }
      }
      return acc
    },
    { photos: 0, videos: 0 },
  )

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
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
                {isFollowing ? (
                  <Button variant="outline" onClick={handleFollow} loading={unfollowMutation.isPending}>
                    <UserCheck className="w-4 h-4 mr-1" /> Seguindo
                  </Button>
                ) : (
                  <Button variant="outline" onClick={handleFollow} loading={followMutation.isPending}>
                    <UserPlus className="w-4 h-4 mr-1" />
                    Seguir
                  </Button>
                )}
                {profile.creator && !isSubscribed && (
                  <Button onClick={() => handleSubscribe()}>
                    <Crown className="w-4 h-4 mr-1" />
                    {Number(profile.creator.subscriptionPrice || 0) > 0
                      ? `Assinar ${formatCurrency(profile.creator.subscriptionPrice)}/mes`
                      : 'Assinar'}
                  </Button>
                )}
                {isSubscribed && !subscription?.subscription?.isCancelled && (
                  <Button variant="outline" onClick={() => setCancelModalOpen(true)}>
                    <Crown className="w-4 h-4 mr-1" /> Assinante
                  </Button>
                )}
                {isSubscribed && subscription?.subscription?.isCancelled && (
                  <Button variant="outline" disabled className="text-muted">
                    <Crown className="w-4 h-4 mr-1" />
                    Ativo ate {new Date(subscription.subscription.currentPeriodEnd!).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </Button>
                )}
              </>
            )}
            {/* Share */}
            <Button variant="ghost" size="sm" onClick={handleShare} className="p-2">
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {profile.bio && <p className="mt-4 text-sm">{profile.bio}</p>}

        {/* Stats */}
        <div className="flex items-center gap-5 mt-4 text-sm text-muted flex-wrap">
          {profile.creator?.category && <Badge variant="primary">{profile.creator.category}</Badge>}
          <span className="flex items-center gap-1">
            <FileText className="w-4 h-4" />
            {formatNumber(profile.postCount || 0)} posts
          </span>
          {mediaStats.photos > 0 && (
            <span className="flex items-center gap-1">
              <Image className="w-4 h-4" />
              {formatNumber(mediaStats.photos)} fotos
            </span>
          )}
          {mediaStats.videos > 0 && (
            <span className="flex items-center gap-1">
              <Video className="w-4 h-4" />
              {formatNumber(mediaStats.videos)} videos
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            {formatNumber(profile.followerCount || 0)} seguidores
          </span>
          {profile.creator && (
            <span className="flex items-center gap-1">
              <Crown className="w-4 h-4" />
              {formatNumber(profile.creator.totalSubscribers || 0)} assinantes
            </span>
          )}
          <span className="flex items-center gap-1">
            <Eye className="w-4 h-4" />
            {formatNumber(profile.profileViews || 0)} visualizacoes
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
        <div className="mb-10">
          <h2 className="font-bold text-lg mb-4">Planos de assinatura</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {profile.creator.tiers.map((tier: any, tierIndex: number) => {
              const tierGradients = [
                'from-primary/20 to-purple-600/5',
                'from-amber-500/20 to-orange-600/5',
                'from-emerald-500/20 to-teal-600/5',
                'from-rose-500/20 to-pink-600/5',
              ]
              const tierAccents = [
                'text-primary',
                'text-amber-400',
                'text-emerald-400',
                'text-rose-400',
              ]
              const gradient = tierGradients[tierIndex % tierGradients.length]
              const accent = tierAccents[tierIndex % tierAccents.length]
              return (
                <Card key={tier.id} hover>
                  <div className={`bg-gradient-to-br ${gradient}`}>
                    <CardContent>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-lg">{tier.name}</h3>
                        <span className={`${accent} font-bold`}>{formatCurrency(tier.price)}/mes</span>
                      </div>
                      {tier.description && <p className="text-sm text-muted mb-4">{tier.description}</p>}
                      {tier.benefits && (
                        <ul className="text-sm space-y-2 mb-4">
                          {(tier.benefits as string[]).map((b, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <Star className={`w-3.5 h-3.5 ${accent} shrink-0`} />
                              {b}
                            </li>
                          ))}
                        </ul>
                      )}
                      <Button
                        className="w-full mt-2"
                        onClick={() => handleSubscribe(tier)}
                      >
                        <Crown className="w-4 h-4 mr-1" />
                        Assinar {formatCurrency(tier.price)}/mes
                      </Button>
                    </CardContent>
                  </div>
                </Card>
              )
            })}
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
                onToggleVisibility={(postId) => toggleVisibilityMutation.mutate(postId)}
                onDelete={(postId) => deleteMutation.mutate(postId)}
                onLike={(postId) => likeMutation.mutate(postId)}
                onBookmark={(postId) => bookmarkMutation.mutate(postId)}
                onComment={(postId, content) => commentMutation.mutate({ postId, content })}
                onTip={(postId, creatorId, amount) => tipMutation.mutate({ postId, creatorId, amount })}
                onPpvUnlock={handlePpvUnlock}
                onSubscribe={() => handleSubscribe()}
              />
            ))}
          </div>
        ) : postsError ? (
          <div className="text-center py-12 text-error">
            <p>Erro ao carregar posts: {(postsError as any)?.message || 'Erro desconhecido'}</p>
          </div>
        ) : (
          <div className="text-center py-12 text-muted">
            <p>{isOwner ? 'Voce ainda nao publicou nenhum post' : 'Nenhum post disponivel'}</p>
          </div>
        )}
      </div>

      {/* Cancel Subscription Modal */}
      {cancelModalOpen && subscription?.subscription && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setCancelModalOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-md shadow-xl max-w-sm w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                </div>
                <h3 className="font-bold text-lg">Cancelar assinatura</h3>
              </div>
              <p className="text-sm text-muted mb-2">
                Tem certeza que deseja cancelar sua assinatura de{' '}
                <span className="font-semibold text-foreground">{profile.displayName || profile.username}</span>?
              </p>
              <div className="bg-surface-light rounded-sm p-3 mb-4">
                <p className="text-sm">
                  Seu acesso continua ativo ate{' '}
                  <span className="font-semibold">
                    {new Date(subscription.subscription.currentPeriodEnd!).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </p>
                <p className="text-xs text-muted mt-1">
                  Nenhuma cobranca futura sera realizada. Voce pode reassinar a qualquer momento.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setCancelModalOpen(false)}
                >
                  Manter assinatura
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1 text-error hover:bg-error/10"
                  onClick={() => cancelMutation.mutate(subscription.subscription!.id)}
                  loading={cancelMutation.isPending}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Subscribe Drawer */}
      {profile && (
        <SubscribeDrawer
          open={subscribeDrawerOpen}
          onClose={() => setSubscribeDrawerOpen(false)}
          creator={{
            id: profile.id,
            username: profile.username,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
            subscriptionPrice: profile.creator?.subscriptionPrice,
          }}
          tier={selectedTier}
        />
      )}

      {/* PPV Unlock Drawer */}
      {ppvPost && (
        <PpvUnlockDrawer
          open={ppvDrawerOpen}
          onClose={() => { setPpvDrawerOpen(false); setPpvPost(null) }}
          onUnlocked={() => {
            queryClient.invalidateQueries({ queryKey: ['creator-posts'] })
          }}
          post={{
            id: ppvPost.id,
            ppvPrice: ppvPost.ppvPrice,
            creatorUsername: ppvPost.creatorUsername,
            creatorDisplayName: ppvPost.creatorDisplayName,
            contentText: ppvPost.contentText,
          }}
        />
      )}
    </div>
  )
}

function CreatorPostCard({
  post,
  currentUserId,
  isAuthenticated,
  onEdit,
  onToggleVisibility,
  onDelete,
  onLike,
  onBookmark,
  onComment,
  onTip,
  onPpvUnlock,
  onSubscribe,
}: {
  post: any
  currentUserId?: string | null
  isAuthenticated: boolean
  onEdit: (postId: string, data: Record<string, unknown>) => void
  onToggleVisibility: (postId: string) => void
  onDelete: (postId: string) => void
  onLike: (postId: string) => void
  onBookmark: (postId: string) => void
  onComment: (postId: string, content: string) => void
  onTip: (postId: string, creatorId: string, amount: number) => void
  onPpvUnlock: (post: any) => void
  onSubscribe: () => void
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
      onToggleVisibility={onToggleVisibility}
      onDelete={onDelete}
      onLike={onLike}
      onBookmark={onBookmark}
      onComment={onComment}
      onTip={onTip}
      onPpvUnlock={onPpvUnlock}
      onSubscribe={onSubscribe}
      comments={Array.isArray(comments) ? comments : []}
    />
  )
}
