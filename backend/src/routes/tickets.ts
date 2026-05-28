/**
 * routes/tickets.ts — Заявки в УК
 *
 * GET    /tickets                         → список (фильтры: status, category, page, limit)
 * GET    /tickets/:id                     → заявка + комментарии
 * POST   /tickets                         → создать заявку (любой авторизованный)
 * PATCH  /tickets/:id/status              → сменить статус (ORG_MANAGER+)
 * POST   /tickets/:id/comments            → добавить комментарий
 * DELETE /tickets/:id/comments/:commentId → удалить комментарий
 */

import { Hono } from 'hono'
import { zValidator } from '../lib/validator.ts'
import { createTicketSchema, updateTicketStatusSchema, createTicketCommentSchema } from '../../../shared/schemas/ticket.schema.ts'
import { ticketService, ForbiddenError } from '../services/ticket.service.ts'
import { authMiddleware } from '../middleware/auth.ts'
import { tenantMiddleware } from '../middleware/tenant.ts'
import { requireRole } from '../middleware/role.ts'
import { apiError } from '../lib/errors.ts'

export const ticketRoutes = new Hono()

const STAFF_ROLES = ['ORG_ADMIN', 'ORG_MANAGER', 'SUPER_ADMIN'] as const
const isStaff = (role: string) => STAFF_ROLES.includes(role as any)

const tenant  = [authMiddleware, tenantMiddleware]
const staff   = [...tenant, requireRole('ORG_ADMIN', 'ORG_MANAGER', 'SUPER_ADMIN')]

// ── Список заявок ─────────────────────────────────────────────────────────────

ticketRoutes.get('/', ...tenant, async (c) => {
  const user = c.get('user')
  const orgId = c.get('organizationId')
  const q = c.req.query()

  // Жильцы видят только свои заявки
  const creatorId = isStaff(user.role) ? q.creatorId : user.id

  const result = await ticketService.getAll(orgId, {
    status:     q.status,
    category:   q.category,
    assigneeId: q.assigneeId,
    creatorId,
    page:       q.page   ? parseInt(q.page)  : undefined,
    limit:      q.limit  ? parseInt(q.limit) : undefined,
  })
  return c.json({ data: result.items, meta: result.meta })
})

// ── Одна заявка ───────────────────────────────────────────────────────────────

ticketRoutes.get('/:id', ...tenant, async (c) => {
  const user = c.get('user')
  try {
    const ticket = await ticketService.getById(c.get('organizationId'), c.req.param('id'), isStaff(user.role))
    // Жилец может видеть только свою заявку
    if (!isStaff(user.role) && ticket.creatorId !== user.id) {
      return apiError(c, 403, 'AUTH_FORBIDDEN', 'Нет доступа к этой заявке')
    }
    return c.json({ data: ticket })
  } catch {
    return apiError(c, 404, 'NOT_FOUND', 'Заявка не найдена')
  }
})

// ── Создать заявку ────────────────────────────────────────────────────────────

ticketRoutes.post('/', ...tenant, zValidator('json', createTicketSchema), async (c) => {
  const data = await ticketService.create(c.get('organizationId'), c.get('user').id, c.req.valid('json'))
  return c.json({ data }, 201)
})

// ── Сменить статус ────────────────────────────────────────────────────────────

ticketRoutes.patch('/:id/status', ...staff, zValidator('json', updateTicketStatusSchema), async (c) => {
  try {
    const data = await ticketService.updateStatus(c.get('organizationId'), c.req.param('id'), c.req.valid('json'))
    return c.json({ data })
  } catch {
    return apiError(c, 404, 'NOT_FOUND', 'Заявка не найдена')
  }
})

// ── Комментарии ───────────────────────────────────────────────────────────────

ticketRoutes.post(
  '/:id/comments',
  ...tenant,
  zValidator('json', createTicketCommentSchema),
  async (c) => {
    const user = c.get('user')
    const body = c.req.valid('json')

    // isInternal = true только для сотрудников
    if (body.isInternal && !isStaff(user.role)) {
      return apiError(c, 403, 'AUTH_FORBIDDEN', 'Внутренние комментарии — только для сотрудников УК')
    }

    try {
      const data = await ticketService.addComment(
        c.get('organizationId'),
        c.req.param('id'),
        user.id,
        body,
      )
      return c.json({ data }, 201)
    } catch {
      return apiError(c, 404, 'NOT_FOUND', 'Заявка не найдена')
    }
  },
)

ticketRoutes.delete('/:id/comments/:commentId', ...tenant, async (c) => {
  const user = c.get('user')
  try {
    await ticketService.deleteComment(
      c.get('organizationId'),
      c.req.param('commentId'),
      user.id,
      isStaff(user.role),
    )
    return c.json({ data: { success: true } })
  } catch (err) {
    if (err instanceof ForbiddenError) return apiError(c, 403, 'AUTH_FORBIDDEN', err.message)
    return apiError(c, 404, 'NOT_FOUND', 'Комментарий не найден')
  }
})
