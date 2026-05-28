import axios from 'axios'
import { QueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../store/auth.store'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
})

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let isRefreshing = false
type QueueItem = { resolve: (token: string) => void; reject: (err: unknown) => void }
let refreshQueue: QueueItem[] = []

function drainQueue(token: string) {
  refreshQueue.forEach(({ resolve }) => resolve(token))
  refreshQueue = []
}
function rejectQueue(err: unknown) {
  refreshQueue.forEach(({ reject }) => reject(err))
  refreshQueue = []
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const orig = error.config
    if (error.response?.status !== 401 || orig._retry) return Promise.reject(error)
    orig._retry = true

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push({
          resolve: (token) => {
            orig.headers.Authorization = `Bearer ${token}`
            resolve(api(orig))
          },
          reject,
        })
      })
    }

    isRefreshing = true
    try {
      const { refreshToken } = useAuthStore.getState()
      if (!refreshToken) throw new Error('no_refresh_token')

      const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken })
      const { accessToken: newAccess, refreshToken: newRefresh } = data.data
      useAuthStore.getState().setTokens(newAccess, newRefresh)
      drainQueue(newAccess)
      orig.headers.Authorization = `Bearer ${newAccess}`
      return api(orig)
    } catch (err) {
      rejectQueue(err)
      useAuthStore.getState().clearAuth()
      return Promise.reject(err)
    } finally {
      isRefreshing = false
    }
  },
)
