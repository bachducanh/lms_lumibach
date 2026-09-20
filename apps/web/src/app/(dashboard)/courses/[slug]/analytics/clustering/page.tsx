import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { hasMinRole } from '@/lib/permissions';
import { ChevronLeft } from 'lucide-react';
import type { UserRole } from '@lumibach/db';
import { ClusteringDataset } from '@/components/features/analytics/ClusteringDataset';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `Dữ liệu phân cụm · ${slug}` };
}

export default async function ClusteringPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!role || !hasMinRole(role, 'TA')) redirect(`/courses/${slug}`);

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <div>
        <Link
          href={`/courses/${slug}/analytics`}
          className="text-muted-foreground hover:text-primary mb-3 inline-flex items-center gap-1.5 text-sm transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Phân tích khoá học
        </Link>
        <div>
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
              Dữ liệu phân cụm học sinh
            </h1>
            <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
              Ma trận đặc trưng mỗi học sinh = 1 dòng. Xuất CSV/XLSX để xử lý phân cụm (K-Means,
              thuật toán tiến hoá…).
            </p>
          </div>
        </div>
      </div>

      <div className="border-border bg-card rounded-xl border p-4 shadow-sm sm:p-5">
        <ClusteringDataset courseSlug={slug} />
      </div>

      <p className="text-muted-foreground text-xs leading-relaxed">
        Lưu ý chuẩn bị dữ liệu: các cột điểm đã chuẩn hoá về [0,1]; cờ <code>has_*</code> phân biệt
        “chưa làm” với “0 điểm”. Trước khi chạy K-Means nên chuẩn hoá z-score toàn bộ cột số, xử lý
        giá trị thiếu và loại bỏ cột định danh (Mã HS, Họ tên, Email).
      </p>
    </div>
  );
}
