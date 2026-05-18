import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaClient } from '@lumibach/db';
import type {
  CategoriesQuery,
  CategoryBreadcrumb,
  CategoryDetail,
  CategoryListItem,
  CategoryTreeNode,
  CreateCategoryBody,
  UpdateCategoryBody,
} from '@lumibach/types';
import type { AuthUser } from '../../common/auth/auth.types';
import { AuditService } from '../../common/audit/audit.service';

const TREE_CACHE_KEY = 'categories:tree';
const TREE_CACHE_TTL_MS = 600_000;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

const LIST_SELECT = {
  id: true,
  name: true,
  slug: true,
  parentId: true,
  description: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: { children: { where: { deletedAt: null } }, courses: { where: { deletedAt: null } } },
  },
} as const;

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaClient,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly audit: AuditService
  ) {}

  // ── Public reads (any authenticated user) ────────────────────

  async listCategories(params: CategoriesQuery): Promise<CategoryListItem[]> {
    const { parentId, includeDeleted } = params;
    const parentFilter =
      parentId === undefined
        ? {}
        : parentId === 'null' || parentId === ''
          ? { parentId: null }
          : { parentId };

    const rows = await this.prisma.courseCategory.findMany({
      where: {
        ...parentFilter,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: LIST_SELECT,
    });

    return rows.map(this.toListItem);
  }

  async getCategoryById(id: string): Promise<CategoryDetail> {
    const row = await this.prisma.courseCategory.findFirst({
      where: { id, deletedAt: null },
      select: LIST_SELECT,
    });
    if (!row) throw new NotFoundException('Danh mục không tồn tại');

    const [breadcrumb, children] = await Promise.all([
      this.buildBreadcrumb(row.id),
      this.prisma.courseCategory.findMany({
        where: { parentId: row.id, deletedAt: null },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: LIST_SELECT,
      }),
    ]);

    return {
      ...this.toListItem(row),
      breadcrumb,
      children: children.map(this.toListItem),
    };
  }

  async getTree(): Promise<CategoryTreeNode[]> {
    if (process.env.NODE_ENV !== 'test') {
      const cached = await this.cache.get<CategoryTreeNode[]>(TREE_CACHE_KEY);
      if (cached) return cached;
    }

    const rows = await this.prisma.courseCategory.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: LIST_SELECT,
    });

    const byParent = new Map<string | null, CategoryListItem[]>();
    for (const row of rows) {
      const item = this.toListItem(row);
      const key = item.parentId;
      const bucket = byParent.get(key);
      if (bucket) bucket.push(item);
      else byParent.set(key, [item]);
    }

    const build = (parentId: string | null): CategoryTreeNode[] =>
      (byParent.get(parentId) ?? []).map((item) => ({
        ...item,
        children: build(item.id),
      }));

    const tree = build(null);

    if (process.env.NODE_ENV !== 'test') {
      await this.cache.set(TREE_CACHE_KEY, tree, TREE_CACHE_TTL_MS);
    }
    return tree;
  }

  // ── Admin writes ─────────────────────────────────────────────

  async createCategory(actor: AuthUser, body: CreateCategoryBody): Promise<CategoryListItem> {
    this.assertAdmin(actor);

    const parentId = body.parentId ?? null;
    if (parentId) {
      const parent = await this.prisma.courseCategory.findFirst({
        where: { id: parentId, deletedAt: null },
        select: { id: true },
      });
      if (!parent) throw new BadRequestException('Danh mục cha không tồn tại');
    }

    const slug = await this.uniqueSlugForParent(body.name, parentId);

    const created = await this.prisma.courseCategory.create({
      data: {
        name: body.name.trim(),
        slug,
        description: body.description?.trim() || null,
        parentId,
        sortOrder: body.sortOrder ?? 0,
      },
      select: LIST_SELECT,
    });

    await this.invalidateTree();
    this.audit.log({
      userId: actor.id,
      userRole: actor.role,
      action: 'CATEGORY_CREATE',
      resource: 'CourseCategory',
      resourceId: created.id,
      changes: { name: body.name, parentId },
    });

    return this.toListItem(created);
  }

  async updateCategory(
    actor: AuthUser,
    id: string,
    body: UpdateCategoryBody
  ): Promise<CategoryListItem> {
    this.assertAdmin(actor);

    const existing = await this.prisma.courseCategory.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Danh mục không tồn tại');

    const nextParentId = body.parentId === undefined ? existing.parentId : body.parentId;

    if (nextParentId !== existing.parentId) {
      if (nextParentId === id) {
        throw new BadRequestException('Danh mục không thể là cha của chính nó');
      }
      if (nextParentId) {
        const parent = await this.prisma.courseCategory.findFirst({
          where: { id: nextParentId, deletedAt: null },
          select: { id: true },
        });
        if (!parent) throw new BadRequestException('Danh mục cha không tồn tại');

        if (await this.isDescendantOf(nextParentId, id)) {
          throw new BadRequestException('Không thể di chuyển danh mục vào chính con cháu của nó');
        }
      }
    }

    const nextName = body.name?.trim() ?? existing.name;
    const nameChanged = body.name !== undefined && body.name.trim() !== existing.name;
    const parentChanged = nextParentId !== existing.parentId;

    let nextSlug = existing.slug;
    if (nameChanged || parentChanged) {
      nextSlug = await this.uniqueSlugForParent(nextName, nextParentId, id);
    }

    const updated = await this.prisma.courseCategory.update({
      where: { id },
      data: {
        name: nextName,
        slug: nextSlug,
        description: body.description === undefined ? undefined : body.description?.trim() || null,
        parentId: nextParentId,
        sortOrder: body.sortOrder ?? undefined,
      },
      select: LIST_SELECT,
    });

    await this.invalidateTree();
    this.audit.log({
      userId: actor.id,
      userRole: actor.role,
      action: 'CATEGORY_UPDATE',
      resource: 'CourseCategory',
      resourceId: id,
      changes: { name: body.name, parentId: nextParentId },
    });

    return this.toListItem(updated);
  }

  async deleteCategory(actor: AuthUser, id: string): Promise<void> {
    this.assertAdmin(actor);

    const existing = await this.prisma.courseCategory.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: {
          select: {
            children: { where: { deletedAt: null } },
            courses: { where: { deletedAt: null } },
          },
        },
      },
    });
    if (!existing) throw new NotFoundException('Danh mục không tồn tại');

    if (existing._count.children > 0) {
      throw new ConflictException('Danh mục còn chứa danh mục con, không thể xoá');
    }
    if (existing._count.courses > 0) {
      throw new ConflictException('Danh mục còn chứa khoá học, không thể xoá');
    }

    await this.prisma.courseCategory.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.invalidateTree();
    this.audit.log({
      userId: actor.id,
      userRole: actor.role,
      action: 'CATEGORY_DELETE',
      resource: 'CourseCategory',
      resourceId: id,
    });
  }

  // ── Helpers ──────────────────────────────────────────────────

  /**
   * Validate categoryId is a leaf (no children) and not deleted.
   * Dùng cho CoursesService khi tạo/update course.
   */
  async assertLeafCategory(categoryId: string): Promise<void> {
    const cat = await this.prisma.courseCategory.findFirst({
      where: { id: categoryId, deletedAt: null },
      include: {
        _count: { select: { children: { where: { deletedAt: null } } } },
      },
    });
    if (!cat) throw new BadRequestException('Danh mục không tồn tại');
    if (cat._count.children > 0) {
      throw new BadRequestException(
        'Khoá học phải gắn vào danh mục cấp lá (không có danh mục con)'
      );
    }
  }

  /**
   * Trả về tất cả id descendant của một category (bao gồm chính nó),
   * dùng để filter courses theo category subtree.
   */
  async getDescendantIds(rootId: string): Promise<string[]> {
    const result: string[] = [rootId];
    const queue: string[] = [rootId];
    while (queue.length > 0) {
      const batch = queue.splice(0, queue.length);
      const children = await this.prisma.courseCategory.findMany({
        where: { parentId: { in: batch }, deletedAt: null },
        select: { id: true },
      });
      for (const c of children) {
        result.push(c.id);
        queue.push(c.id);
      }
    }
    return result;
  }

  async buildBreadcrumb(categoryId: string): Promise<CategoryBreadcrumb> {
    const chain: CategoryBreadcrumb = [];
    let cursor: string | null = categoryId;
    let safety = 0;
    while (cursor && safety < 50) {
      const node: { id: string; name: string; slug: string; parentId: string | null } | null =
        await this.prisma.courseCategory.findUnique({
          where: { id: cursor },
          select: { id: true, name: true, slug: true, parentId: true },
        });
      if (!node) break;
      chain.unshift({ id: node.id, name: node.name, slug: node.slug });
      cursor = node.parentId;
      safety++;
    }
    return chain;
  }

  private async invalidateTree(): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;
    await this.cache.del(TREE_CACHE_KEY);
  }

  private assertAdmin(actor: AuthUser): void {
    if (actor.role !== 'ADMIN') {
      throw new ForbiddenException('Chỉ ADMIN mới được quản lý danh mục');
    }
  }

  private async isDescendantOf(candidateId: string, ancestorId: string): Promise<boolean> {
    let cursor: string | null = candidateId;
    let safety = 0;
    while (cursor && safety < 50) {
      const node: { parentId: string | null } | null = await this.prisma.courseCategory.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
      if (!node) return false;
      if (node.parentId === ancestorId) return true;
      cursor = node.parentId;
      safety++;
    }
    return false;
  }

  private async uniqueSlugForParent(
    name: string,
    parentId: string | null,
    excludeId?: string
  ): Promise<string> {
    const base = slugify(name);
    if (!base) throw new BadRequestException('Tên danh mục không hợp lệ');

    let slug = base;
    let attempt = 0;
    while (
      await this.prisma.courseCategory.findFirst({
        where: {
          parentId,
          slug,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true },
      })
    ) {
      attempt++;
      slug = `${base}-${attempt}`;
    }
    return slug;
  }

  private toListItem = (row: {
    id: string;
    name: string;
    slug: string;
    parentId: string | null;
    description: string | null;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
    _count: { children: number; courses: number };
  }): CategoryListItem => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    parentId: row.parentId,
    description: row.description,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    _count: row._count,
  });
}
