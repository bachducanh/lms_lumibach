import { z } from 'zod';

// ── Category CRUD ──────────────────────────────────────────────

export const CreateCategoryBodySchema = z.object({
  name: z.string().min(1, 'Tên danh mục không được trống').max(100),
  description: z.string().max(1000).optional(),
  parentId: z.string().min(1).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});
export type CreateCategoryBody = z.infer<typeof CreateCategoryBodySchema>;

export const UpdateCategoryBodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  parentId: z.string().min(1).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});
export type UpdateCategoryBody = z.infer<typeof UpdateCategoryBodySchema>;

// ── Query ──────────────────────────────────────────────────────

export const CategoriesQuerySchema = z.object({
  parentId: z.union([z.string().min(1), z.literal('null'), z.literal('')]).optional(),
  includeDeleted: z
    .union([z.boolean(), z.string().transform((v) => v === 'true')])
    .optional()
    .default(false),
});
export type CategoriesQuery = z.infer<typeof CategoriesQuerySchema>;

// ── Response types ─────────────────────────────────────────────

export type CategorySummary = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
};

export type CategoryBreadcrumb = {
  id: string;
  name: string;
  slug: string;
}[];

export type CategoryListItem = CategorySummary & {
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  _count: {
    children: number;
    courses: number;
  };
};

export type CategoryTreeNode = CategoryListItem & {
  children: CategoryTreeNode[];
};

export type CategoryDetail = CategoryListItem & {
  breadcrumb: CategoryBreadcrumb;
  children: CategoryListItem[];
};
