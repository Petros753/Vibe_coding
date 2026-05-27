/**
 * middleware/auth.ts — проверяет Bearer JWT в заголовке Authorization
 *
 * Устанавливает в context:
 *   c.set('user', { id, organizationId, role, sessionId })
 *
 * При ошибке возвращает 401 AUTH_UNAUTHORIZED.
 */

import type { Context, Next } from 'hono'
import { verifyAccessToken } from '../lib/jwt.ts'
import { apiError } from '../lib/errors.ts'
import { prisma } from '../lib/prisma.ts'

export interface AuthUser {
  id: string
  organizationId: string | null
  role: string
  sessionId: string
}

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser
    organizationId: string
  }
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return apiError(c, 401, 'AUTH_UNAUTHORIZED', 'Требуется авторизация')
  }

  const token = authHeader.slice(7)

  try {
    const payload = verifyAccessToken(token)

    // Проверяем, что сессия не отозвана (опционально — можно кэшировать в Redis)
    const session = await prisma.session.findUnique({
      where: { id: payload.sessionId },
      select: { isRevoked: true },
    })

    if (!session || session.isRevoked) {
      return apiError(c, 401, 'AUTH_UNAUTHORIZED', 'Сессия завершена')
    }

    c.set('user', {
      id: payload.sub,
      organizationId: payload.organizationId,
      role: payload.role,
      sessionId: payload.sessionId,
    })
  } catch {
    return apiError(c, 401, 'AUTH_UNAUTHORIZED', 'Невалидный или истёкший токен')
  }

  await next()
}
