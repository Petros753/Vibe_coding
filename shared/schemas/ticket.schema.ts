import { z } from 'zod'

export const createTicketSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(2000),
  category: z.enum(['PLUMBING', 'ELECTRICAL', 'ELEVATOR', 'INTERCOM', 'CLEANING', 'SECURITY', 'PARKING', 'OTHER']),
  mediaUrls: z.array(z.string().url()).max(5).default([]),
})

export const updateTicketStatusSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED']),
})

export type CreateTicketDto = z.infer<typeof createTicketSchema>
export type UpdateTicketStatusDto = z.infer<typeof updateTicketStatusSchema>
