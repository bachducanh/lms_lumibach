import { z } from 'zod';

export const AttachmentsQuerySchema = z.object({
  lessonId: z.string().min(1),
});
export type AttachmentsQuery = z.infer<typeof AttachmentsQuerySchema>;

export type AttachmentDTO = {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  size: number;
  createdAt: string;
};
