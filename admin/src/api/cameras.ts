import { api } from './client'

export interface Camera {
  id: string
  name: string
  isActive: boolean
  streamUrl: string | null
  complexId: string | null
  buildingId: string | null
  entranceId: string | null
  createdAt: string
}

export interface CameraFormData {
  name: string
  rtspUrl: string
  complexId?: string
  buildingId?: string
  entranceId?: string
}

export const camerasApi = {
  list: (params?: { complexId?: string; buildingId?: string; entranceId?: string }) =>
    api.get<{ data: Camera[] }>('/cameras', { params }).then(r => r.data.data),

  get: (id: string) =>
    api.get<{ data: Camera }>(`/cameras/${id}`).then(r => r.data.data),

  create: (body: CameraFormData) =>
    api.post<{ data: Camera }>('/cameras', body).then(r => r.data.data),

  update: (id: string, body: Partial<{ name: string; rtspUrl: string; isActive: boolean }>) =>
    api.patch<{ data: Camera }>(`/cameras/${id}`, body).then(r => r.data.data),

  delete: (id: string) =>
    api.delete(`/cameras/${id}`),
}
