import { api } from './client'

export interface Residency {
  id:            string
  apartmentId:   string
  isVerified:    boolean
  ownershipType: string
  apartment: {
    number: string
    entrance: {
      number: number
      building: {
        address: string
        complex: { id: string; name: string }
      }
    }
  }
}

export interface UserProfile {
  id:        string
  firstName: string | null
  lastName:  string | null
  phone:     string
  role:      string
  residents: Residency[]
}

export const profileApi = {
  getProfile: () =>
    api.get<{ data: UserProfile }>('/auth/profile').then((r) => r.data.data),
}
