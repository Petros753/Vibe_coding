import { z } from 'zod'

export const createComplexSchema = z.object({
  name: z.string().min(2).max(200),
  address: z.string().min(5).max(500),
  city: z.string().min(2).max(100).default('Москва'),
  description: z.string().max(1000).optional(),
})

export const createBuildingSchema = z.object({
  complexId: z.string().cuid(),
  name: z.string().min(1).max(100),
  address: z.string().max(500).optional(),
  floors: z.number().int().min(1).max(50).default(9),
})

export const createApartmentSchema = z.object({
  entranceId: z.string().cuid(),
  number: z.string().min(1).max(10),
  floor: z.number().int().min(1),
  area: z.number().positive().optional(),
  rooms: z.number().int().min(0).optional(),
})

export type CreateComplexDto = z.infer<typeof createComplexSchema>
export type CreateBuildingDto = z.infer<typeof createBuildingSchema>
export type CreateApartmentDto = z.infer<typeof createApartmentSchema>
