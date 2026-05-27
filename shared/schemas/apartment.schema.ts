import { z } from 'zod'

export const createApartmentSchema = z.object({
  entranceId: z.string().cuid(),
  number:     z.string().min(1).max(10),
  floor:      z.number().int().min(1),
  area:       z.number().positive().optional(),
  rooms:      z.number().int().min(0).max(20).optional(),
})

export const updateApartmentSchema = createApartmentSchema.omit({ entranceId: true }).partial()

export type CreateApartmentDto = z.infer<typeof createApartmentSchema>
export type UpdateApartmentDto = z.infer<typeof updateApartmentSchema>
