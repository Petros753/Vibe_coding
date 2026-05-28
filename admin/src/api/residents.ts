import { api } from './client'

export interface Resident {
  id: string
  isVerified: boolean
  accessLevel: string
  createdAt: string
  user: { id: string; firstName: string | null; lastName: string | null; phone: string }
  apartment: {
    id: string
    number: string
    entrance: {
      number: number
      building: { address: string; complex: { name: string } }
    }
  }
}

export const residentsApi = {
  list: (params?: { isVerified?: boolean }) =>
    api.get<{ data: Resident[] }>('/residents', { params }).then(r => r.data.data),

  verify: (id: string, isVerified: boolean) =>
    api.patch<{ data: Resident }>(`/residents/${id}/verify`, { isVerified }).then(r => r.data.data),

  remove: (id: string) =>
    api.delete(`/residents/${id}`),
}
