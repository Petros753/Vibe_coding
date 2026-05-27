/**
 * seed.ts — тестовые данные для разработки
 *
 * Создаёт:
 *   • 1 Организацию (УК "Уют-Сервис")
 *   • 1 ЖК ("Зелёный Квартал")
 *   • 1 Дом ("Корпус 1")
 *   • 2 Подъезда (1, 2)
 *   • 10 Квартир (5 в каждом подъезде, этажи 1–5)
 *   • 3 Жильца (user1 → кв.1 owner, user2 → кв.2 tenant, user3 → кв.6 owner)
 *   • 1 Сотрудник УК (ORG_MANAGER)
 *   • 2 Счётчика для кв.1
 *   • 1 Тестовая заявка от user1
 *   • 1 Объявление от УК
 */

import { PrismaClient, Role, ResidentAccessLevel, MeterType, TicketCategory } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Запускаем сидирование...')

  // ──────────────────────────────────────────
  // 1. Организация (УК)
  // ──────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { inn: '7701234567' },
    update: {},
    create: {
      name: 'УК "Уют-Сервис"',
      inn: '7701234567',
      phone: '+74951234567',
      email: 'info@uyut-service.ru',
      address: 'г. Москва, ул. Примерная, д. 1, оф. 101',
      isActive: true,
    },
  })
  console.log(`✅ Организация: ${org.name} (${org.id})`)

  // ──────────────────────────────────────────
  // 2. ЖК
  // ──────────────────────────────────────────
  const complex = await prisma.complex.upsert({
    where: { id: 'complex_zeleniy_kvartal' },
    update: {},
    create: {
      id: 'complex_zeleniy_kvartal',
      organizationId: org.id,
      name: 'ЖК "Зелёный Квартал"',
      address: 'г. Москва, ул. Зелёная, д. 15',
      city: 'Москва',
      description: 'Современный жилой комплекс комфорт-класса',
    },
  })
  console.log(`✅ ЖК: ${complex.name}`)

  // ──────────────────────────────────────────
  // 3. Дом (корпус)
  // ──────────────────────────────────────────
  const building = await prisma.building.upsert({
    where: { id: 'building_korpus1' },
    update: {},
    create: {
      id: 'building_korpus1',
      organizationId: org.id,
      complexId: complex.id,
      name: 'Корпус 1',
      address: 'ул. Зелёная, д. 15, корп. 1',
      floors: 9,
    },
  })
  console.log(`✅ Дом: ${building.name}`)

  // ──────────────────────────────────────────
  // 4. Подъезды
  // ──────────────────────────────────────────
  const [entrance1, entrance2] = await Promise.all([
    prisma.entrance.upsert({
      where: { buildingId_number: { buildingId: building.id, number: 1 } },
      update: {},
      create: {
        organizationId: org.id,
        buildingId: building.id,
        number: 1,
      },
    }),
    prisma.entrance.upsert({
      where: { buildingId_number: { buildingId: building.id, number: 2 } },
      update: {},
      create: {
        organizationId: org.id,
        buildingId: building.id,
        number: 2,
      },
    }),
  ])
  console.log(`✅ Подъезды: #${entrance1.number}, #${entrance2.number}`)

  // ──────────────────────────────────────────
  // 5. Квартиры (10 штук: 5 в подъезде 1, 5 в подъезде 2)
  //    Подъезд 1: кв. 1–5 (этажи 1–5)
  //    Подъезд 2: кв. 6–10 (этажи 1–5)
  // ──────────────────────────────────────────
  const apartmentData = [
    // Подъезд 1
    { entranceId: entrance1.id, number: '1', floor: 1, area: 42.5, rooms: 1 },
    { entranceId: entrance1.id, number: '2', floor: 2, area: 58.0, rooms: 2 },
    { entranceId: entrance1.id, number: '3', floor: 3, area: 72.3, rooms: 3 },
    { entranceId: entrance1.id, number: '4', floor: 4, area: 45.1, rooms: 1 },
    { entranceId: entrance1.id, number: '5', floor: 5, area: 63.8, rooms: 2 },
    // Подъезд 2
    { entranceId: entrance2.id, number: '6', floor: 1, area: 41.0, rooms: 1 },
    { entranceId: entrance2.id, number: '7', floor: 2, area: 59.5, rooms: 2 },
    { entranceId: entrance2.id, number: '8', floor: 3, area: 70.0, rooms: 3 },
    { entranceId: entrance2.id, number: '9', floor: 4, area: 44.2, rooms: 1 },
    { entranceId: entrance2.id, number: '10', floor: 5, area: 88.6, rooms: 3 },
  ]

  const apartments: Record<string, Awaited<ReturnType<typeof prisma.apartment.upsert>>> = {}

  for (const apt of apartmentData) {
    const a = await prisma.apartment.upsert({
      where: { entranceId_number: { entranceId: apt.entranceId, number: apt.number } },
      update: {},
      create: {
        organizationId: org.id,
        ...apt,
      },
    })
    apartments[apt.number] = a
  }
  console.log(`✅ Квартиры: ${Object.keys(apartments).map(n => `кв.${n}`).join(', ')}`)

  // ──────────────────────────────────────────
  // 6. Жильцы (3 пользователя) + сотрудник УК
  // ──────────────────────────────────────────
  const [user1, user2, user3, manager] = await Promise.all([
    prisma.user.upsert({
      where: { phone: '+79001000001' },
      update: {},
      create: {
        organizationId: org.id,
        phone: '+79001000001',
        firstName: 'Иван',
        lastName: 'Петров',
        middleName: 'Сергеевич',
        role: Role.RESIDENT,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { phone: '+79001000002' },
      update: {},
      create: {
        organizationId: org.id,
        phone: '+79001000002',
        firstName: 'Мария',
        lastName: 'Сидорова',
        middleName: 'Александровна',
        role: Role.RESIDENT,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { phone: '+79001000003' },
      update: {},
      create: {
        organizationId: org.id,
        phone: '+79001000003',
        firstName: 'Алексей',
        lastName: 'Козлов',
        middleName: 'Дмитриевич',
        role: Role.RESIDENT,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { phone: '+79001000010' },
      update: {},
      create: {
        organizationId: org.id,
        phone: '+79001000010',
        firstName: 'Ольга',
        lastName: 'Менеджерова',
        role: Role.ORG_MANAGER,
        isActive: true,
      },
    }),
  ])
  console.log(`✅ Пользователи: ${[user1, user2, user3, manager].map(u => `${u.firstName} ${u.lastName} (${u.role})`).join(', ')}`)

  // ──────────────────────────────────────────
  // 7. Привязка жильцов к квартирам
  // ──────────────────────────────────────────
  await Promise.all([
    prisma.apartmentResident.upsert({
      where: { userId_apartmentId: { userId: user1.id, apartmentId: apartments['1'].id } },
      update: {},
      create: {
        organizationId: org.id,
        userId: user1.id,
        apartmentId: apartments['1'].id,
        accessLevel: ResidentAccessLevel.OWNER,
        isVerified: true,
        verifiedAt: new Date(),
      },
    }),
    prisma.apartmentResident.upsert({
      where: { userId_apartmentId: { userId: user2.id, apartmentId: apartments['2'].id } },
      update: {},
      create: {
        organizationId: org.id,
        userId: user2.id,
        apartmentId: apartments['2'].id,
        accessLevel: ResidentAccessLevel.TENANT,
        isVerified: true,
        verifiedAt: new Date(),
      },
    }),
    prisma.apartmentResident.upsert({
      where: { userId_apartmentId: { userId: user3.id, apartmentId: apartments['6'].id } },
      update: {},
      create: {
        organizationId: org.id,
        userId: user3.id,
        apartmentId: apartments['6'].id,
        accessLevel: ResidentAccessLevel.OWNER,
        isVerified: false, // Ещё не верифицирован
      },
    }),
  ])
  console.log(`✅ Привязки жильцов: Петров → кв.1 (owner), Сидорова → кв.2 (tenant), Козлов → кв.6 (owner, не верифицирован)`)

  // ──────────────────────────────────────────
  // 8. Счётчики для кв.1
  // ──────────────────────────────────────────
  const [meterCold, meterElec] = await Promise.all([
    prisma.meter.create({
      data: {
        organizationId: org.id,
        apartmentId: apartments['1'].id,
        type: MeterType.COLD_WATER,
        serialNumber: 'CW-2024-001',
        installDate: new Date('2024-01-15'),
        nextCheckDate: new Date('2027-01-15'),
      },
    }),
    prisma.meter.create({
      data: {
        organizationId: org.id,
        apartmentId: apartments['1'].id,
        type: MeterType.ELECTRICITY,
        serialNumber: 'EL-2024-001',
        installDate: new Date('2024-01-15'),
        nextCheckDate: new Date('2030-01-15'),
      },
    }),
  ])

  // Показания за последние 3 месяца
  await Promise.all([
    prisma.meterReading.createMany({
      data: [
        { meterId: meterCold.id, value: 112.5, period: '2026-03', submittedAt: new Date('2026-03-25') },
        { meterId: meterCold.id, value: 118.2, period: '2026-04', submittedAt: new Date('2026-04-24') },
        { meterId: meterCold.id, value: 125.8, period: '2026-05', submittedAt: new Date('2026-05-22') },
      ],
      skipDuplicates: true,
    }),
    prisma.meterReading.createMany({
      data: [
        { meterId: meterElec.id, value: 3421.0, period: '2026-03', submittedAt: new Date('2026-03-25') },
        { meterId: meterElec.id, value: 3489.5, period: '2026-04', submittedAt: new Date('2026-04-24') },
        { meterId: meterElec.id, value: 3562.3, period: '2026-05', submittedAt: new Date('2026-05-22') },
      ],
      skipDuplicates: true,
    }),
  ])
  console.log(`✅ Счётчики: холодная вода (${meterCold.serialNumber}), электричество (${meterElec.serialNumber}) + 3 показания каждый`)

  // ──────────────────────────────────────────
  // 9. Тестовая заявка
  // ──────────────────────────────────────────
  const ticketCount = await prisma.ticket.count({ where: { organizationId: org.id } })

  const ticket = await prisma.ticket.create({
    data: {
      organizationId: org.id,
      ticketNumber: ticketCount + 1,
      title: 'Течёт кран на кухне',
      description: 'В кв.1 течёт смеситель на кухне. Вода капает постоянно, прошу прислать сантехника.',
      category: TicketCategory.PLUMBING,
      creatorId: user1.id,
      assigneeId: manager.id,
    },
  })

  await prisma.ticketComment.create({
    data: {
      organizationId: org.id,
      ticketId: ticket.id,
      authorId: manager.id,
      text: 'Заявка принята. Сантехник придёт завтра с 10:00 до 14:00.',
    },
  })
  console.log(`✅ Заявка #${ticket.ticketNumber}: "${ticket.title}"`)

  // ──────────────────────────────────────────
  // 10. Объявление от УК
  // ──────────────────────────────────────────
  await prisma.announcement.create({
    data: {
      organizationId: org.id,
      title: 'Плановое отключение воды 30 мая',
      body: 'Уважаемые жители! 30 мая с 09:00 до 18:00 будет проведено плановое отключение холодного водоснабжения в связи с заменой труб. Просим запастись водой заблаговременно.',
      status: 'PUBLISHED',
      publishedAt: new Date(),
    },
  })
  console.log(`✅ Объявление создано`)

  // ──────────────────────────────────────────
  // Итоги
  // ──────────────────────────────────────────
  const stats = await Promise.all([
    prisma.organization.count(),
    prisma.complex.count(),
    prisma.building.count(),
    prisma.entrance.count(),
    prisma.apartment.count(),
    prisma.user.count(),
    prisma.apartmentResident.count(),
    prisma.meter.count(),
    prisma.ticket.count(),
  ])

  console.log('\n📊 Итоги сидирования:')
  console.log(`   Организации:    ${stats[0]}`)
  console.log(`   ЖК:             ${stats[1]}`)
  console.log(`   Дома:           ${stats[2]}`)
  console.log(`   Подъезды:       ${stats[3]}`)
  console.log(`   Квартиры:       ${stats[4]}`)
  console.log(`   Пользователи:   ${stats[5]}`)
  console.log(`   Жильцы (связи): ${stats[6]}`)
  console.log(`   Счётчики:       ${stats[7]}`)
  console.log(`   Заявки:         ${stats[8]}`)
  console.log('\n🎉 Сидирование завершено успешно!')
}

main()
  .catch((e) => {
    console.error('❌ Ошибка сидирования:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
