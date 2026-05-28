/**
 * services/intercom.service.ts — Домофоны
 *
 * Флоу входящего звонка:
 *   1. Домофон → HTTP webhook → POST /intercoms/:id/call
 *   2. Сервер находит жильцов подъезда → push-токены → sendIntercomCall()
 *   3. Жилец нажимает "Открыть" → POST /intercoms/:id/open
 *   4. Сервер делает HTTP запрос к контроллеру домофона
 *
 * Доступ к открытию:
 *   • Только жилец своего подъезда с isVerified = true
 */

import { prisma }           from '../lib/prisma.ts'
import { sendIntercomCall } from '../lib/push.ts'
import type { CreateIntercomDto, UpdateIntercomDto } from '../../../shared/schemas/intercom.schema.ts'

export const intercomService = {

  // ── CRUD ────────────────────────────────────────────────────────────────────

  async getAll(organizationId: string, entranceId?: string) {
    return prisma.intercom.findMany({
      where:   { organizationId, ...(entranceId && { entranceId }) },
      select:  { id: true, name: true, model: true, isActive: true, entranceId: true, createdAt: true },
      orderBy: { name: 'asc' },
    })
  },

  async getById(organizationId: string, id: string) {
    // Никогда не отдаём httpOpenToken и sipPassword клиенту
    return prisma.intercom.findFirstOrThrow({
      where:  { id, organizationId },
      select: { id: true, name: true, model: true, isActive: true, entranceId: true,
                httpOpenUrl: true, sipLogin: true, createdAt: true, updatedAt: true },
    })
  },

  async create(organizationId: string, data: CreateIntercomDto) {
    await prisma.entrance.findFirstOrThrow({ where: { id: data.entranceId, organizationId } })
    return prisma.intercom.create({
      data:   { ...data, organizationId },
      select: { id: true, name: true, model: true, isActive: true, entranceId: true },
    })
  },

  async update(organizationId: string, id: string, data: UpdateIntercomDto) {
    await prisma.intercom.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.intercom.update({
      where:  { id },
      data,
      select: { id: true, name: true, model: true, isActive: true, entranceId: true },
    })
  },

  async delete(organizationId: string, id: string) {
    await prisma.intercom.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.intercom.delete({ where: { id } })
  },

  // ── Входящий звонок (webhook от домофона) ──────────────────────────────────

  async handleCall(organizationId: string, intercomId: string) {
    const intercom = await prisma.intercom.findFirstOrThrow({
      where: { id: intercomId, organizationId, isActive: true },
    })

    // Логируем звонок
    const callLog = await prisma.intercomCallLog.create({
      data: { intercomId },
    })

    // Находим жильцов подъезда с верификацией
    const residents = await prisma.apartmentResident.findMany({
      where: {
        organizationId,
        isVerified: true,
        apartment:  { entrance: { intercoms: { some: { id: intercomId } } } },
      },
      include: {
        user: {
          include: { pushTokens: { select: { token: true } } },
        },
      },
    })

    const tokens = residents.flatMap(r => r.user.pushTokens.map(t => t.token))

    if (tokens.length > 0) {
      await sendIntercomCall(tokens, intercomId)
    }

    return { callLogId: callLog.id, notified: tokens.length }
  },

  // ── Открытие двери ─────────────────────────────────────────────────────────

  async openDoor(organizationId: string, intercomId: string, userId: string): Promise<void> {
    const intercom = await prisma.intercom.findFirstOrThrow({
      where: { id: intercomId, organizationId, isActive: true },
    })

    // Проверяем право доступа: жилец должен быть в подъезде домофона
    const hasAccess = await prisma.apartmentResident.findFirst({
      where: {
        organizationId,
        userId,
        isVerified: true,
        apartment:  { entrance: { intercoms: { some: { id: intercomId } } } },
      },
    })

    if (!hasAccess) {
      throw new AccessDeniedError('Нет доступа к этому домофону')
    }

    // HTTP запрос к контроллеру домофона
    if (intercom.httpOpenUrl && process.env.NODE_ENV === 'production') {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (intercom.httpOpenToken) headers['Authorization'] = `Bearer ${intercom.httpOpenToken}`

      try {
        const res = await fetch(intercom.httpOpenUrl, { method: 'POST', headers })
        if (!res.ok) throw new Error(`Домофон вернул ошибку: ${res.status}`)
      } catch (fetchErr) {
        throw new IntercomHttpError(`Не удалось связаться с домофоном: ${(fetchErr as Error).message}`)
      }
    } else {
      // DEV: просто логируем, не делаем реальный HTTP запрос
      console.log(`[DEV] Дверь открыта: intercom=${intercomId} (${intercom.httpOpenUrl}) user=${userId}`)
    }

    // Помечаем звонок как открытый
    await prisma.intercomCallLog.updateMany({
      where: { intercomId, openedAt: null },
      data:  { openedAt: new Date() },
    })
  },
}

export class AccessDeniedError extends Error {
  constructor(msg: string) { super(msg); this.name = 'AccessDeniedError' }
}

export class IntercomHttpError extends Error {
  constructor(msg: string) { super(msg); this.name = 'IntercomHttpError' }
}
