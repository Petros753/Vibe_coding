/**
 * routes/complexes.ts — ЖК CRUD
 *
 * GET    /complexes              → список ЖК организации
 * GET    /complexes/:id          → один ЖК с деревом объектов
 * POST   /complexes              → создать ЖК (ORG_ADMIN+)
 * PATCH  /complexes/:id          → обновить (ORG_ADMIN+)
 * DELETE /complexes/:id          → удалить (ORG_ADMIN)
 */

import { Hono } from 'hono'
import { zValidator } from '../lib/validator.ts'
import { createComplexSchema } from '../../../shared/schemas/complex.schema.ts'
import { z } from 'zod'
import { complexService } from '../services/complex.service.ts'
import { authMiddleware } from '../middleware/auth.ts'
import { tenantMiddleware } from '../middleware/tenant.ts'
import { requireRole } from '../middleware/role.ts'
import { apiError } from '../lib/errors.ts'

export const complexRoutes = new Hono()

const tenant  = [authMiddleware, tenantMiddleware]
const manager = [...tenant, requireRole('ORG_ADMIN', 'ORG_MANAGER', 'SUPER_ADMIN')]
const admin   = [...tenant, requireRole('ORG_ADMIN', 'SUPER_ADMIN')]

complexRoutes.get('/', ...tenant, async (c) => {
  const data = await complexService.getAll(c.get('organizationId'))
  return c.json({ data })
})

complexRoutes.get('/:id', ...tenant, async (c) => {
  try {
    const data = await complexService.getById(c.get('organizationId'), c.req.param('id'))
    return c.json({ data })
  } catch {
    return apiError(c, 404, 'NOT_FOUND', 'ЖК не найден')
  }
})

complexRoutes.post('/', ...admin, zValidator('json', createComplexSchema), async (c) => {
  const data = await complexService.create(c.get('organizationId'), c.req.valid('json'))
  return c.json({ data }, 201)
})

complexRoutes.patch('/:id', ...admin, zValidator('json', createComplexSchema.partial()), async (c) => {
  try {
    const data = await complexService.update(c.get('organizationId'), c.req.param('id'), c.req.valid('json'))
    return c.json({ data })
  } catch {
    return apiError(c, 404, 'NOT_FOUND', 'ЖК не найден')
  }
})

complexRoutes.delete('/:id', ...admin, async (c) => {
  try {
    await complexService.delete(c.get('organizationId'), c.req.param('id'))
    return c.json({ data: { success: true } })
  } catch {
    return apiError(c, 404, 'NOT_FOUND', 'ЖК не найден')
  }
})
