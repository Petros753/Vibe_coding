import { api } from './client'

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED'
export type TicketCategory = 'PLUMBING' | 'ELECTRICAL' | 'ELEVATOR' | 'INTERCOM' | 'CLEANING' | 'SECURITY' | 'PARKING' | 'OTHER'

export interface Ticket {
  id: string
  title: string
  description: string
  status: TicketStatus
  category: TicketCategory
  mediaUrls: string[]
  createdAt: string
  updatedAt: string
  creator: { id: string; firstName: string | null; lastName: string | null; phone: string }
  assignee: { id: string; firstName: string | null; lastName: string | null } | null
  _count: { comments: number }
}

export interface TicketDetail extends Ticket {
  comments: TicketComment[]
}

export interface TicketComment {
  id: string
  text: string
  isInternal: boolean
  createdAt: string
  author: { id: string; firstName: string | null; lastName: string | null; role: string }
}

export interface ListMeta { total: number; page: number; limit: number; totalPages: number }

export const ticketsApi = {
  list: (params: { status?: TicketStatus; category?: TicketCategory; page?: number; limit?: number }) =>
    api.get<{ data: Ticket[]; meta: ListMeta }>('/tickets', { params }).then(r => r.data),

  get: (id: string) =>
    api.get<{ data: TicketDetail }>(`/tickets/${id}`).then(r => r.data.data),

  updateStatus: (id: string, status: TicketStatus, assigneeId?: string) =>
    api.patch<{ data: Ticket }>(`/tickets/${id}/status`, { status, assigneeId }).then(r => r.data.data),

  addComment: (id: string, text: string, isInternal = false) =>
    api.post<{ data: TicketComment }>(`/tickets/${id}/comments`, { text, isInternal, mediaUrls: [] }).then(r => r.data.data),
}
