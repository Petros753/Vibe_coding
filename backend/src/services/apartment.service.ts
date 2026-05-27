/**
 * services/apartment.service.ts — Квартиры CRUD
 */

import { prisma } from '../lib/prisma.ts'
import type { CreateApartmentDto, UpdateApartmentDto } from '../../../shared/schemas/apartment.schema.ts'

export const apartmentService = {

  async getAllByEntrance(organizationId: string, entranceId: string) {
    await prisma.entrance.findFirstOrThrow({ where: { id: entranceId, organizationId } })
    return prisma.apartment.findMany({
      where:   { entranceId, organizationId },
      orderBy: { floor: 'asc' },
      include: {
        residents: {
          include: { user: { select: { id: true, firstName: true, lastName: true, phone: true } } },
        },
        _count: { select: { meters: true } },
      },
    })
  },

  async getById(organizationId: string, id: string) {
    return prisma.apartment.findFirstOrThrow({
      where: { id, organizationId },
      include: {
        entrance: { include: { building: { include: { complex: true } } } },
        residents: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, middleName: true, phone: true, avatarUrl: true },
            },
          },
        },
        meters: { include: { readings: { orderBy: { submittedAt: 'desc' }, take: 1 } } },
      },
    })
  },

  async create(organizationId: string, data: CreateApartmentDto) {
    await prisma.entrance.findFirstOrThrow({ where: { id: data.entranceId, organizationId } })
    return prisma.apartment.create({
      data: { ...data, organizationId },
    })
  },

  async update(organizationId: string, id: string, data: UpdateApartmentDto) {
    await prisma.apartment.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.apartment.update({ where: { id }, data })
  },

  async delete(organizationId: string, id: string) {
    await prisma.apartment.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.apartment.delete({ where: { id } })
  },
}
