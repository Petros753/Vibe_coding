import { z } from 'zod'

export const createCameraSchema = z.object({
  name:       z.string().min(1).max(100),
  rtspUrl:    z.string().url().startsWith('rtsp://'),
  complexId:  z.string().cuid().optional(),
  buildingId: z.string().cuid().optional(),
  entranceId: z.string().cuid().optional(),
})

export const updateCameraSchema = createCameraSchema
  .omit({ complexId: true, buildingId: true, entranceId: true })
  .partial()
  .extend({ isActive: z.boolean().optional() })

export type CreateCameraDto = z.infer<typeof createCameraSchema>
export type UpdateCameraDto = z.infer<typeof updateCameraSchema>
