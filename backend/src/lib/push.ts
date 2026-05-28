/**
 * lib/push.ts — push-уведомления через Firebase Admin SDK
 *
 * В DEV-режиме (NODE_ENV !== 'production') уведомления логируются в консоль.
 * В PROD инициализирует Firebase Admin и отправляет через FCM/APNs.
 */

export interface PushPayload {
  title: string
  body:  string
  data?: Record<string, string>
}

let _messaging: any = null

async function getMessaging() {
  if (process.env.NODE_ENV !== 'production') return null

  if (!_messaging) {
    const admin = await import('firebase-admin')
    if (!admin.default.apps.length) {
      admin.default.initializeApp({
        credential: admin.default.credential.cert({
          projectId:   process.env.FIREBASE_PROJECT_ID,
          privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
      })
    }
    _messaging = admin.default.messaging()
  }
  return _messaging
}

export async function sendPush(tokens: string[], payload: PushPayload): Promise<void> {
  if (!tokens.length) return

  const messaging = await getMessaging()

  if (!messaging) {
    // DEV: просто логируем
    console.log(`[DEV] Push → ${tokens.length} устройств: "${payload.title}" — ${payload.body}`)
    return
  }

  const message = {
    tokens,
    notification: { title: payload.title, body: payload.body },
    data:          payload.data ?? {},
    android:       { priority: 'high' as const },
    apns:          { payload: { aps: { sound: 'default' } } },
  }

  const result = await messaging.sendEachForMulticast(message)

  // Возвращаем список невалидных токенов для удаления из БД
  const invalidTokens: string[] = []
  result.responses.forEach((resp: any, i: number) => {
    if (!resp.success && resp.error?.code === 'messaging/invalid-registration-token') {
      invalidTokens.push(tokens[i])
    }
  })

  return invalidTokens as any // Вызывающий код может удалить их из БД
}

export async function sendIntercomCall(tokens: string[], intercomId: string): Promise<void> {
  await sendPush(tokens, {
    title: 'Звонок в дверь',
    body:  'Нажмите чтобы ответить',
    data:  { type: 'INTERCOM_CALL', intercomId },
  })
}

export async function sendTicketUpdate(tokens: string[], ticketNumber: number, status: string): Promise<void> {
  await sendPush(tokens, {
    title: `Заявка #${ticketNumber}`,
    body:  `Статус изменён: ${status}`,
    data:  { type: 'TICKET_UPDATE', ticketNumber: String(ticketNumber) },
  })
}
