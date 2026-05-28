/**
 * services/push-token.service.ts — регистрация FCM/APNs токенов устройств
 */

import { prisma } from '../lib/prisma.ts'
import type { RegisterPushTokenDto } from '../../../shared/schemas/push.schema.ts'

export const pushTokenService = {

  async register(userId: string, data: RegisterPushTokenDto) {
    return prisma.pushToken.upsert({
      where:  { token: data.token },
      update: { userId, platform: data.platform },
      create: { userId, token: data.token, platform: data.platform },
    })
  },

  async unregister(userId: string, token: string) {
    await prisma.pushToken.deleteMany({ where: { token, userId } })
  },

  async getByUser(userId: string) {
    return prisma.pushToken.findMany({
      where:   { userId },
      select:  { id: true, token: true, platform: true, createdAt: true },
    })
  },
}
