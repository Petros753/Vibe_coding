/**
 * services/announcement.service.ts — Объявления УК
 *
 * При публикации:
 *   1. Статус меняется DRAFT → PUBLISHED
 *   2. Push-уведомление всем верифицированным жильцам организации
 *   3. Создаются Notification записи для каждого жильца
 */

import { prisma }                     from '../lib/prisma.ts'
import { sendPush }                   from '../lib/push.ts'
import { createNotificationsForUsers } from './notification.service.ts'
import type { CreateAnnouncementDto, UpdateAnnouncementDto } from '../../../shared/schemas/announcement.schema.ts'

export const announcementService = {

  async getAll(organizationId: string, opts?: {
    status?: string
    page?:   number
    limit?:  number
  }) {
    const page  = opts?.page  ?? 1
    const limit = opts?.limit ?? 20

    const where = {
      organizationId,
      ...(opts?.status && { status: opts.status as any }),
    }

    const [items, total] = await Promise.all([
      prisma.announcement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
      prisma.announcement.count({ where }),
    ])

    return { items, meta: { total, page, limit } }
  },

  async getById(organizationId: string, id: string) {
    return prisma.announcement.findFirstOrThrow({ where: { id, organizationId } })
  },

  async create(organizationId: string, data: CreateAnnouncementDto) {
    return prisma.announcement.create({
      data: { ...data, organizationId, status: 'DRAFT' },
    })
  },

  async update(organizationId: string, id: string, data: UpdateAnnouncementDto) {
    await prisma.announcement.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.announcement.update({ where: { id }, data })
  },

  async delete(organizationId: string, id: string) {
    await prisma.announcement.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.announcement.delete({ where: { id } })
  },

  /** Опубликовать + разослать push + создать уведомления */
  async publish(organizationId: string, id: string) {
    const announcement = await prisma.announcement.findFirstOrThrow({
      where: { id, organizationId },
    })

    if (announcement.status === 'PUBLISHED') {
      throw new AlreadyPublishedError()
    }

    const published = await prisma.announcement.update({
      where: { id },
      data:  { status: 'PUBLISHED', publishedAt: new Date() },
    })

    // Все уникальные верифицированные жильцы организации
    const residents = await prisma.apartmentResident.findMany({
      where:    { organizationId, isVerified: true },
      include:  { user: { include: { pushTokens: { select: { token: true } } } } },
      distinct: ['userId'],
    })

    const userIds   = [...new Set(residents.map(r => r.userId))]
    const allTokens = residents.flatMap(r => r.user.pushTokens.map(t => t.token))

    // Push
    if (allTokens.length) {
      await sendPush(allTokens, {
        title: published.title,
        body:  published.body.substring(0, 200),
        data:  { type: 'ANNOUNCEMENT', announcementId: id },
      })
    }

    // Notification в БД
    await createNotificationsForUsers(organizationId, userIds, {
      type:  'ANNOUNCEMENT',
      title: published.title,
      body:  published.body.substring(0, 200),
      data:  { announcementId: id },
    })

    return { announcement: published, notified: userIds.length }
  },
}

export class AlreadyPublishedError extends Error {
  constructor() { super('Объявление уже опубликовано'); this.name = 'AlreadyPublishedError' }
}
