/**
 * routes/auth.ts — HTTP-слой авторизации (тонкие роуты)
 *
 * POST /auth/send-otp    { phone }                → { success: true }
 * POST /auth/verify-otp  { phone, code }           → { accessToken, refreshToken, user }
 * POST /auth/refresh     { refreshToken }           → { accessToken, refreshToken }
 * POST /auth/logout      Bearer <token>             → { success: true }
 */

import { Hono } from 'hono'
import { zValidator } from '../lib/validator.ts'
import { sendOtpSchema, verifyOtpSchema, refreshTokenSchema } from '../../../shared/schemas/auth.schema.ts'
import {
  sendOtpService,
  verifyOtpService,
  refreshService,
  logoutService,
  OtpInvalidError,
  OtpTooManyAttemptsError,
  UnauthorizedError,
} from '../services/auth.service.ts'
import { authMiddleware } from '../middleware/auth.ts'
import { apiError } from '../lib/errors.ts'

export const authRoutes = new Hono()

// ── POST /auth/send-otp ──────────────────────────────────────────────────────

authRoutes.post('/send-otp', zValidator('json', sendOtpSchema), async (c) => {
  const { phone } = c.req.valid('json')

  try {
    await sendOtpService(phone)
    return c.json({ data: { success: true } })
  } catch (err) {
    if (err instanceof OtpTooManyAttemptsError) {
      return apiError(c, 429, 'AUTH_TOO_MANY_ATTEMPTS', err.message)
    }
    console.error('[send-otp]', err)
    return apiError(c, 500, 'INTERNAL_ERROR', 'Не удалось отправить SMS')
  }
})

// ── POST /auth/verify-otp ────────────────────────────────────────────────────

authRoutes.post('/verify-otp', zValidator('json', verifyOtpSchema), async (c) => {
  const { phone, code } = c.req.valid('json')

  try {
    const result = await verifyOtpService(phone, code, {
      userAgent: c.req.header('User-Agent'),
      ipAddress: c.req.header('X-Forwarded-For') ?? c.req.header('CF-Connecting-IP'),
    })
    return c.json({ data: result }, 200)
  } catch (err) {
    if (err instanceof OtpTooManyAttemptsError) {
      return apiError(c, 429, 'AUTH_TOO_MANY_ATTEMPTS', err.message)
    }
    if (err instanceof OtpInvalidError) {
      return apiError(c, 400, 'AUTH_INVALID_OTP', err.message)
    }
    console.error('[verify-otp]', err)
    return apiError(c, 500, 'INTERNAL_ERROR', 'Ошибка верификации')
  }
})

// ── POST /auth/refresh ───────────────────────────────────────────────────────

authRoutes.post('/refresh', zValidator('json', refreshTokenSchema), async (c) => {
  const { refreshToken } = c.req.valid('json')

  try {
    const tokens = await refreshService(refreshToken)
    return c.json({ data: tokens })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return apiError(c, 401, 'AUTH_UNAUTHORIZED', err.message)
    }
    console.error('[refresh]', err)
    return apiError(c, 500, 'INTERNAL_ERROR', 'Ошибка обновления токена')
  }
})

// ── POST /auth/logout ────────────────────────────────────────────────────────

authRoutes.post('/logout', authMiddleware, async (c) => {
  const { sessionId } = c.get('user')
  await logoutService(sessionId)
  return c.json({ data: { success: true } })
})

// ── GET /auth/me ─────────────────────────────────────────────────────────────

authRoutes.get('/me', authMiddleware, async (c) => {
  const user = c.get('user')
  return c.json({ data: user })
})
