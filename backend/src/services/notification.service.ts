/**
 * services/notification.service.ts — История уведомлений
 *
 * Уведомления создаются другими сервисами (объявления, заявки, чат).
 * Этот сервис предоставляет чтение + отметку прочитанным.
 */

import { prisma } from '../lib/prisma.ts'
import type { NotificationType } from '@prisma/client'

export interface CreateNotificationData {
  type:  NotificationType
  title: string
  body:  string
  data?: Record<string, unknown>
}

export const notificationService = {

  async getAll(organizationId: string, userId: string, opts?: {
    isRead?: boolean
    page?:   number
    limit?:  number
  }) {
    const page  = opts?.page  ?? 1
    const limit = opts?.limit ?? 30

    const where = {
      organizationId,
      userId,
      ...(opts?.isRead !== undefined && { isRead: opts.isRead }),
    }

    const [items, total, unread] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { organizationId, userId, isRead: false } }),
    ])

    return { items, meta: { total, page, limit, unread } }
  },

  async markRead(organizationId: string, userId: string, ids: string[]) {
    const result = await prisma.notification.updateMany({
      where: { id: { in: ids }, organizationId, userId, isRead: false },
      data:  { isRead: true, readAt: new Date() },
    })
    return { updated: result.count }
  },

  async markAllRead(organizationId: string, userId: string) {
    const result = await prisma.notification.updateMany({
      where: { organizationId, userId, isRead: false },
      data:  { isRead: true, readAt: new Date() },
    })
    return { updated: result.count }
  },
}

/** Хелпер: создать уведомления сразу для нескольких пользователей */
export async function createNotificationsForUsers(
  organizationId: string,
  userIds:         string[],
  data:            CreateNotificationData,
) {
  if (!userIds.length) return

  await prisma.notification.createMany({
    data: userIds.map(userId => ({
      organizationId,
      userId,
      type:  data.type,
      title: data.title,
      body:  data.body,
      data:  data.data ?? {},
    })),
    skipDuplicates: true,
  })
}
