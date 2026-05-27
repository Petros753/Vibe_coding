/**
 * services/building.service.ts — Дома и Подъезды CRUD
 */

import { prisma } from '../lib/prisma.ts'
import type { CreateBuildingDto, UpdateBuildingDto, CreateEntranceDto } from '../../../shared/schemas/building.schema.ts'

export const buildingService = {

  // ── Дома ──────────────────────────────────────────────────────────────────

  async getAllByComplex(organizationId: string, complexId: string) {
    // Проверяем принадлежность ЖК
    await prisma.complex.findFirstOrThrow({ where: { id: complexId, organizationId } })
    return prisma.building.findMany({
      where:   { complexId, organizationId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { entrances: true } } },
    })
  },

  async getById(organizationId: string, id: string) {
    return prisma.building.findFirstOrThrow({
      where: { id, organizationId },
      include: {
        entrances: {
          orderBy: { number: 'asc' },
          include: { _count: { select: { apartments: true } } },
        },
        cameras: { select: { id: true, name: true, isActive: true } },
      },
    })
  },

  async create(organizationId: string, data: CreateBuildingDto) {
    // Убедимся что ЖК принадлежит организации
    await prisma.complex.findFirstOrThrow({ where: { id: data.complexId, organizationId } })
    return prisma.building.create({
      data: { ...data, organizationId },
    })
  },

  async update(organizationId: string, id: string, data: UpdateBuildingDto) {
    await prisma.building.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.building.update({ where: { id }, data })
  },

  async delete(organizationId: string, id: string) {
    await prisma.building.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.building.delete({ where: { id } })
  },

  // ── Подъезды ──────────────────────────────────────────────────────────────

  async getEntrances(organizationId: string, buildingId: string) {
    await prisma.building.findFirstOrThrow({ where: { id: buildingId, organizationId } })
    return prisma.entrance.findMany({
      where:   { buildingId, organizationId },
      orderBy: { number: 'asc' },
      include: {
        _count: { select: { apartments: true } },
        intercoms: { select: { id: true, name: true, isActive: true } },
        cameras:   { select: { id: true, name: true, isActive: true } },
      },
    })
  },

  async createEntrance(organizationId: string, data: CreateEntranceDto) {
    await prisma.building.findFirstOrThrow({ where: { id: data.buildingId, organizationId } })
    return prisma.entrance.create({
      data: { ...data, organizationId },
    })
  },

  async deleteEntrance(organizationId: string, id: string) {
    await prisma.entrance.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.entrance.delete({ where: { id } })
  },
}
