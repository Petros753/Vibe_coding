import { z } from 'zod'

export const addResidentSchema = z.object({
  phone:       z.string().regex(/^\+7\d{10}$/, 'Формат: +7XXXXXXXXXX'),
  apartmentId: z.string().cuid(),
  accessLevel: z.enum(['OWNER', 'TENANT', 'FAMILY_MEMBER']).default('TENANT'),
  firstName:   z.string().min(1).max(100).optional(),
  lastName:    z.string().min(1).max(100).optional(),
  middleName:  z.string().max(100).optional(),
})

export const verifyResidentSchema = z.object({
  isVerified: z.boolean(),
})

export type AddResidentDto    = z.infer<typeof addResidentSchema>
export type VerifyResidentDto = z.infer<typeof verifyResidentSchema>
