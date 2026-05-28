/**
 * routes/announcements.ts — Объявления УК
 *
 * GET    /announcements                  → список (PUBLISHED для жильцов, все для сотрудников)
 * GET    /announcements/:id              → одно объявление
 * POST   /announcements                  → создать черновик (ORG_MANAGER+)
 * PATCH  /announcements/:id              → обновить черновик (ORG_MANAGER+)
 * POST   /announcements/:id/publish      → опубликовать + push всем жильцам (ORG_MANAGER+)
 * DELETE /announcements/:id              → удалить (ORG_ADMIN+)
 */

import { Hono } from 'hono'
import { zValidator } from '../lib/validator.ts'
import { createAnnouncementSchema, updateAnnouncementSchema } from '../../../shared/schemas/announcement.schema.ts'
import { announcementService, AlreadyPublishedError } from '../services/announcement.service.ts'
import { authMiddleware }   from '../middleware/auth.ts'
import { tenantMiddleware } from '../middleware/tenant.ts'
import { requireRole }      from '../middleware/role.ts'
import { apiError }         from '../lib/errors.ts'

export const announcementRoutes = new Hono()

const STAFF_ROLES = ['ORG_ADMIN', 'ORG_MANAGER', 'SUPER_ADMIN'] as const
const isStaff = (role: string) => STAFF_ROLES.includes(role as any)

const tenant  = [authMiddleware, tenantMiddleware]
const manager = [...tenant, requireRole('ORG_ADMIN', 'ORG_MANAGER', 'SUPER_ADMIN')]
const admin   = [...tenant, requireRole('ORG_ADMIN', 'SUPER_ADMIN')]

// ── Список ────────────────────────────────────────────────────────────────────

announcementRoutes.get('/', ...tenant, async (c) => {
  const user = c.get('user')
  const q    = c.req.query()

  // Жильцы видят только опубликованные
  const status = isStaff(user.role) ? q.status : 'PUBLISHED'

  const result = await announcementService.getAll(c.get('organizationId'), {
    status,
    page:  q.page  ? parseInt(q.page)  : undefined,
    limit: q.limit ? parseInt(q.limit) : undefined,
  })
  return c.json({ data: result.items, meta: result.meta })
})

// ── Одно объявление ────────────────────────────────────────────────────────────

announcementRoutes.get('/:id', ...tenant, async (c) => {
  try {
    const ann  = await announcementService.getById(c.get('organizationId'), c.req.param('id'))
    const user = c.get('user')
    // Черновик/архив — только сотрудники
    if (ann.status !== 'PUBLISHED' && !isStaff(user.role)) {
      return apiError(c, 404, 'NOT_FOUND', 'Объявление не найдено')
    }
    return c.json({ data: ann })
  } catch {
    return apiError(c, 404, 'NOT_FOUND', 'Объявление не найдено')
  }
})

// ── CRUD ──────────────────────────────────────────────────────────────────────

announcementRoutes.post('/', ...manager, zValidator('json', createAnnouncementSchema), async (c) => {
  const data = await announcementService.create(c.get('organizationId'), c.req.valid('json'))
  return c.json({ data }, 201)
})

announcementRoutes.patch('/:id', ...manager, zValidator('json', updateAnnouncementSchema), async (c) => {
  try {
    const data = await announcementService.update(c.get('organizationId'), c.req.param('id'), c.req.valid('json'))
    return c.json({ data })
  } catch {
    return apiError(c, 404, 'NOT_FOUND', 'Объявление не найдено')
  }
})

announcementRoutes.delete('/:id', ...admin, async (c) => {
  try {
    await announcementService.delete(c.get('organizationId'), c.req.param('id'))
    return c.json({ data: { success: true } })
  } catch {
    return apiError(c, 404, 'NOT_FOUND', 'Объявление не найдено')
  }
})

// ── Публикация + Push ──────────────────────────────────────────────────────────

announcementRoutes.post('/:id/publish', ...manager, async (c) => {
  try {
    const result = await announcementService.publish(c.get('organizationId'), c.req.param('id'))
    return c.json({ data: result })
  } catch (err) {
    if (err instanceof AlreadyPublishedError) {
      return apiError(c, 409, 'VALIDATION_ERROR', err.message)
    }
    return apiError(c, 404, 'NOT_FOUND', 'Объявление не найдено')
  }
})
