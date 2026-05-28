import { api } from './client'

export type AnnouncementStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

export interface Announcement {
  id: string
  title: string
  body: string
  imageUrl: string | null
  isPinned: boolean
  status: AnnouncementStatus
  createdAt: string
  updatedAt: string
}

export const announcementsApi = {
  list: (params?: { status?: AnnouncementStatus; page?: number; limit?: number }) =>
    api.get<{ data: Announcement[]; meta: any }>('/announcements', { params }).then(r => r.data),

  get: (id: string) =>
    api.get<{ data: Announcement }>(`/announcements/${id}`).then(r => r.data.data),

  create: (body: { title: string; body: string; imageUrl?: string; isPinned: boolean }) =>
    api.post<{ data: Announcement }>('/announcements', body).then(r => r.data.data),

  update: (id: string, body: Partial<{ title: string; body: string; imageUrl: string; isPinned: boolean; status: AnnouncementStatus }>) =>
    api.patch<{ data: Announcement }>(`/announcements/${id}`, body).then(r => r.data.data),

  publish: (id: string) =>
    api.post<{ data: Announcement }>(`/announcements/${id}/publish`).then(r => r.data.data),

  delete: (id: string) =>
    api.delete(`/announcements/${id}`),
}
