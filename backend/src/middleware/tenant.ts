/**
 * middleware/tenant.ts — пробрасывает organizationId из JWT в context
 *
 * Правила:
 *   • SUPER_ADMIN может работать без organizationId
 *   • Все остальные роли обязаны иметь organizationId в токене
 *
 * Устанавливает c.set('organizationId', ...) для дальнейшего использования
 * во всех Prisma-запросах.
 */

import type { Context, Next } from 'hono'
import { apiError } from '../lib/errors.ts'

export async function tenantMiddleware(c: Context, next: Next) {
  const user = c.get('user')

  if (user.role === 'SUPER_ADMIN') {
    // SUPER_ADMIN: organizationId может быть null — это ок
    c.set('organizationId', user.organizationId ?? '')
    await next()
    return
  }

  if (!user.organizationId) {
    return apiError(
      c,
      403,
      'AUTH_FORBIDDEN',
      'Пользователь не привязан к организации',
    )
  }

  c.set('organizationId', user.organizationId)
  await next()
}
