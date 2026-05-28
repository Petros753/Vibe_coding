import { z } from 'zod'

export const createIntercomSchema = z.object({
  entranceId:    z.string().cuid(),
  name:          z.string().min(1).max(100),
  model:         z.string().max(50).optional(),
  httpOpenUrl:   z.string().url().optional(),
  httpOpenToken: z.string().max(500).optional(),
  sipLogin:      z.string().max(100).optional(),
  sipPassword:   z.string().max(100).optional(),
})

export const updateIntercomSchema = createIntercomSchema
  .omit({ entranceId: true })
  .partial()
  .extend({ isActive: z.boolean().optional() })

export const openDoorSchema = z.object({
  intercomId: z.string().cuid(),
})

export type CreateIntercomDto = z.infer<typeof createIntercomSchema>
export type UpdateIntercomDto = z.infer<typeof updateIntercomSchema>
