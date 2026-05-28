/**
 * routes/meters.ts — Счётчики и показания
 *
 * GET    /meters?apartmentId=          → счётчики квартиры
 * GET    /meters/:id                   → счётчик + последние показания
 * POST   /meters                       → создать счётчик (ORG_ADMIN+)
 * DELETE /meters/:id                   → деактивировать (ORG_ADMIN+)
 *
 * GET    /meters/:id/readings          → история показаний
 * POST   /meters/:id/readings          → сдать показания (жилец своей кв. / ORG_MANAGER+)
 *
 * GET    /meters/pending?period=YYYY-MM → счётчики без показания за период (ORG_MANAGER+)
 */

import { Hono } from 'hono'
import { zValidator } from '../lib/validator.ts'
import { createMeterSchema, submitReadingSchema } from '../../../shared/schemas/meter.schema.ts'
import { meterService, InvalidReadingError } from '../services/meter.service.ts'
import { authMiddleware } from '../middleware/auth.ts'
import { tenantMiddleware } from '../middleware/tenant.ts'
import { requireRole } from '../middleware/role.ts'
import { apiError } from '../lib/errors.ts'
import { prisma } from '../lib/prisma.ts'

export const meterRoutes = new Hono()

const tenant  = [authMiddleware, tenantMiddleware]
const manager = [...tenant, requireRole('ORG_ADMIN', 'ORG_MANAGER', 'SUPER_ADMIN')]
const admin   = [...tenant, requireRole('ORG_ADMIN', 'SUPER_ADMIN')]

// ── Ожидающие показания (до /:id чтобы не перехватило) ────────────────────────

meterRoutes.get('/pending', ...manager, async (c) => {
  const period = c.req.query('period')
  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    return apiError(c, 422, 'VALIDATION_ERROR', 'Параметр period обязателен (формат: YYYY-MM)')
  }
  const data = await meterService.getPendingReadings(c.get('organizationId'), period)
  return c.json({ data })
})

// ── Счётчики ──────────────────────────────────────────────────────────────────

meterRoutes.get('/', ...tenant, async (c) => {
  const apartmentId = c.req.query('apartmentId')
  if (!apartmentId) return apiError(c, 422, 'VALIDATION_ERROR', 'Требуется параметр apartmentId')
  try {
    const data = await meterService.getByApartment(c.get('organizationId'), apartmentId)
    return c.json({ data })
  } catch {
    return apiError(c, 404, 'NOT_FOUND', 'Квартира не найдена')
  }
})

meterRoutes.get('/:id', ...tenant, async (c) => {
  try {
    const data = await meterService.getById(c.get('organizationId'), c.req.param('id'))
    return c.json({ data })
  } catch {
    return apiError(c, 404, 'NOT_FOUND', 'Счётчик не найден')
  }
})

meterRoutes.post('/', ...admin, zValidator('json', createMeterSchema), async (c) => {
  try {
    const data = await meterService.create(c.get('organizationId'), c.req.valid('json'))
    return c.json({ data }, 201)
  } catch {
    return apiError(c, 404, 'NOT_FOUND', 'Квартира не найдена')
  }
})

meterRoutes.delete('/:id', ...admin, async (c) => {
  try {
    const data = await meterService.deactivate(c.get('organizationId'), c.req.param('id'))
    return c.json({ data })
  } catch {
    return apiError(c, 404, 'NOT_FOUND', 'Счётчик не найден')
  }
})

// ── Показания ─────────────────────────────────────────────────────────────────

meterRoutes.get('/:id/readings', ...tenant, async (c) => {
  try {
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 12
    const data  = await meterService.getReadings(c.get('organizationId'), c.req.param('id'), limit)
    return c.json({ data })
  } catch {
    return apiError(c, 404, 'NOT_FOUND', 'Счётчик не найден')
  }
})

meterRoutes.post('/:id/readings', ...tenant, zValidator('json', submitReadingSchema), async (c) => {
  const user  = c.get('user')
  const orgId = c.get('organizationId')
  const meterId = c.req.param('id')

  // Жилец может сдавать показания только для своей квартиры
  if (user.role === 'RESIDENT') {
    const meter = await prisma.meter.findFirst({
      where: { id: meterId, organizationId: orgId },
      include: { apartment: { include: { residents: { where: { userId: user.id } } } } },
    })
    if (!meter || !meter.apartment.residents.length) {
      return apiError(c, 403, 'AUTH_FORBIDDEN', 'Нет доступа к этому счётчику')
    }
  }

  try {
    const data = await meterService.submitReading(orgId, meterId, c.req.valid('json'))
    return c.json({ data }, 201)
  } catch (err) {
    if (err instanceof InvalidReadingError) return apiError(c, 422, 'VALIDATION_ERROR', err.message)
    return apiError(c, 404, 'NOT_FOUND', 'Счётчик не найден')
  }
})
