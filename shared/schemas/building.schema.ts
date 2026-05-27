import { z } from 'zod'

export const createEntranceSchema = z.object({
  buildingId: z.string().cuid(),
  number:     z.number().int().min(1).max(99),
})

export const createBuildingSchema = z.object({
  complexId: z.string().cuid(),
  name:      z.string().min(1).max(100),
  address:   z.string().max(500).optional(),
  floors:    z.number().int().min(1).max(100).default(9),
})

export const updateBuildingSchema = createBuildingSchema.omit({ complexId: true }).partial()

export type CreateBuildingDto  = z.infer<typeof createBuildingSchema>
export type UpdateBuildingDto  = z.infer<typeof updateBuildingSchema>
export type CreateEntranceDto  = z.infer<typeof createEntranceSchema>
