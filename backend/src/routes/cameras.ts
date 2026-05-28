/**
 * routes/cameras.ts — Камеры видеонаблюдения
 *
 * GET    /cameras                → список (фильтры: entranceId, buildingId, complexId)
 * GET    /cameras/my             → камеры доступные текущему жильцу
 * GET    /cameras/:id            → камера + streamUrl
 * POST   /cameras                → добавить камеру (ORG_ADMIN+)
 * PATCH  /cameras/:id            → обновить (ORG_ADMIN+)
 * DELETE /cameras/:id            → удалить (ORG_ADMIN+)
 *
 * ВАЖНО: rtspUrl НИКОГДА не возвращается клиенту — только streamUrl (WebRTC WHEP)
 */

import { Hono } from 'hono'
import { zValidator } from '../lib/validator.ts'
import { createCameraSchema, updateCameraSchema } from '../../../shared/schemas/camera.schema.ts'
import { cameraService } from '../services/camera.service.ts'
import { authMiddleware } from '../middleware/auth.ts'
import { tenantMiddleware } from '../middleware/tenant.ts'
import { requireRole } from '../middleware/role.ts'
import { apiError } from '../lib/errors.ts'

export const cameraRoutes = new Hono()

const tenant = [authMiddleware, tenantMiddleware]
const admin  = [...tenant, requireRole('ORG_ADMIN', 'SUPER_ADMIN')]

// ── Камеры для жильца ─────────────────────────────────────────────────────────

cameraRoutes.get('/my', ...tenant, async (c) => {
  const data = await cameraService.getForResident(c.get('organizationId'), c.get('user').id)
  return c.json({ data })
})

// ── CRUD ────────────────────────────────────────────────────────────────────────

cameraRoutes.get('/', ...tenant, requireRole('ORG_ADMIN', 'ORG_MANAGER', 'SUPER_ADMIN'), async (c) => {
  const q = c.req.query()
  const data = await cameraService.getAll(c.get('organizationId'), {
    entranceId: q.entranceId,
    buildingId: q.buildingId,
    complexId:  q.complexId,
  })
  return c.json({ data })
})

cameraRoutes.get('/:id', ...tenant, requireRole('ORG_ADMIN', 'ORG_MANAGER', 'SUPER_ADMIN'), async (c) => {
  try {
    const data = await cameraService.getById(c.get('organizationId'), c.req.param('id'))
    return c.json({ data })
  } catch {
    return apiError(c, 404, 'NOT_FOUND', 'Камера не найдена')
  }
})

cameraRoutes.post('/', ...admin, zValidator('json', createCameraSchema), async (c) => {
  try {
    const data = await cameraService.create(c.get('organizationId'), c.req.valid('json'))
    return c.json({ data }, 201)
  } catch (err: any) {
    if (err?.name === 'PrismaClientKnownRequestError') {
      return apiError(c, 404, 'NOT_FOUND', 'Указанный объект (подъезд/дом/ЖК) не найден')
    }
    throw err
  }
})

cameraRoutes.patch('/:id', ...admin, zValidator('json', updateCameraSchema), async (c) => {
  try {
    const data = await cameraService.update(c.get('organizationId'), c.req.param('id'), c.req.valid('json'))
    return c.json({ data })
  } catch {
    return apiError(c, 404, 'NOT_FOUND', 'Камера не найдена')
  }
})

cameraRoutes.delete('/:id', ...admin, async (c) => {
  try {
    await cameraService.delete(c.get('organizationId'), c.req.param('id'))
    return c.json({ data: { success: true } })
  } catch {
    return apiError(c, 404, 'NOT_FOUND', 'Камера не найдена')
  }
})
