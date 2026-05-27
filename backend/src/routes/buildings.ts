/**
 * routes/buildings.ts — Дома и Подъезды CRUD
 *
 * Дома:
 *   GET    /buildings                        → все дома организации (фильтр ?complexId=)
 *   GET    /buildings/:id                    → дом + подъезды
 *   POST   /buildings                        → создать дом
 *   PATCH  /buildings/:id                    → обновить дом
 *   DELETE /buildings/:id                    → удалить дом
 *
 * Подъезды:
 *   GET    /buildings/:id/entrances          → список подъездов дома
 *   POST   /buildings/:id/entrances          → добавить подъезд
 *   DELETE /buildings/:id/entrances/:entId   → удалить подъезд
 */

import { Hono } from 'hono'
import { zValidator } from '../lib/validator.ts'
import { createBuildingSchema, updateBuildingSchema, createEntranceSchema } from '../../../shared/schemas/building.schema.ts'
import { z } from 'zod'
import { buildingService } from '../services/building.service.ts'
import { authMiddleware } from '../middleware/auth.ts'
import { tenantMiddleware } from '../middleware/tenant.ts'
import { requireRole } from '../middleware/role.ts'
import { apiError } from '../lib/errors.ts'

export const buildingRoutes = new Hono()

const tenant  = [authMiddleware, tenantMiddleware]
const manager = [...tenant, requireRole('ORG_ADMIN', 'ORG_MANAGER', 'SUPER_ADMIN')]
const admin   = [...tenant, requireRole('ORG_ADMIN', 'SUPER_ADMIN')]

// ── Дома ─────────────────────────────────────────────────────────────────────

buildingRoutes.get('/', ...tenant, async (c) => {
  const complexId = c.req.query('complexId')
  if (!complexId) return apiError(c, 422, 'VALIDATION_ERROR', 'Требуется параметр complexId')
  try {
    const data = await buildingService.getAllByComplex(c.get('organizationId'), complexId)
    return c.json({ data })
  } catch {
    return apiError(c, 404, 'NOT_FOUND', 'ЖК не найден')
  }
})

buildingRoutes.get('/:id', ...tenant, async (c) => {
  try {
    const data = await buildingService.getById(c.get('organizationId'), c.req.param('id'))
    return c.json({ data })
  } catch {
    return apiError(c, 404, 'NOT_FOUND', 'Дом не найден')
  }
})

buildingRoutes.post('/', ...admin, zValidator('json', createBuildingSchema), async (c) => {
  try {
    const data = await buildingService.create(c.get('organizationId'), c.req.valid('json'))
    return c.json({ data }, 201)
  } catch {
    return apiError(c, 404, 'NOT_FOUND', 'ЖК не найден')
  }
})

buildingRoutes.patch('/:id', ...admin, zValidator('json', updateBuildingSchema), async (c) => {
  try {
    const data = await buildingService.update(c.get('organizationId'), c.req.param('id'), c.req.valid('json'))
    return c.json({ data })
  } catch {
    return apiError(c, 404, 'NOT_FOUND', 'Дом не найден')
  }
})

buildingRoutes.delete('/:id', ...admin, async (c) => {
  try {
    await buildingService.delete(c.get('organizationId'), c.req.param('id'))
    return c.json({ data: { success: true } })
  } catch {
    return apiError(c, 404, 'NOT_FOUND', 'Дом не найден')
  }
})

// ── Подъезды ──────────────────────────────────────────────────────────────────

buildingRoutes.get('/:id/entrances', ...tenant, async (c) => {
  try {
    const data = await buildingService.getEntrances(c.get('organizationId'), c.req.param('id'))
    return c.json({ data })
  } catch {
    return apiError(c, 404, 'NOT_FOUND', 'Дом не найден')
  }
})

buildingRoutes.post(
  '/:id/entrances',
  ...admin,
  zValidator('json', createEntranceSchema.omit({ buildingId: true })),
  async (c) => {
    try {
      const { number } = c.req.valid('json')
      const data = await buildingService.createEntrance(c.get('organizationId'), {
        buildingId: c.req.param('id'),
        number,
      })
      return c.json({ data }, 201)
    } catch (e: any) {
      if (e?.code === 'P2002') return apiError(c, 409, 'VALIDATION_ERROR', 'Подъезд с таким номером уже существует')
      return apiError(c, 404, 'NOT_FOUND', 'Дом не найден')
    }
  },
)

buildingRoutes.delete('/:id/entrances/:entId', ...admin, async (c) => {
  try {
    await buildingService.deleteEntrance(c.get('organizationId'), c.req.param('entId'))
    return c.json({ data: { success: true } })
  } catch {
    return apiError(c, 404, 'NOT_FOUND', 'Подъезд не найден')
  }
})
