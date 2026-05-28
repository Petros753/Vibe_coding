/**
 * services/ticket.service.ts — Заявки в УК
 *
 * Бизнес-правила:
 *   • Порядковый номер заявки (ticketNumber) уникален внутри организации
 *   • При смене статуса → push-уведомление создателю
 *   • isInternal комментарии видны только сотрудникам УК (не жильцам)
 */

import { prisma }             from '../lib/prisma.ts'
import { sendTicketUpdate }   from '../lib/push.ts'
import type { CreateTicketDto, UpdateTicketStatusDto, CreateTicketCommentDto } from '../../../shared/schemas/ticket.schema.ts'

const ticketInclude = {
  creator:  { select: { id: true, firstName: true, lastName: true, phone: true } },
  assignee: { select: { id: true, firstName: true, lastName: true } },
  _count:   { select: { comments: true } },
} as const

export const ticketService = {

  // ── Список заявок ──────────────────────────────────────────────────────────

  async getAll(organizationId: string, filters?: {
    status?:     string
    category?:   string
    assigneeId?: string
    creatorId?:  string
    page?:       number
    limit?:      number
  }) {
    const page  = filters?.page  ?? 1
    const limit = filters?.limit ?? 20

    const where = {
      organizationId,
      ...(filters?.status     && { status:     filters.status     as any }),
      ...(filters?.category   && { category:   filters.category   as any }),
      ...(filters?.assigneeId && { assigneeId: filters.assigneeId }),
      ...(filters?.creatorId  && { creatorId:  filters.creatorId  }),
    }

    const [items, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include:  ticketInclude,
        orderBy:  { createdAt: 'desc' },
        skip:     (page - 1) * limit,
        take:     limit,
      }),
      prisma.ticket.count({ where }),
    ])

    return { items, meta: { total, page, limit, pages: Math.ceil(total / limit) } }
  },

  // ── Одна заявка с комментариями ────────────────────────────────────────────

  async getById(organizationId: string, id: string, isStaff: boolean) {
    const ticket = await prisma.ticket.findFirstOrThrow({
      where: { id, organizationId },
      include: {
        creator:  { select: { id: true, firstName: true, lastName: true, phone: true } },
        assignee: { select: { id: true, firstName: true, lastName: true } },
        comments: {
          where:   isStaff ? {} : { isInternal: false }, // жильцы не видят внутренние
          include: { author: { select: { id: true, firstName: true, lastName: true, role: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    return ticket
  },

  // ── Создать заявку ────────────────────────────────────────────────────────

  async create(organizationId: string, creatorId: string, data: CreateTicketDto) {
    const count = await prisma.ticket.count({ where: { organizationId } })
    return prisma.ticket.create({
      data: { ...data, organizationId, creatorId, ticketNumber: count + 1 },
      include: ticketInclude,
    })
  },

  // ── Сменить статус / назначить исполнителя ────────────────────────────────

  async updateStatus(organizationId: string, id: string, data: UpdateTicketStatusDto) {
    const ticket = await prisma.ticket.findFirstOrThrow({ where: { id, organizationId } })

    const updated = await prisma.ticket.update({
      where: { id },
      data: {
        status:     data.status as any,
        assigneeId: data.assigneeId ?? ticket.assigneeId,
        resolvedAt: ['RESOLVED', 'CLOSED'].includes(data.status) ? new Date() : null,
      },
      include: ticketInclude,
    })

    // Push создателю при смене статуса
    if (data.status !== ticket.status) {
      const pushTokens = await prisma.pushToken.findMany({
        where:  { userId: ticket.creatorId },
        select: { token: true },
      })
      if (pushTokens.length) {
        await sendTicketUpdate(pushTokens.map(t => t.token), updated.ticketNumber, data.status, updated.id)
      }
    }

    return updated
  },

  // ── Комментарии ────────────────────────────────────────────────────────────

  async addComment(organizationId: string, ticketId: string, authorId: string, data: CreateTicketCommentDto) {
    // Проверяем что заявка существует и принадлежит организации
    await prisma.ticket.findFirstOrThrow({ where: { id: ticketId, organizationId } })

    return prisma.ticketComment.create({
      data: { ...data, organizationId, ticketId, authorId },
      include: { author: { select: { id: true, firstName: true, lastName: true, role: true } } },
    })
  },

  async deleteComment(organizationId: string, commentId: string, requesterId: string, isStaff: boolean) {
    const comment = await prisma.ticketComment.findFirstOrThrow({
      where: { id: commentId, organizationId },
    })
    // Удалить может автор или сотрудник УК
    if (comment.authorId !== requesterId && !isStaff) {
      throw new ForbiddenError()
    }
    return prisma.ticketComment.delete({ where: { id: commentId } })
  },
}

export class ForbiddenError extends Error {
  constructor() { super('Нет прав'); this.name = 'ForbiddenError' }
}
