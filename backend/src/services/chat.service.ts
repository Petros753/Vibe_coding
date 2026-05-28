/**
 * services/chat.service.ts — Чат: история сообщений + доступ
 *
 * Типы комнат:
 *   complex_{id}        — общедомовой чат всех жильцов ЖК + сотрудников
 *   entrance_{id}       — чат подъезда
 *   apartment_{id}_uk   — личный чат квартиры с УК
 *
 * Права доступа:
 *   complex:    верифицированные жильцы этого ЖК + сотрудники орг.
 *   entrance:   жильцы этого подъезда + сотрудники
 *   apartment_uk: жилец этой квартиры + сотрудники
 */

import { prisma } from '../lib/prisma.ts'

const STAFF = new Set(['ORG_ADMIN', 'ORG_MANAGER', 'SUPER_ADMIN'])

// ── Доступ ─────────────────────────────────────────────────────────────────────

export async function checkChatAccess(
  organizationId: string,
  userId:         string,
  userRole:       string,
  chatRoomId:     string,
): Promise<boolean> {
  if (STAFF.has(userRole)) return true  // сотрудники имеют доступ ко всем чатам

  if (chatRoomId.startsWith('complex_')) {
    const complexId = chatRoomId.replace('complex_', '')
    const res = await prisma.apartmentResident.findFirst({
      where: {
        organizationId, userId, isVerified: true,
        apartment: { entrance: { building: { complexId } } },
      },
    })
    return !!res

  } else if (chatRoomId.startsWith('entrance_')) {
    const entranceId = chatRoomId.replace('entrance_', '')
    const res = await prisma.apartmentResident.findFirst({
      where: {
        organizationId, userId, isVerified: true,
        apartment: { entranceId },
      },
    })
    return !!res

  } else if (chatRoomId.startsWith('apartment_') && chatRoomId.endsWith('_uk')) {
    const apartmentId = chatRoomId.replace('apartment_', '').replace('_uk', '')
    const res = await prisma.apartmentResident.findFirst({
      where: { organizationId, userId, apartmentId },
    })
    return !!res
  }

  return false
}

// ── История сообщений ──────────────────────────────────────────────────────────

export const chatService = {

  async getHistory(
    organizationId: string,
    chatRoomId:     string,
    opts?: { limit?: number; before?: string },
  ) {
    const limit = opts?.limit ?? 50

    const where: any = { organizationId, chatRoomId }
    if (opts?.before) {
      const pivot = await prisma.chatMessage.findUnique({ where: { id: opts.before } })
      if (pivot) where.createdAt = { lt: pivot.createdAt }
    }

    const messages = await prisma.chatMessage.findMany({
      where,
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take:    limit,
    })

    return messages.reverse() // хронологический порядок
  },

  async saveMessage(
    organizationId: string,
    chatRoomId:     string,
    senderId:       string,
    text?:          string,
    mediaUrls?:     string[],
  ) {
    return prisma.chatMessage.create({
      data: {
        organizationId,
        chatRoomId,
        senderId,
        text:      text ?? null,
        mediaUrls: mediaUrls ?? [],
      },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true, role: true },
        },
      },
    })
  },

  /** Список комнат доступных пользователю (с последним сообщением) */
  async getRooms(organizationId: string, userId: string, userRole: string) {
    // Для сотрудников: все комнаты ЖК организации
    if (STAFF.has(userRole)) {
      const complexes = await prisma.complex.findMany({
        where: { organizationId },
        select: { id: true, name: true },
      })

      return complexes.map(c => ({
        id:   `complex_${c.id}`,
        name: c.name,
        type: 'complex',
      }))
    }

    // Для жильцов: все комнаты к которым есть доступ
    const residencies = await prisma.apartmentResident.findMany({
      where: { organizationId, userId },
      include: {
        apartment: {
          include: {
            entrance: {
              include: { building: { include: { complex: true } } },
            },
          },
        },
      },
    })

    const rooms: Array<{ id: string; name: string; type: string }> = []
    const addedComplexes  = new Set<string>()
    const addedEntrances  = new Set<string>()
    const addedApartments = new Set<string>()

    for (const r of residencies) {
      const { entrance } = r.apartment
      const { building }  = entrance
      const { complex }   = building

      // ЖК-чат
      if (!addedComplexes.has(complex.id)) {
        rooms.push({ id: `complex_${complex.id}`, name: `${complex.name} — общий`, type: 'complex' })
        addedComplexes.add(complex.id)
      }
      // Подъездный чат
      if (!addedEntrances.has(entrance.id)) {
        rooms.push({ id: `entrance_${entrance.id}`, name: `Подъезд #${entrance.number}`, type: 'entrance' })
        addedEntrances.add(entrance.id)
      }
      // Личный чат с УК
      if (!addedApartments.has(r.apartmentId)) {
        rooms.push({ id: `apartment_${r.apartmentId}_uk`, name: `Кв. ${r.apartment.number} — УК`, type: 'apartment_uk' })
        addedApartments.add(r.apartmentId)
      }
    }

    return rooms
  },
}
