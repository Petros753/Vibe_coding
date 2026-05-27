/**
 * routes/organizations.ts — Organizations CRUD (только SUPER_ADMIN)
 *
 * GET    /organizations          → список всех УК
 * GET    /organizations/:id      → конкретная УК
 * POST   /organizations          → создать УК
 * PATCH  /organizations/:id      → обновить УК
 * DELETE /organizations/:id      → удалить УК
 */

import { Hono } from 'hono'
import { zValidator } from '../lib/validator.ts'
import { createOrganizationSchema, updateOrganizationSchema } from '../../../shared/schemas/organization.schema.ts'
import { organizationService } from '../services/organization.service.ts'
import { authMiddleware } from '../middleware/auth.ts'
import { requireRole } from '../middleware/role.ts'
import { apiError } from '../lib/errors.ts'

export const organizationRoutes = new Hono()

const superAdmin = [authMiddleware, requireRole('SUPER_ADMIN')]

organizationRoutes.get('/', ...superAdmin, async (c) => {
  const orgs = await organizationService.getAll()
  return c.json({ data: orgs })
})

organizationRoutes.get('/:id', ...superAdmin, async (c) => {
  try {
    const org = await organizationService.getById(c.req.param('id'))
    return c.json({ data: org })
  } catch {
    return apiError(c, 404, 'NOT_FOUND', 'Организация не найдена')
  }
})

organizationRoutes.post('/', ...superAdmin, zValidator('json', createOrganizationSchema), async (c) => {
  const body = c.req.valid('json')
  const org  = await organizationService.create(body)
  return c.json({ data: org }, 201)
})

organizationRoutes.patch('/:id', ...superAdmin, zValidator('json', updateOrganizationSchema), async (c) => {
  try {
    const org = await organizationService.update(c.req.param('id'), c.req.valid('json'))
    return c.json({ data: org })
  } catch {
    return apiError(c, 404, 'NOT_FOUND', 'Организация не найдена')
  }
})

organizationRoutes.delete('/:id', ...superAdmin, async (c) => {
  try {
    await organizationService.delete(c.req.param('id'))
    return c.json({ data: { success: true } })
  } catch {
    return apiError(c, 404, 'NOT_FOUND', 'Организация не найдена')
  }
})
