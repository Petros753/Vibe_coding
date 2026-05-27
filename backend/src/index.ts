import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import { prettyJSON } from 'hono/pretty-json'

const app = new Hono()

app.use('*', logger())
app.use('*', cors())
app.use('*', prettyJSON())

app.get('/', (c) => {
  return c.json({
    name: 'МойДом API',
    version: '1.0.0',
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
})

app.get('/health', (c) => {
  return c.json({ status: 'healthy' })
})

// TODO: подключить роуты
// app.route('/auth', authRoutes)
// app.route('/complexes', complexRoutes)
// app.route('/tickets', ticketRoutes)

const port = parseInt(process.env.PORT ?? '3000')
console.log(`🚀 МойДом API запущен на порту ${port}`)

export default {
  port,
  fetch: app.fetch,
}
