import { z } from 'zod'

export const sendOtpSchema = z.object({
  phone: z.string().regex(/^\+7\d{10}$/, 'Номер должен быть в формате +7XXXXXXXXXX'),
})

export const verifyOtpSchema = z.object({
  phone: z.string().regex(/^\+7\d{10}$/, 'Номер должен быть в формате +7XXXXXXXXXX'),
  code: z.string().length(4).regex(/^\d{4}$/, 'Код должен состоять из 4 цифр'),
})

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
})

export type SendOtpDto = z.infer<typeof sendOtpSchema>
export type VerifyOtpDto = z.infer<typeof verifyOtpSchema>
export type RefreshTokenDto = z.infer<typeof refreshTokenSchema>
