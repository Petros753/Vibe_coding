/**
 * middleware/role.ts — проверка роли (RBAC)
 *
 * Использование:
 *   router.post('/', authMiddleware, requireRole('ORG_ADMIN', 'SUPER_ADMIN'), handler)
 */

import type { Context, Next } from 'hono'
import { apiError } from '../lib/errors.ts'
import type { Role } from '@prisma/client'

export function requireRole(...roles: Role[]) {
  return async (c: Context, next: Next) => {
    const user = c.get('user')
    if (!roles.includes(user.role as Role)) {
      return apiError(c, 403, 'AUTH_FORBIDDEN', `Требуется роль: ${roles.join(' | ')}`)
    }
    await next()
  }
}
