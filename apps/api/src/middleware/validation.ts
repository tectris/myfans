import { zValidator } from '@hono/zod-validator'
import type { ZodSchema } from 'zod'

export const validateBody = <T extends ZodSchema>(schema: T) =>
  zValidator('json', schema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Dados invalidos',
            details: result.error.flatten().fieldErrors,
          },
        },
        400,
      )
    }
  })

export const validateQuery = <T extends ZodSchema>(schema: T) =>
  zValidator('query', schema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Parametros invalidos',
            details: result.error.flatten().fieldErrors,
          },
        },
        400,
      )
    }
  })
