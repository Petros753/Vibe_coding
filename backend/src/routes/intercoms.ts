/**
 * routes/intercoms.ts — Домофоны
 *
 * GET    /intercoms                → список (?entranceId=)
 * GET    /intercoms/:id            → домофон
 * POST   /intercoms                → добавить (ORG_ADMIN+)
 * PATCH  /intercoms/:id            → обновить (ORG_ADMIN+)
 * DELETE /intercoms/:id            → удалить (ORG_ADMIN+)
 *
 * POST   /intercoms/:id/call       → входящий звонок от домофона (без auth — webhook)
 * POST   /intercoms/:id/open       → открыть дверь (жилец своего подъезда)
 */

import { Hono } from 'hono'
import { zValidator } from '../lib/validator.ts'
import { createIntercomSchema, updateIntercomSchema } from '../../../shared/schemas/intercom.schema.ts'
import { intercomService, AccessDeniedError, IntercomHttpError } from '../services/intercom.service.ts'
import { authMiddleware } from '../middleware/auth.ts'
import { tenantMiddleware } from '../middleware/tenant.ts'
import { requireRole } from '../middleware/role.ts'
import { apiError } from '../lib/errors.ts'

export const intercomRoutes = new Hono()

const tenant = [authMiddleware, tenantMiddleware]
const admin  = [...tenant, requireRole('ORG_ADMIN', 'SUPER_ADMIN')]

intercomRoutes.get('/', ...tenant, async (c) => {
  const data = await intercomService.getAll(c.get('organizationId'), c.req.query('entranceId'))
  return c.json({ data })
})

intercomRoutes.get('/:id', ...tenant, async (c) => {
  try {
    const data = await intercomService.getById(c.get('organizationId'), c.req.param('id'))
    return c.json({ data })
  } catch {
    return apiError(c, 404, 'NOT_FOUND', 'Домофон не найден')
  }
})

intercomRoutes.post('/', ...admin, zValidator('json', createIntercomSchema), async (c) => {
  try {
    const data = await intercomService.create(c.get('organizationId'), c.req.valid('json'))
    return c.json({ data }, 201)
  } catch {
    return apiError(c, 404, 'NOT_FOUND', 'Подъезд не найден')
  }
})

intercomRoutes.patch('/:id', ...admin, zValidator('json', updateIntercomSchema), async (c) => {
  try {
    const data = await intercomService.update(c.get('organizationId'), c.req.param('id'), c.req.valid('json'))
    return c.json({ data })
  } catch {
    return apiError(c, 404, 'NOT_FOUND', 'Домофон не найден')
  }
})

intercomRoutes.delete('/:id', ...admin, async (c) => {
  try {
    await intercomService.delete(c.get('organizationId'), c.req.param('id'))
    return c.json({ data: { success: true } })
  } catch {
    return apiError(c, 404, 'NOT_FOUND', 'Домофон не найден')
  }
})

// ── Webhook входящего звонка (вызывается домофоном, без JWT) ──────────────────
// Защита: orgId в пути — домофон должен знать свой organizationId
// В продакшне добавить HMAC подпись от домофона

intercomRoutes.post('/:id/call', async (c) => {
  // orgId берём из header X-Org-Id (домофон передаёт при настройке)
  const orgId = c.req.header('X-Org-Id')
  if (!orgId) return apiError(c, 400, 'VALIDATION_ERROR', 'Заголовок X-Org-Id обязателен')

  try {
    const result = await intercomService.handleCall(orgId, c.req.param('id'))
    return c.json({ data: result })
  } catch (err: any) {
    console.error('[intercom/call]', err)
    return apiError(c, 404, 'NOT_FOUND', 'Домофон не найден')
  }
})

// ── Открытие двери (аутентифицированный жилец) ────────────────────────────────

intercomRoutes.post('/:id/open', ...tenant, async (c) => {
  try {
    await intercomService.openDoor(c.get('organizationId'), c.req.param('id'), c.get('user').id)
    return c.json({ data: { success: true } })
  } catch (err) {
    if (err instanceof AccessDeniedError)  return apiError(c, 403, 'AUTH_FORBIDDEN', err.message)
    if (err instanceof IntercomHttpError)  return apiError(c, 502, 'INTERNAL_ERROR', err.message)
    return apiError(c, 404, 'NOT_FOUND', 'Домофон не найден')
  }
})
