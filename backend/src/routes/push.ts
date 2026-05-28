/**
 * routes/push.ts — Регистрация push-токенов устройств
 *
 * POST   /push/tokens            → зарегистрировать токен
 * DELETE /push/tokens/:token     → удалить токен (выход из устройства)
 * GET    /push/tokens            → список своих токенов
 */

import { Hono } from 'hono'
import { zValidator } from '../lib/validator.ts'
import { registerPushTokenSchema } from '../../../shared/schemas/push.schema.ts'
import { pushTokenService } from '../services/push-token.service.ts'
import { authMiddleware } from '../middleware/auth.ts'

export const pushRoutes = new Hono()

pushRoutes.post('/tokens', authMiddleware, zValidator('json', registerPushTokenSchema), async (c) => {
  const data = await pushTokenService.register(c.get('user').id, c.req.valid('json'))
  return c.json({ data }, 201)
})

pushRoutes.delete('/tokens/:token', authMiddleware, async (c) => {
  await pushTokenService.unregister(c.get('user').id, c.req.param('token'))
  return c.json({ data: { success: true } })
})

pushRoutes.get('/tokens', authMiddleware, async (c) => {
  const data = await pushTokenService.getByUser(c.get('user').id)
  return c.json({ data })
})
