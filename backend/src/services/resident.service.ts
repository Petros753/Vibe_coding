/**
 * services/resident.service.ts — управление жильцами
 *
 * Добавление жильца к квартире, верификация, удаление.
 * Жилец — это User с ApartmentResident-связью.
 */

import { prisma } from '../lib/prisma.ts'
import type { AddResidentDto } from '../../../shared/schemas/resident.schema.ts'

export const residentService = {

  /** Список жильцов организации (можно фильтровать по квартире) */
  async getAll(organizationId: string, filters?: { apartmentId?: string; isVerified?: boolean }) {
    return prisma.apartmentResident.findMany({
      where: {
        organizationId,
        ...(filters?.apartmentId !== undefined && { apartmentId: filters.apartmentId }),
        ...(filters?.isVerified  !== undefined && { isVerified:  filters.isVerified }),
      },
      include: {
        user:      { select: { id: true, firstName: true, lastName: true, middleName: true, phone: true, avatarUrl: true, isActive: true } },
        apartment: { include: { entrance: { include: { building: { select: { name: true, complexId: true } } } } } },
      },
      orderBy: { createdAt: 'desc' },
    })
  },

  /** Добавить жильца к квартире (создаёт User если не существует) */
  async add(organizationId: string, data: AddResidentDto) {
    // Проверяем что квартира принадлежит организации
    await prisma.apartment.findFirstOrThrow({ where: { id: data.apartmentId, organizationId } })

    // Ищем или создаём пользователя по номеру телефона
    const user = await prisma.user.upsert({
      where:  { phone: data.phone },
      update: {
        // Обновляем имя только если передано
        ...(data.firstName  && { firstName:  data.firstName }),
        ...(data.lastName   && { lastName:   data.lastName }),
        ...(data.middleName && { middleName: data.middleName }),
        // Привязываем к организации если ещё не привязан
        organizationId,
      },
      create: {
        phone:          data.phone,
        firstName:      data.firstName,
        lastName:       data.lastName,
        middleName:     data.middleName,
        organizationId,
        role:           'RESIDENT',
      },
    })

    // Создаём или обновляем связь с квартирой
    return prisma.apartmentResident.upsert({
      where:  { userId_apartmentId: { userId: user.id, apartmentId: data.apartmentId } },
      update: { accessLevel: data.accessLevel },
      create: {
        organizationId,
        userId:         user.id,
        apartmentId:    data.apartmentId,
        accessLevel:    data.accessLevel,
        isVerified:     false,
      },
      include: {
        user:      { select: { id: true, firstName: true, lastName: true, phone: true } },
        apartment: { select: { id: true, number: true } },
      },
    })
  },

  /** Верифицировать / снять верификацию жильца */
  async verify(organizationId: string, residentId: string, isVerified: boolean) {
    const resident = await prisma.apartmentResident.findFirstOrThrow({
      where: { id: residentId, organizationId },
    })
    return prisma.apartmentResident.update({
      where: { id: resident.id },
      data:  {
        isVerified,
        verifiedAt: isVerified ? new Date() : null,
      },
      include: {
        user:      { select: { id: true, firstName: true, lastName: true, phone: true } },
        apartment: { select: { id: true, number: true } },
      },
    })
  },

  /** Удалить жильца из квартиры */
  async remove(organizationId: string, residentId: string) {
    await prisma.apartmentResident.findFirstOrThrow({ where: { id: residentId, organizationId } })
    return prisma.apartmentResident.delete({ where: { id: residentId } })
  },

  /** Получить всех жильцов конкретной квартиры */
  async getByApartment(organizationId: string, apartmentId: string) {
    await prisma.apartment.findFirstOrThrow({ where: { id: apartmentId, organizationId } })
    return prisma.apartmentResident.findMany({
      where: { apartmentId, organizationId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, middleName: true, phone: true, avatarUrl: true } },
      },
      orderBy: { accessLevel: 'asc' },
    })
  },
}
