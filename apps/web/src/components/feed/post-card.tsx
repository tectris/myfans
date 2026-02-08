'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Heart,
  MessageCircle,
  Bookmark,
  Lock,
  Coins,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
  Check,
  Send,
  Pin,
  Eye,
  EyeOff,
  Share2,
  Flag,
  Link2,
  Mail,
} from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { VideoPlayer } from '@/components/ui/video-player'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatNumber, timeAgo, formatCurrency } from '@/lib/utils'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import Link from 'next/link'

interface PostCardProps {
  post: {
    id: string
    contentText: string | null
    postType: string
    visibility: string
    ppvPrice?: string | null
    isPinned?: boolean
    isVisible?: boolean
    likeCount: number
    commentCount: number
    shareCount?: number
    viewCount: number
    publishedAt: string
    creatorId?: string
    creatorUsername: string
    creatorDisplayName: string | null
    creatorAvatarUrl: string | null
    media?: Array<{
      id: string
      mediaType: string
      storageKey: string | null
      thumbnailUrl: string | null
      isPreview: boolean
    }>
    hasAccess?: boolean
    isLiked?: boolean
    isBookmarked?: boolean
    tipSent?: { amount: number; createdAt: string } | null
  }
  currentUserId?: string | null
  isAuthenticated?: boolean
  onLike?: (postId: string) => void
  onBookmark?: (postId: string) => void
  onEdit?: (postId: string, data: { contentText?: string; isPinned?: boolean }) => void
  onToggleVisibility?: (postId: string) => void
  onDelete?: (postId: string) => void
  onComment?: (postId: string, content: string) => void
  onTip?: (postId: string, creatorId: string, amount: number) => void
  comments?: Array<{
    id: string
    content: string
    username: string
    displayName: string | null
    avatarUrl: string | null
    createdAt: string
  }>
}

export function PostCard({
  post,
  currentUserId,
  isAuthenticated = true,
  onLike,
  onBookmark,
  onEdit,
  onToggleVisibility,
  onDelete,
  onComment,
  onTip,
  comments,
}: PostCardProps) {
  const hasMedia = post.media && post.media.length > 0
  const isLocked = post.visibility !== 'public' && !post.hasAccess
  const isOwner = currentUserId && post.creatorId === currentUserId
  const isHidden = post.isVisible === false
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(post.contentText || '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [showTip, setShowTip] = useState(false)
  const [tipAmount, setTipAmount] = useState('')
  const [liked, setLiked] = useState(post.isLiked || false)
  const [likeCount, setLikeCount] = useState(post.likeCount)
  const [bookmarked, setBookmarked] = useState(post.isBookmarked || false)
  const [shareCount, setShareCount] = useState(post.shareCount || 0)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [viewCount, setViewCount] = useState(post.viewCount)
  const [viewTracked, setViewTracked] = useState(false)
  const videoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (videoTimerRef.current) clearTimeout(videoTimerRef.current)
    }
  }, [])

  function handleLike() {
    if (!isAuthenticated) {
      window.location.href = '/login'
      return
    }
    setLiked(!liked)
    setLikeCount((c) => (liked ? c - 1 : c + 1))
    onLike?.(post.id)
  }

  function handleBookmark() {
    if (!isAuthenticated) {
      window.location.href = '/login'
      return
    }
    setBookmarked(!bookmarked)
    onBookmark?.(post.id)
  }

  function handleEdit() {
    onEdit?.(post.id, { contentText: editText })
    setEditing(false)
    setMenuOpen(false)
  }

  function handleDelete() {
    onDelete?.(post.id)
    setConfirmDelete(false)
    setMenuOpen(false)
  }

  function handlePin() {
    onEdit?.(post.id, { isPinned: !post.isPinned })
    setMenuOpen(false)
  }

  function handleComment() {
    if (!isAuthenticated) {
      window.location.href = '/login'
      return
    }
    if (!commentText.trim()) return
    onComment?.(post.id, commentText.trim())
    setCommentText('')
  }

  function handleTip() {
    if (!isAuthenticated) {
      window.location.href = '/login'
      return
    }
    const amount = Number(tipAmount)
    if (!amount || amount <= 0) return
    onTip?.(post.id, post.creatorId || '', amount)
    setTipAmount('')
    setShowTip(false)
  }

  function toggleComments() {
    if (!isAuthenticated) {
      window.location.href = '/login'
      return
    }
    setShowComments(!showComments)
    if (!showComments) setShowTip(false)
  }

  function toggleTip() {
    if (!isAuthenticated) {
      window.location.href = '/login'
      return
    }
    setShowTip(!showTip)
    if (!showTip) setShowComments(false)
  }

  function sendViewTrack() {
    if (viewTracked) return
    setViewTracked(true)
    setViewCount((c) => c + 1)
    api.post(`/posts/${post.id}/view`, {}).catch(() => {})
  }

  // Video: start 3s timer on play, cancel on pause
  function handleVideoPlay() {
    if (viewTracked) return
    videoTimerRef.current = setTimeout(() => {
      sendViewTrack()
    }, 3000)
  }

  function handleVideoPause() {
    if (videoTimerRef.current) {
      clearTimeout(videoTimerRef.current)
      videoTimerRef.current = null
    }
  }

  function openLightbox(index: number) {
    setLightboxIndex(index)
    setLightboxOpen(true)
    sendViewTrack()
  }

  async function handleShare() {
    const url = `${window.location.origin}/creator/${post.creatorUsername}`
    const shareData = {
      title: `Post de ${post.creatorDisplayName || post.creatorUsername}`,
      text: post.contentText || `Confira este post no MyFans!`,
      url,
    }

    // Try native share API first (mobile browsers)
    if (typeof navigator !== 'undefined' && navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
      try {
        await navigator.share(shareData)
        setShareCount((c) => c + 1)
        api.post(`/posts/${post.id}/share`, {}).catch(() => {})
      } catch {
        // User cancelled
      }
    } else {
      // Desktop: show share modal
      setShowShareModal(true)
    }
  }

  function handleShareOption(platform: string) {
    const url = `${window.location.origin}/creator/${post.creatorUsername}`
    const text = post.contentText || `Confira este post no MyFans!`
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

    setShareCount((c) => c + 1)
    api.post(`/posts/${post.id}/share`, {}).catch(() => {})
    setShowShareModal(false)
  }

  async function handleReport() {
    if (!reportReason.trim()) {
      toast.error('Selecione um motivo')
      return
    }
    try {
      await api.post(`/posts/${post.id}/report`, { reason: reportReason })
      toast.success('Denuncia enviada. Obrigado!')
      setShowReportModal(false)
      setReportReason('')
      setMenuOpen(false)
    } catch (e: any) {
      if (e.code === 'ALREADY_REPORTED') {
        toast.info('Voce ja denunciou este post')
      } else {
        toast.error(e.message || 'Erro ao denunciar')
      }
      setShowReportModal(false)
    }
  }

  return (
    <Card className={`mb-4 ${isHidden ? 'opacity-50 grayscale' : ''}`}>
      {/* Hidden indicator */}
      {isHidden && isOwner && (
        <div className="px-4 pt-3 flex items-center gap-2 text-muted">
          <EyeOff className="w-4 h-4" />
          <span className="text-xs">Post oculto — somente voce pode ver</span>
        </div>
      )}
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3">
        <Link href={`/creator/${post.creatorUsername}`}>
          <Avatar src={post.creatorAvatarUrl} alt={post.creatorDisplayName || post.creatorUsername} />
        </Link>
        <div className="flex-1 min-w-0">
          <Link
            href={`/creator/${post.creatorUsername}`}
            className="font-semibold text-sm hover:text-primary transition-colors"
          >
            {post.creatorDisplayName || post.creatorUsername}
          </Link>
          <p className="text-xs text-muted">
            @{post.creatorUsername} · {timeAgo(post.publishedAt)}
            {post.isPinned && <Pin className="w-3 h-3 inline ml-1 text-primary" />}
          </p>
        </div>
        {post.visibility === 'ppv' && post.ppvPrice && (
          <Badge variant="warning">{formatCurrency(post.ppvPrice)}</Badge>
        )}

        {/* More menu */}
        <div className="relative">
          <button
            onClick={() => {
              setMenuOpen(!menuOpen)
              setConfirmDelete(false)
            }}
            className="p-1.5 rounded-sm text-muted hover:text-foreground hover:bg-surface-light transition-colors"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 bg-surface border border-border rounded-sm shadow-lg py-1 min-w-[160px]">
                {isOwner && (
                  <>
                    <button
                      onClick={() => {
                        setEditing(true)
                        setMenuOpen(false)
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-light transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                      Editar
                    </button>
                    <button
                      onClick={handlePin}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-light transition-colors"
                    >
                      <Pin className="w-4 h-4" />
                      {post.isPinned ? 'Desafixar' : 'Fixar'}
                    </button>
                    <button
                      onClick={() => {
                        onToggleVisibility?.(post.id)
                        setMenuOpen(false)
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-light transition-colors"
                    >
                      {isHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      {isHidden ? 'Tornar visivel' : 'Ocultar post'}
                    </button>
                    {!confirmDelete ? (
                      <button
                        onClick={() => setConfirmDelete(true)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-error hover:bg-surface-light transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Excluir
                      </button>
                    ) : (
                      <button
                        onClick={handleDelete}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-error font-semibold hover:bg-error/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Confirmar exclusao
                      </button>
                    )}
                  </>
                )}
                {!isOwner && isAuthenticated && (
                  <button
                    onClick={() => {
                      setShowReportModal(true)
                      setMenuOpen(false)
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-error hover:bg-surface-light transition-colors"
                  >
                    <Flag className="w-4 h-4" />
                    Denunciar
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      {editing ? (
        <div className="px-4 pb-3">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-sm bg-surface-light border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none text-sm"
          />
          <div className="flex gap-2 mt-2">
            <Button size="sm" onClick={handleEdit}>
              <Check className="w-4 h-4 mr-1" />
              Salvar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false)
                setEditText(post.contentText || '')
              }}
            >
              <X className="w-4 h-4 mr-1" />
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        post.contentText && (
          <div className="px-4 pb-3">
            <p className="text-sm whitespace-pre-wrap">{post.contentText}</p>
          </div>
        )
      )}

      {/* Media */}
      {hasMedia && (
        <div className="relative">
          {isLocked ? (
            <div className="aspect-video bg-surface-dark flex flex-col items-center justify-center gap-3">
              <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center">
                <Lock className="w-8 h-8 text-muted" />
              </div>
              <p className="text-sm text-muted">Conteudo exclusivo para assinantes</p>
              <Link href={`/creator/${post.creatorUsername}`}>
                <Button size="sm">Assinar para desbloquear</Button>
              </Link>
            </div>
          ) : post.media!.length === 1 ? (
            // Single media
            <div className="aspect-video bg-surface-dark">
              {post.media![0].mediaType === 'image' && post.media![0].storageKey && (
                <img
                  src={post.media![0].storageKey}
                  alt=""
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => openLightbox(0)}
                />
              )}
              {post.media![0].mediaType === 'video' && post.media![0].storageKey && (
                <VideoPlayer
                  src={post.media![0].storageKey}
                  poster={post.media![0].thumbnailUrl || undefined}
                  className="w-full h-full object-cover"
                  onPlay={handleVideoPlay}
                  onPause={handleVideoPause}
                />
              )}
            </div>
          ) : (
            // Multi-image gallery grid
            <div className={`grid gap-0.5 ${post.media!.length === 2 ? 'grid-cols-2' : post.media!.length >= 3 ? 'grid-cols-2' : ''}`}>
              {post.media!.slice(0, 4).map((m, i) => (
                <div
                  key={m.id || i}
                  className={`relative bg-surface-dark ${i === 0 && post.media!.length === 3 ? 'row-span-2' : ''} ${post.media!.length === 1 ? 'aspect-video' : 'aspect-square'}`}
                >
                  {m.mediaType === 'image' && m.storageKey && (
                    <img
                      src={m.storageKey}
                      alt=""
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => openLightbox(i)}
                    />
                  )}
                  {m.mediaType === 'video' && m.storageKey && (
                    <VideoPlayer
                      src={m.storageKey}
                      poster={m.thumbnailUrl || undefined}
                      className="w-full h-full object-cover"
                      onPlay={handleVideoPlay}
                  onPause={handleVideoPause}
                    />
                  )}
                  {i === 3 && post.media!.length > 4 && (
                    <div
                      className="absolute inset-0 bg-black/60 flex items-center justify-center cursor-pointer"
                      onClick={() => openLightbox(3)}
                    >
                      <span className="text-white text-2xl font-bold">+{post.media!.length - 4}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Image lightbox */}
      {lightboxOpen && post.media && post.media.filter((m) => m.mediaType === 'image').length > 0 && (
        <>
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setLightboxOpen(false)}>
            <button
              className="absolute top-4 right-4 text-white/70 hover:text-white z-60"
              onClick={() => setLightboxOpen(false)}
            >
              <X className="w-8 h-8" />
            </button>
            {post.media.filter((m) => m.mediaType === 'image').length > 1 && (
              <>
                <button
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-4xl font-light z-60"
                  onClick={(e) => {
                    e.stopPropagation()
                    const images = post.media!.filter((m) => m.mediaType === 'image')
                    setLightboxIndex((prev) => (prev - 1 + images.length) % images.length)
                  }}
                >
                  &#8249;
                </button>
                <button
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-4xl font-light z-60"
                  onClick={(e) => {
                    e.stopPropagation()
                    const images = post.media!.filter((m) => m.mediaType === 'image')
                    setLightboxIndex((prev) => (prev + 1) % images.length)
                  }}
                >
                  &#8250;
                </button>
              </>
            )}
            <img
              src={post.media.filter((m) => m.mediaType === 'image')[lightboxIndex]?.storageKey || ''}
              alt=""
              className="max-w-[90vw] max-h-[90vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            {post.media.filter((m) => m.mediaType === 'image').length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {post.media.filter((m) => m.mediaType === 'image').map((_, i) => (
                  <button
                    key={i}
                    className={`w-2 h-2 rounded-full ${i === lightboxIndex ? 'bg-white' : 'bg-white/40'}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setLightboxIndex(i)
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Stats bar (views) */}
      <div className="px-4 pt-2 flex items-center gap-1 text-xs text-muted">
        <Eye className="w-3.5 h-3.5" />
        <span>{formatNumber(viewCount)} visualizacoes</span>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 flex items-center gap-5">
        <button onClick={handleLike} className="flex items-center gap-1.5 text-sm text-muted hover:text-error transition-colors group">
          <Heart
            className={`w-5 h-5 group-hover:scale-110 transition-transform ${liked ? 'fill-error text-error' : ''}`}
          />
          <span>{formatNumber(likeCount)}</span>
        </button>

        <button
          onClick={toggleComments}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-primary transition-colors"
        >
          <MessageCircle className={`w-5 h-5 ${showComments ? 'text-primary' : ''}`} />
          <span>{formatNumber(post.commentCount)}</span>
        </button>

        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
        >
          <Share2 className="w-5 h-5" />
          <span>{shareCount > 0 ? formatNumber(shareCount) : ''}</span>
        </button>

        {!isOwner && (
          <button
            onClick={toggleTip}
            className="flex items-center gap-1.5 text-sm text-muted hover:text-secondary transition-colors"
          >
            <Coins className={`w-5 h-5 ${showTip ? 'text-secondary' : ''}`} />
            <span>Tip</span>
          </button>
        )}

        <div className="flex-1" />

        <button onClick={handleBookmark} className="text-muted hover:text-primary transition-colors">
          <Bookmark className={`w-5 h-5 ${bookmarked ? 'fill-primary text-primary' : ''}`} />
        </button>
      </div>

      {/* Tip sent log */}
      {post.tipSent && !isOwner && (
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-sm bg-secondary/10 border border-secondary/20 text-xs">
            <Coins className="w-3.5 h-3.5 text-secondary shrink-0" />
            <span className="text-secondary">
              Voce enviou {post.tipSent.amount} FanCoins em{' '}
              {new Date(post.tipSent.createdAt).toLocaleDateString('pt-BR')} -{' '}
              {new Date(post.tipSent.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      )}

      {/* Tip input */}
      {showTip && !isOwner && (
        <div className="px-4 pb-3 flex gap-2">
          <input
            type="number"
            min="1"
            placeholder="Quantidade de FanCoins"
            value={tipAmount}
            onChange={(e) => setTipAmount(e.target.value)}
            className="flex-1 px-3 py-2 rounded-sm bg-surface-light border border-border text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-secondary"
          />
          <Button size="sm" variant="secondary" onClick={handleTip}>
            <Coins className="w-4 h-4 mr-1" />
            Enviar
          </Button>
        </div>
      )}

      {/* Report modal */}
      {showReportModal && (
        <div className="px-4 pb-3">
          <div className="p-3 rounded-sm border border-border bg-surface-light">
            <p className="text-sm font-medium mb-2">Denunciar post</p>
            <div className="space-y-1.5 mb-3">
              {[
                { value: 'spam', label: 'Spam' },
                { value: 'inappropriate', label: 'Conteudo inapropriado' },
                { value: 'harassment', label: 'Assedio ou bullying' },
                { value: 'violence', label: 'Violencia' },
                { value: 'copyright', label: 'Violacao de direitos autorais' },
                { value: 'other', label: 'Outro' },
              ].map((r) => (
                <label key={r.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="report-reason"
                    value={r.value}
                    checked={reportReason === r.value}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="accent-primary"
                  />
                  {r.label}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleReport}>
                Enviar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowReportModal(false); setReportReason('') }}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Share modal */}
      {showShareModal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setShowShareModal(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-sm mx-auto bg-surface border border-border rounded-md shadow-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Compartilhar</h3>
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

      {/* Comments section */}
      {showComments && (
        <div className="border-t border-border">
          {comments && comments.length > 0 && (
            <div className="px-4 py-2 space-y-3 max-h-60 overflow-y-auto">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-2">
                  <Avatar src={c.avatarUrl} alt={c.displayName || c.username} size="xs" />
                  <div>
                    <p className="text-xs">
                      <span className="font-semibold">{c.displayName || c.username}</span>{' '}
                      <span className="text-muted">· {timeAgo(c.createdAt)}</span>
                    </p>
                    <p className="text-sm">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="px-4 py-3 flex gap-2">
            <input
              type="text"
              placeholder="Escreva um comentario..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleComment()}
              className="flex-1 px-3 py-2 rounded-sm bg-surface-light border border-border text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Button size="sm" onClick={handleComment} disabled={!commentText.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
