import { z } from 'zod'

export const markReadSchema = z.object({
  ids: z.array(z.string().cuid()).min(1).max(100),
})

export type MarkReadDto = z.infer<typeof markReadSchema>
