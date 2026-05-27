/**
 * lib/validator.ts — обёртка над zValidator с единым форматом ошибок API
 *
 * { error: { code: "VALIDATION_ERROR", message: "...", details: [...] } }
 */

import { zValidator as baseValidator } from '@hono/zod-validator'
import type { ZodSchema } from 'zod'

export function zValidator<T extends ZodSchema>(
  target: 'json' | 'query' | 'param' | 'form',
  schema: T,
) {
  return baseValidator(target, schema, (result, c) => {
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path:    issue.path.join('.'),
        message: issue.message,
      }))
      return c.json(
        {
          error: {
            code:    'VALIDATION_ERROR',
            message: details[0]?.message ?? 'Ошибка валидации',
            details,
          },
        },
        422,
      )
    }
  })
}
