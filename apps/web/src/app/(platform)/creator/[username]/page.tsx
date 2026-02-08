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
import { Users, Calendar, Crown, Star, Camera, ImagePlus, UserPlus, UserCheck, Share2, FileText, X, Link2, Mail, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { useState, useRef } from 'react'

export default function CreatorProfilePage() {
  const { username } = useParams<{ username: string }>()
  const { user, isAuthenticated, setUser } = useAuthStore()
  const queryClient = useQueryClient()
  const [subscribing, setSubscribing] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

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

  const { data: followData } = useQuery({
    queryKey: ['follow-check', profile?.id],
    queryFn: async () => {
      const res = await api.get<{ isFollowing: boolean }>(`/users/${profile.id}/follow`)
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

  async function handleSubscribe() {
    if (!isAuthenticated) {
      window.location.href = '/login'
      return
    }
    setSubscribing(true)
    try {
      await api.post('/subscriptions', { creatorId: profile.id })
      queryClient.invalidateQueries({ queryKey: ['subscription-check', profile?.id] })
      toast.success(`Voce agora assina ${profile.displayName || profile.username}!`)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSubscribing(false)
    }
  }

  async function handleShare() {
    const url = `${window.location.origin}/creator/${username}`
    const shareData = {
      title: `${profile?.displayName || username} no FanDreams`,
      text: `Confira o perfil de ${profile?.displayName || username} no FanDreams!`,
      url,
    }

    // Try native share API on mobile
    if (typeof navigator !== 'undefined' && navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
      try {
        await navigator.share(shareData)
      } catch {
        // User cancelled
      }
    } else {
      // Desktop: show share modal
      setShowShareModal(true)
    }
  }

  function handleShareOption(platform: string) {
    const url = `${window.location.origin}/creator/${username}`
    const text = `Confira o perfil de ${profile?.displayName || username} no FanDreams!`
    const encoded = encodeURIComponent(text + ' ' + url)
    const encodedUrl = encodeURIComponent(url)
    const encodedText = encodeURIComponent(text)

    const shareUrls: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${encoded}`,
      telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      reddit: `https://reddit.com/submit?url=${encodedUrl}&title=${encodedText}`,
      pinterest: `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedText}`,
      email: `mailto:?subject=${encodedText}&body=${encoded}`,
    }

    if (platform === 'copy') {
      navigator.clipboard.writeText(url)
      toast.success('Link copiado!')
    } else if (shareUrls[platform]) {
      window.open(shareUrls[platform], '_blank', 'width=600,height=400')
    }

    setShowShareModal(false)
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
                  <Button onClick={handleSubscribe} loading={subscribing}>
                    <Crown className="w-4 h-4 mr-1" />
                    {Number(profile.creator.subscriptionPrice || 0) > 0
                      ? `Assinar ${formatCurrency(profile.creator.subscriptionPrice)}/mes`
                      : 'Assinar'}
                  </Button>
                )}
                {isSubscribed && (
                  <Button variant="outline" disabled>
                    <Crown className="w-4 h-4 mr-1" /> Assinante
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
        <div className="flex items-center gap-4 mt-3 text-sm text-muted flex-wrap">
          {profile.creator?.category && <Badge variant="primary">{profile.creator.category}</Badge>}
          <span className="flex items-center gap-1">
            <FileText className="w-4 h-4" />
            {formatNumber(profile.postCount || 0)} posts
          </span>
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
                onToggleVisibility={(postId) => toggleVisibilityMutation.mutate(postId)}
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

      {/* Share modal */}
      {showShareModal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setShowShareModal(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-sm mx-auto bg-surface border border-border rounded-md shadow-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Compartilhar perfil</h3>
              <button onClick={() => setShowShareModal(false)} className="text-muted hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {[
                { id: 'copy', label: 'Copiar URL', icon: <Link2 className="w-5 h-5" />, color: 'bg-gray-600' },
                { id: 'whatsapp', label: 'WhatsApp', icon: <span className="text-base font-bold">W</span>, color: 'bg-green-500' },
                { id: 'telegram', label: 'Telegram', icon: <span className="text-base font-bold">T</span>, color: 'bg-blue-400' },
                { id: 'twitter', label: 'Twitter', icon: <span className="text-base font-bold">X</span>, color: 'bg-black' },
                { id: 'facebook', label: 'Facebook', icon: <span className="text-base font-bold">f</span>, color: 'bg-blue-600' },
                { id: 'linkedin', label: 'LinkedIn', icon: <span className="text-base font-bold">in</span>, color: 'bg-blue-700' },
                { id: 'reddit', label: 'Reddit', icon: <span className="text-base font-bold">R</span>, color: 'bg-orange-500' },
                { id: 'email', label: 'Email', icon: <Mail className="w-5 h-5" />, color: 'bg-gray-500' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleShareOption(opt.id)}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <div className={`w-10 h-10 rounded-full ${opt.color} text-white flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    {opt.icon}
                  </div>
                  <span className="text-xs text-muted">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
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
      comments={Array.isArray(comments) ? comments : []}
    />
  )
}
