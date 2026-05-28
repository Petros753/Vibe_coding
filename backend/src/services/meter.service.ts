/**
 * services/meter.service.ts — Счётчики и показания
 *
 * Бизнес-правила:
 *   • Одно показание за период (YYYY-MM) — unique constraint в БД
 *   • Жилец может отправить показания только для своей квартиры
 *   • Каждое показание должно быть >= предыдущего (защита от ошибок)
 */

import { prisma }          from '../lib/prisma.ts'
import type { CreateMeterDto, SubmitReadingDto } from '../../../shared/schemas/meter.schema.ts'

export const meterService = {

  // ── Счётчики квартиры ──────────────────────────────────────────────────────

  async getByApartment(organizationId: string, apartmentId: string) {
    await prisma.apartment.findFirstOrThrow({ where: { id: apartmentId, organizationId } })
    return prisma.meter.findMany({
      where:   { apartmentId, organizationId, isActive: true },
      include: {
        readings: { orderBy: { submittedAt: 'desc' }, take: 3 },
      },
      orderBy: { type: 'asc' },
    })
  },

  async getById(organizationId: string, id: string) {
    return prisma.meter.findFirstOrThrow({
      where:   { id, organizationId },
      include: {
        apartment: { select: { id: true, number: true } },
        readings:  { orderBy: { submittedAt: 'desc' }, take: 12 },
      },
    })
  },

  async create(organizationId: string, data: CreateMeterDto) {
    await prisma.apartment.findFirstOrThrow({ where: { id: data.apartmentId, organizationId } })
    return prisma.meter.create({
      data: {
        ...data,
        organizationId,
        installDate:   data.installDate   ? new Date(data.installDate)   : undefined,
        nextCheckDate: data.nextCheckDate ? new Date(data.nextCheckDate) : undefined,
      },
    })
  },

  async deactivate(organizationId: string, id: string) {
    await prisma.meter.findFirstOrThrow({ where: { id, organizationId } })
    return prisma.meter.update({ where: { id }, data: { isActive: false } })
  },

  // ── Показания ──────────────────────────────────────────────────────────────

  async submitReading(organizationId: string, meterId: string, data: SubmitReadingDto) {
    const meter = await prisma.meter.findFirstOrThrow({ where: { id: meterId, organizationId } })

    // Проверяем что показание не меньше предыдущего
    const lastReading = await prisma.meterReading.findFirst({
      where:   { meterId },
      orderBy: { submittedAt: 'desc' },
    })

    if (lastReading && data.value < lastReading.value) {
      throw new InvalidReadingError(
        `Показание (${data.value}) не может быть меньше предыдущего (${lastReading.value})`,
      )
    }

    return prisma.meterReading.upsert({
      where:  { meterId_period: { meterId, period: data.period } },
      update: { value: data.value, imageUrl: data.imageUrl, submittedAt: new Date() },
      create: { meterId, value: data.value, imageUrl: data.imageUrl, period: data.period },
    })
  },

  async getReadings(organizationId: string, meterId: string, limit = 12) {
    await prisma.meter.findFirstOrThrow({ where: { id: meterId, organizationId } })
    return prisma.meterReading.findMany({
      where:   { meterId },
      orderBy: { submittedAt: 'desc' },
      take:    limit,
    })
  },

  /** Все квартиры организации, не сдавшие показания за период */
  async getPendingReadings(organizationId: string, period: string) {
    const meters = await prisma.meter.findMany({
      where: { organizationId, isActive: true },
      include: {
        readings:  { where: { period } },
        apartment: { select: { id: true, number: true } },
      },
    })
    return meters.filter(m => m.readings.length === 0)
  },
}

export class InvalidReadingError extends Error {
  constructor(msg: string) { super(msg); this.name = 'InvalidReadingError' }
}
