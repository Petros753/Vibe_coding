import { api } from './client'

export interface Organization {
  id: string
  name: string
  inn: string | null
  phone: string | null
  email: string | null
  address: string | null
  logoUrl: string | null
  isActive: boolean
}

export const organizationsApi = {
  get: (id: string) =>
    api.get<{ data: Organization }>(`/organizations/${id}`).then(r => r.data.data),

  update: (id: string, body: Partial<Omit<Organization, 'id' | 'isActive'>>) =>
    api.patch<{ data: Organization }>(`/organizations/${id}`, body).then(r => r.data.data),
}
