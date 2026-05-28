import { api } from './client'

export type AnnouncementStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

export interface Announcement {
  id:          string
  title:       string
  body:        string
  imageUrl:    string | null
  isPinned:    boolean
  status:      AnnouncementStatus
  publishedAt: string | null
  createdAt:   string
}

export interface AnnouncementListResponse {
  data: Announcement[]
  meta: { total: number; page: number; limit: number }
}

export const announcementsApi = {
  getAll: (params?: { page?: number; limit?: number }) =>
    api
      .get<AnnouncementListResponse>('/announcements', { params })
      .then((r) => r.data),

  getById: (id: string) =>
    api
      .get<{ data: Announcement }>(`/announcements/${id}`)
      .then((r) => r.data.data),
}
