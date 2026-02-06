import { z } from 'zod'

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  country: z.string().length(2).optional(),
  language: z.string().max(5).optional(),
  timezone: z.string().max(50).optional(),
})

export const updateSettingsSchema = z.object({
  notificationEmail: z.boolean().optional(),
  notificationPush: z.boolean().optional(),
  notificationMessages: z.boolean().optional(),
  privacyShowOnline: z.boolean().optional(),
  privacyShowActivity: z.boolean().optional(),
  theme: z.enum(['light', 'dark', 'auto']).optional(),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>
