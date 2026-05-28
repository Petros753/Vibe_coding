/**
 * services/camera.service.ts — Камеры видеонаблюдения
 *
 * Безопасность:
 *   • rtspUrl хранится зашифрованным (AES-256) — поле rtspUrlEncrypted
 *   • Клиент НИКОГДА не получает rtspUrl — только streamUrl (WebRTC WHEP endpoint)
 *
 * Доступ жильца:
 *   • Камеры своего подъезда — всегда
 *   • Камеры ЖК (общие зоны, без entranceId) — всегда
 *   • Камеры чужих подъездов — нет
 */

import { prisma }         from '../lib/prisma.ts'
import { encryptRtspUrl } from '../lib/crypto.ts'
import { getStreamUrl }   from '../lib/stream.ts'
import type { CreateCameraDto, UpdateCameraDto } from '../../../shared/schemas/camera.schema.ts'

// Никогда не включаем rtspUrlEncrypted в ответ клиенту
const SAFE_SELECT = {
  id:            true,
  organizationId:true,
  complexId:     true,
  buildingId:    true,
  entranceId:    true,
  name:          true,
  isActive:      true,
  createdAt:     true,
  updatedAt:     true,
} as const

export const cameraService = {

  // ── Список камер (с stream URL) ────────────────────────────────────────────

  async getAll(organizationId: string, filters?: { entranceId?: string; buildingId?: string; complexId?: string }) {
    const cameras = await prisma.camera.findMany({
      where:   { organizationId, isActive: true, ...filters },
      select:  SAFE_SELECT,
      orderBy: { name: 'asc' },
    })
    return cameras.map(c => ({ ...c, streamUrl: getStreamUrl(c.id) }))
  },

  /** Камеры доступные жильцу: только своего подъезда + общие зоны ЖК */
  async getForResident(organizationId: string, userId: string) {
    // Находим все квартиры/подъезды/ЖК жильца
    const resident = await prisma.apartmentResident.findMany({
      where:   { organizationId, userId, isVerified: true },
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

    if (!resident.length) return []

    const entranceIds = [...new Set(resident.map(r => r.apartment.entrance.id))]
    const complexIds  = [...new Set(resident.map(r => r.apartment.entrance.building.complexId))]

    const cameras = await prisma.camera.findMany({
      where: {
        organizationId,
        isActive: true,
        OR: [
          { entranceId: { in: entranceIds } },  // камеры подъездов
          { entranceId: null, complexId: { in: complexIds } }, // общие камеры ЖК
        ],
      },
      select:  SAFE_SELECT,
      orderBy: { name: 'asc' },
    })

    return cameras.map(c => ({ ...c, streamUrl: getStreamUrl(c.id) }))
  },

  async getById(organizationId: string, id: string) {
    const camera = await prisma.camera.findFirstOrThrow({
      where:  { id, organizationId },
      select: SAFE_SELECT,
    })
    return { ...camera, streamUrl: getStreamUrl(camera.id) }
  },

  async create(organizationId: string, data: CreateCameraDto) {
    const { rtspUrl, ...rest } = data

    // Проверяем принадлежность связанных объектов
    if (rest.entranceId) {
      await prisma.entrance.findFirstOrThrow({ where: { id: rest.entranceId, organizationId } })
    } else if (rest.buildingId) {
      await prisma.building.findFirstOrThrow({ where: { id: rest.buildingId, organizationId } })
    } else if (rest.complexId) {
      await prisma.complex.findFirstOrThrow({ where: { id: rest.complexId, organizationId } })
    }

    const camera = await prisma.camera.create({
      data:   { ...rest, organizationId, rtspUrlEncrypted: encryptRtspUrl(rtspUrl) },
      select: SAFE_SELECT,
    })
    return { ...camera, streamUrl: getStreamUrl(camera.id) }
  },

  async update(organizationId: string, id: string, data: UpdateCameraDto) {
    await prisma.camera.findFirstOrThrow({ where: { id, organizationId } })
    const updateData: any = { ...data }
    if (data.rtspUrl) {
      updateData.rtspUrlEncrypted = encryptRtspUrl(data.rtspUrl)
      delete updateData.rtspUrl
    }
    const camera = await prisma.camera.update({ where: { id }, data: updateData, select: SAFE_SELECT })
    return { ...camera, streamUrl: getStreamUrl(camera.id) }
  },

  async delete(organizationId: string, id: string) {
    await prisma.camera.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.camera.delete({ where: { id } })
  },
}
