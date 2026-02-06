'use client'

import { useState } from 'react'
import { Heart, MessageCircle, Bookmark, Lock, Coins, MoreHorizontal, Pencil, Trash2, X, Check } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
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
  onLike?: (postId: string) => void
  onBookmark?: (postId: string) => void
  onEdit?: (postId: string, data: { contentText: string }) => void
  onDelete?: (postId: string) => void
}

export function PostCard({ post, currentUserId, onLike, onBookmark, onEdit, onDelete }: PostCardProps) {
  const hasMedia = post.media && post.media.length > 0
  const isLocked = post.visibility !== 'public' && !post.hasAccess
  const isOwner = currentUserId && post.creatorId === currentUserId
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(post.contentText || '')
  const [confirmDelete, setConfirmDelete] = useState(false)

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

  return (
    <Card className="mb-4">
      <div className="px-4 py-3 flex items-center gap-3">
        <Link href={`/creator/${post.creatorUsername}`}>
          <Avatar src={post.creatorAvatarUrl} alt={post.creatorDisplayName || post.creatorUsername} />
        </Link>
        <div className="flex-1 min-w-0">
          <Link href={`/creator/${post.creatorUsername}`} className="font-semibold text-sm hover:text-primary transition-colors">
            {post.creatorDisplayName || post.creatorUsername}
          </Link>
          <p className="text-xs text-muted">
            @{post.creatorUsername} · {timeAgo(post.publishedAt)}
          </p>
        </div>
        {post.visibility === 'ppv' && post.ppvPrice && (
          <Badge variant="warning">{formatCurrency(post.ppvPrice)}</Badge>
        )}
        {isOwner && (
          <div className="relative">
            <button
              onClick={() => { setMenuOpen(!menuOpen); setConfirmDelete(false) }}
              className="p-1.5 rounded-sm text-muted hover:text-foreground hover:bg-surface-light transition-colors"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-surface border border-border rounded-sm shadow-lg py-1 min-w-[140px]">
                  <button
                    onClick={() => { setEditing(true); setMenuOpen(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-light transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                    Editar
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
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setEditText(post.contentText || '') }}>
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
                <img
                  src={post.media[0].storageKey}
                  alt=""
                  className="w-full h-full object-cover"
                />
              )}
              {post.media?.[0]?.mediaType === 'video' && post.media[0].thumbnailUrl && (
                <div className="relative w-full h-full">
                  <img src={post.media[0].thumbnailUrl} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-primary/80 flex items-center justify-center">
                      <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </div>
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

      <div className="px-4 py-3 flex items-center gap-6">
        <button
          onClick={() => onLike?.(post.id)}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-error transition-colors group"
        >
          <Heart className={`w-5 h-5 group-hover:scale-110 transition-transform ${post.isLiked ? 'fill-error text-error' : ''}`} />
          <span>{formatNumber(post.likeCount)}</span>
        </button>

        <Link
          href={`#comments-${post.id}`}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-primary transition-colors"
        >
          <MessageCircle className="w-5 h-5" />
          <span>{formatNumber(post.commentCount)}</span>
        </Link>

        <button className="flex items-center gap-1.5 text-sm text-muted hover:text-secondary transition-colors">
          <Coins className="w-5 h-5" />
          <span>Tip</span>
        </button>

        <div className="flex-1" />

        <button
          onClick={() => onBookmark?.(post.id)}
          className="text-muted hover:text-primary transition-colors"
        >
          <Bookmark className={`w-5 h-5 ${post.isBookmarked ? 'fill-primary text-primary' : ''}`} />
        </button>
      </div>
    </Card>
  )
}
