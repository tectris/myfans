import { eq, desc, and, or, sql, inArray } from 'drizzle-orm'
import { posts, postMedia, postLikes, postComments, postBookmarks, subscriptions, users, creatorProfiles } from '@myfans/database'
import { db } from '../config/database'
import { AppError } from './auth.service'
import type { CreatePostInput, UpdatePostInput } from '@myfans/shared'

export async function createPost(creatorId: string, input: CreatePostInput) {
  // Block media upload for users without KYC verification
  if (input.media && input.media.length > 0) {
    const [creator] = await db
      .select({ kycStatus: users.kycStatus })
      .from(users)
      .where(eq(users.id, creatorId))
      .limit(1)

    if (!creator || creator.kycStatus !== 'approved') {
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
    } else if (!hasAccess) {
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

  if (creatorIds.length === 0) {
    return { posts: [], total: 0 }
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
      publishedAt: posts.publishedAt,
      creatorUsername: users.username,
      creatorDisplayName: users.displayName,
      creatorAvatarUrl: users.avatarUrl,
    })
    .from(posts)
    .innerJoin(users, eq(posts.creatorId, users.id))
    .where(
      and(
        inArray(posts.creatorId, creatorIds),
        eq(posts.isArchived, false),
        or(eq(posts.isVisible, true), eq(posts.creatorId, userId)),
      ),
    )
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

  const postsWithMedia = feedPosts.map((post) => ({
    ...post,
    media: allMedia.filter((m) => m.postId === post.id),
    isLiked: likedPostIds.has(post.id),
    isBookmarked: bookmarkedPostIds.has(post.id),
  }))

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
  }))

  return { posts: postsWithMedia, total: feedPosts.length }
}

export async function getCreatorPosts(creatorId: string, viewerId?: string, page = 1, limit = 20) {
  const offset = (page - 1) * limit
  const isOwner = viewerId === creatorId

  const conditions = [eq(posts.creatorId, creatorId), eq(posts.isArchived, false)]
  if (!isOwner) {
    conditions.push(eq(posts.visibility, 'public'))
    conditions.push(eq(posts.isVisible, true))
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

  let likedPostIds = new Set<string>()
  let bookmarkedPostIds = new Set<string>()

  if (viewerId && postIds.length > 0) {
    const userLikes = await db.select({ postId: postLikes.postId }).from(postLikes).where(and(eq(postLikes.userId, viewerId), inArray(postLikes.postId, postIds)))
    likedPostIds = new Set(userLikes.map((l) => l.postId))

    const userBookmarks = await db.select({ postId: postBookmarks.postId }).from(postBookmarks).where(and(eq(postBookmarks.userId, viewerId), inArray(postBookmarks.postId, postIds)))
    bookmarkedPostIds = new Set(userBookmarks.map((b) => b.postId))
  }

  const postsWithMedia = feedPosts.map((post) => ({
    ...post,
    media: allMedia.filter((m) => m.postId === post.id),
    isLiked: likedPostIds.has(post.id),
    isBookmarked: bookmarkedPostIds.has(post.id),
  }))

  return { posts: postsWithMedia, total: feedPosts.length }
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

export async function addMediaToPost(postId: string, mediaData: { mediaType: string; storageKey: string; thumbnailUrl?: string; duration?: number; width?: number; height?: number; fileSize?: number; isPreview?: boolean; sortOrder?: number; blurhash?: string }) {
  const [media] = await db
    .insert(postMedia)
    .values({ postId, ...mediaData })
    .returning()

  return media
}
