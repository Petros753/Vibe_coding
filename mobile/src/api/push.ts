import { api } from './client'

export const pushApi = {
  registerToken: (token: string, platform: 'ios' | 'android') =>
    api
      .post('/push/tokens', { token, platform })
      .then((r) => r.data),

  unregisterToken: (token: string) =>
    api
      .delete(`/push/tokens/${encodeURIComponent(token)}`)
      .then((r) => r.data),
}
