/**
 * routes/auth.ts — HTTP-слой авторизации (тонкие роуты)
 *
 * POST /auth/send-otp    { phone }                → { success: true }
 * POST /auth/verify-otp  { phone, code }           → { accessToken, refreshToken, user }
 * POST /auth/refresh     { refreshToken }           → { accessToken, refreshToken }
 * POST /auth/logout      Bearer <token>             → { success: true }
 * POST /auth/firebase    { idToken }                → { accessToken, refreshToken, user }
 */

import { Hono } from 'hono'
import { zValidator } from '../lib/validator.ts'
import { sendOtpSchema, verifyOtpSchema, refreshTokenSchema } from '../../../shared/schemas/auth.schema.ts'
import {
  sendOtpService,
  verifyOtpService,
  refreshService,
  logoutService,
  createSession,
  OtpInvalidError,
  OtpTooManyAttemptsError,
  UnauthorizedError,
} from '../services/auth.service.ts'
import { authMiddleware } from '../middleware/auth.ts'
import { tenantMiddleware } from '../middleware/tenant.ts'
import { prisma } from '../lib/prisma.ts'
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

// ── GET /auth/profile ────────────────────────────────────────────────────────

authRoutes.get('/profile', authMiddleware, tenantMiddleware, async (c) => {
  const { id: userId, organizationId } = c.get('user')

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id:        true,
      firstName: true,
      lastName:  true,
      phone:     true,
      role:      true,
      apartments: {
        where:   { organizationId },
        select: {
          id:            true,
          apartmentId:   true,
          isVerified:   true,
          accessLevel:  true,
          apartment: {
            select: {
              number:   true,
              entrance: {
                select: {
                  number:   true,
                  building: {
                    select: {
                      address: true,
                      complex: { select: { id: true, name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!user) return apiError(c, 404, 'NOT_FOUND', 'Пользователь не найден')

  const { apartments: residents, ...rest } = user
  return c.json({ data: { ...rest, residents } })
})

// ── POST /auth/firebase ──────────────────────────────────────────────────────

authRoutes.post('/firebase', async (c) => {
  const { idToken } = await c.req.json()
  if (!idToken) return apiError(c, 400, 'INVALID_REQUEST', 'idToken required')

  try {
    const { firebaseAuth } = await import('../lib/firebase.ts')
    const decoded = await firebaseAuth.verifyIdToken(idToken)
    const phone = decoded.phone_number
    if (!phone) return apiError(c, 400, 'INVALID_TOKEN', 'No phone in token')

    const user = await prisma.user.upsert({
      where:  { phone },
      update: {},
      create: { phone },
    })

    const result = await createSession(user, {
      userAgent: c.req.header('User-Agent'),
      ipAddress: c.req.header('X-Forwarded-For') ?? c.req.header('CF-Connecting-IP'),
    })

    return c.json({ data: result }, 200)
  } catch (err) {
    console.error('[firebase-auth]', err)
    return apiError(c, 401, 'AUTH_FIREBASE_FAILED', 'Firebase token verification failed')
  }
})