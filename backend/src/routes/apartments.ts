/**
 * routes/apartments.ts — Квартиры CRUD
 *
 * GET    /apartments               → список (фильтр ?entranceId=)
 * GET    /apartments/:id           → квартира + жильцы + счётчики
 * POST   /apartments               → создать
 * PATCH  /apartments/:id           → обновить
 * DELETE /apartments/:id           → удалить
 *
 * Жильцы квартиры:
 * GET    /apartments/:id/residents → список жильцов
 * POST   /apartments/:id/residents → добавить жильца
 */

import { Hono } from 'hono'
import { zValidator } from '../lib/validator.ts'
import { createApartmentSchema, updateApartmentSchema } from '../../../shared/schemas/apartment.schema.ts'
import { addResidentSchema } from '../../../shared/schemas/resident.schema.ts'
import { apartmentService } from '../services/apartment.service.ts'
import { residentService } from '../services/resident.service.ts'
import { authMiddleware } from '../middleware/auth.ts'
import { tenantMiddleware } from '../middleware/tenant.ts'
import { requireRole } from '../middleware/role.ts'
import { apiError } from '../lib/errors.ts'

export const apartmentRoutes = new Hono()

const tenant  = [authMiddleware, tenantMiddleware]
const manager = [...tenant, requireRole('ORG_ADMIN', 'ORG_MANAGER', 'SUPER_ADMIN')]
const admin   = [...tenant, requireRole('ORG_ADMIN', 'SUPER_ADMIN')]

// ── Квартиры ──────────────────────────────────────────────────────────────────

apartmentRoutes.get('/', ...tenant, async (c) => {
  const entranceId = c.req.query('entranceId')
  if (!entranceId) return apiError(c, 422, 'VALIDATION_ERROR', 'Требуется параметр entranceId')
  try {
    const data = await apartmentService.getAllByEntrance(c.get('organizationId'), entranceId)
    return c.json({ data })
  } catch {
    return apiError(c, 404, 'NOT_FOUND', 'Подъезд не найден')
  }
})

apartmentRoutes.get('/:id', ...tenant, async (c) => {
  try {
    const data = await apartmentService.getById(c.get('organizationId'), c.req.param('id'))
    return c.json({ data })
  } catch {
    return apiError(c, 404, 'NOT_FOUND', 'Квартира не найдена')
  }
})

apartmentRoutes.post('/', ...admin, zValidator('json', createApartmentSchema), async (c) => {
  try {
    const data = await apartmentService.create(c.get('organizationId'), c.req.valid('json'))
    return c.json({ data }, 201)
  } catch (e: any) {
    if (e?.code === 'P2002') return apiError(c, 409, 'VALIDATION_ERROR', 'Квартира с таким номером уже существует в этом подъезде')
    return apiError(c, 404, 'NOT_FOUND', 'Подъезд не найден')
  }
})

apartmentRoutes.patch('/:id', ...admin, zValidator('json', updateApartmentSchema), async (c) => {
  try {
    const data = await apartmentService.update(c.get('organizationId'), c.req.param('id'), c.req.valid('json'))
    return c.json({ data })
  } catch {
    return apiError(c, 404, 'NOT_FOUND', 'Квартира не найдена')
  }
})

apartmentRoutes.delete('/:id', ...admin, async (c) => {
  try {
    await apartmentService.delete(c.get('organizationId'), c.req.param('id'))
    return c.json({ data: { success: true } })
  } catch {
    return apiError(c, 404, 'NOT_FOUND', 'Квартира не найдена')
  }
})

// ── Жильцы квартиры ───────────────────────────────────────────────────────────

apartmentRoutes.get('/:id/residents', ...tenant, async (c) => {
  try {
    const data = await residentService.getByApartment(c.get('organizationId'), c.req.param('id'))
    return c.json({ data })
  } catch {
    return apiError(c, 404, 'NOT_FOUND', 'Квартира не найдена')
  }
})

apartmentRoutes.post(
  '/:id/residents',
  ...manager,
  zValidator('json', addResidentSchema.omit({ apartmentId: true })),
  async (c) => {
    try {
      const body = c.req.valid('json')
      const data = await residentService.add(c.get('organizationId'), {
        ...body,
        apartmentId: c.req.param('id'),
      })
      return c.json({ data }, 201)
    } catch {
      return apiError(c, 404, 'NOT_FOUND', 'Квартира не найдена')
    }
  },
)
