import { api } from './client'

export type TicketStatus   = 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED'
export type TicketCategory = 'PLUMBING' | 'ELECTRICAL' | 'ELEVATOR' | 'INTERCOM' | 'CLEANING' | 'SECURITY' | 'PARKING' | 'OTHER'

export interface TicketUser {
  id:        string
  firstName: string | null
  lastName:  string | null
  phone?:    string
  role?:     string
}

export interface TicketComment {
  id:         string
  text:       string
  mediaUrls:  string[]
  isInternal: boolean
  createdAt:  string
  author:     TicketUser
}

export interface Ticket {
  id:           string
  ticketNumber: number
  title:        string
  description:  string
  category:     TicketCategory
  status:       TicketStatus
  mediaUrls:    string[]
  createdAt:    string
  resolvedAt:   string | null
  creator:      TicketUser
  assignee:     TicketUser | null
  _count:       { comments: number }
}

export interface TicketDetail extends Ticket {
  comments: TicketComment[]
}

export interface TicketListResponse {
  data: Ticket[]
  meta: { total: number; page: number; limit: number; pages: number }
}

export const ticketsApi = {
  getAll: (params?: { status?: string; page?: number; limit?: number }) =>
    api
      .get<TicketListResponse>('/tickets', { params })
      .then((r) => r.data),

  getById: (id: string) =>
    api
      .get<{ data: TicketDetail }>(`/tickets/${id}`)
      .then((r) => r.data.data),

  create: (data: { title: string; description: string; category: TicketCategory; mediaUrls?: string[] }) =>
    api
      .post<{ data: Ticket }>('/tickets', data)
      .then((r) => r.data.data),

  addComment: (ticketId: string, data: { text: string; mediaUrls?: string[] }) =>
    api
      .post<{ data: TicketComment }>(`/tickets/${ticketId}/comments`, data)
      .then((r) => r.data.data),
}

// ── UI helpers ────────────────────────────────────────────────────────────────

export const STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN:        'Открыта',
  IN_PROGRESS: 'В работе',
  WAITING:     'Ожидание',
  RESOLVED:    'Решена',
  CLOSED:      'Закрыта',
}

export const STATUS_CLASS: Record<TicketStatus, { bg: string; text: string }> = {
  OPEN:        { bg: 'bg-blue-100',   text: 'text-blue-700'   },
  IN_PROGRESS: { bg: 'bg-orange-100', text: 'text-orange-700' },
  WAITING:     { bg: 'bg-purple-100', text: 'text-purple-700' },
  RESOLVED:    { bg: 'bg-green-100',  text: 'text-green-700'  },
  CLOSED:      { bg: 'bg-slate-100',  text: 'text-slate-500'  },
}

export const CATEGORY_LABEL: Record<TicketCategory, string> = {
  PLUMBING:   'Сантехника',
  ELECTRICAL: 'Электрика',
  ELEVATOR:   'Лифт',
  INTERCOM:   'Домофон',
  CLEANING:   'Уборка',
  SECURITY:   'Безопасность',
  PARKING:    'Парковка',
  OTHER:      'Другое',
}

export const CATEGORY_EMOJI: Record<TicketCategory, string> = {
  PLUMBING:   '🔧',
  ELECTRICAL: '⚡',
  ELEVATOR:   '🛗',
  INTERCOM:   '🔔',
  CLEANING:   '🧹',
  SECURITY:   '🔒',
  PARKING:    '🚗',
  OTHER:      '📝',
}
