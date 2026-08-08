import { z } from 'zod'

export const VideoFileSchema = z.object({
  mediaId: z.string().optional(),
  name: z.string().min(1),
  extension: z.string(),
  path: z.string().min(1),
  url: z.string().url()
})

export const OpenVideoResultSchema = z.discriminatedUnion('canceled', [
  z.object({
    canceled: z.literal(true)
  }),
  z.object({
    canceled: z.literal(false),
    video: VideoFileSchema,
    playlist: z.array(VideoFileSchema),
    selectedIndex: z.number().int().nonnegative()
  })
])
