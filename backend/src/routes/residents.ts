/**
 * routes/residents.ts — управление жильцами организации
 *
 * GET    /residents                     → список всех жильцов (?apartmentId= ?isVerified=)
 * PATCH  /residents/:id/verify          → верифицировать / снять верификацию
 * DELETE /residents/:id                 → удалить жильца из квартиры
 */

import { Hono } from 'hono'
import { zValidator } from '../lib/validator.ts'
import { verifyResidentSchema } from '../../../shared/schemas/resident.schema.ts'
import { residentService } from '../services/resident.service.ts'
import { authMiddleware } from '../middleware/auth.ts'
import { tenantMiddleware } from '../middleware/tenant.ts'
import { requireRole } from '../middleware/role.ts'
import { apiError } from '../lib/errors.ts'

export const residentRoutes = new Hono()

const tenant  = [authMiddleware, tenantMiddleware]
const manager = [...tenant, requireRole('ORG_ADMIN', 'ORG_MANAGER', 'SUPER_ADMIN')]
const admin   = [...tenant, requireRole('ORG_ADMIN', 'SUPER_ADMIN')]

residentRoutes.get('/', ...manager, async (c) => {
  const apartmentId = c.req.query('apartmentId')
  const isVerifiedRaw = c.req.query('isVerified')
  const isVerified = isVerifiedRaw !== undefined ? isVerifiedRaw === 'true' : undefined

  const data = await residentService.getAll(c.get('organizationId'), { apartmentId, isVerified })
  return c.json({ data })
})

residentRoutes.patch(
  '/:id/verify',
  ...manager,
  zValidator('json', verifyResidentSchema),
  async (c) => {
    try {
      const { isVerified } = c.req.valid('json')
      const data = await residentService.verify(c.get('organizationId'), c.req.param('id'), isVerified)
      return c.json({ data })
    } catch {
      return apiError(c, 404, 'NOT_FOUND', 'Жилец не найден')
    }
  },
)

residentRoutes.delete('/:id', ...admin, async (c) => {
  try {
    await residentService.remove(c.get('organizationId'), c.req.param('id'))
    return c.json({ data: { success: true } })
  } catch {
    return apiError(c, 404, 'NOT_FOUND', 'Жилец не найден')
  }
})
