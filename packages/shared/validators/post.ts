import { z } from 'zod'

export const createPostSchema = z.object({
  contentText: z.string().max(5000).optional(),
  postType: z.enum(['regular', 'poll', 'scheduled', 'ppv']).default('regular'),
  visibility: z.enum(['public', 'subscribers', 'ppv']).default('subscribers'),
  tierId: z.string().uuid().optional(),
  ppvPrice: z.number().min(1).max(10000).optional(),
  scheduledAt: z.string().datetime().optional(),
  media: z
    .array(
      z.object({
        key: z.string(),
        mediaType: z.string(),
      }),
    )
    .optional(),
})

export const updatePostSchema = z.object({
  contentText: z.string().max(5000).optional(),
  visibility: z.enum(['public', 'subscribers', 'ppv']).optional(),
  isPinned: z.boolean().optional(),
  isArchived: z.boolean().optional(),
})

export const createCommentSchema = z.object({
  content: z.string().min(1).max(1000),
  parentId: z.string().uuid().optional(),
})

export type CreatePostInput = z.infer<typeof createPostSchema>
export type UpdatePostInput = z.infer<typeof updatePostSchema>
export type CreateCommentInput = z.infer<typeof createCommentSchema>
