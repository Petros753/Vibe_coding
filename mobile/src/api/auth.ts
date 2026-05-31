import { api } from './client'

export interface SendOtpResponse {
  message: string
  expiresIn: number
}

export interface VerifyOtpResponse {
  accessToken:  string
  refreshToken: string
  user: {
    id:        string
    phone:     string
    firstName: string | null
    lastName:  string | null
    role:      string
  }
}

export const authApi = {
  sendOtp: (phone: string) =>
    api.post<{ data: SendOtpResponse }>('/auth/send-otp', { phone }).then((r) => r.data.data),

  verifyOtp: (phone: string, code: string) =>
    api
      .post<{ data: VerifyOtpResponse }>('/auth/verify-otp', { phone, code })
      .then((r) => r.data.data),

  firebaseLogin: (idToken: string) =>
    api
      .post<{ data: VerifyOtpResponse }>('/auth/firebase', { idToken })
      .then((r) => r.data.data),

  logout: () => api.post('/auth/logout'),
}