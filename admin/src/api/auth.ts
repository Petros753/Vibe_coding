import { api } from './client'

export const authApi = {
  sendOtp: (phone: string) =>
    api.post<{ data: { message: string; expiresIn: number } }>('/auth/send-otp', { phone }).then(r => r.data.data),

  verifyOtp: (phone: string, code: string) =>
    api.post<{ data: { accessToken: string; refreshToken: string; user: any } }>('/auth/verify-otp', { phone, code }).then(r => r.data.data),

  logout: () => api.post('/auth/logout'),
}
