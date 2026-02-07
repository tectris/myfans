'use client'

import { useState } from 'react'
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
} from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { VideoPlayer } from '@/components/ui/video-player'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatNumber, timeAgo, formatCurrency } from '@/lib/utils'
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
        {isOwner && (
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
                </div>
              </>
            )}
          </div>
        )}
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
          ) : (
            <div className="aspect-video bg-surface-dark">
              {post.media?.[0]?.mediaType === 'image' && post.media[0].storageKey && (
                <img src={post.media[0].storageKey} alt="" className="w-full h-full object-cover" />
              )}
              {post.media?.[0]?.mediaType === 'video' && post.media[0].storageKey && (
                <VideoPlayer
                  src={post.media[0].storageKey}
                  poster={post.media[0].thumbnailUrl || undefined}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          )}
          {hasMedia && post.media!.length > 1 && (
            <div className="absolute top-2 right-2">
              <Badge>{post.media!.length} itens</Badge>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-3 flex items-center gap-6">
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
