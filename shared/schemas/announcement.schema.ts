import { z } from 'zod'

export const createAnnouncementSchema = z.object({
  title:    z.string().min(3).max(200),
  body:     z.string().min(10).max(5000),
  imageUrl: z.string().url().optional(),
  isPinned: z.boolean().default(false),
})

export const updateAnnouncementSchema = createAnnouncementSchema.partial().extend({
  status: z.enum(['DRAFT', 'ARCHIVED']).optional(),
})

export type CreateAnnouncementDto = z.infer<typeof createAnnouncementSchema>
export type UpdateAnnouncementDto = z.infer<typeof updateAnnouncementSchema>
