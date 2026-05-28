import { z } from 'zod'

export const createMeterSchema = z.object({
  apartmentId:   z.string().cuid(),
  type:          z.enum(['COLD_WATER','HOT_WATER','ELECTRICITY','GAS','HEAT']),
  serialNumber:  z.string().max(100).optional(),
  installDate:   z.string().datetime().optional(),
  nextCheckDate: z.string().datetime().optional(),
})

export const submitReadingSchema = z.object({
  value:    z.number().positive(),
  imageUrl: z.string().url().optional(),
  period:   z.string().regex(/^\d{4}-\d{2}$/, 'Формат: YYYY-MM'),
})

export type CreateMeterDto    = z.infer<typeof createMeterSchema>
export type SubmitReadingDto  = z.infer<typeof submitReadingSchema>
