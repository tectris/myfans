import { eq, desc, and, or, sql, inArray, gt } from 'drizzle-orm'
import { posts, postMedia, postLikes, postComments, postBookmarks, subscriptions, users, creatorProfiles, fancoinTransactions, postViews, payments } from '@fandreams/database'
import { db } from '../config/database'
import { AppError } from './auth.service'
import type { CreatePostInput, UpdatePostInput } from '@fandreams/shared'

export async function createPost(creatorId: string, input: CreatePostInput) {
  // Block media upload for users without KYC verification (admins bypass)
  if (input.media && input.media.length > 0) {
    const [creator] = await db
      .select({ kycStatus: users.kycStatus, role: users.role })
      .from(users)
      .where(eq(users.id, creatorId))
      .limit(1)

    if (!creator || (creator.role !== 'admin' && creator.kycStatus !== 'approved')) {
      throw new AppError(
        'KYC_REQUIRED',
        'Verificacao de identidade necessaria para postar imagens e videos',
        403,
      )
    }
  }

  const [post] = await db
    .insert(posts)
    .values({
      creatorId,
      contentText: input.contentText,
      postType: input.postType,
      visibility: input.visibility,
      tierId: input.tierId,
      ppvPrice: input.ppvPrice ? String(input.ppvPrice) : null,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      publishedAt: input.scheduledAt ? new Date(input.scheduledAt) : new Date(),
    })
    .returning()

  if (input.media && input.media.length > 0) {
    for (let i = 0; i < input.media.length; i++) {
      const m = input.media[i]
      await addMediaToPost(post.id, {
        mediaType: m.mediaType,
        storageKey: m.key,
        sortOrder: i,
      })
    }
  }

  return post
}

export async function getPost(postId: string, viewerId?: string) {
  const [post] = await db
    .select()
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1)

  if (!post) throw new AppError('NOT_FOUND', 'Post nao encontrado', 404)

  // Hidden posts are only visible to their creator
  if (!post.isVisible && viewerId !== post.creatorId) {
    throw new AppError('NOT_FOUND', 'Post nao encontrado', 404)
  }

  const media = await db
    .select()
    .from(postMedia)
    .where(eq(postMedia.postId, postId))
    .orderBy(postMedia.sortOrder)

  const [creator] = await db
    .select({
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      isVerified: creatorProfiles.isVerified,
    })
    .from(users)
    .leftJoin(creatorProfiles, eq(creatorProfiles.userId, users.id))
    .where(eq(users.id, post.creatorId))
    .limit(1)

  let hasAccess = post.visibility === 'public'
  let isLiked = false
  let isBookmarked = false

  if (viewerId) {
    if (viewerId === post.creatorId) {
      hasAccess = true
    } else if (post.visibility === 'ppv') {
      // PPV: check for completed payment
      const [ppvPayment] = await db
        .select({ id: payments.id })
        .from(payments)
        .where(
          and(
            eq(payments.userId, viewerId),
            eq(payments.type, 'ppv'),
            eq(payments.status, 'completed'),
            sql`${payments.metadata}->>'postId' = ${postId}`,
          ),
        )
        .limit(1)
      hasAccess = !!ppvPayment
    } else if (!hasAccess) {
      // Subscribers visibility
      const [sub] = await db
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.fanId, viewerId),
            eq(subscriptions.creatorId, post.creatorId),
            eq(subscriptions.status, 'active'),
          ),
        )
        .limit(1)
      hasAccess = !!sub
    }

    const [like] = await db
      .select()
      .from(postLikes)
      .where(and(eq(postLikes.userId, viewerId), eq(postLikes.postId, postId)))
      .limit(1)
    isLiked = !!like

    const [bookmark] = await db
      .select()
      .from(postBookmarks)
      .where(and(eq(postBookmarks.userId, viewerId), eq(postBookmarks.postId, postId)))
      .limit(1)
    isBookmarked = !!bookmark
  }

  await db.update(posts).set({ viewCount: sql`${posts.viewCount} + 1` }).where(eq(posts.id, postId))

  return {
    ...post,
    media: hasAccess ? media : media.map((m) => ({ ...m, storageKey: m.isPreview ? m.storageKey : null })),
    creator,
    hasAccess,
    isLiked,
    isBookmarked,
  }
}

export async function getFeed(userId: string, page = 1, limit = 20) {
  const offset = (page - 1) * limit

  const subscribedCreators = await db
    .select({ creatorId: subscriptions.creatorId })
    .from(subscriptions)
    .where(and(eq(subscriptions.fanId, userId), eq(subscriptions.status, 'active')))

  const creatorIds = subscribedCreators.map((s) => s.creatorId)

  // Always include own posts in feed
  if (!creatorIds.includes(userId)) {
    creatorIds.push(userId)
  }

  // Build feed conditions: own posts + subscribed creators' posts + public posts from everyone
  const feedConditions = and(
    eq(posts.isArchived, false),
    or(
      // Own posts (visible or hidden)
      eq(posts.creatorId, userId),
      // Subscribed creators' posts
      ...(creatorIds.length > 0
        ? [and(inArray(posts.creatorId, creatorIds), eq(posts.isVisible, true))]
        : []),
      // Public posts from all creators (so new users see content)
      and(eq(posts.visibility, 'public'), eq(posts.isVisible, true)),
    ),
  )

  const feedPosts = await db
    .select({
      id: posts.id,
      creatorId: posts.creatorId,
      contentText: posts.contentText,
      postType: posts.postType,
      visibility: posts.visibility,
      ppvPrice: posts.ppvPrice,
      isVisible: posts.isVisible,
      likeCount: posts.likeCount,
      commentCount: posts.commentCount,
      tipCount: posts.tipCount,
      shareCount: posts.shareCount,
      viewCount: posts.viewCount,
      publishedAt: posts.publishedAt,
      creatorUsername: users.username,
      creatorDisplayName: users.displayName,
      creatorAvatarUrl: users.avatarUrl,
    })
    .from(posts)
    .innerJoin(users, eq(posts.creatorId, users.id))
    .where(feedConditions)
    .orderBy(desc(posts.publishedAt))
    .limit(limit)
    .offset(offset)

  const postIds = feedPosts.map((p) => p.id)
  const allMedia =
    postIds.length > 0
      ? await db.select().from(postMedia).where(inArray(postMedia.postId, postIds)).orderBy(postMedia.sortOrder)
      : []

  const userLikes =
    postIds.length > 0
      ? await db.select({ postId: postLikes.postId }).from(postLikes).where(and(eq(postLikes.userId, userId), inArray(postLikes.postId, postIds)))
      : []
  const likedPostIds = new Set(userLikes.map((l) => l.postId))

  const userBookmarks =
    postIds.length > 0
      ? await db.select({ postId: postBookmarks.postId }).from(postBookmarks).where(and(eq(postBookmarks.userId, userId), inArray(postBookmarks.postId, postIds)))
      : []
  const bookmarkedPostIds = new Set(userBookmarks.map((b) => b.postId))

  // Get user's tip_sent transactions for these posts
  const userTips =
    postIds.length > 0
      ? await db
          .select({
            referenceId: fancoinTransactions.referenceId,
            amount: fancoinTransactions.amount,
            createdAt: fancoinTransactions.createdAt,
          })
          .from(fancoinTransactions)
          .where(
            and(
              eq(fancoinTransactions.userId, userId),
              eq(fancoinTransactions.type, 'tip_sent'),
              inArray(fancoinTransactions.referenceId, postIds),
            ),
          )
      : []
  const tipsByPostId = new Map<string, { amount: number; createdAt: Date | string }>()
  for (const t of userTips) {
    if (!t.referenceId) continue
    const existing = tipsByPostId.get(t.referenceId)
    if (existing) {
      existing.amount += Math.abs(Number(t.amount))
      if (new Date(t.createdAt) > new Date(existing.createdAt)) {
        existing.createdAt = t.createdAt
      }
    } else {
      tipsByPostId.set(t.referenceId, { amount: Math.abs(Number(t.amount)), createdAt: t.createdAt })
    }
  }

  // Check PPV unlocks for PPV posts
  const ppvPostIds = feedPosts.filter((p) => p.visibility === 'ppv').map((p) => p.id)
  const ppvUnlockedIds = new Set<string>()
  if (ppvPostIds.length > 0) {
    const ppvPayments = await db
      .select({ metadata: payments.metadata })
      .from(payments)
      .where(
        and(
          eq(payments.userId, userId),
          eq(payments.type, 'ppv'),
          eq(payments.status, 'completed'),
        ),
      )
    for (const p of ppvPayments) {
      const postId = (p.metadata as any)?.postId
      if (postId && ppvPostIds.includes(postId)) ppvUnlockedIds.add(postId)
    }
  }

  const subscribedCreatorIds = new Set(creatorIds)

  const postsWithMedia = feedPosts.map((post) => {
    const isOwn = post.creatorId === userId
    const isSubscribed = subscribedCreatorIds.has(post.creatorId)
    const isPublic = post.visibility === 'public'
    let hasAccess = isOwn || isSubscribed || isPublic
    if (!hasAccess && post.visibility === 'ppv') {
      hasAccess = ppvUnlockedIds.has(post.id)
    }
    const postMedia = allMedia.filter((m) => m.postId === post.id)
    return {
      ...post,
      media: hasAccess
        ? postMedia
        : postMedia.map((m) => ({ ...m, storageKey: m.isPreview ? m.storageKey : null })),
      hasAccess,
      isLiked: likedPostIds.has(post.id),
      isBookmarked: bookmarkedPostIds.has(post.id),
      tipSent: tipsByPostId.get(post.id) || null,
    }
  })

  return { posts: postsWithMedia, total: feedPosts.length }
}

export async function getPublicFeed(page = 1, limit = 20) {
  const offset = (page - 1) * limit

  const feedPosts = await db
    .select({
      id: posts.id,
      creatorId: posts.creatorId,
      contentText: posts.contentText,
      postType: posts.postType,
      visibility: posts.visibility,
      likeCount: posts.likeCount,
      commentCount: posts.commentCount,
      shareCount: posts.shareCount,
      viewCount: posts.viewCount,
      publishedAt: posts.publishedAt,
      creatorUsername: users.username,
      creatorDisplayName: users.displayName,
      creatorAvatarUrl: users.avatarUrl,
    })
    .from(posts)
    .innerJoin(users, eq(posts.creatorId, users.id))
    .where(and(eq(posts.visibility, 'public'), eq(posts.isArchived, false), eq(posts.isVisible, true)))
    .orderBy(desc(posts.publishedAt))
    .limit(limit)
    .offset(offset)

  const postIds = feedPosts.map((p) => p.id)
  const allMedia =
    postIds.length > 0
      ? await db.select().from(postMedia).where(inArray(postMedia.postId, postIds))
      : []

  const postsWithMedia = feedPosts.map((post) => ({
    ...post,
    media: allMedia.filter((m) => m.postId === post.id),
    hasAccess: true,
  }))

  return { posts: postsWithMedia, total: feedPosts.length }
}

export async function getCreatorPosts(creatorId: string, viewerId?: string, page = 1, limit = 20) {
  const offset = (page - 1) * limit
  const isOwner = viewerId === creatorId

  // For non-owners: show all visible, non-archived posts (public + protected)
  // Protected posts will be returned with hasAccess: false and restricted media
  const conditions = [eq(posts.creatorId, creatorId), eq(posts.isArchived, false)]
  if (!isOwner) {
    conditions.push(eq(posts.isVisible, true))
    // Non-owners see public posts, subscribers also see subscriber/ppv posts
    // The access control (locked overlay) is handled client-side via hasAccess
  }

  const feedPosts = await db
    .select({
      id: posts.id,
      creatorId: posts.creatorId,
      contentText: posts.contentText,
      postType: posts.postType,
      visibility: posts.visibility,
      ppvPrice: posts.ppvPrice,
      isVisible: posts.isVisible,
      likeCount: posts.likeCount,
      commentCount: posts.commentCount,
      tipCount: posts.tipCount,
      viewCount: posts.viewCount,
      isPinned: posts.isPinned,
      publishedAt: posts.publishedAt,
      creatorUsername: users.username,
      creatorDisplayName: users.displayName,
      creatorAvatarUrl: users.avatarUrl,
    })
    .from(posts)
    .innerJoin(users, eq(posts.creatorId, users.id))
    .where(and(...conditions))
    .orderBy(desc(posts.isPinned), desc(posts.publishedAt))
    .limit(limit)
    .offset(offset)

  const postIds = feedPosts.map((p) => p.id)
  const allMedia =
    postIds.length > 0
      ? await db.select().from(postMedia).where(inArray(postMedia.postId, postIds)).orderBy(postMedia.sortOrder)
      : []

  // Check subscription status for non-owner viewers
  let hasSubscription = false
  if (viewerId && !isOwner) {
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.fanId, viewerId),
          eq(subscriptions.creatorId, creatorId),
          eq(subscriptions.status, 'active'),
        ),
      )
      .limit(1)
    hasSubscription = !!sub
  }

  let likedPostIds = new Set<string>()
  let bookmarkedPostIds = new Set<string>()

  if (viewerId && postIds.length > 0) {
    const userLikes = await db.select({ postId: postLikes.postId }).from(postLikes).where(and(eq(postLikes.userId, viewerId), inArray(postLikes.postId, postIds)))
    likedPostIds = new Set(userLikes.map((l) => l.postId))

    const userBookmarks = await db.select({ postId: postBookmarks.postId }).from(postBookmarks).where(and(eq(postBookmarks.userId, viewerId), inArray(postBookmarks.postId, postIds)))
    bookmarkedPostIds = new Set(userBookmarks.map((b) => b.postId))
  }

  // Get viewer's tip_sent transactions for these posts
  const tipsByPostId = new Map<string, { amount: number; createdAt: Date | string }>()
  if (viewerId && postIds.length > 0) {
    const userTips = await db
      .select({
        referenceId: fancoinTransactions.referenceId,
        amount: fancoinTransactions.amount,
        createdAt: fancoinTransactions.createdAt,
      })
      .from(fancoinTransactions)
      .where(
        and(
          eq(fancoinTransactions.userId, viewerId),
          eq(fancoinTransactions.type, 'tip_sent'),
          inArray(fancoinTransactions.referenceId, postIds),
        ),
      )
    for (const t of userTips) {
      if (!t.referenceId) continue
      const existing = tipsByPostId.get(t.referenceId)
      if (existing) {
        existing.amount += Math.abs(Number(t.amount))
        if (new Date(t.createdAt) > new Date(existing.createdAt)) {
          existing.createdAt = t.createdAt
        }
      } else {
        tipsByPostId.set(t.referenceId, { amount: Math.abs(Number(t.amount)), createdAt: t.createdAt })
      }
    }
  }

  // Check PPV unlocks
  const ppvPostIds = feedPosts.filter((p) => p.visibility === 'ppv').map((p) => p.id)
  const ppvUnlockedIds = new Set<string>()
  if (viewerId && ppvPostIds.length > 0) {
    const ppvPayments = await db
      .select({ metadata: payments.metadata })
      .from(payments)
      .where(
        and(
          eq(payments.userId, viewerId),
          eq(payments.type, 'ppv'),
          eq(payments.status, 'completed'),
        ),
      )
    for (const p of ppvPayments) {
      const postId = (p.metadata as any)?.postId
      if (postId && ppvPostIds.includes(postId)) ppvUnlockedIds.add(postId)
    }
  }

  const postsWithMedia = feedPosts.map((post) => {
    const postIsPublic = post.visibility === 'public'
    let hasAccess = isOwner || postIsPublic || hasSubscription
    if (!hasAccess && post.visibility === 'ppv') {
      hasAccess = ppvUnlockedIds.has(post.id)
    }
    const postMedia = allMedia.filter((m) => m.postId === post.id)

    return {
      ...post,
      // For locked posts: only show preview media, null out full storageKeys
      media: hasAccess
        ? postMedia
        : postMedia.map((m) => ({ ...m, storageKey: m.isPreview ? m.storageKey : null })),
      hasAccess,
      isLiked: likedPostIds.has(post.id),
      isBookmarked: bookmarkedPostIds.has(post.id),
      tipSent: tipsByPostId.get(post.id) || null,
    }
  })

  // Debug: log post visibility breakdown
  const visBreakdown = feedPosts.reduce((acc: Record<string, number>, p) => {
    acc[p.visibility] = (acc[p.visibility] || 0) + 1
    return acc
  }, {})
  console.log(`[getCreatorPosts] creatorId=${creatorId} viewerId=${viewerId || 'anonymous'} isOwner=${isOwner} total=${feedPosts.length} breakdown=`, visBreakdown)

  return { posts: postsWithMedia, total: feedPosts.length }
}

// Debug: raw count of posts by visibility for a creator
export async function getCreatorPostsDebug(creatorId: string) {
  const allPosts = await db
    .select({
      id: posts.id,
      visibility: posts.visibility,
      isVisible: posts.isVisible,
      isArchived: posts.isArchived,
      publishedAt: posts.publishedAt,
      contentText: posts.contentText,
    })
    .from(posts)
    .where(eq(posts.creatorId, creatorId))

  const breakdown = allPosts.reduce((acc: Record<string, number>, p) => {
    acc[p.visibility] = (acc[p.visibility] || 0) + 1
    return acc
  }, {})

  return {
    creatorId,
    totalInDb: allPosts.length,
    visibilityBreakdown: breakdown,
    archivedCount: allPosts.filter((p) => p.isArchived).length,
    hiddenCount: allPosts.filter((p) => !p.isVisible).length,
    posts: allPosts.map((p) => ({
      id: p.id,
      visibility: p.visibility,
      isVisible: p.isVisible,
      isArchived: p.isArchived,
      hasText: !!p.contentText,
    })),
  }
}

export async function updatePost(postId: string, creatorId: string, input: UpdatePostInput) {
  const [post] = await db
    .update(posts)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(posts.id, postId), eq(posts.creatorId, creatorId)))
    .returning()

  if (!post) throw new AppError('NOT_FOUND', 'Post nao encontrado', 404)
  return post
}

export async function togglePostVisibility(postId: string, creatorId: string) {
  const [post] = await db
    .select({ id: posts.id, isVisible: posts.isVisible })
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.creatorId, creatorId)))
    .limit(1)

  if (!post) throw new AppError('NOT_FOUND', 'Post nao encontrado', 404)

  const [updated] = await db
    .update(posts)
    .set({ isVisible: !post.isVisible, updatedAt: new Date() })
    .where(eq(posts.id, postId))
    .returning()

  return updated
}

export async function deletePost(postId: string, creatorId: string) {
  const [deleted] = await db
    .delete(posts)
    .where(and(eq(posts.id, postId), eq(posts.creatorId, creatorId)))
    .returning({ id: posts.id })

  if (!deleted) throw new AppError('NOT_FOUND', 'Post nao encontrado', 404)
  return deleted
}

export async function likePost(postId: string, userId: string) {
  const [existing] = await db
    .select()
    .from(postLikes)
    .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)))
    .limit(1)

  if (existing) {
    await db.delete(postLikes).where(and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)))
    await db.update(posts).set({ likeCount: sql`${posts.likeCount} - 1` }).where(eq(posts.id, postId))
    return { liked: false }
  }

  await db.insert(postLikes).values({ postId, userId })
  await db.update(posts).set({ likeCount: sql`${posts.likeCount} + 1` }).where(eq(posts.id, postId))
  return { liked: true }
}

export async function bookmarkPost(postId: string, userId: string) {
  const [existing] = await db
    .select()
    .from(postBookmarks)
    .where(and(eq(postBookmarks.postId, postId), eq(postBookmarks.userId, userId)))
    .limit(1)

  if (existing) {
    await db.delete(postBookmarks).where(and(eq(postBookmarks.postId, postId), eq(postBookmarks.userId, userId)))
    return { bookmarked: false }
  }

  await db.insert(postBookmarks).values({ postId, userId })
  return { bookmarked: true }
}

export async function getComments(postId: string, page = 1, limit = 20) {
  const offset = (page - 1) * limit

  const comments = await db
    .select({
      id: postComments.id,
      content: postComments.content,
      parentId: postComments.parentId,
      createdAt: postComments.createdAt,
      userId: postComments.userId,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(postComments)
    .innerJoin(users, eq(postComments.userId, users.id))
    .where(and(eq(postComments.postId, postId), eq(postComments.isHidden, false)))
    .orderBy(desc(postComments.createdAt))
    .limit(limit)
    .offset(offset)

  return comments
}

export async function addComment(postId: string, userId: string, content: string, parentId?: string) {
  const [comment] = await db
    .insert(postComments)
    .values({ postId, userId, content, parentId })
    .returning()

  await db.update(posts).set({ commentCount: sql`${posts.commentCount} + 1` }).where(eq(posts.id, postId))

  return comment
}

const VIEW_DEDUP_HOURS = 24

export async function viewPost(postId: string, userId?: string, ipAddress?: string) {
  if (!userId && !ipAddress) return { counted: false }

  const cutoff = new Date(Date.now() - VIEW_DEDUP_HOURS * 60 * 60 * 1000)

  // Check for existing view within dedup window
  const conditions = [eq(postViews.postId, postId), gt(postViews.viewedAt, cutoff)]
  if (userId) {
    conditions.push(eq(postViews.userId, userId))
  } else {
    conditions.push(eq(postViews.ipAddress, ipAddress!))
  }

  const [existing] = await db
    .select({ id: postViews.id })
    .from(postViews)
    .where(and(...conditions))
    .limit(1)

  if (existing) return { counted: false }

  // Record new view and increment counter
  await db.insert(postViews).values({
    postId,
    userId: userId || null,
    ipAddress: ipAddress || null,
  })
  await db.update(posts).set({ viewCount: sql`${posts.viewCount} + 1` }).where(eq(posts.id, postId))

  return { counted: true }
}

export async function sharePost(postId: string) {
  await db.update(posts).set({ shareCount: sql`${posts.shareCount} + 1` }).where(eq(posts.id, postId))
  return { shared: true }
}

export async function addMediaToPost(postId: string, mediaData: { mediaType: string; storageKey: string; thumbnailUrl?: string; duration?: number; width?: number; height?: number; fileSize?: number; isPreview?: boolean; sortOrder?: number; blurhash?: string }) {
  const [media] = await db
    .insert(postMedia)
    .values({ postId, ...mediaData })
    .returning()

  return media
}
