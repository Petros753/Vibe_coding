/**
 * services/complex.service.ts — ЖК CRUD
 */

import { prisma } from '../lib/prisma.ts'
import type { CreateComplexDto } from '../../../shared/schemas/complex.schema.ts'

const updateComplexSchema_type = {} as Partial<CreateComplexDto>
type UpdateComplexDto = typeof updateComplexSchema_type

export const complexService = {

  async getAll(organizationId: string) {
    return prisma.complex.findMany({
      where:   { organizationId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { buildings: true } } },
    })
  },

  async getById(organizationId: string, id: string) {
    return prisma.complex.findFirstOrThrow({
      where: { id, organizationId },
      include: {
        buildings: {
          include: {
            entrances: {
              include: {
                _count: { select: { apartments: true } },
              },
            },
          },
        },
        cameras: { where: { entranceId: null, buildingId: null }, select: { id: true, name: true, isActive: true } },
      },
    })
  },

  async create(organizationId: string, data: CreateComplexDto) {
    return prisma.complex.create({
      data: { ...data, organizationId },
    })
  },

  async update(organizationId: string, id: string, data: Partial<CreateComplexDto>) {
    // Убедимся что ЖК принадлежит организации
    await prisma.complex.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.complex.update({ where: { id }, data })
  },

  async delete(organizationId: string, id: string) {
    await prisma.complex.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.complex.delete({ where: { id } })
  },
}
