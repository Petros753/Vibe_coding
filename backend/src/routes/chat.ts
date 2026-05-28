/**
 * routes/chat.ts — Чат: история (REST) + реальное время (WebSocket)
 *
 * REST:
 *   GET /chat/rooms                    → список комнат пользователя
 *   GET /chat/:roomId/messages         → история (?limit=50&before=msgId)
 *
 * WebSocket:
 *   GET /chat/ws?token=<accessToken>   → upgrade to WebSocket
 *
 * WS протокол (JSON):
 *   Клиент → сервер:
 *     { type: "join",    chatRoomId: "complex_xxx" }
 *     { type: "message", chatRoomId: "complex_xxx", text: "...", mediaUrls?: [] }
 *     { type: "ping" }
 *
 *   Сервер → клиент:
 *     { type: "joined",   chatRoomId }
 *     { type: "error",    message }
 *     { type: "message",  chatRoomId, id, senderId, senderName, text, mediaUrls, createdAt }
 *     { type: "pong" }
 */

import { Hono }           from 'hono'
import { createBunWebSocket } from 'hono/bun'
import type { ServerWebSocket } from 'bun'
import { verifyAccessToken }   from '../lib/jwt.ts'
import { prisma }              from '../lib/prisma.ts'
import { chatService, checkChatAccess } from '../services/chat.service.ts'
import { authMiddleware }      from '../middleware/auth.ts'
import { tenantMiddleware }    from '../middleware/tenant.ts'
import { apiError }            from '../lib/errors.ts'

// ── WebSocket connection store ────────────────────────────────────────────────

interface WsClient {
  ws:    ServerWebSocket<unknown>
  userId:         string
  orgId:          string
  userRole:       string
  senderName:     string
  joinedRooms:    Set<string>
}

const clients = new Set<WsClient>()

function broadcastToRoom(roomId: string, payload: unknown, excludeWs?: ServerWebSocket<unknown>) {
  const json = JSON.stringify(payload)
  for (const client of clients) {
    if (client.joinedRooms.has(roomId) && client.ws !== excludeWs) {
      try { client.ws.send(json) } catch {}
    }
  }
}

// ── Hono WebSocket ────────────────────────────────────────────────────────────

export const { upgradeWebSocket, websocket } = createBunWebSocket<ServerWebSocket>()

export const chatRoutes = new Hono()

// ── REST: список комнат ────────────────────────────────────────────────────────

chatRoutes.get('/rooms', authMiddleware, tenantMiddleware, async (c) => {
  const user = c.get('user')
  const data = await chatService.getRooms(c.get('organizationId'), user.id, user.role)
  return c.json({ data })
})

// ── REST: история сообщений ────────────────────────────────────────────────────

chatRoutes.get('/:roomId/messages', authMiddleware, tenantMiddleware, async (c) => {
  const user    = c.get('user')
  const orgId   = c.get('organizationId')
  const roomId  = c.req.param('roomId')
  const q       = c.req.query()

  const hasAccess = await checkChatAccess(orgId, user.id, user.role, roomId)
  if (!hasAccess) return apiError(c, 403, 'AUTH_FORBIDDEN', 'Нет доступа к этой комнате')

  const messages = await chatService.getHistory(orgId, roomId, {
    limit:  q.limit ? parseInt(q.limit) : 50,
    before: q.before,
  })

  return c.json({ data: messages })
})

// ── WebSocket ─────────────────────────────────────────────────────────────────
// Аутентификация через ?token= в URL (не в заголовке — ограничение браузерного WS API)

chatRoutes.get(
  '/ws',
  upgradeWebSocket(async (c) => {
    // 1. Аутентификация: токен из query params
    const token = c.req.query('token')
    let authUser: { id: string; orgId: string; role: string } | null = null

    if (token) {
      try {
        const payload = verifyAccessToken(token)
        // Проверяем сессию
        const session = await prisma.session.findUnique({
          where:  { id: payload.sessionId },
          select: { isRevoked: true },
        })
        if (session && !session.isRevoked && payload.organizationId) {
          authUser = {
            id:    payload.sub,
            orgId: payload.organizationId,
            role:  payload.role,
          }
        }
      } catch {}
    }

    if (!authUser) {
      // WebSocket не поддерживает HTTP-коды при upgrade — закрываем соединение
      return {
        onOpen(_evt, ws) {
          ws.send(JSON.stringify({ type: 'error', message: 'Требуется авторизация' }))
          ws.close(4001, 'Unauthorized')
        },
      }
    }

    const { id: userId, orgId, role } = authUser

    // 2. Получаем имя пользователя
    const dbUser = await prisma.user.findUnique({
      where:  { id: userId },
      select: { firstName: true, lastName: true },
    })
    const senderName = [dbUser?.firstName, dbUser?.lastName].filter(Boolean).join(' ') || 'Пользователь'

    // 3. WS handlers
    const client: WsClient = {
      ws:          null as any, // заполним в onOpen
      userId,
      orgId,
      userRole:    role,
      senderName,
      joinedRooms: new Set(),
    }

    return {
      onOpen(_evt, ws) {
        client.ws = ws as any
        clients.add(client)
        ws.send(JSON.stringify({ type: 'connected', userId, senderName }))
      },

      async onMessage(evt, ws) {
        let msg: any
        try { msg = JSON.parse(evt.data as string) } catch {
          ws.send(JSON.stringify({ type: 'error', message: 'Невалидный JSON' }))
          return
        }

        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }))
          return
        }

        if (msg.type === 'join') {
          const roomId = msg.chatRoomId as string
          const ok = await checkChatAccess(orgId, userId, role, roomId)
          if (!ok) {
            ws.send(JSON.stringify({ type: 'error', message: 'Нет доступа к этой комнате' }))
            return
          }
          client.joinedRooms.add(roomId)
          ws.send(JSON.stringify({ type: 'joined', chatRoomId: roomId }))
          return
        }

        if (msg.type === 'message') {
          const roomId    = msg.chatRoomId as string
          const text      = (msg.text      as string | undefined)?.trim()
          const mediaUrls = (msg.mediaUrls as string[] | undefined) ?? []

          if (!text && !mediaUrls.length) {
            ws.send(JSON.stringify({ type: 'error', message: 'Сообщение пустое' }))
            return
          }

          if (!client.joinedRooms.has(roomId)) {
            ws.send(JSON.stringify({ type: 'error', message: 'Сначала выполните join' }))
            return
          }

          // Сохраняем в БД
          const saved = await chatService.saveMessage(orgId, roomId, userId, text, mediaUrls)

          const outbound = {
            type:        'message',
            chatRoomId:  roomId,
            id:          saved.id,
            senderId:    userId,
            senderName,
            senderRole:  role,
            text:        saved.text,
            mediaUrls:   saved.mediaUrls,
            createdAt:   saved.createdAt,
          }

          // Отправляем отправителю (подтверждение)
          ws.send(JSON.stringify({ ...outbound, own: true }))

          // Рассылаем остальным в комнате
          broadcastToRoom(roomId, outbound, ws as any)
          return
        }

        ws.send(JSON.stringify({ type: 'error', message: `Неизвестный тип: ${msg.type}` }))
      },

      onClose() {
        clients.delete(client)
      },

      onError(err) {
        console.error('[WS error]', err)
        clients.delete(client)
      },
    }
  }),
)
