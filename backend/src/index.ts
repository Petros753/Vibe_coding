import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import { prettyJSON } from 'hono/pretty-json'
import { authRoutes }         from './routes/auth.ts'
import { organizationRoutes } from './routes/organizations.ts'
import { complexRoutes }      from './routes/complexes.ts'
import { buildingRoutes }     from './routes/buildings.ts'
import { apartmentRoutes }    from './routes/apartments.ts'
import { residentRoutes }     from './routes/residents.ts'
import { ticketRoutes }       from './routes/tickets.ts'
import { meterRoutes }        from './routes/meters.ts'
import { cameraRoutes }       from './routes/cameras.ts'
import { intercomRoutes }     from './routes/intercoms.ts'
import { pushRoutes }         from './routes/push.ts'
import { announcementRoutes } from './routes/announcements.ts'
import { notificationRoutes } from './routes/notifications.ts'
import { chatRoutes, websocket } from './routes/chat.ts'

const app = new Hono()

app.use('*', logger())
app.use('*', cors())
app.use('*', prettyJSON())

// ── Health ─────────────────────────────────────────────────────────────────────

app.get('/', (c) =>
  c.json({ name: 'МойДом API', version: '1.0.0', status: 'ok', timestamp: new Date().toISOString() }),
)
app.get('/health', (c) => c.json({ status: 'healthy' }))

// ── Фаза 1: Авторизация ────────────────────────────────────────────────────────

app.route('/auth', authRoutes)

// ── Фаза 2: Структура ЖК ──────────────────────────────────────────────────────

app.route('/organizations', organizationRoutes)
app.route('/complexes',     complexRoutes)
app.route('/buildings',     buildingRoutes)
app.route('/apartments',    apartmentRoutes)
app.route('/residents',     residentRoutes)

// ── Фаза 3: Основные функции ───────────────────────────────────────────────────

app.route('/tickets',   ticketRoutes)
app.route('/meters',    meterRoutes)
app.route('/cameras',   cameraRoutes)
app.route('/intercoms', intercomRoutes)
app.route('/push',      pushRoutes)

// ── Фаза 4: Коммуникации ───────────────────────────────────────────────────────

app.route('/announcements', announcementRoutes)
app.route('/notifications', notificationRoutes)
app.route('/chat',          chatRoutes)   // REST + WS на /chat/ws

// ── 404 / Error ────────────────────────────────────────────────────────────────

app.notFound((c) =>
  c.json({ error: { code: 'NOT_FOUND', message: 'Маршрут не найден' } }, 404),
)

app.onError((err, c) => {
  console.error('[UNHANDLED]', err)
  return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Внутренняя ошибка сервера' } }, 500)
})

const port = parseInt(process.env.PORT ?? '3000')
console.log(`🚀 МойДом API запущен на http://localhost:${port}`)
console.log(`💬 WebSocket чат: ws://localhost:${port}/chat/ws?token=<JWT>`)

export default { port, fetch: app.fetch, websocket }
