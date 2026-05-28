/**
 * routes/notifications.ts — История уведомлений пользователя
 *
 * GET   /notifications            → список (?isRead=false, ?page=, ?limit=)
 * PATCH /notifications/read       → отметить прочитанными { ids: [...] }
 * PATCH /notifications/read-all   → отметить все прочитанными
 */

import { Hono } from 'hono'
import { zValidator } from '../lib/validator.ts'
import { markReadSchema } from '../../../shared/schemas/notification.schema.ts'
import { notificationService } from '../services/notification.service.ts'
import { authMiddleware }   from '../middleware/auth.ts'
import { tenantMiddleware } from '../middleware/tenant.ts'

export const notificationRoutes = new Hono()

const tenant = [authMiddleware, tenantMiddleware]

notificationRoutes.get('/', ...tenant, async (c) => {
  const q       = c.req.query()
  const isRead  = q.isRead !== undefined ? q.isRead === 'true' : undefined

  const result = await notificationService.getAll(
    c.get('organizationId'),
    c.get('user').id,
    {
      isRead,
      page:  q.page  ? parseInt(q.page)  : undefined,
      limit: q.limit ? parseInt(q.limit) : undefined,
    },
  )
  return c.json({ data: result.items, meta: result.meta })
})

notificationRoutes.patch(
  '/read',
  ...tenant,
  zValidator('json', markReadSchema),
  async (c) => {
    const { ids } = c.req.valid('json')
    const result  = await notificationService.markRead(
      c.get('organizationId'),
      c.get('user').id,
      ids,
    )
    return c.json({ data: result })
  },
)

notificationRoutes.patch('/read-all', ...tenant, async (c) => {
  const result = await notificationService.markAllRead(
    c.get('organizationId'),
    c.get('user').id,
  )
  return c.json({ data: result })
})
