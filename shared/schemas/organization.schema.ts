import { z } from 'zod'

export const createOrganizationSchema = z.object({
  name:    z.string().min(2).max(200),
  inn:     z.string().regex(/^\d{10}$/, 'ИНН должен содержать 10 цифр').optional(),
  phone:   z.string().regex(/^\+7\d{10}$/).optional(),
  email:   z.string().email().optional(),
  address: z.string().max(500).optional(),
  logoUrl: z.string().url().optional(),
})

export const updateOrganizationSchema = createOrganizationSchema.partial().extend({
  isActive: z.boolean().optional(),
})

export type CreateOrganizationDto = z.infer<typeof createOrganizationSchema>
export type UpdateOrganizationDto = z.infer<typeof updateOrganizationSchema>
