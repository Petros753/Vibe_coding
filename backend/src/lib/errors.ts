/**
 * lib/errors.ts — стандартные коды и хелпер для ошибок API
 */

import type { Context } from 'hono'

export type ErrorCode =
  | 'AUTH_INVALID_OTP'
  | 'AUTH_TOO_MANY_ATTEMPTS'
  | 'AUTH_UNAUTHORIZED'
  | 'AUTH_FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'TENANT_MISMATCH'
  | 'INTERNAL_ERROR'

export function apiError(
  c: Context,
  status: 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500,
  code: ErrorCode,
  message: string,
  details?: unknown,
) {
  return c.json({ error: { code, message, details } }, status)
}

/** Обёртка для async route handlers — ловит неожиданные ошибки */
export function tryCatch<T>(fn: () => Promise<T>, c: Context): Promise<T | Response> {
  return fn().catch((err) => {
    console.error('[ERROR]', err)
    return apiError(c, 500, 'INTERNAL_ERROR', 'Внутренняя ошибка сервера') as never
  })
}
