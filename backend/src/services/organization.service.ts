/**
 * services/organization.service.ts — Organizations CRUD (только SUPER_ADMIN)
 */

import { prisma } from '../lib/prisma.ts'
import type { CreateOrganizationDto, UpdateOrganizationDto } from '../../../shared/schemas/organization.schema.ts'

export const organizationService = {

  async getAll() {
    return prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { complexes: true, users: true } } },
    })
  },

  async getById(id: string) {
    return prisma.organization.findUniqueOrThrow({
      where: { id },
      include: {
        complexes: { include: { buildings: { include: { entrances: true } } } },
        _count:    { select: { users: true, tickets: true } },
      },
    })
  },

  async create(data: CreateOrganizationDto) {
    return prisma.organization.create({ data })
  },

  async update(id: string, data: UpdateOrganizationDto) {
    return prisma.organization.update({ where: { id }, data })
  },

  async delete(id: string) {
    return prisma.organization.delete({ where: { id } })
  },
}
